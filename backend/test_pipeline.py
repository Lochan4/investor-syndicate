"""
End-to-end pipeline test — minimal token spend.
Tests: PDF extract → chunk → embed → DB insert → graph edges → traversal → LLM (tiny) → activity feed
Run: cd backend && source .env && .venv/bin/python test_pipeline.py
"""
from __future__ import annotations
import asyncio, json, os, uuid, sys
import asyncpg

PDF_1 = "/Users/saitrilochan/Desktop/Founder_Due_Diligence_Policy.pdf"
PDF_2 = "/Users/saitrilochan/Desktop/leaps.to · Pre-Seed Round.pdf"

TEST_PROJECT_ID = str(uuid.uuid4())
TEST_ASSET_1    = str(uuid.uuid4())
TEST_ASSET_2    = str(uuid.uuid4())

PASS = "✅"
FAIL = "❌"
SKIP = "⚠️ "

# ── helpers ──────────────────────────────────────────────────────────────────

def section(title: str):
    print(f"\n{'─'*60}\n  {title}\n{'─'*60}")

def ok(msg):   print(f"  {PASS}  {msg}")
def fail(msg): print(f"  {FAIL}  {msg}"); sys.exit(1)
def warn(msg): print(f"  {SKIP}  {msg}")

async def _init_conn(conn):
    await conn.set_type_codec("jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog")

# ── 1. PDF extraction ─────────────────────────────────────────────────────────

def test_pdf_extraction():
    section("1. PDF EXTRACTION")
    from app.services.extractors.pdf import extract
    results = {}
    for label, path in [("Policy doc", PDF_1), ("Pitch deck", PDF_2)]:
        with open(path, "rb") as f:
            data = f.read()
        text = extract(data)
        if not text or len(text) < 50:
            fail(f"{label}: extracted empty or too-short text")
        ok(f"{label}: {len(text):,} chars extracted  (first 80: {text[:80]!r})")
        results[label] = text
    return results

# ── 2. Chunker ───────────────────────────────────────────────────────────────

def test_chunker(texts: dict):
    section("2. CHUNKER")
    from app.services.chunker import chunk_text
    chunks_map = {}
    for label, text in texts.items():
        # Use only first 4500 chars to keep embedding cost tiny (≈3 chunks)
        trimmed = text[:4500]
        chunks = chunk_text(trimmed)
        if not chunks:
            fail(f"{label}: no chunks produced")
        ok(f"{label}: {len(chunks)} chunks from {len(trimmed):,} chars")
        chunks_map[label] = chunks
    return chunks_map

# ── 3. Embeddings ─────────────────────────────────────────────────────────────

async def test_embeddings(chunks_map: dict):
    section("3. EMBEDDINGS  (OpenAI text-embedding-3-large)")
    from app.services.embeddings import embed_batch
    all_chunks = []
    for chunks in chunks_map.values():
        all_chunks.extend(chunks[:3])   # max 3 chunks per doc = ≤6 API calls total

    # single batched call — cheapest
    vecs = await embed_batch(all_chunks)
    if len(vecs) != len(all_chunks):
        fail(f"Expected {len(all_chunks)} vectors, got {len(vecs)}")
    for v in vecs:
        if len(v) != 1536:
            fail(f"Wrong dimension: {len(v)}")
    ok(f"{len(vecs)} vectors, each dim=1536")
    return all_chunks, vecs

# ── 4. DB insert (project + assets + chunks) ──────────────────────────────────

async def test_db_insert(db, chunks_map, all_chunks, vecs):
    section("4. DB INSERT")

    # insert fake project (no FK to users needed — projects.created_by is optional)
    await db.execute(
        "INSERT INTO projects(id, startup_name, status) VALUES($1,$2,'open')",
        TEST_PROJECT_ID, "__test_pipeline__"
    )
    ok(f"Project inserted: {TEST_PROJECT_ID}")

    # insert two fake assets
    asset_ids = [TEST_ASSET_1, TEST_ASSET_2]
    labels = list(chunks_map.keys())
    for asset_id, label in zip(asset_ids, labels):
        await db.execute(
            "INSERT INTO assets(id, project_id, filename, kind, storage_key, status) VALUES($1,$2,$3,'pdf',$4,'processing')",
            asset_id, TEST_PROJECT_ID, f"{label}.pdf", f"test-key-{asset_id}"
        )
    ok(f"2 assets inserted")

    # distribute chunks: first half to asset_1, second half to asset_2
    half = len(all_chunks) // 2 or 1
    rows = []
    for i, (chunk, vec) in enumerate(zip(all_chunks, vecs)):
        asset_id = TEST_ASSET_1 if i < half else TEST_ASSET_2
        rows.append((asset_id, TEST_PROJECT_ID, i, chunk, str(vec)))

    await db.executemany(
        """INSERT INTO chunks(asset_id, project_id, chunk_index, text, embedding)
           VALUES($1,$2,$3,$4,$5::vector) ON CONFLICT DO NOTHING""",
        rows
    )
    count = await db.fetchval("SELECT COUNT(*) FROM chunks WHERE project_id=$1", TEST_PROJECT_ID)
    ok(f"{count} chunks inserted with embeddings")
    return asset_ids

# ── 5. Graph edges ────────────────────────────────────────────────────────────

async def test_graph_edges(db, asset_ids):
    section("5. GRAPH EDGES")
    from app.services.graph import build_next_edges, build_similarity_edges

    total_next = 0
    total_sim  = 0
    for asset_id in asset_ids:
        n = await build_next_edges(db, asset_id)
        s = await build_similarity_edges(db, asset_id)
        total_next += n
        total_sim  += s

    ok(f"NEXT edges: {total_next}")
    if total_sim == 0:
        warn("SIMILAR_TO edges: 0  (expected — only ~3 chunks per doc, all unique content)")
    else:
        ok(f"SIMILAR_TO edges: {total_sim}")

    total_edges = await db.fetchval(
        "SELECT COUNT(*) FROM chunk_edges WHERE project_id=$1", TEST_PROJECT_ID
    )
    ok(f"Total chunk_edges in DB: {total_edges}")

# ── 6. Traversal ──────────────────────────────────────────────────────────────

async def test_traversal(db):
    section("6. GRAPH TRAVERSAL")
    from app.services.traversal import traverse

    question = "Who are the founders and what is their background?"
    ctx_chunks, source_ids, trace = await traverse(db, TEST_PROJECT_ID, "fake-cell-id", question)

    if not ctx_chunks:
        fail("Traversal returned no context chunks")
    ok(f"Seeds found: {trace['total_nodes']} nodes visited")
    ok(f"Top {len(ctx_chunks)} context chunks returned")
    ok(f"Source assets: {source_ids}")
    ok(f"First chunk preview: {ctx_chunks[0][:120]!r}")
    return ctx_chunks

# ── 7. LLM analysis (tiny) ────────────────────────────────────────────────────

async def test_llm(ctx_chunks):
    section("7. LLM ANALYSIS  (tiny — first chunk only, Haiku)")
    from app.services.llm import get_async_client

    # Use just the first retrieved chunk — minimal tokens
    snippet = ctx_chunks[0][:800]
    client = get_async_client()
    msg = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=120,
        messages=[{"role": "user", "content":
            f"In one sentence, what is this document about?\n\n{snippet}"}],
    )
    answer = msg.content[0].text.strip()
    ok(f"LLM response: {answer}")

# ── 8. Activity feed (Redis) ──────────────────────────────────────────────────

async def test_activity_feed():
    section("8. ACTIVITY FEED  (Redis push/pop)")
    from app.services.cell_context import push_activity, pop_activities

    pid, cid = TEST_PROJECT_ID, "fake-cell-id"
    await push_activity(pid, cid, "traversal", {"nodes": 5, "note": "test event"})
    events = await pop_activities(pid, cid, 0)

    if not events:
        fail("push_activity wrote nothing / pop_activities returned nothing")
    ok(f"Activity feed works — {len(events)} event(s) stored")
    ok(f"Event: {events[0]}")

    # Check that send_message pushes activities — it DOESN'T currently
    warn("send_message does NOT call push_activity — AssistantPanel will stay empty")
    warn("Traversal data (seeds/nodes) is not pushed to activity feed from conversation.py")

# ── 9. Cleanup ────────────────────────────────────────────────────────────────

async def cleanup(db):
    section("9. CLEANUP")
    # cascade deletes chunks, chunk_edges, assets via FK ON DELETE CASCADE
    await db.execute("DELETE FROM projects WHERE id=$1", TEST_PROJECT_ID)
    ok("Test data cleaned up")

# ── main ──────────────────────────────────────────────────────────────────────

async def main():
    print("\n🔬  SYNDICATE PIPELINE TEST")
    print(f"   Project ID (ephemeral): {TEST_PROJECT_ID}\n")

    # check PDFs exist
    for p in [PDF_1, PDF_2]:
        if not os.path.exists(p):
            fail(f"PDF not found: {p}")

    db = await asyncpg.create_pool(os.environ["DATABASE_URL"], init=_init_conn)

    try:
        texts      = test_pdf_extraction()
        chunks_map = test_chunker(texts)
        all_chunks, vecs = await test_embeddings(chunks_map)
        asset_ids  = await test_db_insert(db, chunks_map, all_chunks, vecs)
        await test_graph_edges(db, asset_ids)
        ctx_chunks = await test_traversal(db)
        await test_llm(ctx_chunks)
        await test_activity_feed()
    finally:
        await cleanup(db)
        await db.close()

    section("SUMMARY")
    print("  Pipeline stages: PDF extract → chunk → embed → DB → graph edges → traversal → LLM")
    print(f"  {PASS}  All critical stages passed")
    print(f"  {FAIL}  AssistantPanel (left) is WIRED but DARK — push_activity never called from conversation.py")
    print(f"  {SKIP}  Fix: call push_activity in send_message/stream_answer after traversal completes\n")

asyncio.run(main())
