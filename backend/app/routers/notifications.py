from __future__ import annotations

import asyncpg
from fastapi import APIRouter, Depends

from app.dependencies import CurrentUser, get_current_user, get_db

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
async def list_notifications(
    user: CurrentUser = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT id, project_id, kind, created_at
           FROM notifications
           WHERE user_id=$1 AND read_at IS NULL
           ORDER BY created_at DESC
           LIMIT 50""",
        user.id,
    )
    return [dict(r) for r in rows]


@router.post("/{notification_id}/read")
async def mark_read(
    notification_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    await db.execute(
        "UPDATE notifications SET read_at=now() WHERE id=$1 AND user_id=$2",
        notification_id, user.id,
    )
    return {"ok": True}
