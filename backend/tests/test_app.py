"""
Tests: app startup, health endpoint, CORS headers, router registration.
"""
import pytest
from httpx import AsyncClient


async def test_health_returns_200(client: AsyncClient):
    r = await client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


# ── CORS ──────────────────────────────────────────────────

async def test_cors_allows_configured_frontend(client: AsyncClient):
    r = await client.options(
        "/api/v1/projects",
        headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"},
    )
    assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"


async def test_cors_blocks_unknown_origin(client: AsyncClient):
    r = await client.get(
        "/api/v1/projects",
        headers={"Origin": "https://evil.example.com"},
    )
    assert "access-control-allow-origin" not in r.headers


async def test_cors_preflight_includes_authorization_header(client: AsyncClient):
    r = await client.options(
        "/api/v1/projects",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "Authorization",
        },
    )
    allow_headers = r.headers.get("access-control-allow-headers", "").lower()
    assert "authorization" in allow_headers


# ── Router registration (stubs return 401, not 404) ───────

@pytest.mark.parametrize("path", [
    "/api/v1/projects",
    "/api/v1/notifications",
])
async def test_registered_routes_return_401_not_404(client: AsyncClient, path: str):
    r = await client.get(path)
    assert r.status_code == 401, f"{path} returned {r.status_code} — router may not be registered"
