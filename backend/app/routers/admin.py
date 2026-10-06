from __future__ import annotations
import hashlib
import hmac
import os
import time

import asyncpg
from fastapi import APIRouter, Depends, Header, HTTPException, Request

from pydantic import BaseModel

from app.dependencies import CurrentUser, get_current_user, get_db, require_admin
from app.schemas import InviteCreate, InviteResponse, WorkOSWebhookPayload
from app.services import webhook as webhook_svc
from app.services.workos import get_client

router = APIRouter(tags=["admin"])

CANVAS_EDITOR_ROLES = {"super_admin", "admin", "developer"}


# ── Current user profile ──────────────────────────────────

@router.get("/me")
async def get_me(user: CurrentUser = Depends(get_current_user)):
    return {
        "id": user.id,
        "email": user.email,
        "platform_role": user.platform_role,
        "can_edit_canvas": user.platform_role in CANVAS_EDITOR_ROLES,
    }


# ── User management (super_admin only) ───────────────────

@router.get("/admin/users")
async def list_users(
    _user: CurrentUser = Depends(require_admin),
    db: asyncpg.Pool = Depends(get_db),
):
    rows = await db.fetch(
        "SELECT id, email, platform_role, status, created_at FROM users ORDER BY created_at DESC"
    )
    return [dict(r) for r in rows]


class RoleUpdate(BaseModel):
    platform_role: str


@router.patch("/admin/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    body: RoleUpdate,
    _user: CurrentUser = Depends(require_admin),
    db: asyncpg.Pool = Depends(get_db),
):
    allowed = {"super_admin", "admin", "developer", "investor"}
    if body.platform_role not in allowed:
        raise HTTPException(400, f"Role must be one of {allowed}")
    if user_id == _user.id:
        raise HTTPException(400, "Cannot change your own role")
    updated = await db.fetchval(
        "UPDATE users SET platform_role=$1 WHERE id=$2 RETURNING id",
        body.platform_role, user_id,
    )
    if not updated:
        raise HTTPException(404, "User not found")
    return {"ok": True}


@router.post("/admin/invite", response_model=InviteResponse, status_code=201)
async def invite_user(
    body: InviteCreate,
    _user: CurrentUser = Depends(require_admin),
    db: asyncpg.Pool = Depends(get_db),
):
    row = await db.fetchrow(
        """
        INSERT INTO pending_invites (email, project_id, role, invited_by)
        VALUES ($1, $2, $3, $4)
        RETURNING id, email, project_id, role, created_at
        """,
        str(body.email), body.project_id, body.role, _user.id,
    )
    get_client().user_management.send_invitation(
        email=str(body.email),
        organization_id=os.environ.get("WORKOS_ORG_ID"),
    )
    return dict(row)


@router.post("/webhooks/workos", status_code=200)
async def workos_webhook(
    request: Request,
    wh_signature: str | None = Header(default=None, alias="Wh-Signature"),
    db: asyncpg.Pool = Depends(get_db),
):
    body = await request.body()
    _verify_signature(wh_signature, body)

    try:
        payload = WorkOSWebhookPayload.model_validate_json(body)
    except Exception:
        raise HTTPException(422, "Invalid webhook payload")

    if payload.event == "user.created":
        await webhook_svc.handle_user_created(
            db,
            workos_user_id=payload.data["id"],
            email=payload.data["email"],
        )

    # All other event types are silently ignored
    return {"received": True}


# ── private ───────────────────────────────────────────────

def _verify_signature(header: str | None, body: bytes) -> None:
    if not header:
        raise HTTPException(401, "Missing Wh-Signature header")

    secret = os.environ["WORKOS_WEBHOOK_SECRET"]
    parts = dict(p.split("=", 1) for p in header.split(",") if "=" in p)
    timestamp = parts.get("t", "")
    signature = parts.get("v1", "")

    if abs(int(time.time()) - int(timestamp)) > 300:
        raise HTTPException(401, "Webhook replay detected")

    expected = hmac.new(
        secret.encode(),
        f"{timestamp}.{body.decode()}".encode(),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, signature):
        raise HTTPException(401, "Invalid webhook signature")
