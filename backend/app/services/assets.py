"""Asset CRUD — storage layer for the assets router."""
from __future__ import annotations
import asyncpg


async def list_for_project(db: asyncpg.Pool, project_id: str) -> list[dict]:
    rows = await db.fetch(
        """
        SELECT id, filename, kind, status, file_size_bytes,
               chunk_count, analysis_cache, created_at, processed_at
        FROM assets
        WHERE project_id = $1
        ORDER BY created_at
        """,
        project_id,
    )
    return [dict(r) for r in rows]


async def create(
    db: asyncpg.Pool,
    project_id: str,
    filename: str,
    kind: str,
    storage_key: str,
    file_size_bytes: int | None = None,
) -> dict:
    row = await db.fetchrow(
        """
        INSERT INTO assets(project_id, filename, kind, storage_key, file_size_bytes)
        VALUES($1, $2, $3, $4, $5)
        RETURNING id, filename, kind, status, file_size_bytes,
                  chunk_count, analysis_cache, created_at, processed_at
        """,
        project_id, filename, kind, storage_key, file_size_bytes,
    )
    return dict(row)
