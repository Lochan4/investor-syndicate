"""Per-asset analysis: store Claude-generated analysis_cache and mark asset ready."""
from __future__ import annotations
import asyncpg


async def store_analysis(db: asyncpg.Pool, asset_id: str, analysis: dict) -> None:
    """Write analysis_cache, set status='ready', stamp processed_at."""
    await db.execute(
        """
        UPDATE assets
        SET analysis_cache = $1,
            status         = $2,
            processed_at   = now()
        WHERE id = $3
        """,
        analysis, "ready", asset_id,
    )
