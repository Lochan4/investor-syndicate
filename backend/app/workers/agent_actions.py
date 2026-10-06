"""Arq workers: web search, headless browser session, KG ingest from web pages."""
from __future__ import annotations
import asyncio
import base64
import uuid

from app.services import agent_actions, cell_context, embeddings, graph
from app.services.chunker import chunk_text


async def run_agent_web_search(ctx: dict, project_id: str, cell_id: str, query: str) -> None:
    await cell_context.push_activity(project_id, cell_id, "search_start", {"query": query})
    try:
        results = await agent_actions.web_search(query)
        await cell_context.push_activity(project_id, cell_id, "search_done", {"results": results})
    except Exception as exc:
        await cell_context.push_activity(project_id, cell_id, "error", {"query": query, "error": str(exc)})


async def run_agent_browser_session(ctx: dict, project_id: str, cell_id: str, url: str) -> None:
    await cell_context.push_activity(project_id, cell_id, "browser_start", {"url": url})
    try:
        from playwright.async_api import async_playwright
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page(viewport={"width": 1280, "height": 800})
            await page.goto(url, wait_until="domcontentloaded", timeout=20_000)

            # 4 frames at ~1s intervals — each replaces the previous on the frontend
            for _ in range(4):
                raw = await page.screenshot(type="jpeg", quality=60, full_page=False)
                await cell_context.push_activity(project_id, cell_id, "screenshot", {
                    "url": url, "image": base64.b64encode(raw).decode()
                })
                await asyncio.sleep(1)

            try:
                text = await page.evaluate("document.body.innerText")
            except Exception:
                text = await agent_actions.extract_page_text(url)

            await browser.close()

        await ctx["arq"].enqueue_job("ingest_page_to_kg", project_id, cell_id, url, text)
    except Exception as exc:
        await cell_context.push_activity(project_id, cell_id, "error", {"url": url, "error": str(exc)})


async def ingest_page_to_kg(ctx: dict, project_id: str, cell_id: str, url: str, text: str) -> None:
    if not text:
        return
    db = ctx["db"]
    await cell_context.push_activity(project_id, cell_id, "kg_start", {"url": url})
    try:
        asset_id = await db.fetchval(
            """INSERT INTO assets(project_id, kind, filename, storage_key)
               VALUES($1,'web_page',$2,$3) RETURNING id""",
            project_id,
            url.split("/")[-1][:120] or "page",
            f"{project_id}/web_{uuid.uuid4()}.txt",
        )
        chunks = chunk_text(text)
        if not chunks:
            return
        vectors = await embeddings.embed_batch(chunks)
        await db.executemany(
            """INSERT INTO chunks(asset_id, project_id, chunk_index, text, embedding)
               VALUES($1,$2,$3,$4,$5::vector) ON CONFLICT DO NOTHING""",
            [(str(asset_id), project_id, i, chunks[i], str(vectors[i])) for i in range(len(chunks))],
        )
        await graph.build_next_edges(db, str(asset_id))
        await graph.build_similarity_edges(db, str(asset_id))
        await cell_context.push_activity(project_id, cell_id, "kg_done", {"url": url, "chunks": len(chunks)})
    except Exception as exc:
        await cell_context.push_activity(project_id, cell_id, "error", {"url": url, "stage": "kg", "error": str(exc)})
