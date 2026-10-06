"""
Tests: asset analysis cache storage.
"""
import asyncpg

from app.services import asset_analysis as analysis_svc


# ── helpers ───────────────────────────────────────────────

async def _setup(db: asyncpg.Pool, investor: dict) -> tuple[str, str]:
    """Returns (project_id, asset_id)."""
    pid = str(await db.fetchval(
        "INSERT INTO projects(startup_name,created_by) VALUES('AnalysisCo',$1) RETURNING id",
        investor["id"],
    ))
    aid = str(await db.fetchval(
        "INSERT INTO assets(project_id,kind,filename,storage_key) VALUES($1,'pdf','doc.pdf','key') RETURNING id",
        pid,
    ))
    return pid, aid


# ── tests ─────────────────────────────────────────────────

async def test_store_analysis_sets_status_ready(db: asyncpg.Pool, investor: dict):
    _, aid = await _setup(db, investor)
    await analysis_svc.store_analysis(db, aid, {"entities": [], "summary": "Solid team.", "topics": ["AI"]})
    row = await db.fetchrow("SELECT status FROM assets WHERE id=$1", aid)
    assert row["status"] == "ready"


async def test_store_analysis_stores_json_cache(db: asyncpg.Pool, investor: dict):
    _, aid = await _setup(db, investor)
    await analysis_svc.store_analysis(
        db, aid,
        {"entities": ["Alice"], "summary": "Strong fundamentals.", "topics": ["fintech", "B2B"]},
    )
    row = await db.fetchrow("SELECT analysis_cache FROM assets WHERE id=$1", aid)
    assert row["analysis_cache"]["summary"] == "Strong fundamentals."
    assert "fintech" in row["analysis_cache"]["topics"]


async def test_store_analysis_sets_processed_at(db: asyncpg.Pool, investor: dict):
    _, aid = await _setup(db, investor)
    await analysis_svc.store_analysis(db, aid, {"entities": [], "summary": "...", "topics": []})
    row = await db.fetchrow("SELECT processed_at FROM assets WHERE id=$1", aid)
    assert row["processed_at"] is not None


async def test_store_analysis_overwrites_previous(db: asyncpg.Pool, investor: dict):
    _, aid = await _setup(db, investor)
    await analysis_svc.store_analysis(db, aid, {"entities": [], "summary": "First.", "topics": []})
    await analysis_svc.store_analysis(db, aid, {"entities": [], "summary": "Second.", "topics": []})
    row = await db.fetchrow("SELECT analysis_cache FROM assets WHERE id=$1", aid)
    assert row["analysis_cache"]["summary"] == "Second."
