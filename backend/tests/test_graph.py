"""
Tests: graph edge construction (NEXT + SIMILAR_TO) and project status update.
Services exercised directly — no HTTP layer needed.
"""
import asyncpg

from app.services import graph as graph_svc


# ── helpers ───────────────────────────────────────────────

def _unit_vec(pos: int = 0) -> str:
    """1536-dim unit vector with 1.0 at position `pos`, zeros elsewhere."""
    return "[" + ",".join("1.0" if i == pos else "0.0" for i in range(1536)) + "]"


async def _make_project_asset(db: asyncpg.Pool, investor: dict) -> tuple[str, str]:
    pid = str(await db.fetchval(
        "INSERT INTO projects(startup_name,created_by) VALUES('GraphCo',$1) RETURNING id",
        investor["id"],
    ))
    aid = str(await db.fetchval(
        "INSERT INTO assets(project_id,kind,filename,storage_key) VALUES($1,'pdf','doc.pdf','k') RETURNING id",
        pid,
    ))
    return pid, aid


async def _insert_chunk(
    db: asyncpg.Pool,
    asset_id: str,
    project_id: str,
    idx: int,
    emb: str | None = None,
) -> str:
    if emb is None:
        cid = await db.fetchval(
            "INSERT INTO chunks(asset_id,project_id,text,chunk_index) VALUES($1,$2,$3,$4) RETURNING id",
            asset_id, project_id, f"chunk {idx}", idx,
        )
    else:
        cid = await db.fetchval(
            "INSERT INTO chunks(asset_id,project_id,text,chunk_index,embedding)"
            " VALUES($1,$2,$3,$4,$5::vector) RETURNING id",
            asset_id, project_id, f"chunk {idx}", idx, emb,
        )
    return str(cid)


# ── NEXT edges ────────────────────────────────────────────

async def test_build_next_edges_returns_correct_count(db: asyncpg.Pool, investor: dict):
    pid, aid = await _make_project_asset(db, investor)
    for i in range(3):
        await _insert_chunk(db, aid, pid, i)
    count = await graph_svc.build_next_edges(db, aid)
    assert count == 2


async def test_build_next_edges_correct_order(db: asyncpg.Pool, investor: dict):
    pid, aid = await _make_project_asset(db, investor)
    id0 = await _insert_chunk(db, aid, pid, 0)
    id1 = await _insert_chunk(db, aid, pid, 1)
    await graph_svc.build_next_edges(db, aid)
    row = await db.fetchrow(
        """
        SELECT ce.from_chunk, ce.to_chunk
        FROM chunk_edges ce
        JOIN chunks c ON c.id = ce.from_chunk
        WHERE c.asset_id = $1 AND ce.kind = 'NEXT'
        """,
        aid,
    )
    assert str(row["from_chunk"]) == id0
    assert str(row["to_chunk"]) == id1


async def test_build_next_edges_single_chunk_returns_zero(db: asyncpg.Pool, investor: dict):
    pid, aid = await _make_project_asset(db, investor)
    await _insert_chunk(db, aid, pid, 0)
    count = await graph_svc.build_next_edges(db, aid)
    assert count == 0


async def test_build_next_edges_idempotent(db: asyncpg.Pool, investor: dict):
    pid, aid = await _make_project_asset(db, investor)
    for i in range(3):
        await _insert_chunk(db, aid, pid, i)
    await graph_svc.build_next_edges(db, aid)
    await graph_svc.build_next_edges(db, aid)  # second call — ON CONFLICT DO NOTHING
    edge_count = await db.fetchval(
        """
        SELECT COUNT(*) FROM chunk_edges ce
        JOIN chunks c ON c.id = ce.from_chunk
        WHERE c.asset_id = $1 AND ce.kind = 'NEXT'
        """,
        aid,
    )
    assert edge_count == 2  # no duplicates inserted


# ── SIMILAR_TO edges ──────────────────────────────────────

async def test_build_similarity_edges_identical_vectors(db: asyncpg.Pool, investor: dict):
    """Two chunks with the same unit vector have cosine similarity = 1.0 > 0.82."""
    pid, aid = await _make_project_asset(db, investor)
    await _insert_chunk(db, aid, pid, 0, emb=_unit_vec(0))
    await _insert_chunk(db, aid, pid, 1, emb=_unit_vec(0))
    count = await graph_svc.build_similarity_edges(db, aid)
    assert count > 0


async def test_build_similarity_edges_dissimilar_vectors(db: asyncpg.Pool, investor: dict):
    """Two orthogonal unit vectors have cosine similarity = 0.0 < 0.82 — no edge."""
    pid, aid = await _make_project_asset(db, investor)
    await _insert_chunk(db, aid, pid, 0, emb=_unit_vec(0))
    await _insert_chunk(db, aid, pid, 1, emb=_unit_vec(1))
    count = await graph_svc.build_similarity_edges(db, aid)
    assert count == 0


async def test_build_similarity_edges_skips_null_embeddings(db: asyncpg.Pool, investor: dict):
    pid, aid = await _make_project_asset(db, investor)
    await _insert_chunk(db, aid, pid, 0, emb=None)
    await _insert_chunk(db, aid, pid, 1, emb=None)
    count = await graph_svc.build_similarity_edges(db, aid)
    assert count == 0


async def test_build_similarity_edges_idempotent(db: asyncpg.Pool, investor: dict):
    pid, aid = await _make_project_asset(db, investor)
    await _insert_chunk(db, aid, pid, 0, emb=_unit_vec(0))
    await _insert_chunk(db, aid, pid, 1, emb=_unit_vec(0))
    first = await graph_svc.build_similarity_edges(db, aid)
    await graph_svc.build_similarity_edges(db, aid)
    edge_count = await db.fetchval(
        """
        SELECT COUNT(*) FROM chunk_edges ce
        JOIN chunks c ON c.id = ce.from_chunk
        WHERE c.asset_id = $1 AND ce.kind = 'SIMILAR_TO'
        """,
        aid,
    )
    assert edge_count == first  # no duplicates on second run


# ── Project status update ─────────────────────────────────

async def test_update_project_if_ready_sets_open(db: asyncpg.Pool, investor: dict):
    pid = str(await db.fetchval(
        "INSERT INTO projects(startup_name,created_by,status) VALUES('ReadyCo',$1,'building_graph') RETURNING id",
        investor["id"],
    ))
    for _ in range(2):
        await db.execute(
            "INSERT INTO assets(project_id,kind,filename,storage_key,status) VALUES($1,'pdf','f.pdf','k','ready')",
            pid,
        )
    result = await graph_svc.update_project_if_ready(db, pid)
    assert result is True
    status = await db.fetchval("SELECT status FROM projects WHERE id=$1", pid)
    assert status == "open"


async def test_update_project_if_ready_pending_asset_no_change(db: asyncpg.Pool, investor: dict):
    pid = str(await db.fetchval(
        "INSERT INTO projects(startup_name,created_by,status) VALUES('WaitCo',$1,'building_graph') RETURNING id",
        investor["id"],
    ))
    await db.execute(
        "INSERT INTO assets(project_id,kind,filename,storage_key,status) VALUES($1,'pdf','a.pdf','k1','ready')",
        pid,
    )
    await db.execute(
        "INSERT INTO assets(project_id,kind,filename,storage_key,status) VALUES($1,'pdf','b.pdf','k2','pending')",
        pid,
    )
    result = await graph_svc.update_project_if_ready(db, pid)
    assert result is False
    status = await db.fetchval("SELECT status FROM projects WHERE id=$1", pid)
    assert status == "building_graph"


async def test_update_project_if_ready_no_assets_no_change(db: asyncpg.Pool, investor: dict):
    pid = str(await db.fetchval(
        "INSERT INTO projects(startup_name,created_by) VALUES('EmptyCo',$1) RETURNING id",
        investor["id"],
    ))
    result = await graph_svc.update_project_if_ready(db, pid)
    assert result is False
