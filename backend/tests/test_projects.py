"""
Tests: GET /api/v1/projects, POST /api/v1/projects
"""
import uuid

import asyncpg
import pytest
from httpx import AsyncClient


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── POST /projects ────────────────────────────────────────

async def test_create_project_returns_201(client: AsyncClient, investor: dict, make_jwt):
    token = make_jwt(investor["id"])
    r = await client.post(
        "/api/v1/projects",
        json={"startup_name": "AcmeCo", "sector": "fintech", "stage": "seed"},
        headers=auth_header(token),
    )
    assert r.status_code == 201


async def test_create_project_response_shape(client: AsyncClient, investor: dict, make_jwt):
    token = make_jwt(investor["id"])
    r = await client.post(
        "/api/v1/projects",
        json={"startup_name": "ShapeCheck"},
        headers=auth_header(token),
    )
    data = r.json()
    assert "id" in data
    assert data["startup_name"] == "ShapeCheck"
    assert data["status"] == "draft"
    assert "created_at" in data


async def test_create_project_status_is_draft(client: AsyncClient, investor: dict, make_jwt):
    token = make_jwt(investor["id"])
    r = await client.post(
        "/api/v1/projects",
        json={"startup_name": "DraftCheck"},
        headers=auth_header(token),
    )
    assert r.json()["status"] == "draft"


async def test_create_project_inserts_creator_as_project_member(
    client: AsyncClient, investor: dict, make_jwt, db: asyncpg.Pool
):
    token = make_jwt(investor["id"])
    r = await client.post(
        "/api/v1/projects",
        json={"startup_name": "MemberCheck"},
        headers=auth_header(token),
    )
    project_id = r.json()["id"]
    row = await db.fetchrow(
        "SELECT role FROM project_members WHERE project_id=$1 AND user_id=$2",
        project_id, investor["id"],
    )
    assert row is not None


async def test_create_project_missing_startup_name_returns_422(
    client: AsyncClient, investor: dict, make_jwt
):
    token = make_jwt(investor["id"])
    r = await client.post(
        "/api/v1/projects",
        json={"sector": "saas"},
        headers=auth_header(token),
    )
    assert r.status_code == 422


async def test_create_project_unauthenticated_returns_401(client: AsyncClient):
    r = await client.post("/api/v1/projects", json={"startup_name": "Ghost"})
    assert r.status_code == 401


# ── GET /projects ─────────────────────────────────────────

async def test_list_projects_returns_200(client: AsyncClient, investor: dict, make_jwt):
    token = make_jwt(investor["id"])
    r = await client.get("/api/v1/projects", headers=auth_header(token))
    assert r.status_code == 200


async def test_list_projects_returns_empty_array_for_new_user(
    client: AsyncClient, db: asyncpg.Pool, make_jwt
):
    uid = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO users(id,email,platform_role) VALUES($1,$2,'investor')",
        uid, f"{uid}@test.com",
    )
    token = make_jwt(uid)
    r = await client.get("/api/v1/projects", headers=auth_header(token))
    assert r.status_code == 200
    assert r.json() == []
    await db.execute("DELETE FROM users WHERE id=$1", uid)


async def test_list_projects_only_returns_users_own_projects(
    client: AsyncClient, db: asyncpg.Pool, make_jwt
):
    # Create two users
    uid_a = str(uuid.uuid4())
    uid_b = str(uuid.uuid4())
    for uid in [uid_a, uid_b]:
        await db.execute(
            "INSERT INTO users(id,email,platform_role) VALUES($1,$2,'investor')",
            uid, f"{uid}@test.com",
        )

    # User A creates a project (also adds them as a member via service)
    token_a = make_jwt(uid_a)
    r = await client.post(
        "/api/v1/projects",
        json={"startup_name": "UserA Project"},
        headers=auth_header(token_a),
    )
    assert r.status_code == 201

    # User B should see 0 projects
    token_b = make_jwt(uid_b)
    r = await client.get("/api/v1/projects", headers=auth_header(token_b))
    assert r.status_code == 200
    assert r.json() == []

    # Delete projects before users to satisfy FK constraint
    await db.execute("DELETE FROM projects WHERE created_by = ANY($1::uuid[])", [uid_a, uid_b])
    for uid in [uid_a, uid_b]:
        await db.execute("DELETE FROM users WHERE id=$1", uid)


async def test_list_projects_unauthenticated_returns_401(client: AsyncClient):
    r = await client.get("/api/v1/projects")
    assert r.status_code == 401
