import os
import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import CurrentUser, get_current_user, get_db, require_canvas_editor
from app.schemas import ProjectCreate, ProjectResponse, WorkspaceCreate, WorkspaceMemberAdd, WorkspaceResponse
from app.services.workos import get_client as get_workos
from app.services.projects import seed_flow_cells

router = APIRouter(prefix="/workspaces", tags=["workspaces"])

_ADMIN_ROLES = {"super_admin", "admin"}


def _is_admin(user: CurrentUser) -> bool:
    return user.platform_role in _ADMIN_ROLES


async def _assert_member(db: asyncpg.Pool, workspace_id: str, user: CurrentUser) -> None:
    """Raises 403 if user is not an admin and not a workspace member."""
    if _is_admin(user):
        row = await db.fetchrow("SELECT id FROM workspaces WHERE id=$1", workspace_id)
        if not row:
            raise HTTPException(404, "Workspace not found")
        return
    row = await db.fetchrow(
        "SELECT role FROM workspace_members WHERE workspace_id=$1 AND user_id=$2",
        workspace_id, user.id,
    )
    if not row:
        raise HTTPException(403, "Not a member of this workspace")


# ── List ──────────────────────────────────────────────────

@router.get("", response_model=list[WorkspaceResponse])
async def list_workspaces(
    user: CurrentUser = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    if _is_admin(user):
        rows = await db.fetch("""
            SELECT w.id, w.name, w.description, w.created_by, w.created_at,
                   COUNT(wm.user_id)::int AS member_count
            FROM workspaces w
            LEFT JOIN workspace_members wm ON wm.workspace_id = w.id
            GROUP BY w.id ORDER BY w.created_at DESC
        """)
    else:
        rows = await db.fetch("""
            SELECT w.id, w.name, w.description, w.created_by, w.created_at,
                   COUNT(wm2.user_id)::int AS member_count
            FROM workspaces w
            JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = $1
            LEFT JOIN workspace_members wm2 ON wm2.workspace_id = w.id
            GROUP BY w.id ORDER BY w.created_at DESC
        """, user.id)
    return [dict(r) for r in rows]


# ── Create ────────────────────────────────────────────────

@router.post("", response_model=WorkspaceResponse, status_code=201)
async def create_workspace(
    body: WorkspaceCreate,
    user: CurrentUser = Depends(require_canvas_editor),
    db: asyncpg.Pool = Depends(get_db),
):
    async with db.acquire() as conn:
        async with conn.transaction():
            workspace = await conn.fetchrow(
                """INSERT INTO workspaces (name, description, created_by)
                   VALUES ($1, $2, $3)
                   RETURNING id, name, description, created_by, created_at""",
                body.name, body.description, user.id,
            )
            await conn.execute(
                """INSERT INTO workspace_members (workspace_id, user_id, role, added_by)
                   VALUES ($1, $2, 'owner', $2)""",
                workspace["id"], user.id,
            )
    return {**dict(workspace), "member_count": 1}


# ── Detail ────────────────────────────────────────────────

@router.get("/{workspace_id}")
async def get_workspace(
    workspace_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    await _assert_member(db, workspace_id, user)
    workspace = await db.fetchrow("SELECT * FROM workspaces WHERE id=$1", workspace_id)
    if not workspace:
        raise HTTPException(404, "Workspace not found")
    members = await db.fetch(
        """SELECT wm.user_id, u.email, wm.role, wm.added_at
           FROM workspace_members wm
           JOIN users u ON u.id = wm.user_id
           WHERE wm.workspace_id = $1
           ORDER BY wm.added_at""",
        workspace_id,
    )
    return {**dict(workspace), "members": [dict(m) for m in members]}


# ── Members ───────────────────────────────────────────────

@router.post("/{workspace_id}/members", status_code=201)
async def add_workspace_member(
    workspace_id: str,
    body: WorkspaceMemberAdd,
    user: CurrentUser = Depends(require_canvas_editor),
    db: asyncpg.Pool = Depends(get_db),
):
    workspace = await db.fetchrow("SELECT id FROM workspaces WHERE id=$1", workspace_id)
    if not workspace:
        raise HTTPException(404, "Workspace not found")
    member = await db.fetchrow("SELECT id FROM users WHERE email=$1", body.email)
    if not member:
        raise HTTPException(404, "User not found — they must sign in at least once first")
    await db.execute(
        """INSERT INTO workspace_members (workspace_id, user_id, role, added_by)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role""",
        workspace_id, member["id"], body.role, user.id,
    )
    return {"ok": True}


@router.post("/{workspace_id}/invite", status_code=201)
async def invite_workspace_member(
    workspace_id: str,
    body: WorkspaceMemberAdd,
    user: CurrentUser = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    """Send a workspace invite email. Works whether the invitee has an account or not."""
    await _assert_member(db, workspace_id, user)
    # Only owners (and platform admins) can invite
    if not _is_admin(user):
        row = await db.fetchrow(
            "SELECT role FROM workspace_members WHERE workspace_id=$1 AND user_id=$2",
            workspace_id, user.id,
        )
        if not row or row["role"] != "owner":
            raise HTTPException(403, "Only workspace owners can invite members")

    # If user already exists, add directly
    existing = await db.fetchrow("SELECT id FROM users WHERE email=$1", str(body.email))
    if existing:
        await db.execute(
            """INSERT INTO workspace_members (workspace_id, user_id, role, added_by)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role""",
            workspace_id, existing["id"], body.role, user.id,
        )
    else:
        await db.execute(
            """INSERT INTO pending_workspace_invites (email, workspace_id, role, invited_by)
               VALUES ($1, $2, $3, $4)""",
            str(body.email), workspace_id, body.role, user.id,
        )
        get_workos().user_management.send_invitation(
            email=str(body.email),
            organization_id=os.environ.get("WORKOS_ORG_ID"),
        )

    return {"ok": True}


@router.delete("/{workspace_id}/members/{member_user_id}")
async def remove_workspace_member(
    workspace_id: str,
    member_user_id: str,
    user: CurrentUser = Depends(require_canvas_editor),
    db: asyncpg.Pool = Depends(get_db),
):
    await db.execute(
        "DELETE FROM workspace_members WHERE workspace_id=$1 AND user_id=$2",
        workspace_id, member_user_id,
    )
    return {"ok": True}


# ── Projects scoped to workspace ──────────────────────────

@router.get("/{workspace_id}/projects", response_model=list[ProjectResponse])
async def list_workspace_projects(
    workspace_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    await _assert_member(db, workspace_id, user)
    rows = await db.fetch(
        """SELECT id, startup_name, sector, stage, status, created_at
           FROM projects WHERE workspace_id=$1 ORDER BY created_at DESC""",
        workspace_id,
    )
    return [dict(r) for r in rows]


@router.post("/{workspace_id}/projects", response_model=ProjectResponse, status_code=201)
async def create_workspace_project(
    workspace_id: str,
    body: ProjectCreate,
    user: CurrentUser = Depends(require_canvas_editor),
    db: asyncpg.Pool = Depends(get_db),
):
    workspace = await db.fetchrow("SELECT id FROM workspaces WHERE id=$1", workspace_id)
    if not workspace:
        raise HTTPException(404, "Workspace not found")
    async with db.acquire() as conn:
        async with conn.transaction():
            project = await conn.fetchrow(
                """INSERT INTO projects (startup_name, sector, stage, created_by, workspace_id)
                   VALUES ($1, $2, $3, $4, $5)
                   RETURNING id, startup_name, sector, stage, status, created_at""",
                body.startup_name, body.sector, body.stage, user.id, workspace_id,
            )
            await conn.execute(
                """INSERT INTO project_members (project_id, user_id, role, added_by)
                   VALUES ($1, $2, 'admin', $2)""",
                project["id"], user.id,
            )
            await seed_flow_cells(conn, str(project["id"]))
    return dict(project)
