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
from app.services.llm import get_async_client
from app.services import cell_context, traversal
from app.services import embeddings
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
    if chars:
        weighted = "\n".join(
            f"  - {c['name']} (importance: {c['strength']}/10)" for c in chars
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


_SEARCH_KEYWORDS = ("search", "find", "look up", "who is", "what is", "open", "visit", "check", "show me", "browse")


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
    ctx_chunks, source_ids, _ = await traversal.traverse(db, project_id, cell_id, message)
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

    client = _anthropic()
    async with client.messages.stream(
        model=_HAIKU,
        max_tokens=1024,
        system=system_prompt,
        messages=[{"role": "user", "content": user_content}],
    ) as stream:
        full_answer = await stream.get_final_text()

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
        ctx_chunks, source_ids, trace = await traversal.traverse(db, project_id, cell_id, message)
        yield f"data: {json.dumps({'type': 'traversal', 'seeds': trace['seeds'], 'total_nodes': trace['total_nodes'], 'source_ids': trace['source_ids']})}\n\n"

        # enqueue agent action based on message intent
        url, query = _detect_intent(message)
        if url:
            await arq.enqueue_job("run_agent_browser_session", project_id, cell_id, url)
        elif query:
            await arq.enqueue_job("run_agent_web_search", project_id, cell_id, query)

        upstream = await cell_context.get_cell_analysis(project_id, cell_id)
        cell_row = await db.fetchrow(
            "SELECT topic, prompt, characteristics, policy_doc_ids FROM flow_cells WHERE id=$1", cell_id
        )
        policy_text = await _get_policy_text(db, cell_row)

        context_text = "\n\n".join(ctx_chunks)
        user_content = f"Context:\n{context_text}"
        if policy_text:
            user_content += f"\n\nFirm investment policy:\n{policy_text}"
        if upstream:
            user_content += f"\n\nPrior analysis:\n{upstream}"
        user_content += f"\n\nQuestion: {message}"

        client = _anthropic()
        async with client.messages.stream(
            model=_HAIKU,
            max_tokens=1024,
            system=_build_system_prompt(cell_row),
            messages=[{"role": "user", "content": user_content}],
        ) as stream:
            async for tok in stream.text_stream:
                yield f"data: {json.dumps({'type': 'token', 'token': tok})}\n\n"

        yield f"data: {json.dumps({'type': 'done', 'sources': source_ids})}\n\n"

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
