import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import CurrentUser, get_current_user, get_arq, get_db, require_canvas_editor
from app.schemas import ProjectCreate, ProjectDecision, ProjectResponse
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


@router.get("/{project_id}/my-role")
async def get_my_project_role(
    project_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    """Returns the current user's role in this project, or their workspace role if applicable."""
    pm = await db.fetchrow(
        "SELECT role FROM project_members WHERE project_id=$1 AND user_id=$2",
        project_id, user.id,
    )
    if pm:
        return {"role": pm["role"]}
    # Check if workspace admin
    project = await db.fetchrow("SELECT workspace_id FROM projects WHERE id=$1", project_id)
    if project and project["workspace_id"]:
        wm = await db.fetchrow(
            "SELECT role FROM workspace_members WHERE workspace_id=$1 AND user_id=$2",
            project["workspace_id"], user.id,
        )
        if wm and wm["role"] == "owner":
            return {"role": "admin"}
    # Platform admins always get admin
    if user.platform_role in ("super_admin", "admin", "developer"):
        return {"role": "admin"}
    return {"role": "attendee"}


@router.get("/{project_id}/members")
async def list_project_members(
    project_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT pm.user_id, u.email, pm.role, pm.added_by, pm.notified_at
           FROM project_members pm
           JOIN users u ON u.id = pm.user_id
           WHERE pm.project_id = $1
           ORDER BY pm.notified_at NULLS LAST""",
        project_id,
    )
    return [dict(r) for r in rows]


@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    user: CurrentUser = Depends(require_canvas_editor),
    db: asyncpg.Pool = Depends(get_db),
):
    """Delete a project and all its data (assets, chunks, KG, flow cells, analyses).
    CASCADE handles all child tables automatically."""
    await db.execute("DELETE FROM notifications WHERE project_id=$1", project_id)
    result = await db.execute("DELETE FROM projects WHERE id=$1", project_id)
    if result == "DELETE 0":
        raise HTTPException(404, "Project not found")
    return {"ok": True}


@router.patch("/{project_id}/decision")
async def set_project_decision(
    project_id: str,
    body: ProjectDecision,
    user: CurrentUser = Depends(require_canvas_editor),
    db: asyncpg.Pool = Depends(get_db),
):
    result = await db.execute(
        """UPDATE projects
           SET is_investable=$1, decision_notes=$2, decided_by=$3, decided_at=now()
           WHERE id=$4""",
        body.is_investable, body.notes, user.id, project_id,
    )
    if result == "UPDATE 0":
        raise HTTPException(404, "Project not found")
    return {"ok": True}


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
