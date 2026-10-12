"""
Tests: GraphRAG BFS traversal (services/traversal.py).

All tests use real embedded Postgres (from conftest) and mock only embed_batch
so no OpenAI calls are made.

Relevance decay formula (from traversal.py):
    depth-1 node: seed_rel * 0.85^1 = 0.85   (>  0.45, included)
    depth-2 node: 0.85   * 0.85^2 = 0.614  (>  0.45, included)
    depth-3 node: 0.614  * 0.85^3 = 0.377  (<  0.45, filtered)
"""
from __future__ import annotations
import uuid
from unittest.mock import patch

import asyncpg
import pytest

from app.services import traversal as traversal_svc


# ── Helpers ───────────────────────────────────────────────────────────────────

_DUMMY_CELL = str(uuid.uuid4())


def _unit_vec(pos: int = 0) -> list[float]:
    v = [0.0] * 1536
    v[pos] = 1.0
    return v


def _vec_str(pos: int = 0) -> str:
    return "[" + ",".join("1.0" if i == pos else "0.0" for i in range(1536)) + "]"


def _mock_embed(vec: list[float]):
    """embed_batch replacement that always returns `vec` for any input texts."""
    async def _embed(texts):
        return [vec] * len(texts)
    return _embed


async def _make_project(db: asyncpg.Pool, owner_id: str) -> str:
    return str(await db.fetchval(
        "INSERT INTO projects(startup_name, created_by) VALUES($1, $2) RETURNING id",
        f"TraversalCo-{uuid.uuid4()}", owner_id,
    ))


async def _make_asset(db: asyncpg.Pool, project_id: str) -> str:
    return str(await db.fetchval(
        "INSERT INTO assets(project_id, kind, filename, storage_key) VALUES($1,'pdf','doc.pdf','k') RETURNING id",
        project_id,
    ))


async def _insert_chunk(
    db: asyncpg.Pool,
    asset_id: str,
    project_id: str,
    idx: int,
    text: str,
    vec_pos: int | None = None,
) -> str:
    if vec_pos is None:
        return str(await db.fetchval(
            "INSERT INTO chunks(asset_id, project_id, text, chunk_index)"
            " VALUES($1, $2, $3, $4) RETURNING id",
            asset_id, project_id, text, idx,
        ))
    return str(await db.fetchval(
        "INSERT INTO chunks(asset_id, project_id, text, chunk_index, embedding)"
        " VALUES($1, $2, $3, $4, $5::vector) RETURNING id",
        asset_id, project_id, text, idx, _vec_str(vec_pos),
    ))


async def _add_edge(
    db: asyncpg.Pool, project_id: str, from_id: str, to_id: str, kind: str = "NEXT"
) -> None:
    await db.execute(
        "INSERT INTO chunk_edges(project_id, from_chunk, to_chunk, kind)"
        " VALUES($1, $2, $3, $4) ON CONFLICT DO NOTHING",
        project_id, from_id, to_id, kind,
    )


# ── Tests ─────────────────────────────────────────────────────────────────────

async def test_seed_chunk_returned(db: asyncpg.Pool, investor: dict):
    """Query embedding matches chunk embedding → chunk text in returned context."""
    pid = await _make_project(db, investor["id"])
    aid = await _make_asset(db, pid)
    await _insert_chunk(db, aid, pid, 0, "ARR is $2M", vec_pos=0)

    with patch("app.services.traversal.embed_batch", new=_mock_embed(_unit_vec(0))):
        chunks, source_ids, trace = await traversal_svc.traverse(db, pid, _DUMMY_CELL, "revenue?")

    assert any("ARR is $2M" in c for c in chunks)
    assert len(source_ids) > 0


async def test_next_edge_expands_bfs(db: asyncpg.Pool, investor: dict):
    """BFS follows NEXT edges: seed chunk → neighbor chunk included even without vec match."""
    pid = await _make_project(db, investor["id"])
    aid = await _make_asset(db, pid)

    seed_id = await _insert_chunk(db, aid, pid, 0, "seed text", vec_pos=0)
    # neighbor has no embedding → would never be a seed directly
    neighbor_id = await _insert_chunk(db, aid, pid, 1, "neighbor via NEXT", vec_pos=None)
    await _add_edge(db, pid, seed_id, neighbor_id, kind="NEXT")

    with patch("app.services.traversal.embed_batch", new=_mock_embed(_unit_vec(0))):
        chunks, _, _ = await traversal_svc.traverse(db, pid, _DUMMY_CELL, "q")

    assert any("neighbor via NEXT" in c for c in chunks)


async def test_similar_to_edge_expands_bfs(db: asyncpg.Pool, investor: dict):
    """BFS follows SIMILAR_TO edges the same way as NEXT edges."""
    pid = await _make_project(db, investor["id"])
    aid = await _make_asset(db, pid)

    seed_id = await _insert_chunk(db, aid, pid, 0, "seed text", vec_pos=0)
    neighbor_id = await _insert_chunk(db, aid, pid, 1, "neighbor via SIMILAR_TO", vec_pos=None)
    await _add_edge(db, pid, seed_id, neighbor_id, kind="SIMILAR_TO")

    with patch("app.services.traversal.embed_batch", new=_mock_embed(_unit_vec(0))):
        chunks, _, _ = await traversal_svc.traverse(db, pid, _DUMMY_CELL, "q")

    assert any("neighbor via SIMILAR_TO" in c for c in chunks)


async def test_depth3_node_filtered_by_decay(db: asyncpg.Pool, investor: dict):
    """
    Chain: seed (rel=1.0) → A (0.85) → B (0.614) → C (0.377).
    C is at depth 3 with rel < 0.45 threshold → must be excluded.
    A and B must be included.
    """
    pid = await _make_project(db, investor["id"])
    aid = await _make_asset(db, pid)

    seed = await _insert_chunk(db, aid, pid, 0, "seed",     vec_pos=0)
    a    = await _insert_chunk(db, aid, pid, 1, "depth-1-A", vec_pos=None)
    b    = await _insert_chunk(db, aid, pid, 2, "depth-2-B", vec_pos=None)
    c    = await _insert_chunk(db, aid, pid, 3, "depth-3-C", vec_pos=None)

    await _add_edge(db, pid, seed, a)
    await _add_edge(db, pid, a,    b)
    await _add_edge(db, pid, b,    c)

    with patch("app.services.traversal.embed_batch", new=_mock_embed(_unit_vec(0))):
        chunks, _, trace = await traversal_svc.traverse(db, pid, _DUMMY_CELL, "q")

    texts = set(chunks)
    assert "depth-1-A" in texts
    assert "depth-2-B" in texts
    assert "depth-3-C" not in texts


async def test_nodes_capped_at_40(db: asyncpg.Pool, investor: dict):
    """1 seed + 50 NEXT-edge neighbors → trace reports ≤ 40 total nodes visited."""
    pid = await _make_project(db, investor["id"])
    aid = await _make_asset(db, pid)

    seed = await _insert_chunk(db, aid, pid, 0, "seed", vec_pos=0)
    for i in range(1, 51):
        neighbor = await _insert_chunk(db, aid, pid, i, f"neighbor-{i}", vec_pos=None)
        await _add_edge(db, pid, seed, neighbor)

    with patch("app.services.traversal.embed_batch", new=_mock_embed(_unit_vec(0))):
        _, _, trace = await traversal_svc.traverse(db, pid, _DUMMY_CELL, "q")

    assert trace["total_nodes"] <= 40


async def test_returns_at_most_12_chunks(db: asyncpg.Pool, investor: dict):
    """Even when >12 nodes are visited, only 12 chunks are returned."""
    pid = await _make_project(db, investor["id"])
    aid = await _make_asset(db, pid)

    # 5 seeds + 10 depth-1 neighbors = 15 visited nodes
    seeds = []
    for i in range(5):
        sid = await _insert_chunk(db, aid, pid, i, f"seed-{i}", vec_pos=0)
        seeds.append(sid)

    for i, sid in enumerate(seeds):
        for j in range(2):
            idx = 10 + i * 2 + j
            nid = await _insert_chunk(db, aid, pid, idx, f"neighbor-{idx}", vec_pos=None)
            await _add_edge(db, pid, sid, nid)

    with patch("app.services.traversal.embed_batch", new=_mock_embed(_unit_vec(0))):
        chunks, _, trace = await traversal_svc.traverse(db, pid, _DUMMY_CELL, "q")

    assert trace["total_nodes"] == 15
    assert len(chunks) == 12


async def test_project_isolation(db: asyncpg.Pool, investor: dict):
    """Chunks from another project must never appear in traversal results."""
    pid_a = await _make_project(db, investor["id"])
    pid_b = await _make_project(db, investor["id"])

    aid_a = await _make_asset(db, pid_a)
    aid_b = await _make_asset(db, pid_b)

    await _insert_chunk(db, aid_a, pid_a, 0, "project A chunk", vec_pos=0)
    await _insert_chunk(db, aid_b, pid_b, 0, "project B chunk", vec_pos=0)  # same embedding

    with patch("app.services.traversal.embed_batch", new=_mock_embed(_unit_vec(0))):
        chunks, _, _ = await traversal_svc.traverse(db, pid_a, _DUMMY_CELL, "q")

    assert all("project B chunk" not in c for c in chunks)
    assert any("project A chunk" in c for c in chunks)


async def test_trace_structure(db: asyncpg.Pool, investor: dict):
    """trace dict has the expected keys and sane values."""
    pid = await _make_project(db, investor["id"])
    aid = await _make_asset(db, pid)
    await _insert_chunk(db, aid, pid, 0, "some text", vec_pos=0)

    with patch("app.services.traversal.embed_batch", new=_mock_embed(_unit_vec(0))):
        _, source_ids, trace = await traversal_svc.traverse(db, pid, _DUMMY_CELL, "q")

    assert "seeds" in trace
    assert "total_nodes" in trace
    assert "source_ids" in trace
    assert isinstance(trace["seeds"], list)
    assert isinstance(trace["total_nodes"], int)
    assert trace["total_nodes"] >= 1
    assert trace["source_ids"] == source_ids


async def test_empty_project_returns_empty(db: asyncpg.Pool, investor: dict):
    """Project with no chunks → empty context, empty source list."""
    pid = await _make_project(db, investor["id"])

    with patch("app.services.traversal.embed_batch", new=_mock_embed(_unit_vec(0))):
        chunks, source_ids, trace = await traversal_svc.traverse(db, pid, _DUMMY_CELL, "q")

    assert chunks == []
    assert source_ids == []
    assert trace["total_nodes"] == 0
