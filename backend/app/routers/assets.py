import uuid

from fastapi import APIRouter, Depends

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
