from __future__ import annotations
import asyncpg


async def list_for_user(db: asyncpg.Pool, user_id: str) -> list[asyncpg.Record]:
    rows = await db.fetch(
        """
        SELECT p.id, p.startup_name, p.sector, p.stage, p.status, p.created_at
        FROM projects p
        JOIN project_members pm ON pm.project_id = p.id
        WHERE pm.user_id = $1
        ORDER BY p.created_at DESC
        """,
        user_id,
    )
    return [dict(r) for r in rows]


async def create(
    db: asyncpg.Pool,
    startup_name: str,
    sector: str | None,
    stage: str | None,
    created_by: str,
) -> asyncpg.Record:
    async with db.acquire() as conn:
        async with conn.transaction():
            project = await conn.fetchrow(
                """
                INSERT INTO projects (startup_name, sector, stage, created_by)
                VALUES ($1, $2, $3, $4)
                RETURNING id, startup_name, sector, stage, status, created_at
                """,
                startup_name, sector, stage, created_by,
            )
            # Creator is added as a reviewer so GET /projects returns it immediately
            await conn.execute(
                """
                INSERT INTO project_members (project_id, user_id, role, added_by)
                VALUES ($1, $2, 'reviewer', $2)
                """,
                project["id"], created_by,
            )
    return dict(project)
