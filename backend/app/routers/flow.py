from __future__ import annotations

import json
import uuid

import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dependencies import CurrentUser, get_current_user, get_db, require_canvas_editor
from app.services import notifications as notif_svc, storage
from app.services.extractors.pdf import extract as extract_pdf_text
from app.services.llm import get_async_client

router = APIRouter(tags=["flow"])


# ── Per-project flow ──────────────────────────────────────

@router.get("/projects/{project_id}/flow/cells")
async def list_flow_cells(
    project_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    rows = await db.fetch(
        "SELECT * FROM flow_cells WHERE project_id=$1 ORDER BY created_at", project_id
    )
    edges = await db.fetch(
        "SELECT * FROM flow_edges WHERE project_id=$1", project_id
    )
    return {"cells": [dict(r) for r in rows], "edges": [dict(r) for r in edges]}


class FlowCellBody(BaseModel):
    topic: str
    prompt: str
    position_x: float = 0.0
    position_y: float = 0.0


@router.post("/projects/{project_id}/flow/cells", status_code=201)
async def create_flow_cell(
    project_id: str,
    body: FlowCellBody,
    user: CurrentUser = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    row = await db.fetchrow(
        """INSERT INTO flow_cells(project_id, topic, prompt, position_x, position_y)
           VALUES($1,$2,$3,$4,$5) RETURNING *""",
        project_id, body.topic, body.prompt, body.position_x, body.position_y,
    )
    return dict(row)


class EdgeBody(BaseModel):
    from_cell: str
    to_cell: str


@router.post("/projects/{project_id}/flow/edges", status_code=201)
async def create_flow_edge(
    project_id: str,
    body: EdgeBody,
    user: CurrentUser = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    row = await db.fetchrow(
        """INSERT INTO flow_edges(project_id, from_cell, to_cell)
           VALUES($1,$2,$3)
           ON CONFLICT (project_id, from_cell, to_cell) DO NOTHING
           RETURNING *""",
        project_id, body.from_cell, body.to_cell,
    )
    return dict(row) if row else {"ok": True}


@router.delete("/projects/{project_id}/flow/edges/{edge_id}")
async def delete_flow_edge(
    project_id: str,
    edge_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    await db.execute(
        "DELETE FROM flow_edges WHERE id=$1 AND project_id=$2", edge_id, project_id
    )
    return {"ok": True}


@router.post("/projects/{project_id}/flow/open")
async def open_flow(
    project_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    """Copy live template cells to per-project flow_cells, set project status=open."""
    version = await db.fetchrow(
        "SELECT id FROM flow_template_versions WHERE status='live' ORDER BY version_num DESC LIMIT 1"
    )
    if not version:
        raise HTTPException(404, "No live flow template")

    template_cells = await db.fetch(
        "SELECT * FROM flow_template_cells WHERE version_id=$1 ORDER BY cell_order",
        str(version["id"]),
    )

    for i, tc in enumerate(template_cells):
        pos_x = float(tc["position_x"]) if tc["position_x"] else (i % 3) * 320.0 + 60.0
        pos_y = float(tc["position_y"]) if tc["position_y"] else (i // 3) * 220.0 + 60.0
        await db.execute(
            """INSERT INTO flow_cells(project_id, template_cell_id, topic, prompt, position_x, position_y, characteristics, policy_doc_ids)
               VALUES($1,$2,$3,$4,$5,$6,$7,$8)
               ON CONFLICT DO NOTHING""",
            project_id, str(tc["id"]), tc["topic"], tc["prompt"],
            pos_x, pos_y,
            json.dumps(tc["characteristics"] or []),
            list(tc["policy_doc_ids"] or []),
        )

    await db.execute("UPDATE projects SET status='open' WHERE id=$1", project_id)
    await notif_svc.notify_all_members(db, project_id, "graph_ready")
    return {"ok": True}


# ── Admin flow-template ───────────────────────────────────

@router.get("/admin/flow-template/versions")
async def list_template_versions(
    user: CurrentUser = Depends(require_canvas_editor),
    db: asyncpg.Pool = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT ftv.*, u.email AS published_by_email
           FROM flow_template_versions ftv
           LEFT JOIN users u ON u.id = ftv.published_by
           ORDER BY ftv.version_num DESC"""
    )
    return [dict(r) for r in rows]


@router.get("/admin/flow-template/cells/{version_id}")
async def list_template_cells(
    version_id: str,
    user: CurrentUser = Depends(require_canvas_editor),
    db: asyncpg.Pool = Depends(get_db),
):
    rows = await db.fetch(
        "SELECT * FROM flow_template_cells WHERE version_id=$1 ORDER BY cell_order",
        version_id,
    )
    return [dict(r) for r in rows]


class PolicyDocPatch(BaseModel):
    policy_doc_ids: list[str]


@router.patch("/admin/flow-template/cells/{cell_id}/policy-docs")
async def update_cell_policy_docs(
    cell_id: str,
    body: PolicyDocPatch,
    user: CurrentUser = Depends(require_canvas_editor),
    db: asyncpg.Pool = Depends(get_db),
):
    result = await db.execute(
        "UPDATE flow_template_cells SET policy_doc_ids=$1::uuid[] WHERE id=$2",
        body.policy_doc_ids, cell_id,
    )
    if result == "UPDATE 0":
        raise HTTPException(status_code=404, detail="Cell not found")
    return {"ok": True}


class Characteristic(BaseModel):
    name: str
    strength: int = 5  # 1-10


class TemplateCellBody(BaseModel):
    topic: str
    prompt: str
    position_x: float = 0.0
    position_y: float = 0.0
    cell_order: int = 0
    characteristics: list[Characteristic] = []
    policy_doc_ids: list[str] = []


class PublishBody(BaseModel):
    cells: list[TemplateCellBody]


@router.post("/admin/flow-template/publish", status_code=201)
async def publish_template(
    body: PublishBody,
    user: CurrentUser = Depends(require_canvas_editor),
    db: asyncpg.Pool = Depends(get_db),
):
    async with db.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                "UPDATE flow_template_versions SET status='archived' WHERE status='live'"
            )
            max_ver = await conn.fetchval(
                "SELECT COALESCE(MAX(version_num), 0) FROM flow_template_versions"
            )
            new_version = await conn.fetchrow(
                """INSERT INTO flow_template_versions(version_num, status, published_by, published_at)
                   VALUES($1,'live',$2,now()) RETURNING id, version_num""",
                max_ver + 1, user.id,
            )
            version_id = str(new_version["id"])
            for cell in body.cells:
                chars = json.dumps([c.model_dump() for c in cell.characteristics])
                doc_ids = [uuid.UUID(d) for d in cell.policy_doc_ids]
                await conn.execute(
                    """INSERT INTO flow_template_cells
                         (version_id, topic, prompt, position_x, position_y, cell_order, characteristics, policy_doc_ids)
                       VALUES($1,$2,$3,$4,$5,$6,$7,$8)""",
                    version_id, cell.topic, cell.prompt,
                    cell.position_x, cell.position_y, cell.cell_order, chars, doc_ids,
                )
    return {"version_id": version_id, "version_num": new_version["version_num"]}


@router.post("/admin/flow-template/versions/{version_id}/promote")
async def promote_version(
    version_id: str,
    user: CurrentUser = Depends(require_canvas_editor),
    db: asyncpg.Pool = Depends(get_db),
):
    """Archive the current live version and set the selected version as live."""
    async with db.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                "UPDATE flow_template_versions SET status='archived' WHERE status='live'"
            )
            result = await conn.execute(
                "UPDATE flow_template_versions SET status='live' WHERE id=$1", version_id
            )
    if result == "UPDATE 0":
        raise HTTPException(404, "Version not found")
    return {"ok": True}


# ── Canvas policy docs ────────────────────────────────────

@router.get("/admin/canvas-policy-docs")
async def list_policy_docs(
    user: CurrentUser = Depends(require_canvas_editor),
    db: asyncpg.Pool = Depends(get_db),
):
    rows = await db.fetch(
        "SELECT id, filename, storage_key, created_at FROM canvas_policy_docs ORDER BY created_at DESC"
    )
    return [dict(r) for r in rows]


class PolicyDocUploadRequest(BaseModel):
    filename: str


@router.post("/admin/canvas-policy-docs/upload-url")
async def get_policy_doc_upload_url(
    body: PolicyDocUploadRequest,
    user: CurrentUser = Depends(require_canvas_editor),
):
    key = f"canvas-policy/{uuid.uuid4()}/{body.filename}"
    url = storage.presigned_upload_url(key, content_type="application/pdf")
    return {"upload_url": url, "storage_key": key, "content_type": "application/pdf"}


class PolicyDocConfirmRequest(BaseModel):
    filename: str
    storage_key: str


@router.post("/admin/canvas-policy-docs/confirm", status_code=201)
async def confirm_policy_doc(
    body: PolicyDocConfirmRequest,
    user: CurrentUser = Depends(require_canvas_editor),
    db: asyncpg.Pool = Depends(get_db),
):
    # Download from R2 and extract text
    try:
        raw = storage.download_bytes(body.storage_key)
        text = extract_pdf_text(raw)
    except Exception as e:
        raise HTTPException(422, f"Failed to extract PDF text: {e}")

    row = await db.fetchrow(
        """INSERT INTO canvas_policy_docs(filename, storage_key, text_content, created_by)
           VALUES($1,$2,$3,$4) RETURNING id, filename, storage_key, created_at""",
        body.filename, body.storage_key, text, user.id,
    )
    return dict(row)


# ── Characteristics extraction ────────────────────────────

EXTRACT_PROMPT = """\
You are an investment evaluation system. Given the analysis prompt below, extract:
1. A short cell name (1-3 words, e.g. "Team", "Market Size", "Traction")
2. 3-6 key evaluation characteristics/criteria that this prompt is measuring

{policy_section}Return ONLY valid JSON in this exact shape:
{{"topic": "...", "characteristics": [{{"name": "...", "strength": 5}}]}}

Prompt:
{prompt}"""

POLICY_SECTION = """\
The following are our firm's investment policy guidelines. Use them to inform the characteristics you extract:

{docs}

"""


class ExtractBody(BaseModel):
    prompt: str
    policy_doc_ids: list[str] = []


@router.post("/admin/flow-template/extract-characteristics")
async def extract_characteristics(
    body: ExtractBody,
    user: CurrentUser = Depends(require_canvas_editor),
    db: asyncpg.Pool = Depends(get_db),
):
    if not body.prompt.strip():
        raise HTTPException(400, "Prompt is required")

    policy_section = ""
    if body.policy_doc_ids:
        doc_ids = [uuid.UUID(d) for d in body.policy_doc_ids]
        rows = await db.fetch(
            "SELECT text_content FROM canvas_policy_docs WHERE id = ANY($1)", doc_ids
        )
        if rows:
            combined = "\n\n---\n\n".join(r["text_content"] for r in rows if r["text_content"])
            # trim to avoid blowing token budget
            combined = combined[:8000]
            policy_section = POLICY_SECTION.format(docs=combined)

    prompt_text = EXTRACT_PROMPT.format(prompt=body.prompt, policy_section=policy_section)

    client = get_async_client()
    msg = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt_text}],
    )
    raw = msg.content[0].text.strip()
    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        cleaned = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        result = json.loads(cleaned)

    return result
