"""
Tests: entity extraction storage (entities table + chunk_mentions).
Services exercised directly.
"""
import asyncpg

from app.services import ner as ner_svc


# ── helpers ───────────────────────────────────────────────

async def _setup(db: asyncpg.Pool, investor: dict) -> tuple[str, str]:
    """Returns (project_id, chunk_id)."""
    pid = str(await db.fetchval(
        "INSERT INTO projects(startup_name,created_by) VALUES('NERCo',$1) RETURNING id",
        investor["id"],
    ))
    aid = str(await db.fetchval(
        "INSERT INTO assets(project_id,kind,filename,storage_key) VALUES($1,'pdf','doc.pdf','k') RETURNING id",
        pid,
    ))
    cid = str(await db.fetchval(
        "INSERT INTO chunks(asset_id,project_id,text,chunk_index) VALUES($1,$2,'some text',0) RETURNING id",
        aid, pid,
    ))
    return pid, cid


# ── tests ─────────────────────────────────────────────────

async def test_store_entities_inserts_entity_row(db: asyncpg.Pool, investor: dict):
    pid, cid = await _setup(db, investor)
    await ner_svc.store_entities(db, pid, cid, [{"name": "John Doe", "kind": "person"}])
    row = await db.fetchrow(
        "SELECT name, kind FROM entities WHERE project_id=$1 AND name='John Doe'", pid
    )
    assert row is not None
    assert row["kind"] == "person"


async def test_store_entities_creates_chunk_mention(db: asyncpg.Pool, investor: dict):
    pid, cid = await _setup(db, investor)
    await ner_svc.store_entities(db, pid, cid, [{"name": "Acme Corp", "kind": "company"}])
    row = await db.fetchrow(
        """
        SELECT cm.chunk_id FROM chunk_mentions cm
        JOIN entities e ON e.id = cm.entity_id
        WHERE cm.chunk_id = $1 AND e.name = 'Acme Corp'
        """,
        cid,
    )
    assert row is not None


async def test_store_entities_upsert_no_duplicate(db: asyncpg.Pool, investor: dict):
    pid, cid = await _setup(db, investor)
    await ner_svc.store_entities(db, pid, cid, [{"name": "CEO", "kind": "person"}])
    await ner_svc.store_entities(db, pid, cid, [{"name": "CEO", "kind": "person"}])
    count = await db.fetchval(
        "SELECT COUNT(*) FROM entities WHERE project_id=$1 AND name='CEO'", pid
    )
    assert count == 1


async def test_store_entities_multiple_entities(db: asyncpg.Pool, investor: dict):
    pid, cid = await _setup(db, investor)
    entities = [
        {"name": "Alice", "kind": "person"},
        {"name": "TechCorp", "kind": "company"},
        {"name": "$5M Series A", "kind": "metric"},
    ]
    await ner_svc.store_entities(db, pid, cid, entities)
    entity_count = await db.fetchval(
        "SELECT COUNT(*) FROM entities WHERE project_id=$1", pid
    )
    mention_count = await db.fetchval(
        "SELECT COUNT(*) FROM chunk_mentions WHERE chunk_id=$1", cid
    )
    assert entity_count == 3
    assert mention_count == 3


async def test_store_entities_empty_list_is_no_op(db: asyncpg.Pool, investor: dict):
    pid, cid = await _setup(db, investor)
    await ner_svc.store_entities(db, pid, cid, [])
    count = await db.fetchval(
        "SELECT COUNT(*) FROM entities WHERE project_id=$1", pid
    )
    assert count == 0
