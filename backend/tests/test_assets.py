"""
Tests: GET /api/v1/projects/{id}/assets, POST /api/v1/projects/{id}/assets
"""
import asyncpg
from httpx import AsyncClient


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _make_project(db: asyncpg.Pool, investor: dict) -> str:
    return str(await db.fetchval(
        "INSERT INTO projects(startup_name,created_by) VALUES('AssetCo',$1) RETURNING id",
        investor["id"],
    ))


# ── GET /assets ───────────────────────────────────────────

async def test_list_assets_empty_for_new_project(
    client: AsyncClient, investor: dict, make_jwt, db: asyncpg.Pool
):
    pid = await _make_project(db, investor)
    r = await client.get(f"/api/v1/projects/{pid}/assets", headers=auth_header(make_jwt(investor["id"])))
    assert r.status_code == 200
    assert r.json() == []


async def test_list_assets_returns_inserted_asset(
    client: AsyncClient, investor: dict, make_jwt, db: asyncpg.Pool
):
    pid = await _make_project(db, investor)
    await db.execute(
        "INSERT INTO assets(project_id,kind,filename,storage_key) VALUES($1,'pdf','deck.pdf','s3/deck')",
        pid,
    )
    r = await client.get(f"/api/v1/projects/{pid}/assets", headers=auth_header(make_jwt(investor["id"])))
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["filename"] == "deck.pdf"
    assert data[0]["status"] == "pending"


async def test_list_assets_includes_analysis_cache(
    client: AsyncClient, investor: dict, make_jwt, db: asyncpg.Pool
):
    pid = await _make_project(db, investor)
    aid = await db.fetchval(
        "INSERT INTO assets(project_id,kind,filename,storage_key) VALUES($1,'pdf','a.pdf','k') RETURNING id",
        pid,
    )
    await db.execute(
        "UPDATE assets SET analysis_cache='{\"summary\":\"Great team\"}'::jsonb WHERE id=$1",
        aid,
    )
    r = await client.get(f"/api/v1/projects/{pid}/assets", headers=auth_header(make_jwt(investor["id"])))
    assert r.json()[0]["analysis_cache"]["summary"] == "Great team"


async def test_list_assets_unauthenticated_returns_401(
    client: AsyncClient, investor: dict, db: asyncpg.Pool
):
    pid = await _make_project(db, investor)
    r = await client.get(f"/api/v1/projects/{pid}/assets")
    assert r.status_code == 401


# ── POST /assets ──────────────────────────────────────────

async def test_create_asset_returns_201(
    client: AsyncClient, investor: dict, make_jwt, db: asyncpg.Pool
):
    pid = await _make_project(db, investor)
    r = await client.post(
        f"/api/v1/projects/{pid}/assets",
        json={"filename": "pitch.pdf", "kind": "pdf", "storage_key": "uploads/pitch.pdf"},
        headers=auth_header(make_jwt(investor["id"])),
    )
    assert r.status_code == 201


async def test_create_asset_response_shape(
    client: AsyncClient, investor: dict, make_jwt, db: asyncpg.Pool
):
    pid = await _make_project(db, investor)
    r = await client.post(
        f"/api/v1/projects/{pid}/assets",
        json={"filename": "model.xlsx", "kind": "spreadsheet", "storage_key": "uploads/model.xlsx"},
        headers=auth_header(make_jwt(investor["id"])),
    )
    data = r.json()
    assert "id" in data
    assert data["filename"] == "model.xlsx"
    assert data["kind"] == "spreadsheet"
    assert data["status"] == "pending"
    assert data["analysis_cache"] is None


async def test_create_asset_unauthenticated_returns_401(
    client: AsyncClient, investor: dict, db: asyncpg.Pool
):
    pid = await _make_project(db, investor)
    r = await client.post(
        f"/api/v1/projects/{pid}/assets",
        json={"filename": "x.pdf", "kind": "pdf", "storage_key": "k"},
    )
    assert r.status_code == 401


async def test_confirm_asset_marks_processing(
    client: AsyncClient, investor: dict, make_jwt, db: asyncpg.Pool
):
    pid = await _make_project(db, investor)
    aid = await db.fetchval(
        "INSERT INTO assets(project_id,kind,filename,storage_key) VALUES($1,'pdf','f.pdf','k') RETURNING id",
        pid,
    )
    r = await client.post(
        f"/api/v1/projects/{pid}/assets/{aid}/confirm",
        headers=auth_header(make_jwt(investor["id"])),
    )
    assert r.status_code == 200
    assert r.json() == {"queued": True}
    status = await db.fetchval("SELECT status FROM assets WHERE id=$1", aid)
    assert status == "processing"
