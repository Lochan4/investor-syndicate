import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import CurrentUser, get_current_user, get_arq, get_db
from app.schemas import ProjectCreate, ProjectResponse
from app.services import projects as svc

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectResponse])
async def list_projects(
    user: CurrentUser = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    return await svc.list_for_user(db, user.id)


@router.get("/investments")
async def list_investments(
    user: CurrentUser = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    """Returns all projects the current user is a member of."""
    rows = await db.fetch(
        """SELECT p.id, p.startup_name, p.sector, p.stage, p.status, p.created_at, pm.role
           FROM projects p
           JOIN project_members pm ON pm.project_id = p.id
           WHERE pm.user_id = $1
           ORDER BY p.created_at DESC""",
        user.id,
    )
    return [dict(r) for r in rows]


@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(
    body: ProjectCreate,
    user: CurrentUser = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    return await svc.create(db, body.startup_name, body.sector, body.stage, user.id)


@router.get("/{project_id}")
async def get_project(
    project_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    row = await db.fetchrow("SELECT * FROM projects WHERE id=$1", project_id)
    if not row:
        raise HTTPException(404, "Project not found")
    return dict(row)


@router.post("/{project_id}/competitive-scan")
async def trigger_competitive_scan(
    project_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
    arq=Depends(get_arq),
):
    """Enqueue a competitive intelligence scan for this project."""
    row = await db.fetchrow("SELECT id FROM projects WHERE id=$1", project_id)
    if not row:
        raise HTTPException(404, "Project not found")
    await arq.enqueue_job("run_competitive_scan", project_id)
    return {"queued": True}
