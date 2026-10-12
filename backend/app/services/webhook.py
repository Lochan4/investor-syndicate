from __future__ import annotations
import asyncpg
from app.services import users as users_service


async def handle_user_created(
    db: asyncpg.Pool, workos_user_id: str, email: str
) -> None:
    """
    Handles WorkOS user.created event:
    1. Creates users row (idempotent).
    2. Moves pending_invites for this email into project_members.
    3. Moves pending_workspace_invites into workspace_members.
    """
    await users_service.upsert_from_workos(db, workos_user_id, email)

    # Project-level invites
    pending = await db.fetch(
        "SELECT id, project_id, role FROM pending_invites WHERE email = $1 AND accepted_at IS NULL",
        email,
    )
    for invite in pending:
        await db.execute(
            """INSERT INTO project_members (project_id, user_id, role)
               VALUES ($1, $2, $3)
               ON CONFLICT (project_id, user_id) DO NOTHING""",
            invite["project_id"], workos_user_id, invite["role"],
        )
        await db.execute(
            "UPDATE pending_invites SET accepted_at = now() WHERE id = $1",
            invite["id"],
        )

    # Workspace-level invites
    ws_pending = await db.fetch(
        "SELECT id, workspace_id, role FROM pending_workspace_invites WHERE email = $1 AND accepted_at IS NULL",
        email,
    )
    for invite in ws_pending:
        await db.execute(
            """INSERT INTO workspace_members (workspace_id, user_id, role, added_by)
               VALUES ($1, $2, $3, $2)
               ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role""",
            invite["workspace_id"], workos_user_id, invite["role"],
        )
        await db.execute(
            "UPDATE pending_workspace_invites SET accepted_at = now() WHERE id = $1",
            invite["id"],
        )
