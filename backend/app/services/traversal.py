"""GraphRAG traversal — BFS over chunk_edges seeded by embedding similarity."""
from __future__ import annotations

import logging

import asyncpg

from app.services.embeddings import embed_batch

log = logging.getLogger("traversal")


async def traverse(
    db: asyncpg.Pool,
    project_id: str,
    cell_id: str,
    query: str,
    upstream_ctx: str = "",
) -> tuple[list[str], list[str], dict]:
    """Returns (context_chunks, source_asset_ids, trace)."""
    log.info("[TRAVERSE:START] project=%s  cell=%s  query=%r", project_id, cell_id, query[:120])

    query_vec = (await embed_batch([query]))[0]
    vec_str = str(query_vec)

    seed_rows = await db.fetch(
        """SELECT c.id, c.text, c.asset_id, c.qa_group_id,
                  1 - (c.embedding <=> $1::vector) AS sim
           FROM chunks c
           WHERE c.project_id = $2 AND c.embedding IS NOT NULL
           ORDER BY c.embedding <=> $1::vector
           LIMIT 5""",
        vec_str, project_id,
    )
    if not seed_rows:
        log.warning("[TRAVERSE:SEEDS] project=%s — no chunks found (no assets uploaded?)", project_id)

    # node_id -> {text, asset_id, relevance}
    visited: dict[str, dict] = {}
    frontier: list[tuple[str, float]] = []

    for row in seed_rows:
        cid = str(row["id"])
        sim = float(row["sim"])
        visited[cid] = {
            "text": row["text"], "asset_id": str(row["asset_id"]), "relevance": sim,
            "qa_group_id": str(row["qa_group_id"]) if row["qa_group_id"] else None,
        }
        frontier.append((cid, sim))
        log.info(
            "[TRAVERSE:SEED] sim=%.3f  preview=%r",
            sim, row["text"][:80],
        )

    # BFS up to depth 3, cap 40 nodes
    for depth in range(1, 4):
        if len(visited) >= 40 or not frontier:
            break

        chunk_ids = [f[0] for f in frontier]
        parent_rel = {cid: rel for cid, rel in frontier}

        edge_rows = await db.fetch(
            """SELECT from_chunk, to_chunk FROM chunk_edges
               WHERE from_chunk = ANY($1::uuid[]) OR to_chunk = ANY($1::uuid[])""",
            chunk_ids,
        )

        next_frontier: list[tuple[str, float]] = []
        for edge in edge_rows:
            from_id = str(edge["from_chunk"])
            to_id = str(edge["to_chunk"])
            for neighbor, parent_id in ((to_id, from_id), (from_id, to_id)):
                if neighbor in visited or len(visited) >= 40:
                    continue
                parent_relevance = parent_rel.get(parent_id, 0.0)
                rel = parent_relevance * (0.85 ** depth)
                if rel < 0.45:
                    continue
                chunk_row = await db.fetchrow(
                    "SELECT text, asset_id, qa_group_id FROM chunks WHERE id=$1", neighbor
                )
                if not chunk_row:
                    continue
                visited[neighbor] = {
                    "text": chunk_row["text"],
                    "asset_id": str(chunk_row["asset_id"]),
                    "relevance": rel,
                    "qa_group_id": str(chunk_row["qa_group_id"]) if chunk_row["qa_group_id"] else None,
                }
                next_frontier.append((neighbor, rel))

        frontier = next_frontier

    top = sorted(visited.values(), key=lambda x: x["relevance"], reverse=True)[:12]
    context_chunks = [n["text"] for n in top]
    source_ids = list(dict.fromkeys(n["asset_id"] for n in top))
    log.info(
        "[TRAVERSE:DONE] project=%s  total_visited=%d  top_k=%d  source_assets=%d",
        project_id, len(visited), len(top), len(source_ids),
    )

    # Sibling expansion: if a Q&A chunk was found, fetch its group siblings for full context
    _MAX_GROUPS = 2
    _MAX_SIBLINGS_PER_GROUP = 3
    _SIBLING_CHAR_BUDGET = 6000

    qa_group_ids = list(dict.fromkeys(
        info["qa_group_id"] for info in visited.values() if info.get("qa_group_id")
    ))[:_MAX_GROUPS]

    if qa_group_ids:
        visited_ids = list(visited.keys())
        sibling_texts: list[str] = []
        for gid in qa_group_ids:
            sib_rows = await db.fetch(
                """SELECT text FROM chunks
                   WHERE qa_group_id = $1 AND id != ALL($2::uuid[])
                   ORDER BY chunk_index ASC LIMIT $3""",
                gid, visited_ids, _MAX_SIBLINGS_PER_GROUP,
            )
            sibling_texts.extend(r["text"] for r in sib_rows)
        # Cap total sibling injection by char budget
        budget = 0
        for t in sibling_texts:
            if budget + len(t) > _SIBLING_CHAR_BUDGET:
                break
            context_chunks.append(t)
            budget += len(t)

    first_five = list(visited.items())[:5]
    avg_top_relevance = sum(n["relevance"] for n in top) / len(top) if top else 0.0
    trace = {
        "seeds": [
            {
                "id": cid,
                "asset_id": info["asset_id"],
                "relevance": info["relevance"],
                "preview": info["text"][:80],
            }
            for cid, info in first_five
        ],
        "total_nodes": len(visited),
        "source_ids": source_ids,
        "avg_top_relevance": avg_top_relevance,
    }
    return context_chunks, source_ids, trace
