from __future__ import annotations
import asyncio
import json
import logging
import os
import re

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.dependencies import CurrentUser, get_arq, get_current_user, get_db
from app.services.llm import get_async_client, stream_tokens
from app.services import cell_context, traversal, agent_actions, embeddings, graph, storage
from app.services.extractors import audio as whisper_extract
from app.services import notifications as notif_svc

router = APIRouter(prefix="/projects/{project_id}", tags=["conversation"])
log = logging.getLogger("conversation")

_HAIKU = "claude-haiku-4-5-20251001"

# Jev-style: all cell-level decisions in one Haiku call
_CELL_JEV_PROMPT = """\
You are a decision classifier. Answer ALL questions about this message simultaneously.
Return ONLY valid JSON — no other text. Float values 0.0-1.0. navigation_target is a string.

Activity topic: {topic}
Activity description: {description}
Message: "{message}"

{{"is_on_topic": 0.0, "needs_web_search": 0.0, "is_biographical": 0.0, "is_navigation_command": 0.0, "navigation_target": ""}}

Scoring:
- is_on_topic: 1.0=clearly about the activity topic, 0.0=completely unrelated
- needs_web_search: 1.0=requires current/external data (market stats, news)
- is_biographical: 1.0=asking about a person's background, education, career history
- is_navigation_command: 1.0=asking to go back, exit, or navigate elsewhere"""


async def _cell_jev_check(message: str, topic: str, description: str) -> dict:
    """Jev-style multi-question cell check. Fails open on error."""
    try:
        client = _anthropic()
        msg = await client.messages.create(
            model=_HAIKU,
            max_tokens=128,
            messages=[{"role": "user", "content": _CELL_JEV_PROMPT.format(
                topic=topic, description=description[:300] if description else "", message=message
            )}],
        )
        raw = msg.content[0].text.strip()
        result = json.loads(raw)
        log.info(
            "[JEV:CELL] topic=%r  scores=%s",
            topic, json.dumps(result),
        )
        return result
    except Exception as exc:
        log.error("[JEV:CELL] parse failed for topic=%r message=%r: %s", topic, message[:80], exc)
        return {"is_on_topic": 1.0, "needs_web_search": 0.0, "is_biographical": 0.0, "is_navigation_command": 0.0}


def _anthropic():
    return get_async_client()


def _build_system_prompt(cell_row) -> str:
    base = "You are an AI assistant helping investors conduct due diligence."
    if not cell_row:
        return base + " Answer based on the provided document context. Be concise and accurate. Use plain text only — no markdown, no asterisks for bold, no # headers."
    parts = [base]
    if cell_row["topic"]:
        parts.append(f"You are evaluating the startup on: {cell_row['topic']}.")
    if cell_row["prompt"]:
        parts.append(f"Evaluation criteria:\n{cell_row['prompt']}")
    chars = cell_row["characteristics"] or []
    if isinstance(chars, str):
        try:
            chars = json.loads(chars)
        except Exception:
            chars = []
    if chars and isinstance(chars, list):
        weighted = "\n".join(
            f"  - {c['name']} (importance: {c['strength']}/10)" for c in chars
            if isinstance(c, dict)
        )
        parts.append(f"Key characteristics to assess (higher importance = weight more heavily):\n{weighted}")
    parts.append("Answer based on the provided document context. Be concise and accurate. Use plain text only — no markdown, no asterisks for bold, no # headers.")
    return "\n\n".join(parts)


async def _get_policy_text(db, cell_row) -> str:
    if not cell_row:
        return ""
    doc_ids = cell_row["policy_doc_ids"] or []
    if not doc_ids:
        return ""
    rows = await db.fetch(
        "SELECT text_content FROM canvas_policy_docs WHERE id = ANY($1)", doc_ids
    )
    combined = "\n\n---\n\n".join(r["text_content"] for r in rows if r["text_content"])
    return combined[:6000]


_SEARCH_KEYWORDS = ("search online", "look up", "open", "visit", "browse", "google", "search the web")


def _detect_intent(message: str) -> tuple[str | None, str | None]:
    """Returns (url, None) if URL detected, (None, query) if search intent, (None, None) otherwise."""
    m = re.search(r'https?://\S+', message)
    if m:
        return m.group().rstrip(".,)"), None
    if any(kw in message.lower() for kw in _SEARCH_KEYWORDS):
        return None, message
    return None, None


# ── GET /conversation/{cell_id}/activity ─────────────────

@router.get("/conversation/{cell_id}/activity")
async def activity_stream(
    project_id: str,
    cell_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    async def event_gen():
        cursor = 0
        while True:
            events = await cell_context.pop_activities(project_id, cell_id, cursor)
            for e in events:
                yield f"data: {json.dumps(e)}\n\n"
            cursor += len(events)
            await asyncio.sleep(0.5)

    return StreamingResponse(event_gen(), media_type="text/event-stream")


# ── GET /activities ──────────────────────────────────────

@router.get("/activities")
async def list_project_activities(
    project_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    """Return all flow cells for a project with per-user activity status."""
    cells = await db.fetch(
        "SELECT id, topic, prompt, description FROM flow_cells WHERE project_id=$1 ORDER BY created_at",
        project_id,
    )

    session = await db.fetchrow(
        "SELECT id, status, cell_confidence FROM conversation_sessions WHERE project_id=$1 AND user_id=$2",
        project_id, user.id,
    )
    session_status = session["status"] if session else "active"
    cell_confidence: dict = (session["cell_confidence"] or {}) if session else {}

    turn_rows = await db.fetch(
        """SELECT cell_id, COUNT(*) AS cnt
           FROM cell_conversation_turns
           WHERE project_id=$1 AND user_id=$2 AND role='user'
           GROUP BY cell_id""",
        project_id, user.id,
    )
    turn_counts = {str(r["cell_id"]): int(r["cnt"]) for r in turn_rows}

    result = []
    for cell in cells:
        cell_id = str(cell["id"])
        turns = turn_counts.get(cell_id, 0)
        confidence = cell_confidence.get(cell_id)

        # Completion %: turns (max 60%) + confidence set (+20%) + submitted (+20%)
        pct = min(turns / 10, 0.6)
        if confidence:
            pct += 0.2
        if session_status == "submitted":
            pct += 0.2
        completion_pct = round(min(pct * 100, 100))

        if session_status == "submitted":
            state = "closed"
        elif turns > 0:
            state = "in_progress"
        else:
            state = "open"

        result.append({
            "id": cell_id,
            "topic": cell["topic"],
            "description": cell.get("description"),
            "turn_count": turns,
            "confidence_score": confidence,
            "completion_pct": completion_pct,
            "state": state,
        })

    return result


# ── GET /conversation/{cell_id}/turns ────────────────────

@router.get("/conversation/{cell_id}/turns")
async def get_turns(
    project_id: str,
    cell_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT role, content
           FROM cell_conversation_turns
           WHERE project_id=$1 AND cell_id=$2 AND user_id=$3
           ORDER BY created_at""",
        project_id, cell_id, user.id,
    )
    return [{"role": r["role"], "content": r["content"]} for r in rows]


# ── POST /sessions/{cell_id} ──────────────────────────────

@router.post("/sessions/{cell_id}")
async def get_or_create_session(
    project_id: str,
    cell_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    row = await db.fetchrow(
        """INSERT INTO conversation_sessions(project_id, user_id)
           VALUES($1,$2)
           ON CONFLICT (project_id, user_id) DO UPDATE SET project_id=EXCLUDED.project_id
           RETURNING id, status""",
        project_id, user.id,
    )
    return {"session_id": str(row["id"]), "status": row["status"]}


# ── POST /conversation/{session_id}/message ───────────────

class MessageBody(BaseModel):
    message: str
    cell_id: str


@router.post("/conversation/{session_id}/message")
async def send_message(
    project_id: str,
    session_id: str,
    body: MessageBody,
    user: CurrentUser = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    message = body.message
    cell_id = body.cell_id

    # embed user message
    user_vec = (await embeddings.embed_batch([message]))[0]
    await db.execute(
        """INSERT INTO cell_conversation_turns(project_id, cell_id, user_id, role, content, embedding)
           VALUES($1,$2,$3,'user',$4,$5::vector)""",
        project_id, cell_id, user.id, message, str(user_vec),
    )

    # traverse
    ctx_chunks, source_ids, trace = await traversal.traverse(db, project_id, cell_id, message)
    await cell_context.push_activity(project_id, cell_id, "traversal", {
        "seeds": trace["seeds"], "total_nodes": trace["total_nodes"], "source_ids": source_ids,
    })
    upstream = await cell_context.get_cell_analysis(project_id, cell_id)

    # cell-specific context: prompt, characteristics, policy docs
    cell_row = await db.fetchrow(
        "SELECT topic, prompt, characteristics, policy_doc_ids FROM flow_cells WHERE id=$1", cell_id
    )
    system_prompt = _build_system_prompt(cell_row)
    policy_text = await _get_policy_text(db, cell_row)

    context_text = "\n\n".join(ctx_chunks)
    user_content = f"Context from documents:\n{context_text}"
    if policy_text:
        user_content += f"\n\nFirm investment policy:\n{policy_text}"
    if upstream:
        user_content += f"\n\nPrior analysis for this topic:\n{upstream}"
    user_content += f"\n\nInvestor question: {message}"

    full_answer_parts: list[str] = []
    async for tok in stream_tokens(system_prompt, user_content):
        full_answer_parts.append(tok)
    full_answer = "".join(full_answer_parts)

    # embed + store assistant turn
    asst_vec = (await embeddings.embed_batch([full_answer]))[0]
    await db.execute(
        """INSERT INTO cell_conversation_turns(project_id, cell_id, user_id, role, content, embedding)
           VALUES($1,$2,$3,'assistant',$4,$5::vector)""",
        project_id, cell_id, user.id, full_answer, str(asst_vec),
    )

    # push both to Redis
    await cell_context.push_turn(project_id, cell_id, user.id, "user", message)
    await cell_context.push_turn(project_id, cell_id, user.id, "assistant", full_answer)

    return {"answer": full_answer, "sources": source_ids}


# ── GET /conversation/{session_id}/stream ────────────────

def _chunk_answer(answer: str, max_chars: int = 800) -> list[str]:
    """Split answer into paragraph-sized chunks for tighter embeddings."""
    paragraphs = [p.strip() for p in answer.split('\n\n') if p.strip()]
    chunks: list[str] = []
    for para in paragraphs:
        if len(para) <= max_chars:
            chunks.append(para)
        else:
            sentences = re.split(r'(?<=[.!?])\s+', para)
            current = ""
            for s in sentences:
                if len(current) + len(s) > max_chars and current:
                    chunks.append(current.strip())
                    current = s
                else:
                    current = (current + " " + s).strip()
            if current:
                chunks.append(current)
    return chunks or [answer[:max_chars]]


async def _save_turns(db: asyncpg.Pool, project_id: str, cell_id: str, user_id: str, question: str, answer: str) -> None:
    try:
        await db.execute(
            """INSERT INTO cell_conversation_turns(project_id, cell_id, user_id, role, content)
               VALUES($1,$2,$3,'user',$4)""",
            project_id, cell_id, user_id, question,
        )
        await db.execute(
            """INSERT INTO cell_conversation_turns(project_id, cell_id, user_id, role, content)
               VALUES($1,$2,$3,'assistant',$4)""",
            project_id, cell_id, user_id, answer,
        )
    except Exception:
        pass


async def _save_qa_to_kg(db: asyncpg.Pool, project_id: str, question: str, answer: str) -> None:
    """Chunk Q&A, embed each piece, store with a shared qa_group_id for sibling retrieval."""
    import uuid as _uuid
    try:
        asset_id = await db.fetchval(
            "SELECT id FROM assets WHERE project_id=$1 AND kind='text' AND filename='Conversation History' LIMIT 1",
            project_id,
        )
        if not asset_id:
            asset_id = await db.fetchval(
                """INSERT INTO assets(project_id, kind, filename, storage_key, status)
                   VALUES($1,'text','Conversation History',$2,'ready') RETURNING id""",
                project_id, f"{project_id}/conversation.txt",
            )

        next_idx = (await db.fetchval(
            "SELECT COALESCE(MAX(chunk_index)+1, 0) FROM chunks WHERE asset_id=$1", str(asset_id)
        )) or 0

        # Question as first chunk (what future queries will match against)
        # Answer split into paragraph chunks (retrieved as siblings)
        q_chunk = f"Q: {question}"
        a_chunks = _chunk_answer(answer)
        all_chunks = [q_chunk] + a_chunks

        qa_group_id = _uuid.uuid4()
        vecs = await embeddings.embed_batch(all_chunks)

        for i, (text, vec) in enumerate(zip(all_chunks, vecs)):
            await db.execute(
                """INSERT INTO chunks(asset_id, project_id, chunk_index, text, embedding, qa_group_id)
                   VALUES($1,$2,$3,$4,$5::vector,$6) ON CONFLICT DO NOTHING""",
                str(asset_id), project_id, next_idx + i, text, str(vec), qa_group_id,
            )

        await graph.build_similarity_edges(db, str(asset_id))
    except Exception:
        pass  # non-fatal


@router.get("/conversation/{session_id}/stream")
async def stream_answer(
    project_id: str,
    session_id: str,
    message: str,
    cell_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
    arq=Depends(get_arq),
):
    _DOCK_RE = re.compile(
        r'(?:move|place|dock|put|send)\s+(?:the\s+)?(.+?)\s+(?:window\s+)?(?:to\s+the\s+|to\s+)(left|right|top|bottom)',
        re.IGNORECASE,
    )

    async def event_gen():
        log.info(
            "[STREAM] project=%s  cell=%s  user=%s  message=%r",
            project_id, cell_id, user.id, message,
        )

        # 0. Fetch cell metadata first — needed for guardrail + system prompt
        cell_row = await db.fetchrow(
            "SELECT topic, prompt, description, characteristics, policy_doc_ids FROM flow_cells WHERE id=$1", cell_id
        )

        # 1. Jev check — guardrail + routing signals in one Haiku call
        jev: dict = {}
        if cell_row and cell_row.get("topic"):
            jev = await _cell_jev_check(
                message,
                cell_row["topic"] or "",
                cell_row.get("prompt") or cell_row.get("description") or "",
            )
            on_topic_score = jev.get("is_on_topic", 1.0)
            if on_topic_score < 0.4:
                topic_name = cell_row["topic"]
                log.warning(
                    "[GUARDRAIL] BLOCKED  project=%s  cell=%s  topic=%r  "
                    "on_topic=%.2f  message=%r",
                    project_id, cell_id, topic_name, on_topic_score, message,
                )
                yield f"data: {json.dumps({'type': 'guardrail', 'confidence': round(on_topic_score * 100), 'message': f'Your question does not seem related to this activity: {topic_name}. Please keep questions relevant to this topic.'})}\n\n"
                yield f"data: {json.dumps({'type': 'done', 'sources': []})}\n\n"
                return

        # 2. Dock-window shortcut — no LLM needed
        m = _DOCK_RE.search(message)
        if m:
            title_hint = m.group(1).strip()
            edge = m.group(2).lower()
            await cell_context.push_activity(project_id, cell_id, "dock_window", {"title_hint": title_hint, "edge": edge})
            yield f"data: {json.dumps({'type': 'text', 'text': f'Moved to {edge}.'})}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'sources': []})}\n\n"
            return

        # 3. KG traversal
        project_row = await db.fetchrow("SELECT startup_name FROM projects WHERE id=$1", project_id)
        company = (project_row["startup_name"] if project_row else "") or ""

        # Pull key entities/topics extracted from uploaded assets (pitch deck, docs, etc.)
        asset_rows = await db.fetch(
            "SELECT analysis_cache FROM assets WHERE project_id=$1 AND status='ready' ORDER BY created_at",
            project_id,
        )
        project_entities: list[str] = []
        for ar in asset_rows:
            cache = ar["analysis_cache"] or {}
            if isinstance(cache, str):
                try:
                    cache = json.loads(cache)
                except Exception:
                    cache = {}
            project_entities.extend(cache.get("entities", [])[:8])
            project_entities.extend(cache.get("topics", [])[:4])
        # Dedupe while preserving order, cap at 20
        seen: set[str] = set()
        deduped: list[str] = []
        for e in project_entities:
            low = e.lower()
            if low not in seen:
                seen.add(low)
                deduped.append(e)
        project_entities = deduped[:20]

        ctx_chunks, source_ids, trace = await traversal.traverse(db, project_id, cell_id, message)

        avg_rel = trace["avg_top_relevance"]
        log.info(
            "[TRAVERSAL] project=%s  cell=%s  seeds=%d  total_nodes=%d  "
            "chunks_returned=%d  avg_relevance=%.3f  source_assets=%s",
            project_id, cell_id,
            len(trace["seeds"]), trace["total_nodes"],
            len(ctx_chunks), avg_rel,
            source_ids,
        )
        yield f"data: {json.dumps({'type': 'traversal', 'seeds': trace['seeds'], 'total_nodes': trace['total_nodes'], 'source_ids': trace['source_ids'], 'avg_top_relevance': avg_rel})}\n\n"
        await cell_context.push_activity(project_id, cell_id, "traversal", {
            "seeds": trace["seeds"], "total_nodes": trace["total_nodes"], "source_ids": source_ids, "avg_top_relevance": avg_rel,
        })

        # Handle explicit URL intent for browser session
        explicit_url, _ = _detect_intent(message)
        if explicit_url:
            await arq.enqueue_job("run_agent_browser_session", project_id, cell_id, explicit_url)

        # 2. Route: RAG-only if hybrid traversal covers the question well, else RAG+Serper
        # Threshold is lower than pure cosine (0.82) because graph-decayed nodes pull avg down
        _RAG_ONLY_THRESHOLD = 0.65
        # Jev signals replace the old keyword set for biographical/web-search detection
        force_web = (
            jev.get("is_biographical", 0) > 0.55 or
            jev.get("needs_web_search", 0) > 0.55
        )
        use_web = force_web or avg_rel < _RAG_ONLY_THRESHOLD
        route_label = "rag+serper" if use_web else "rag_only"
        log.info(
            "[ROUTE] project=%s  cell=%s  route=%s  "
            "avg_rel=%.3f  threshold=%.2f  force_web=%s  "
            "is_biographical=%.2f  needs_web_search=%.2f",
            project_id, cell_id, route_label,
            avg_rel, _RAG_ONLY_THRESHOLD, force_web,
            jev.get("is_biographical", 0), jev.get("needs_web_search", 0),
        )

        await cell_context.push_activity(project_id, cell_id, "route", {
            "route": route_label,
            "avg_top_relevance": avg_rel,
            "threshold": _RAG_ONLY_THRESHOLD,
        })

        all_web_results: list[dict] = []
        scraped_context_parts: list[str] = []

        if use_web:
            intent_data = await agent_actions.classify_search_intent(message, company, ctx_chunks, project_entities)
            await cell_context.push_activity(project_id, cell_id, "intent", intent_data)

            queries = (intent_data.get("queries") or [f'"{company}" {message}'])[:3]
            doc_urls = (intent_data.get("urls") or [])[:3]
            log.info(
                "[SEARCH:INTENT] project=%s  cell=%s  intent=%r  queries=%s  urls=%s",
                project_id, cell_id,
                intent_data.get("intent", ""),
                queries, doc_urls,
            )

            for q in queries:
                await cell_context.push_activity(project_id, cell_id, "search_start", {"query": q})
                log.info("[SEARCH:QUERY] project=%s  cell=%s  query=%r", project_id, cell_id, q)

            search_tasks = [asyncio.create_task(agent_actions.web_search(q)) for q in queries]
            scrape_tasks = [asyncio.create_task(agent_actions.extract_page_text(u)) for u in doc_urls]

            search_results_list = await asyncio.gather(*search_tasks, return_exceptions=True)
            scrape_results_list = await asyncio.gather(*scrape_tasks, return_exceptions=True)

            for r in search_results_list:
                if isinstance(r, list):
                    all_web_results.extend(r)

            if all_web_results:
                seen: set[str] = set()
                deduped = []
                for r in all_web_results:
                    if r.get("link") not in seen:
                        seen.add(r.get("link", ""))
                        deduped.append(r)
                all_web_results = deduped
                log.info(
                    "[SEARCH:RESULTS] project=%s  cell=%s  total_results=%d  titles=%s",
                    project_id, cell_id, len(all_web_results),
                    [r.get("title", "")[:50] for r in all_web_results[:4]],
                )
                await cell_context.push_activity(project_id, cell_id, "search_done", {"results": all_web_results})

            for url, result in zip(doc_urls, scrape_results_list):
                if isinstance(result, str) and result:
                    scraped_context_parts.append(f"[From {url}]\n{result[:1500]}")
                    await cell_context.push_activity(project_id, cell_id, "browser_start", {"url": url})

            # Scrape LinkedIn profiles found in search results (not in pitch deck)
            li_urls = [
                r["link"] for r in all_web_results
                if "linkedin.com/in/" in r.get("link", "")
            ][:2]
            if li_urls:
                li_scrape = await asyncio.gather(
                    *[agent_actions.extract_page_text(u) for u in li_urls],
                    return_exceptions=True,
                )
                for url, result in zip(li_urls, li_scrape):
                    if isinstance(result, str) and result:
                        scraped_context_parts.append(f"[LinkedIn: {url}]\n{result[:2000]}")
                        await cell_context.push_activity(project_id, cell_id, "browser_start", {"url": url})

        # 4. Build combined context
        upstream = await cell_context.get_cell_analysis(project_id, cell_id)
        policy_text = await _get_policy_text(db, cell_row)

        user_content = f"Context from documents:\n{chr(10).join(ctx_chunks)}"

        if all_web_results:
            web_ctx = "\n".join(
                f"• {r['title']}: {r['snippet']}" for r in all_web_results[:8] if r.get("snippet")
            )
            user_content += f"\n\nWeb research results (intent: {intent_data.get('intent', '')}):\n{web_ctx}"

        if scraped_context_parts:
            user_content += f"\n\nLive page content:\n" + "\n\n".join(scraped_context_parts)

        if policy_text:
            user_content += f"\n\nFirm investment policy:\n{policy_text}"
        if upstream:
            user_content += f"\n\nPrior analysis for this topic:\n{upstream}"
        user_content += f"\n\nQuestion: {message}"

        # 5. Stream LLM response
        log.info(
            "[LLM:START] project=%s  cell=%s  context_chars=%d  web_results=%d",
            project_id, cell_id, len(user_content), len(all_web_results),
        )
        answer_parts: list[str] = []
        try:
            async for tok in stream_tokens(_build_system_prompt(cell_row), user_content):
                yield f"data: {json.dumps({'type': 'token', 'token': tok})}\n\n"
                answer_parts.append(tok)
            log.info(
                "[LLM:DONE] project=%s  cell=%s  answer_chars=%d",
                project_id, cell_id, sum(len(t) for t in answer_parts),
            )
        except Exception as exc:
            log.error("[LLM:ERROR] project=%s  cell=%s  error=%s", project_id, cell_id, exc)
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"

        # Resolve asset filenames + presigned download URLs for citation chips
        sources_out: list[dict] = []
        if source_ids:
            fname_rows = await db.fetch(
                "SELECT id::text, filename, storage_key FROM assets WHERE id = ANY($1::uuid[])", source_ids
            )
            meta = {r["id"]: r for r in fname_rows}
            for sid in source_ids:
                row = meta.get(sid)
                if not row:
                    continue
                try:
                    url = storage.presigned_download_url(row["storage_key"])
                except Exception:
                    url = None
                sources_out.append({"id": sid, "name": row["filename"], "url": url})
        yield f"data: {json.dumps({'type': 'done', 'sources': sources_out})}\n\n"

        # Push citation sources to activity feed so WindowCanvas can spawn document cards
        if sources_out:
            log.info(
                "[SOURCES] project=%s  cell=%s  citations=%s",
                project_id, cell_id, [s["name"] for s in sources_out],
            )
            await cell_context.push_activity(project_id, cell_id, "sources_done", {"sources": sources_out})

        # 6. Save Q&A back to KG and persist turns — fire-and-forget so SSE connection closes immediately
        if answer_parts:
            full_answer = "".join(answer_parts)
            asyncio.create_task(_save_qa_to_kg(db, project_id, message, full_answer))
            asyncio.create_task(_save_turns(db, project_id, cell_id, user.id, message, full_answer))

    return StreamingResponse(event_gen(), media_type="text/event-stream")


# ── POST /conversation/{session_id}/submit ────────────────

async def maybe_close_collection(db: asyncpg.Pool, arq, project_id: str) -> None:
    total = await db.fetchval(
        "SELECT COUNT(*) FROM project_members WHERE project_id=$1", project_id
    )
    submitted = await db.fetchval(
        "SELECT COUNT(*) FROM conversation_sessions WHERE project_id=$1 AND status='submitted'",
        project_id,
    )
    if total and submitted >= total:
        await db.execute("UPDATE projects SET status='consensus' WHERE id=$1", project_id)
        await arq.enqueue_job("run_group_consensus", project_id)


@router.post("/conversation/{session_id}/submit")
async def submit_session(
    project_id: str,
    session_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
    arq=Depends(get_arq),
):
    await db.execute(
        "UPDATE conversation_sessions SET status='submitted', submitted_at=now() WHERE id=$1 AND project_id=$2",
        session_id, project_id,
    )
    await maybe_close_collection(db, arq, project_id)
    return {"ok": True}


# ── PATCH /conversation/{session_id}/confidence ──────────


class ConfidenceBody(BaseModel):
    cell_id: str
    score: int  # 1–5


@router.patch("/conversation/{session_id}/confidence")
async def set_confidence(
    project_id: str,
    session_id: str,
    body: ConfidenceBody,
    user: CurrentUser = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    if not 1 <= body.score <= 10:
        raise HTTPException(400, "score must be 1-10")
    await db.execute(
        """UPDATE conversation_sessions
           SET cell_confidence = COALESCE(cell_confidence, '{}') || jsonb_build_object($1::text, $2::int)
           WHERE id=$3 AND project_id=$4""",
        body.cell_id, body.score, session_id, project_id,
    )
    return {"ok": True}


# ── POST /conversation/{session_id}/voice ─────────────────

@router.post("/conversation/{session_id}/voice")
async def voice_message(
    project_id: str,
    session_id: str,
    audio: UploadFile = File(...),
    user: CurrentUser = Depends(get_current_user),
):
    data = await audio.read()
    log.info(
        "[VOICE] project=%s  session=%s  user=%s  audio_bytes=%d",
        project_id, session_id, user.id, len(data),
    )
    try:
        transcript = await whisper_extract.extract(data, audio.filename or "voice.webm")
        log.info("[VOICE] project=%s  user=%s  transcript=%r", project_id, user.id, transcript)
        return {"transcript": transcript}
    except Exception as exc:
        log.error("[VOICE] transcription failed  project=%s  user=%s  error=%s", project_id, user.id, exc)
        raise
