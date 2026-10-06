"""
Tests: POST /api/v1/webhooks/workos
"""
from __future__ import annotations
import hashlib
import hmac
import json
import os
import time
import uuid

import asyncpg
import pytest
from httpx import AsyncClient


def _sign(body: str, secret: str, timestamp: int | None = None) -> str:
    t = timestamp or int(time.time())
    sig = hmac.new(secret.encode(), f"{t}.{body}".encode(), hashlib.sha256).hexdigest()
    return f"t={t},v1={sig}"


def webhook_headers(body: str, secret: str = "test-webhook-secret") -> dict:
    return {"Wh-Signature": _sign(body, secret), "Content-Type": "application/json"}


def user_created_payload(user_id: str, email: str) -> str:
    return json.dumps({"event": "user.created", "data": {"id": user_id, "email": email}})


# ── Signature validation ──────────────────────────────────

async def test_missing_signature_returns_401(client: AsyncClient):
    body = user_created_payload(str(uuid.uuid4()), "x@test.com")
    r = await client.post("/api/v1/webhooks/workos", content=body)
    assert r.status_code == 401


async def test_wrong_secret_returns_401(client: AsyncClient):
    body = user_created_payload(str(uuid.uuid4()), "x@test.com")
    r = await client.post(
        "/api/v1/webhooks/workos",
        content=body,
        headers=webhook_headers(body, secret="wrong-secret"),
    )
    assert r.status_code == 401


async def test_replayed_webhook_returns_401(client: AsyncClient):
    body = user_created_payload(str(uuid.uuid4()), "x@test.com")
    old_ts = int(time.time()) - 400  # 6+ minutes ago
    headers = {"Wh-Signature": _sign(body, "test-webhook-secret", old_ts), "Content-Type": "application/json"}
    r = await client.post("/api/v1/webhooks/workos", content=body, headers=headers)
    assert r.status_code == 401


# ── user.created — no pending invite ─────────────────────

async def test_user_created_inserts_user_row(client: AsyncClient, db: asyncpg.Pool):
    uid = str(uuid.uuid4())
    email = f"{uid}@test.com"
    body = user_created_payload(uid, email)

    r = await client.post("/api/v1/webhooks/workos", content=body, headers=webhook_headers(body))
    assert r.status_code == 200

    row = await db.fetchrow("SELECT id, email, platform_role FROM users WHERE id=$1", uid)
    assert row is not None
    assert row["email"] == email
    assert row["platform_role"] == "investor"

    await db.execute("DELETE FROM users WHERE id=$1", uid)


async def test_user_created_no_pending_invite_no_project_members(
    client: AsyncClient, db: asyncpg.Pool
):
    uid = str(uuid.uuid4())
    body = user_created_payload(uid, f"{uid}@test.com")
    await client.post("/api/v1/webhooks/workos", content=body, headers=webhook_headers(body))

    count = await db.fetchval("SELECT COUNT(*) FROM project_members WHERE user_id=$1", uid)
    assert count == 0

    await db.execute("DELETE FROM users WHERE id=$1", uid)


# ── user.created — with pending invites ──────────────────

async def test_user_created_moves_pending_invite_to_project_members(
    client: AsyncClient, db: asyncpg.Pool, admin: dict
):
    uid = str(uuid.uuid4())
    email = f"{uid}@test.com"

    # Create a project and a pending invite
    project_id = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO projects(id,startup_name,created_by) VALUES($1,'InviteCo',$2)",
        project_id, admin["id"],
    )
    await db.execute(
        "INSERT INTO pending_invites(email,project_id,role,invited_by) VALUES($1,$2,'attendee',$3)",
        email, project_id, admin["id"],
    )

    body = user_created_payload(uid, email)
    r = await client.post("/api/v1/webhooks/workos", content=body, headers=webhook_headers(body))
    assert r.status_code == 200

    # project_members row created
    member = await db.fetchrow(
        "SELECT role FROM project_members WHERE project_id=$1 AND user_id=$2",
        project_id, uid,
    )
    assert member is not None
    assert member["role"] == "attendee"

    # pending_invite accepted
    invite = await db.fetchrow(
        "SELECT accepted_at FROM pending_invites WHERE email=$1", email
    )
    assert invite["accepted_at"] is not None

    await db.execute("DELETE FROM projects WHERE id=$1", project_id)
    await db.execute("DELETE FROM users WHERE id=$1", uid)


async def test_user_created_with_multiple_pending_invites(
    client: AsyncClient, db: asyncpg.Pool, admin: dict
):
    uid = str(uuid.uuid4())
    email = f"{uid}@test.com"
    project_ids = [str(uuid.uuid4()), str(uuid.uuid4())]

    for pid in project_ids:
        await db.execute(
            "INSERT INTO projects(id,startup_name,created_by) VALUES($1,'MultiCo',$2)", pid, admin["id"]
        )
        await db.execute(
            "INSERT INTO pending_invites(email,project_id,role,invited_by) VALUES($1,$2,'attendee',$3)",
            email, pid, admin["id"],
        )

    body = user_created_payload(uid, email)
    await client.post("/api/v1/webhooks/workos", content=body, headers=webhook_headers(body))

    count = await db.fetchval(
        "SELECT COUNT(*) FROM project_members WHERE user_id=$1", uid
    )
    assert count == 2

    for pid in project_ids:
        await db.execute("DELETE FROM projects WHERE id=$1", pid)
    await db.execute("DELETE FROM users WHERE id=$1", uid)


# ── Idempotency ───────────────────────────────────────────

async def test_duplicate_user_created_is_idempotent(client: AsyncClient, db: asyncpg.Pool):
    uid = str(uuid.uuid4())
    body = user_created_payload(uid, f"{uid}@test.com")

    r1 = await client.post("/api/v1/webhooks/workos", content=body, headers=webhook_headers(body))
    r2 = await client.post("/api/v1/webhooks/workos", content=body, headers=webhook_headers(body))

    assert r1.status_code == 200
    assert r2.status_code == 200

    count = await db.fetchval("SELECT COUNT(*) FROM users WHERE id=$1", uid)
    assert count == 1

    await db.execute("DELETE FROM users WHERE id=$1", uid)


# ── Unknown event type ────────────────────────────────────

async def test_unknown_event_returns_200_noop(client: AsyncClient):
    body = json.dumps({"event": "user.deleted", "data": {"id": str(uuid.uuid4())}})
    r = await client.post("/api/v1/webhooks/workos", content=body, headers=webhook_headers(body))
    assert r.status_code == 200


# ── Malformed payload ─────────────────────────────────────

async def test_malformed_payload_returns_422(client: AsyncClient):
    body = "{}"
    r = await client.post("/api/v1/webhooks/workos", content=body, headers=webhook_headers(body))
    assert r.status_code == 422
