"""Notification helpers."""
from __future__ import annotations

import asyncpg


async def notify(db: asyncpg.Pool, user_id: str, project_id: str, kind: str) -> None:
    await db.execute(
        "INSERT INTO notifications(user_id, project_id, kind) VALUES($1,$2,$3)",
        user_id, project_id, kind,
    )


async def notify_all_members(db: asyncpg.Pool, project_id: str, kind: str) -> None:
    members = await db.fetch(
        "SELECT user_id FROM project_members WHERE project_id=$1", project_id
    )
    for m in members:
        await notify(db, str(m["user_id"]), project_id, kind)
