"""Graph edge construction — NEXT and SIMILAR_TO edges via pgvector."""
from __future__ import annotations
import asyncpg


async def build_next_edges(db: asyncpg.Pool, asset_id: str) -> int:
    """Create NEXT edges for consecutive chunk pairs within an asset. Returns pair count."""
    rows = await db.fetch(
        "SELECT id, project_id FROM chunks WHERE asset_id=$1 ORDER BY chunk_index",
        asset_id,
    )
    if len(rows) < 2:
        return 0
    project_id = rows[0]["project_id"]
    pairs = [
        (str(project_id), str(rows[i]["id"]), str(rows[i + 1]["id"]))
        for i in range(len(rows) - 1)
    ]
    await db.executemany(
        """
        INSERT INTO chunk_edges(project_id, from_chunk, to_chunk, kind)
        VALUES($1, $2, $3, 'NEXT')
        ON CONFLICT (from_chunk, to_chunk, kind) DO NOTHING
        """,
        pairs,
    )
    return len(pairs)


async def build_similarity_edges(db: asyncpg.Pool, asset_id: str) -> int:
    """
    Create SIMILAR_TO edges for chunk pairs with cosine similarity > 0.82.
    Capped at 20 neighbors per source chunk.
    """
    rows = await db.fetch(
        """
        WITH ranked AS (
          SELECT
            a.id                                    AS from_chunk,
            b.id                                    AS to_chunk,
            a.project_id,
            1 - (a.embedding <=> b.embedding)       AS score,
            ROW_NUMBER() OVER (
              PARTITION BY a.id
              ORDER BY a.embedding <=> b.embedding
            )                                       AS rn
          FROM chunks a
          JOIN chunks b
            ON  b.project_id = a.project_id
            AND b.id != a.id
            AND b.embedding IS NOT NULL
          WHERE a.asset_id = $1
            AND a.embedding IS NOT NULL
            AND 1 - (a.embedding <=> b.embedding) > 0.82
        )
        SELECT from_chunk, to_chunk, score, project_id FROM ranked WHERE rn <= 20
        """,
        asset_id,
    )
    if not rows:
        return 0
    await db.executemany(
        """
        INSERT INTO chunk_edges(project_id, from_chunk, to_chunk, kind, score)
        VALUES($1, $2, $3, 'SIMILAR_TO', $4)
        ON CONFLICT (from_chunk, to_chunk, kind) DO NOTHING
        """,
        [(str(r["project_id"]), str(r["from_chunk"]), str(r["to_chunk"]), r["score"]) for r in rows],
    )
    return len(rows)


async def update_project_if_ready(db: asyncpg.Pool, project_id: str) -> bool:
    """
    Transition project → 'open' when every asset is 'ready'.
    Returns True if updated, False otherwise.
    """
    row = await db.fetchrow(
        """
        SELECT
          COUNT(*) FILTER (WHERE status != 'ready') AS unfinished,
          COUNT(*)                                   AS total
        FROM assets WHERE project_id = $1
        """,
        project_id,
    )
    if row["total"] > 0 and row["unfinished"] == 0:
        await db.execute("UPDATE projects SET status='open' WHERE id=$1", project_id)
        return True
    return False
