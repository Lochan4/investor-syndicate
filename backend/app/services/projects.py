from __future__ import annotations
import asyncpg


async def seed_flow_cells(conn: asyncpg.Connection, project_id: str) -> None:
    """Seed flow cells from the live template version. Idempotent — skips if cells exist."""
    existing = await conn.fetchval(
        "SELECT COUNT(*) FROM flow_cells WHERE project_id=$1", project_id
    )
    if existing:
        return
    version = await conn.fetchrow(
        "SELECT id FROM flow_template_versions WHERE status='live' ORDER BY version_num DESC LIMIT 1"
    )
    if not version:
        return
    template_cells = await conn.fetch(
        "SELECT * FROM flow_template_cells WHERE version_id=$1 ORDER BY cell_order",
        str(version["id"]),
    )
    COLS, COL_GAP, ROW_GAP, PAD = 3, 560.0, 300.0, 80.0
    for i, tc in enumerate(template_cells):
        await conn.execute(
            """INSERT INTO flow_cells(project_id, template_cell_id, topic, prompt,
                   position_x, position_y, characteristics, policy_doc_ids)
               VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING""",
            project_id, str(tc["id"]), tc["topic"], tc["prompt"],
            PAD + (i % COLS) * COL_GAP,
            PAD + (i // COLS) * ROW_GAP,
            tc["characteristics"] or [],
            list(tc["policy_doc_ids"] or []),
        )


async def list_for_user(db: asyncpg.Pool, user_id: str) -> list[asyncpg.Record]:
    rows = await db.fetch(
        """
        SELECT DISTINCT p.id, p.startup_name, p.sector, p.stage, p.status, p.created_at
        FROM projects p
        WHERE
          p.id IN (SELECT project_id FROM project_members WHERE user_id = $1)
          OR (p.workspace_id IS NOT NULL AND
              p.workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = $1))
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
                VALUES ($1, $2, 'admin', $2)
                """,
                project["id"], created_by,
            )
            await seed_flow_cells(conn, str(project["id"]))
    return dict(project)
