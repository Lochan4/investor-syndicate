"""GraphRAG traversal — BFS over chunk_edges seeded by embedding similarity."""
from __future__ import annotations

import asyncpg

from app.services.embeddings import embed_batch


async def traverse(
    db: asyncpg.Pool,
    project_id: str,
    cell_id: str,
    query: str,
    upstream_ctx: str = "",
) -> tuple[list[str], list[str], dict]:
    """Returns (context_chunks, source_asset_ids, trace)."""
    query_vec = (await embed_batch([query]))[0]
    vec_str = str(query_vec)

    seed_rows = await db.fetch(
        """SELECT c.id, c.text, c.asset_id,
                  1 - (c.embedding <=> $1::vector) AS sim
           FROM chunks c
           WHERE c.project_id = $2 AND c.embedding IS NOT NULL
           ORDER BY c.embedding <=> $1::vector
           LIMIT 5""",
        vec_str, project_id,
    )

    # node_id -> {text, asset_id, relevance}
    visited: dict[str, dict] = {}
    frontier: list[tuple[str, float]] = []

    for row in seed_rows:
        cid = str(row["id"])
        sim = float(row["sim"])
        visited[cid] = {"text": row["text"], "asset_id": str(row["asset_id"]), "relevance": sim}
        frontier.append((cid, sim))

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
                    "SELECT text, asset_id FROM chunks WHERE id=$1", neighbor
                )
                if not chunk_row:
                    continue
                visited[neighbor] = {
                    "text": chunk_row["text"],
                    "asset_id": str(chunk_row["asset_id"]),
                    "relevance": rel,
                }
                next_frontier.append((neighbor, rel))

        frontier = next_frontier

    top = sorted(visited.values(), key=lambda x: x["relevance"], reverse=True)[:12]
    context_chunks = [n["text"] for n in top]
    source_ids = list(dict.fromkeys(n["asset_id"] for n in top))

    first_five = list(visited.items())[:5]
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
    }
    return context_chunks, source_ids, trace
