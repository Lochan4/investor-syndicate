from __future__ import annotations
import json
import logging

import asyncpg
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.dependencies import CurrentUser, get_current_user, get_db
from app.services.llm import get_async_client
from app.services.extractors import audio as whisper_extract

router = APIRouter(tags=["investor"])
log = logging.getLogger("investor")

_HAIKU = "claude-haiku-4-5-20251001"

# Single-intent classifiers — deterministic routing, no probability ambiguity
_INVESTOR_JEV = """\
Classify this investor dashboard voice query into ONE specific intent.

EXAMPLES:
"show my projects" → {{"intent":"projects","navigation_target":""}}
"show me the projects" → {{"intent":"projects","navigation_target":""}}
"what projects do I have" → {{"intent":"projects","navigation_target":""}}
"active projects" → {{"intent":"active","navigation_target":""}}
"show workspaces" → {{"intent":"workspaces","navigation_target":""}}
"open leaps" → {{"intent":"navigate","navigation_target":"leaps"}}
"show everything" → {{"intent":"all","navigation_target":""}}

RULES:
- "show me X" / "show X" / "just X" / "only X" → that specific X intent
- "open [name]" / "go to [name]" → navigate with that name
- "all" ONLY for genuinely ambiguous queries like "show me everything" or "what do I have"

Query: "{message}"

Return ONLY the JSON object, no other text:"""

_ADMIN_JEV = """\
Classify this admin dashboard voice query into ONE specific intent.

EXAMPLES:
"show me the applications" → {{"intent":"applications","navigation_target":""}}
"show applications" → {{"intent":"applications","navigation_target":""}}
"just applications" → {{"intent":"applications","navigation_target":""}}
"pending applications" → {{"intent":"pending_applications","navigation_target":""}}
"show me the projects" → {{"intent":"projects","navigation_target":""}}
"show workspaces" → {{"intent":"workspaces","navigation_target":""}}
"open leaps" → {{"intent":"navigate","navigation_target":"leaps"}}
"show everything" → {{"intent":"all","navigation_target":""}}

RULES:
- "show me X" / "show X" / "just X" / "only X" → that specific X intent
- "open [name]" / "go to [name]" → navigate with that name
- "all" ONLY for genuinely ambiguous queries like "show me everything" or "what do I have"
- Valid intents: applications, pending_applications, workspaces, projects, navigate, all

Query: "{message}"

Return ONLY the JSON object, no other text:"""


class Stage1Body(BaseModel):
    message: str


# ── POST /investor/stage1 ─────────────────────────────────

@router.post("/investor/stage1")
async def investor_stage1(
    body: Stage1Body,
    user: CurrentUser = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    log.info("[STAGE1:INVESTOR] user=%s  query=%r", user.id, body.message)

    client = get_async_client()
    try:
        msg = await client.messages.create(
            model=_HAIKU,
            max_tokens=64,
            system='You are a JSON classifier. Output ONLY a valid JSON object, nothing else.',
            messages=[{"role": "user", "content": _INVESTOR_JEV.format(message=body.message)}],
        )
        raw_jev = msg.content[0].text.strip()
        if raw_jev.startswith("```"):
            raw_jev = raw_jev.split("```")[1].lstrip("json").strip()
        d = json.loads(raw_jev)
        log.info("[JEV:INVESTOR] intent=%r  nav_target=%r", d.get("intent"), d.get("navigation_target"))
    except Exception as exc:
        log.error("[JEV:INVESTOR] parse failed: %s", exc)
        d = {"intent": "all"}

    intent = d.get("intent", "all")
    nav_target = d.get("navigation_target", "").strip()

    if intent == "navigate" and nav_target:
        log.info("[DECISION:INVESTOR] NAVIGATE  target=%r", nav_target)
        row = await db.fetchrow(
            """SELECT p.id FROM projects p
               JOIN project_members pm ON pm.project_id = p.id
               WHERE pm.user_id = $1 AND LOWER(p.startup_name) LIKE $2
               ORDER BY p.created_at DESC LIMIT 1""",
            user.id, f"%{nav_target.lower()}%",
        )
        if row:
            route = f"/investor/{row['id']}"
            log.info("[DECISION:INVESTOR] resolved %r → %s", nav_target, route)
            return {"intent": "navigate", "route": route, "navigation_target": nav_target, "message": f"Opening {nav_target}.", "projects": [], "workspaces": []}
        log.warning("[DECISION:INVESTOR] no project matched %r for user=%s", nav_target, user.id)
        return {"intent": "navigate", "route": None, "navigation_target": nav_target, "message": f"No project found matching '{nav_target}'.", "projects": [], "workspaces": []}

    fetch_projects = intent in ("projects", "active", "assigned", "all")
    fetch_workspaces = intent in ("workspaces", "all")
    log.info("[DECISION:INVESTOR] RESULTS  intent=%r  fetch_projects=%s  fetch_workspaces=%s", intent, fetch_projects, fetch_workspaces)

    projects: list[dict] = []
    workspaces: list[dict] = []

    if fetch_projects:
        rows = await db.fetch(
            """SELECT p.id, p.startup_name, p.sector, p.stage, p.status, p.created_at, pm.role
               FROM projects p
               JOIN project_members pm ON pm.project_id = p.id
               WHERE pm.user_id = $1
               ORDER BY p.created_at DESC""",
            user.id,
        )
        all_projects = [dict(r) for r in rows]

        if intent == "active":
            projects = [p for p in all_projects if p["status"] == "open"]
            log.info("[DECISION:INVESTOR] filtered to active-only → %d projects", len(projects))
        elif intent == "assigned":
            started = await db.fetch(
                "SELECT DISTINCT project_id FROM cell_conversation_turns WHERE user_id=$1",
                user.id,
            )
            started_ids = {str(r["project_id"]) for r in started}
            projects = [p for p in all_projects if str(p["id"]) in started_ids]
            log.info("[DECISION:INVESTOR] filtered to assigned-only → %d projects", len(projects))
        else:
            projects = all_projects
            log.info("[DECISION:INVESTOR] returning all %d projects", len(projects))

    if fetch_workspaces:
        ws_rows = await db.fetch(
            """SELECT w.id, w.name, w.description, wm.role
               FROM workspaces w
               JOIN workspace_members wm ON wm.workspace_id = w.id
               WHERE wm.user_id = $1
               ORDER BY w.created_at DESC""",
            user.id,
        )
        workspaces = [dict(r) for r in ws_rows]
        log.info("[DECISION:INVESTOR] returning %d workspaces", len(workspaces))

    parts = []
    if projects:
        parts.append(f"{len(projects)} project(s)")
    if workspaces:
        parts.append(f"{len(workspaces)} workspace(s)")
    summary = f"Here are your {' and '.join(parts)}." if parts else "No results found."

    return {
        "intent": "results",
        "message": summary,
        "projects": [
            {
                "id": str(p["id"]),
                "startup_name": p["startup_name"],
                "sector": p.get("sector"),
                "stage": p.get("stage"),
                "status": p["status"],
                "role": p.get("role"),
            }
            for p in projects
        ],
        "workspaces": [
            {
                "id": str(w["id"]),
                "name": w["name"],
                "description": w.get("description"),
                "role": w.get("role"),
            }
            for w in workspaces
        ],
    }


# ── POST /admin/stage1 ────────────────────────────────────

@router.post("/admin/stage1")
async def admin_stage1(
    body: Stage1Body,
    user: CurrentUser = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    if user.platform_role not in ("super_admin", "admin", "developer"):
        log.warning("[STAGE1:ADMIN] forbidden user=%s role=%s", user.id, user.platform_role)
        raise HTTPException(403, "Admin access required")

    log.info("[STAGE1:ADMIN] user=%s  query=%r", user.id, body.message)

    client = get_async_client()
    try:
        msg = await client.messages.create(
            model=_HAIKU,
            max_tokens=64,
            system='You are a JSON classifier. Output ONLY a valid JSON object, nothing else.',
            messages=[{"role": "user", "content": _ADMIN_JEV.format(message=body.message)}],
        )
        raw_jev = msg.content[0].text.strip()
        if raw_jev.startswith("```"):
            raw_jev = raw_jev.split("```")[1].lstrip("json").strip()
        d = json.loads(raw_jev)
        log.info("[JEV:ADMIN] intent=%r  nav_target=%r", d.get("intent"), d.get("navigation_target"))
    except Exception as exc:
        log.error("[JEV:ADMIN] parse failed: %s", exc)
        d = {"intent": "all"}

    intent = d.get("intent", "all")
    nav_target = d.get("navigation_target", "").strip()

    if intent == "navigate" and nav_target:
        log.info("[DECISION:ADMIN] NAVIGATE  target=%r", nav_target)
        row = await db.fetchrow(
            "SELECT id FROM projects WHERE LOWER(startup_name) LIKE $1 ORDER BY created_at DESC LIMIT 1",
            f"%{nav_target.lower()}%",
        )
        if row:
            route = f"/investor/{row['id']}"
            log.info("[DECISION:ADMIN] resolved %r → project %s", nav_target, route)
            return {"intent": "navigate", "route": route, "navigation_target": nav_target, "message": f"Opening {nav_target}.", "applications": [], "workspaces": [], "projects": []}
        row = await db.fetchrow(
            "SELECT id FROM startup_applications WHERE LOWER(startup_name) LIKE $1 ORDER BY created_at DESC LIMIT 1",
            f"%{nav_target.lower()}%",
        )
        if row:
            route = f"/admin/inbox/{row['id']}"
            log.info("[DECISION:ADMIN] resolved %r → application %s", nav_target, route)
            return {"intent": "navigate", "route": route, "navigation_target": nav_target, "message": f"Opening {nav_target}.", "applications": [], "workspaces": [], "projects": []}
        log.warning("[DECISION:ADMIN] no match found for target=%r", nav_target)
        return {"intent": "navigate", "route": None, "navigation_target": nav_target, "message": f"No match found for '{nav_target}'.", "applications": [], "workspaces": [], "projects": []}

    fetch_apps = intent in ("applications", "pending_applications", "all")
    fetch_workspaces = intent in ("workspaces", "all")
    fetch_projects = intent in ("projects", "all")
    log.info("[DECISION:ADMIN] RESULTS  intent=%r  fetch_apps=%s  fetch_workspaces=%s  fetch_projects=%s", intent, fetch_apps, fetch_workspaces, fetch_projects)

    applications: list[dict] = []
    workspaces: list[dict] = []
    projects: list[dict] = []

    if fetch_apps:
        rows = await db.fetch(
            """SELECT id, founder_name, startup_name, sector, stage, status, created_at
               FROM startup_applications ORDER BY created_at DESC LIMIT 50"""
        )
        all_apps = [dict(r) for r in rows]
        if intent == "pending_applications":
            applications = [a for a in all_apps if a["status"] in ("submitted", "reviewing")]
            log.info("[DECISION:ADMIN] filtered to pending-only → %d applications", len(applications))
        else:
            applications = all_apps
            log.info("[DECISION:ADMIN] returning all %d applications", len(applications))

    if fetch_workspaces:
        rows = await db.fetch(
            "SELECT id, name, description, created_at FROM workspaces ORDER BY created_at DESC LIMIT 20"
        )
        workspaces = [dict(r) for r in rows]
        log.info("[DECISION:ADMIN] returning %d workspaces", len(workspaces))

    if fetch_projects:
        rows = await db.fetch(
            "SELECT id, startup_name, sector, stage, status, created_at FROM projects ORDER BY created_at DESC LIMIT 30"
        )
        projects = [dict(r) for r in rows]
        log.info("[DECISION:ADMIN] returning %d projects", len(projects))

    parts = []
    if applications:
        parts.append(f"{len(applications)} application(s)")
    if workspaces:
        parts.append(f"{len(workspaces)} workspace(s)")
    if projects:
        parts.append(f"{len(projects)} project(s)")
    summary = f"Showing {', '.join(parts)}." if parts else "Nothing found for your query."

    return {
        "intent": "results",
        "message": summary,
        "applications": [
            {
                "id": str(a["id"]),
                "founder_name": a["founder_name"],
                "startup_name": a["startup_name"],
                "sector": a.get("sector"),
                "stage": a.get("stage"),
                "status": a["status"],
            }
            for a in applications
        ],
        "workspaces": [
            {"id": str(w["id"]), "name": w["name"], "description": w.get("description")}
            for w in workspaces
        ],
        "projects": [
            {
                "id": str(p["id"]),
                "startup_name": p["startup_name"],
                "sector": p.get("sector"),
                "status": p["status"],
            }
            for p in projects
        ],
    }


# ── POST /investor/transcribe ─────────────────────────────

@router.post("/investor/transcribe")
async def transcribe(
    audio: UploadFile = File(...),
    user: CurrentUser = Depends(get_current_user),
):
    """Session-free audio transcription for Stage 1 and Stage 2 voice input."""
    data = await audio.read()
    log.info("[TRANSCRIBE] user=%s  audio_bytes=%d  filename=%s", user.id, len(data), audio.filename)
    try:
        transcript = await whisper_extract.extract(data, audio.filename or "voice.webm")
        log.info("[TRANSCRIBE] user=%s  result=%r", user.id, transcript)
        return {"transcript": transcript}
    except Exception as exc:
        log.error("[TRANSCRIBE] failed for user=%s: %s", user.id, exc)
        raise
