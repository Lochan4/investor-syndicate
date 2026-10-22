import asyncio
import json
import uuid

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

import asyncpg

from app.dependencies import CurrentUser, get_current_user, get_arq, get_db, require_canvas_editor
from app.schemas import AssetCreate, AssetResponse, UploadUrlRequest, UploadUrlResponse
from app.services import assets as svc
from app.services import storage

router = APIRouter(prefix="/projects/{project_id}/assets", tags=["assets"])


@router.get("", response_model=list[AssetResponse])
async def list_assets(
    project_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    return await svc.list_for_project(db, project_id)


@router.post("", response_model=AssetResponse, status_code=201)
async def create_asset(
    project_id: str,
    body: AssetCreate,
    user: CurrentUser = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    return await svc.create(db, project_id, body.filename, body.kind, body.storage_key, body.file_size_bytes)


@router.get("/{asset_id}/download-url")
async def get_download_url(
    project_id: str,
    asset_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    row = await db.fetchrow("SELECT storage_key FROM assets WHERE id=$1 AND project_id=$2", asset_id, project_id)
    if not row:
        from fastapi import HTTPException
        raise HTTPException(404, "Asset not found")
    url = storage.presigned_download_url(row["storage_key"])
    return {"url": url}


@router.post("/{asset_id}/confirm")
async def confirm_asset(
    project_id: str,
    asset_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
    arq=Depends(get_arq),
):
    await db.execute("UPDATE assets SET status='processing' WHERE id=$1", asset_id)
    await arq.enqueue_job("process_asset", asset_id)
    return {"queued": True}


@router.post("/{asset_id}/reanalyse")
async def reanalyse_asset(
    project_id: str,
    asset_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    """Re-run LLM analysis on existing chunks and update analysis_cache. No re-chunking."""
    from app.services import llm, asset_analysis as aa
    rows = await db.fetch(
        "SELECT text FROM chunks WHERE asset_id=$1 ORDER BY chunk_index", asset_id
    )
    if not rows:
        from fastapi import HTTPException
        raise HTTPException(404, "No chunks found — re-upload the asset")
    full_text = "\n".join(r["text"] for r in rows)
    analysis = await llm.analyse_asset(full_text)
    await aa.store_analysis(db, asset_id, analysis)
    return {"ok": True, "topics": analysis.get("topics", []), "entities": analysis.get("entities", [])}


@router.get("/graph")
async def get_asset_graph(
    project_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    chunk_rows = await db.fetch(
        """SELECT c.id, c.text, a.filename, a.kind, a.id as asset_id
           FROM chunks c
           JOIN assets a ON c.asset_id = a.id
           WHERE c.project_id = $1
           ORDER BY a.id, c.id
           LIMIT 500""",
        project_id,
    )
    if not chunk_rows:
        return {"nodes": [], "edges": []}

    chunk_id_strs = [str(r["id"]) for r in chunk_rows]
    edge_rows = await db.fetch(
        """SELECT from_chunk::text, to_chunk::text
           FROM chunk_edges
           WHERE from_chunk = ANY($1::uuid[]) AND to_chunk = ANY($1::uuid[])
           LIMIT 2000""",
        chunk_id_strs,
    )
    nodes = [
        {
            "id": str(r["id"]),
            "asset_id": str(r["asset_id"]),
            "asset_name": r["filename"],
            "kind": r["kind"],
            "preview": r["text"][:120] + ("…" if len(r["text"]) > 120 else ""),
        }
        for r in chunk_rows
    ]
    edges = [{"source": e["from_chunk"], "target": e["to_chunk"]} for e in edge_rows]
    return {"nodes": nodes, "edges": edges}


@router.get("/entity-graph")
async def get_entity_graph(
    project_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    """
    Concept-level knowledge graph built from analysis_cache.
    Structure: asset node → topic/entity child nodes (hub-and-spoke per document).
    """
    asset_rows = await db.fetch(
        """SELECT id, filename, kind, analysis_cache
           FROM assets
           WHERE project_id=$1 AND status='ready'
           ORDER BY created_at""",
        project_id,
    )
    if not asset_rows:
        return {"nodes": [], "edges": []}

    nodes: list[dict] = []
    edges: list[dict] = []
    seen_concept_ids: set[str] = set()

    for asset in asset_rows:
        asset_id = str(asset["id"])
        asset_node_id = f"asset-{asset_id}"
        nodes.append({
            "id": asset_node_id,
            "name": asset["filename"],
            "kind": asset["kind"],          # pdf | audio | image | spreadsheet
            "node_type": "asset",
        })

        cache = asset["analysis_cache"] or {}
        if isinstance(cache, str):
            try:
                cache = json.loads(cache)
            except Exception:
                cache = {}

        # Topic nodes — one per topic, shared across assets if identical
        for topic in (cache.get("topics") or []):
            concept_id = f"topic-{topic.lower().strip()}"
            if concept_id not in seen_concept_ids:
                seen_concept_ids.add(concept_id)
                nodes.append({
                    "id": concept_id,
                    "name": topic,
                    "kind": "topic",
                    "node_type": "concept",
                })
            edges.append({"source": asset_node_id, "target": concept_id, "weight": 1})

        # Entity nodes — cap at 10 per asset, shared across assets
        for entity in (cache.get("entities") or [])[:10]:
            concept_id = f"entity-{entity.lower().strip()}"
            if concept_id not in seen_concept_ids:
                seen_concept_ids.add(concept_id)
                nodes.append({
                    "id": concept_id,
                    "name": entity,
                    "kind": "entity",
                    "node_type": "concept",
                })
            edges.append({"source": asset_node_id, "target": concept_id, "weight": 1})

    return {"nodes": nodes, "edges": edges}


@router.get("/graph/stream")
async def stream_graph(
    project_id: str,
    cursor: int = Query(0),
    user: CurrentUser = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    """SSE stream of KG node/edge events as they are added during asset processing."""
    from app.services import cell_context

    async def generator():
        # 1. Send existing DB snapshot first (covers already-processed assets)
        chunk_rows = await db.fetch(
            """SELECT c.id, c.text, a.filename, a.kind, a.id AS asset_id
               FROM chunks c JOIN assets a ON c.asset_id = a.id
               WHERE c.project_id = $1 ORDER BY a.id, c.id LIMIT 500""",
            project_id,
        )
        nodes = [
            {"id": str(r["id"]), "asset_id": str(r["asset_id"]),
             "asset_name": r["filename"], "kind": r["kind"],
             "preview": r["text"][:120] + ("…" if len(r["text"]) > 120 else "")}
            for r in chunk_rows
        ]
        chunk_id_strs = [str(r["id"]) for r in chunk_rows]
        edges: list = []
        if chunk_id_strs:
            edge_rows = await db.fetch(
                """SELECT from_chunk::text, to_chunk::text FROM chunk_edges
                   WHERE from_chunk = ANY($1::uuid[]) LIMIT 2000""",
                chunk_id_strs,
            )
            edges = [{"source": e["from_chunk"], "target": e["to_chunk"]} for e in edge_rows]
        yield f"data: {json.dumps({'type': 'kg_snapshot', 'data': {'nodes': nodes, 'edges': edges}})}\n\n"

        # 2. Poll Redis for live events emitted by process_asset worker
        cur = cursor
        while True:
            events = await cell_context.pop_kg_events(project_id, cur)
            for ev in events:
                yield f"data: {json.dumps(ev)}\n\n"
                cur += 1
            await asyncio.sleep(0.5)

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.delete("/{asset_id}")
async def delete_asset(
    project_id: str,
    asset_id: str,
    user: CurrentUser = Depends(require_canvas_editor),
    db: asyncpg.Pool = Depends(get_db),
):
    await db.execute(
        "DELETE FROM assets WHERE id=$1 AND project_id=$2", asset_id, project_id
    )
    return {"ok": True}


@router.post("/upload-url", response_model=UploadUrlResponse)
async def get_upload_url(
    project_id: str,
    body: UploadUrlRequest,
    user: CurrentUser = Depends(get_current_user),
):
    key = f"{project_id}/{uuid.uuid4()}/{body.filename}"
    url = storage.presigned_upload_url(key, content_type=body.content_type)
    return {"upload_url": url, "storage_key": key, "content_type": body.content_type}
