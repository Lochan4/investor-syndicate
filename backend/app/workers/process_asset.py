"""
Arq worker: full asset processing pipeline.
ctx["db"] must be an asyncpg.Pool, injected by WorkerSettings.
"""
from __future__ import annotations
import httpx

from app.services import asset_analysis, graph, ner
from app.services import chunker, embeddings, llm
from app.services.extractors import pdf, spreadsheet, audio, image
from app.services.storage import presigned_download_url


async def _download(url: str) -> bytes:
    async with httpx.AsyncClient() as client:
        r = await client.get(url, follow_redirects=True)
        r.raise_for_status()
        return r.content


def _extract(data: bytes, kind: str, filename: str) -> str:
    if kind == "pdf":
        return pdf.extract(data)
    if kind in ("spreadsheet", "csv"):
        return spreadsheet.extract(data, filename)
    return data.decode("utf-8", errors="ignore")


async def process_asset(ctx: dict, asset_id: str) -> None:
    """Download → extract → chunk → embed → store chunks → NER (doc-level) → analyse → graph."""
    db = ctx["db"]
    row = await db.fetchrow(
        "SELECT project_id, kind, filename, storage_key FROM assets WHERE id=$1", asset_id
    )
    if not row:
        return

    project_id = str(row["project_id"])
    kind = row["kind"]
    filename = row["filename"]

    try:
        # 1. download
        url = presigned_download_url(row["storage_key"])
        data = await _download(url)

        # 2. extract text
        if kind == "audio":
            text = await audio.extract(data, filename)
        elif kind == "image":
            text = await image.extract(data)
        else:
            text = _extract(data, kind, filename)

        # 3. chunk + embed
        chunks = chunker.chunk_text(text)
        if not chunks:
            await asset_analysis.store_analysis(db, asset_id, {"summary": "", "topics": [], "entities": []})
            return

        vectors = await embeddings.embed_batch(chunks)

        # 4. insert chunks
        await db.executemany(
            """INSERT INTO chunks(asset_id, project_id, chunk_index, text, embedding)
               VALUES($1, $2, $3, $4, $5::vector)
               ON CONFLICT DO NOTHING""",
            [(asset_id, project_id, i, chunks[i], str(vectors[i])) for i in range(len(chunks))],
        )

        # 5. NER — one call on the full document, not one per chunk
        # ponytail: doc-level NER; per-chunk linking adds no retrieval value since
        #           traversal uses chunk_edges (NEXT/SIMILAR_TO), not chunk_mentions
        chunk_rows = await db.fetch(
            "SELECT id FROM chunks WHERE asset_id=$1 ORDER BY chunk_index LIMIT 1", asset_id
        )
        if chunk_rows:
            first_chunk_id = str(chunk_rows[0]["id"])
            try:
                full_text = "\n".join(chunks)
                entities = await llm.extract_entities(full_text[:6000])
                if entities:
                    await ner.store_entities(db, project_id, first_chunk_id, entities)
            except Exception:
                pass  # NER failure is non-fatal — chunks + embeddings are the critical path

        # 6. asset-level analysis
        full_text = "\n".join(chunks)
        analysis: dict = {"summary": "", "topics": [], "entities": []}
        try:
            analysis = await llm.analyse_asset(full_text)
        except Exception:
            pass  # analysis failure is non-fatal — mark ready with empty cache

        await asset_analysis.store_analysis(db, asset_id, analysis)

        # 7. graph edges + project status
        await graph.build_next_edges(db, asset_id)
        await graph.build_similarity_edges(db, asset_id)
        await graph.update_project_if_ready(db, project_id)

    except Exception as exc:
        # Mark asset failed so it doesn't stay stuck in 'processing'
        await db.execute(
            "UPDATE assets SET status='failed', error_message=$1 WHERE id=$2",
            str(exc)[:500], asset_id,
        )
        raise


# legacy stubs for backwards compat with existing tests
async def build_graph_edges(ctx: dict, asset_id: str) -> None:
    db = ctx["db"]
    await graph.build_next_edges(db, asset_id)
    await graph.build_similarity_edges(db, asset_id)
    row = await db.fetchrow("SELECT project_id FROM assets WHERE id=$1", asset_id)
    if row:
        await graph.update_project_if_ready(db, str(row["project_id"]))


async def run_asset_analysis(ctx: dict, asset_id: str) -> None:
    db = ctx["db"]
    rows = await db.fetch("SELECT text FROM chunks WHERE asset_id=$1 ORDER BY chunk_index", asset_id)
    analysis = {"entities": [], "summary": "", "topics": []}
    await asset_analysis.store_analysis(db, asset_id, analysis)
