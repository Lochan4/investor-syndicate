from __future__ import annotations
import asyncpg
from app.services import users as users_service


async def handle_user_created(
    db: asyncpg.Pool, workos_user_id: str, email: str
) -> None:
    """
    Handles WorkOS user.created event:
    1. Creates users row (idempotent).
    2. Moves all pending_invites for this email into project_members.
    """
    await users_service.upsert_from_workos(db, workos_user_id, email)

    pending = await db.fetch(
        "SELECT id, project_id, role FROM pending_invites WHERE email = $1 AND accepted_at IS NULL",
        email,
    )

    for invite in pending:
        await db.execute(
            """
            INSERT INTO project_members (project_id, user_id, role)
            VALUES ($1, $2, $3)
            ON CONFLICT (project_id, user_id) DO NOTHING
            """,
            invite["project_id"], workos_user_id, invite["role"],
        )
        await db.execute(
            "UPDATE pending_invites SET accepted_at = now() WHERE id = $1",
            invite["id"],
        )
