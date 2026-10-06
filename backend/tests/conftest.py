"""
Shared fixtures for all backend tests.

Infrastructure:
- Postgres: embedded_postgres spins up a real PG instance per test session.
- Redis:    fakeredis (in-process, no daemon needed).
- JWT:      local RSA key pair; _get_jwks is patched so no HTTP calls are made.
- DB pool:  wired into app.state so the FastAPI client uses the test database.
"""
from __future__ import annotations
import json
import os
import tempfile
import time
import uuid
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import asyncpg
import pytest
import pytest_asyncio
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from embedded_postgres import PostgresServer
from httpx import ASGITransport, AsyncClient
from jose import jwk, jwt

from app.main import app


# ── Embedded Postgres (one instance for the whole session) ──

@pytest.fixture(scope="session")
def pg_server():
    tmpdir = Path(tempfile.mkdtemp())
    server = PostgresServer(pgdata=tmpdir)
    server.ensure_pgdata_inited()
    server.ensure_postgres_running()
    yield server


@pytest.fixture(scope="session")
def pg_uri(pg_server: PostgresServer) -> str:
    return pg_server.get_uri()


async def _init_conn(conn) -> None:
    """Register JSON codecs so jsonb columns return Python dicts, not strings."""
    await conn.set_type_codec("jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog")
    await conn.set_type_codec("json",  encoder=json.dumps, decoder=json.loads, schema="pg_catalog")


@pytest_asyncio.fixture(scope="session")
async def db(pg_uri: str) -> asyncpg.Pool:
    """Run the full migration once, then expose the pool for all tests."""
    pool = await asyncpg.create_pool(pg_uri, init=_init_conn)

    migration = Path(__file__).parent.parent / "migrations" / "001_initial.sql"
    await pool.execute(migration.read_text())

    yield pool
    await pool.close()


# ── RSA key pair ──────────────────────────────────────────

@pytest.fixture(scope="session")
def rsa_private_key():
    return rsa.generate_private_key(
        public_exponent=65537, key_size=2048, backend=default_backend()
    )


@pytest.fixture(scope="session")
def rsa_private_pem(rsa_private_key) -> str:
    return rsa_private_key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.TraditionalOpenSSL,
        serialization.NoEncryption(),
    ).decode()


@pytest.fixture(scope="session")
def rsa_public_pem(rsa_private_key) -> str:
    return rsa_private_key.public_key().public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode()


@pytest.fixture(scope="session")
def jwks_document(rsa_public_pem: str) -> dict:
    key_dict = jwk.construct(rsa_public_pem, algorithm="RS256").to_dict()
    key_dict.update({"kid": "test-key-1", "use": "sig", "alg": "RS256"})
    return {"keys": [key_dict]}


# ── JWT factory ───────────────────────────────────────────

@pytest.fixture(scope="session")
def make_jwt(rsa_private_pem: str):
    def _make(user_id: str, role: str = "investor", exp_offset: int = 3600) -> str:
        now = int(time.time())
        return jwt.encode(
            {"sub": user_id, "iat": now, "exp": now + exp_offset},
            rsa_private_pem,
            algorithm="RS256",
            headers={"kid": "test-key-1"},
        )
    return _make


# ── Patch _get_jwks (no HTTP calls during tests) ─────────

@pytest.fixture(scope="session", autouse=True)
def patch_jwks(jwks_document: dict):
    with patch("app.dependencies._get_jwks", new=AsyncMock(return_value=jwks_document)):
        yield


# ── FastAPI test client (wired to embedded Postgres) ─────

@pytest_asyncio.fixture
async def client(db: asyncpg.Pool):
    """
    Overrides app.state.db with the test pool so no external DB is needed.
    Bypasses the lifespan connection entirely.
    """
    app.state.db = db
    fake_arq = MagicMock()
    fake_arq.enqueue_job = AsyncMock(return_value=None)
    app.state.arq = fake_arq
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c


# ── User helpers ──────────────────────────────────────────

@pytest_asyncio.fixture
async def investor(db: asyncpg.Pool) -> dict:
    uid = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO users(id, email, platform_role) VALUES($1, $2, 'investor')",
        uid, f"{uid}@test.com",
    )
    yield {"id": uid, "email": f"{uid}@test.com", "platform_role": "investor"}
    # Delete projects first to satisfy FK before deleting the user
    await db.execute("DELETE FROM projects WHERE created_by=$1", uid)
    await db.execute("DELETE FROM users WHERE id=$1", uid)


@pytest_asyncio.fixture
async def admin(db: asyncpg.Pool) -> dict:
    uid = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO users(id, email, platform_role) VALUES($1, $2, 'super_admin')",
        uid, f"admin-{uid}@test.com",
    )
    yield {"id": uid, "email": f"admin-{uid}@test.com", "platform_role": "super_admin"}
    await db.execute("DELETE FROM projects WHERE created_by=$1", uid)
    await db.execute("DELETE FROM users WHERE id=$1", uid)
