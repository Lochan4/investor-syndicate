"""
Tests: WorkOS JWT validation middleware and role guards.
All tests hit GET /api/v1/projects to exercise the full dependency chain.
"""
import time
import uuid

import pytest
from httpx import AsyncClient


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── Happy path ────────────────────────────────────────────

async def test_valid_investor_jwt_passes(client: AsyncClient, investor: dict, make_jwt):
    token = make_jwt(investor["id"])
    r = await client.get("/api/v1/projects", headers=auth_header(token))
    assert r.status_code == 200


async def test_valid_admin_jwt_passes(client: AsyncClient, admin: dict, make_jwt):
    token = make_jwt(admin["id"], role="super_admin")
    r = await client.get("/api/v1/projects", headers=auth_header(token))
    assert r.status_code == 200


# ── Missing / malformed token (all → 401) ─────────────────

async def test_no_authorization_header_returns_401(client: AsyncClient):
    r = await client.get("/api/v1/projects")
    assert r.status_code == 401


async def test_empty_bearer_returns_401(client: AsyncClient):
    r = await client.get("/api/v1/projects", headers={"Authorization": "Bearer "})
    assert r.status_code == 401


async def test_non_bearer_scheme_returns_401(client: AsyncClient):
    r = await client.get("/api/v1/projects", headers={"Authorization": "Basic dXNlcjpwYXNz"})
    assert r.status_code == 401


async def test_malformed_jwt_returns_401(client: AsyncClient):
    r = await client.get("/api/v1/projects", headers=auth_header("not.a.jwt"))
    assert r.status_code == 401


async def test_wrong_signature_returns_401(client: AsyncClient, investor: dict):
    """Token signed with a different key that isn't in our JWKS."""
    from cryptography.hazmat.backends import default_backend
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.primitives import serialization
    from jose import jwt

    other_key = rsa.generate_private_key(65537, 2048, default_backend())
    other_pem = other_key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.TraditionalOpenSSL,
        serialization.NoEncryption(),
    ).decode()
    now = int(time.time())
    bad_token = jwt.encode(
        {"sub": investor["id"], "exp": now + 3600, "iat": now},
        other_pem,
        algorithm="RS256",
        headers={"kid": "test-key-1"},  # kid matches but signature won't verify
    )
    r = await client.get("/api/v1/projects", headers=auth_header(bad_token))
    assert r.status_code == 401


async def test_expired_jwt_returns_401(client: AsyncClient, investor: dict, make_jwt):
    token = make_jwt(investor["id"], exp_offset=-10)
    r = await client.get("/api/v1/projects", headers=auth_header(token))
    assert r.status_code == 401


# ── User lookup ───────────────────────────────────────────

async def test_valid_jwt_for_unknown_user_returns_404(client: AsyncClient, make_jwt):
    ghost_id = str(uuid.uuid4())
    token = make_jwt(ghost_id)
    r = await client.get("/api/v1/projects", headers=auth_header(token))
    assert r.status_code == 404
    assert "not found" in r.json().get("detail", "").lower()


# ── Role guards ───────────────────────────────────────────

async def test_investor_cannot_access_admin_invite(client: AsyncClient, investor: dict, make_jwt):
    token = make_jwt(investor["id"])
    r = await client.post(
        "/api/v1/admin/invite",
        json={"email": "x@x.com", "project_id": str(uuid.uuid4()), "role": "attendee"},
        headers=auth_header(token),
    )
    assert r.status_code == 403


async def test_super_admin_can_access_admin_invite_route(
    client: AsyncClient, admin: dict, make_jwt, db
):
    """Reaches the handler — must not be blocked with 403."""
    from unittest.mock import patch, MagicMock
    # Create a real project so the FK constraint on pending_invites is satisfied
    project = await db.fetchrow(
        "INSERT INTO projects(startup_name, created_by) VALUES('InviteTestCo',$1) RETURNING id",
        admin["id"],
    )
    token = make_jwt(admin["id"], role="super_admin")
    with patch("app.routers.admin.get_client") as mock_wos:
        mock_wos.return_value.user_management.send_invitation = MagicMock()
        r = await client.post(
            "/api/v1/admin/invite",
            json={"email": "invite@test.com", "project_id": str(project["id"]), "role": "attendee"},
            headers=auth_header(token),
        )
    assert r.status_code != 403
