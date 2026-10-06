from __future__ import annotations
import os
from dataclasses import dataclass

import asyncpg
import httpx
from fastapi import Depends, Header, HTTPException, Request
from jose import JWTError, jwt

# ── DB pool ───────────────────────────────────────────────

def get_db(request: Request) -> asyncpg.Pool:
    return request.app.state.db


# ── WorkOS JWT ────────────────────────────────────────────

_jwks_cache: dict | None = None


async def _get_jwks() -> dict:
    """Fetches WorkOS JWKS. Cached for process lifetime."""
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache
    client_id = os.environ["WORKOS_CLIENT_ID"]
    async with httpx.AsyncClient() as client:
        r = await client.get(f"https://api.workos.com/sso/jwks/{client_id}")
        r.raise_for_status()
    _jwks_cache = r.json()
    return _jwks_cache


@dataclass
class CurrentUser:
    id: str
    email: str
    platform_role: str


async def get_current_user(
    authorization: str | None = Header(default=None),
    db: asyncpg.Pool = Depends(get_db),
) -> CurrentUser:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing or invalid Authorization header")

    token = authorization.removeprefix("Bearer ")

    try:
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        jwks = await _get_jwks()
        key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
        if key is None:
            raise HTTPException(401, "Signing key not found")
        payload = jwt.decode(token, key, algorithms=["RS256"], options={"verify_aud": False})
    except JWTError:
        raise HTTPException(401, "Invalid or expired token")

    user_id: str = payload.get("sub", "")
    email: str = payload.get("email", "")

    # Auto-provision on first login — no webhook needed for local dev
    from app.services.users import upsert_from_workos
    await upsert_from_workos(db, user_id, email)

    row = await db.fetchrow(
        "SELECT id, email, platform_role FROM users WHERE id = $1", user_id
    )
    if row is None:
        raise HTTPException(404, "User not found")

    return CurrentUser(id=str(row["id"]), email=row["email"], platform_role=row["platform_role"])


# ── Role guards ───────────────────────────────────────────

class RoleChecker:
    def __init__(self, *roles: str):
        self.roles = roles

    def __call__(self, user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.platform_role not in self.roles:
            raise HTTPException(403, "Insufficient platform role")
        return user


class ProjectMemberChecker:
    """Verifies the current user is a member of the requested project."""

    async def __call__(
        self,
        project_id: str,
        user: CurrentUser = Depends(get_current_user),
        db: asyncpg.Pool = Depends(get_db),
    ) -> CurrentUser:
        row = await db.fetchrow(
            "SELECT role FROM project_members WHERE project_id=$1 AND user_id=$2",
            project_id,
            user.id,
        )
        if row is None:
            raise HTTPException(403, "Not a member of this project")
        return user


require_admin = RoleChecker("super_admin")
require_developer = RoleChecker("developer", "super_admin")
# canvas editors: super_admin, admin, developer
require_canvas_editor = RoleChecker("super_admin", "admin", "developer")
require_project_member = ProjectMemberChecker()


def get_arq(request: Request):
    return request.app.state.arq
