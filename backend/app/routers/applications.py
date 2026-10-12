"""Admin-only endpoints for reviewing startup applications."""
import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import CurrentUser, get_current_user, get_db, require_canvas_editor
from app.schemas import AddToWorkspaceBody, ApplicationResponse, ApplicationStatusUpdate
from app.services.projects import seed_flow_cells

router = APIRouter(tags=["applications"])

_VALID_STATUSES = {"submitted", "reviewing", "added", "rejected"}


@router.get("/applications", response_model=list[ApplicationResponse])
async def list_applications(
    _user: CurrentUser = Depends(require_canvas_editor),
    db: asyncpg.Pool = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT * FROM startup_applications ORDER BY created_at DESC"""
    )
    return [dict(r) for r in rows]


@router.get("/applications/{app_id}", response_model=ApplicationResponse)
async def get_application(
    app_id: str,
    _user: CurrentUser = Depends(require_canvas_editor),
    db: asyncpg.Pool = Depends(get_db),
):
    row = await db.fetchrow(
        "SELECT * FROM startup_applications WHERE id = $1", app_id
    )
    if not row:
        raise HTTPException(404, "Application not found")
    return dict(row)


@router.patch("/applications/{app_id}/status")
async def update_application_status(
    app_id: str,
    body: ApplicationStatusUpdate,
    user: CurrentUser = Depends(require_canvas_editor),
    db: asyncpg.Pool = Depends(get_db),
):
    if body.status not in _VALID_STATUSES:
        raise HTTPException(400, f"status must be one of {_VALID_STATUSES}")
    result = await db.execute(
        """UPDATE startup_applications
           SET status = $1, reviewed_by = $2, reviewed_at = now()
           WHERE id = $3""",
        body.status, user.id, app_id,
    )
    if result == "UPDATE 0":
        raise HTTPException(404, "Application not found")
    return {"ok": True}


@router.post("/applications/{app_id}/add-to-workspace")
async def add_application_to_workspace(
    app_id: str,
    body: AddToWorkspaceBody,
    user: CurrentUser = Depends(require_canvas_editor),
    db: asyncpg.Pool = Depends(get_db),
):
    app = await db.fetchrow(
        "SELECT * FROM startup_applications WHERE id = $1", app_id
    )
    if not app:
        raise HTTPException(404, "Application not found")
    if app["status"] == "added":
        raise HTTPException(400, "Already added to a workspace")

    workspace = await db.fetchrow(
        "SELECT id FROM workspaces WHERE id = $1", str(body.workspace_id)
    )
    if not workspace:
        raise HTTPException(404, "Workspace not found")

    async with db.acquire() as conn:
        async with conn.transaction():
            project = await conn.fetchrow(
                """INSERT INTO projects (startup_name, sector, stage, created_by, workspace_id)
                   VALUES ($1, $2, $3, $4, $5)
                   RETURNING id, startup_name, sector, stage, status, created_at""",
                app["startup_name"], app["sector"], app["stage"],
                user.id, str(body.workspace_id),
            )
            await conn.execute(
                """INSERT INTO project_members (project_id, user_id, role, added_by)
                   VALUES ($1, $2, 'admin', $2)""",
                project["id"], user.id,
            )
            await conn.execute(
                """UPDATE startup_applications
                   SET status = 'added', workspace_id = $1, project_id = $2,
                       reviewed_by = $3, reviewed_at = now()
                   WHERE id = $4""",
                str(body.workspace_id), project["id"], user.id, app_id,
            )
            await seed_flow_cells(conn, str(project["id"]))

    return {"project_id": str(project["id"]), "workspace_id": str(body.workspace_id)}
