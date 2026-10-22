from __future__ import annotations
import json

import asyncpg
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.dependencies import CurrentUser, get_current_user, get_db
from app.services.llm import get_async_client
from app.services.extractors import audio as whisper_extract

router = APIRouter(tags=["investor"])

_HAIKU = "claude-haiku-4-5-20251001"

# Jev-style: all decisions in one call, probabilities 0.0–1.0
_INVESTOR_JEV = """\
You are a decision classifier. Answer ALL questions about this investor voice query simultaneously.
Return ONLY valid JSON — no other text. Float values 0.0-1.0. navigation_target is a string.

Query: "{message}"

{{"is_asking_for_projects": 0.0, "is_asking_for_workspaces": 0.0, "is_active_only": 0.0, "is_assigned_only": 0.0, "is_navigation_command": 0.0, "navigation_target": ""}}"""

_ADMIN_JEV = """\
You are a decision classifier. Answer ALL questions about this admin voice query simultaneously.
Return ONLY valid JSON — no other text. Float values 0.0-1.0. navigation_target is a string.

Query: "{message}"

{{"is_asking_for_applications": 0.0, "is_pending_only": 0.0, "is_asking_for_workspaces": 0.0, "is_asking_for_projects": 0.0, "is_navigation_command": 0.0, "navigation_target": ""}}"""


class Stage1Body(BaseModel):
    message: str


# ── POST /investor/stage1 ─────────────────────────────────

@router.post("/investor/stage1")
async def investor_stage1(
    body: Stage1Body,
    user: CurrentUser = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    client = get_async_client()
    msg = await client.messages.create(
        model=_HAIKU,
        max_tokens=128,
        messages=[{"role": "user", "content": _INVESTOR_JEV.format(message=body.message)}],
    )
    try:
        d = json.loads(msg.content[0].text.strip())
    except Exception:
        d = {}

    # Navigation command — return early, frontend handles routing
    if d.get("is_navigation_command", 0) > 0.75 and d.get("navigation_target", "").strip():
        nav = d["navigation_target"].strip()
        return {"intent": "navigate", "navigation_target": nav, "message": f"Going to {nav}.", "projects": [], "workspaces": []}

    fetch_projects = (
        d.get("is_asking_for_projects", 0) > 0.45 or
        d.get("is_active_only", 0) > 0.45 or
        d.get("is_assigned_only", 0) > 0.45
    )
    fetch_workspaces = d.get("is_asking_for_workspaces", 0) > 0.45
    # Default to general (fetch both) when nothing specific was detected
    if not fetch_projects and not fetch_workspaces:
        fetch_projects = fetch_workspaces = True

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

        if d.get("is_active_only", 0) > 0.45:
            projects = [p for p in all_projects if p["status"] == "open"]
        elif d.get("is_assigned_only", 0) > 0.45:
            started = await db.fetch(
                "SELECT DISTINCT project_id FROM cell_conversation_turns WHERE user_id=$1",
                user.id,
            )
            started_ids = {str(r["project_id"]) for r in started}
            projects = [p for p in all_projects if str(p["id"]) in started_ids]
        else:
            projects = all_projects

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
        raise HTTPException(403, "Admin access required")

    client = get_async_client()
    msg = await client.messages.create(
        model=_HAIKU,
        max_tokens=128,
        messages=[{"role": "user", "content": _ADMIN_JEV.format(message=body.message)}],
    )
    try:
        d = json.loads(msg.content[0].text.strip())
    except Exception:
        d = {}

    fetch_apps = d.get("is_asking_for_applications", 0) > 0.45 or d.get("is_pending_only", 0) > 0.45
    fetch_workspaces = d.get("is_asking_for_workspaces", 0) > 0.45
    fetch_projects = d.get("is_asking_for_projects", 0) > 0.45
    # Default to general
    if not fetch_apps and not fetch_workspaces and not fetch_projects:
        fetch_apps = fetch_workspaces = fetch_projects = True

    applications: list[dict] = []
    workspaces: list[dict] = []
    projects: list[dict] = []

    if fetch_apps:
        rows = await db.fetch(
            """SELECT id, founder_name, startup_name, sector, stage, status, created_at
               FROM applications ORDER BY created_at DESC LIMIT 50"""
        )
        all_apps = [dict(r) for r in rows]
        if d.get("is_pending_only", 0) > 0.45:
            applications = [a for a in all_apps if a["status"] in ("submitted", "reviewing")]
        else:
            applications = all_apps

    if fetch_workspaces:
        rows = await db.fetch(
            "SELECT id, name, description, created_at FROM workspaces ORDER BY created_at DESC LIMIT 20"
        )
        workspaces = [dict(r) for r in rows]

    if fetch_projects:
        rows = await db.fetch(
            "SELECT id, startup_name, sector, stage, status, created_at FROM projects ORDER BY created_at DESC LIMIT 30"
        )
        projects = [dict(r) for r in rows]

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
    transcript = await whisper_extract.extract(data, audio.filename or "voice.webm")
    return {"transcript": transcript}
