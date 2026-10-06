from __future__ import annotations

import asyncpg
from fastapi import APIRouter, Depends

from app.dependencies import CurrentUser, get_arq, get_current_user, get_db

router = APIRouter(prefix="/projects/{project_id}/analyses", tags=["analyses"])


@router.get("")
async def list_analyses(
    project_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    rows = await db.fetch(
        "SELECT * FROM analyses WHERE project_id=$1 ORDER BY created_at", project_id
    )
    return [dict(r) for r in rows]


@router.post("/cells/{cell_id}/analyse")
async def trigger_cell_analysis(
    project_id: str,
    cell_id: str,
    user: CurrentUser = Depends(get_current_user),
    arq=Depends(get_arq),
):
    await arq.enqueue_job("build_cell_views", project_id, cell_id)
    return {"queued": True}
