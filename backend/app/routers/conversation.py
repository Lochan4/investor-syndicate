from __future__ import annotations
import asyncio
import json
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

_HAIKU = "claude-haiku-4-5-20251001"


def _anthropic():
    return get_async_client()


def _build_system_prompt(cell_row) -> str:
    base = "You are an AI assistant helping investors conduct due diligence."
    if not cell_row:
        return base + " Answer based on the provided document context. Be concise and accurate."
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
    parts.append("Answer based on the provided document context. Be concise and accurate.")
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

async def _save_qa_to_kg(db: asyncpg.Pool, project_id: str, question: str, answer: str) -> None:
    """Embed the Q&A pair and upsert it into the project KG as a conversation chunk."""
    try:
        # Get or create a conversation asset for this project
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

        qa_text = f"Q: {question}\nA: {answer}"
        vec = (await embeddings.embed_batch([qa_text]))[0]
        await db.execute(
            """INSERT INTO chunks(asset_id, project_id, chunk_index, text, embedding)
               VALUES($1,$2,$3,$4,$5::vector) ON CONFLICT DO NOTHING""",
            str(asset_id), project_id, next_idx, qa_text, str(vec),
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
    async def event_gen():
        # 1. KG traversal
        project_row = await db.fetchrow("SELECT startup_name FROM projects WHERE id=$1", project_id)
        company = (project_row["startup_name"] if project_row else "") or ""

        ctx_chunks, source_ids, trace = await traversal.traverse(db, project_id, cell_id, message)

        yield f"data: {json.dumps({'type': 'traversal', 'seeds': trace['seeds'], 'total_nodes': trace['total_nodes'], 'source_ids': trace['source_ids']})}\n\n"
        await cell_context.push_activity(project_id, cell_id, "traversal", {
            "seeds": trace["seeds"], "total_nodes": trace["total_nodes"], "source_ids": source_ids,
        })

        # Handle explicit URL intent for browser session
        explicit_url, _ = _detect_intent(message)
        if explicit_url:
            await arq.enqueue_job("run_agent_browser_session", project_id, cell_id, explicit_url)

        # 2. AI judge: classify intent → targeted queries + doc URLs
        intent_data = await agent_actions.classify_search_intent(message, company, ctx_chunks)
        await cell_context.push_activity(project_id, cell_id, "intent", intent_data)

        # 3. Targeted Serper searches + doc URL scraping in parallel
        queries = (intent_data.get("queries") or [f'"{company}" {message}'])[:2]
        doc_urls = (intent_data.get("urls") or [])[:3]

        for q in queries:
            await cell_context.push_activity(project_id, cell_id, "search_start", {"query": q})

        search_tasks = [asyncio.create_task(agent_actions.web_search(q)) for q in queries]
        scrape_tasks = [asyncio.create_task(agent_actions.extract_page_text(u)) for u in doc_urls]

        search_results_list = await asyncio.gather(*search_tasks, return_exceptions=True)
        scrape_results_list = await asyncio.gather(*scrape_tasks, return_exceptions=True)

        all_web_results: list[dict] = []
        for r in search_results_list:
            if isinstance(r, list):
                all_web_results.extend(r)

        if all_web_results:
            # Deduplicate by link
            seen: set[str] = set()
            deduped = []
            for r in all_web_results:
                if r.get("link") not in seen:
                    seen.add(r.get("link", ""))
                    deduped.append(r)
            all_web_results = deduped
            await cell_context.push_activity(project_id, cell_id, "search_done", {"results": all_web_results})

        scraped_context_parts: list[str] = []
        for url, result in zip(doc_urls, scrape_results_list):
            if isinstance(result, str) and result:
                scraped_context_parts.append(f"[From {url}]\n{result[:1500]}")
                await cell_context.push_activity(project_id, cell_id, "browser_start", {"url": url})

        # 4. Build combined context
        upstream = await cell_context.get_cell_analysis(project_id, cell_id)
        cell_row = await db.fetchrow(
            "SELECT topic, prompt, characteristics, policy_doc_ids FROM flow_cells WHERE id=$1", cell_id
        )
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
        answer_parts: list[str] = []
        try:
            async for tok in stream_tokens(_build_system_prompt(cell_row), user_content):
                yield f"data: {json.dumps({'type': 'token', 'token': tok})}\n\n"
                answer_parts.append(tok)
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

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

        # 6. Save Q&A back to KG
        if answer_parts:
            await _save_qa_to_kg(db, project_id, message, "".join(answer_parts))

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
    transcript = await whisper_extract.extract(data, audio.filename or "voice.webm")
    return {"transcript": transcript}
