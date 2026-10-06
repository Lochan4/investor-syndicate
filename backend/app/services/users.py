from __future__ import annotations
import asyncpg


async def get_by_id(db: asyncpg.Pool, user_id: str) -> asyncpg.Record | None:
    return await db.fetchrow(
        "SELECT id, email, platform_role, status FROM users WHERE id = $1", user_id
    )


async def upsert_from_workos(
    db: asyncpg.Pool, workos_user_id: str, email: str
) -> None:
    """Inserts a user row on first WorkOS login. No-op if already exists."""
    await db.execute(
        """
        INSERT INTO users (id, email, platform_role)
        VALUES ($1, $2, 'investor')
        ON CONFLICT (id) DO NOTHING
        """,
        workos_user_id, email,
    )
