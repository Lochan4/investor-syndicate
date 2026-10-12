"""Redis cell context store — conversation turns and cell analyses."""
from __future__ import annotations
import json
import os

import redis.asyncio as aioredis

_TTL = 30 * 24 * 3600  # 30 days


async def _redis() -> aioredis.Redis:
    return aioredis.from_url(os.environ.get("REDIS_URL", "redis://localhost:6379"))


async def push_turn(project_id: str, cell_id: str, user_id: str, role: str, content: str) -> None:
    """RPUSH cell_ctx:{pid}:{cid}:{uid} with 30-day expiry."""
    r = await _redis()
    key = f"cell_ctx:{project_id}:{cell_id}:{user_id}"
    entry = json.dumps({"role": role, "content": content})
    await r.rpush(key, entry)
    await r.expire(key, _TTL)


async def get_cell_analysis(project_id: str, cell_id: str) -> str:
    """GET cell_analysis:{pid}:{cid} — returns empty string if not set."""
    r = await _redis()
    val = await r.get(f"cell_analysis:{project_id}:{cell_id}")
    return val.decode() if val else ""


async def set_cell_analysis(project_id: str, cell_id: str, analysis: str) -> None:
    """SET cell_analysis:{pid}:{cid} with 30-day expiry."""
    r = await _redis()
    await r.set(f"cell_analysis:{project_id}:{cell_id}", analysis, ex=_TTL)


async def push_activity(project_id: str, cell_id: str, event_type: str, data: dict) -> None:
    """RPUSH activity:{pid}:{cid}, 6h TTL."""
    r = await _redis()
    key = f"activity:{project_id}:{cell_id}"
    entry = json.dumps({"type": event_type, "data": data})
    await r.rpush(key, entry)
    await r.expire(key, 6 * 3600)


async def pop_activities(project_id: str, cell_id: str, cursor: int) -> list[dict]:
    """LRANGE activity:{pid}:{cid} from cursor to end — returns new events since cursor."""
    r = await _redis()
    raw = await r.lrange(f"activity:{project_id}:{cell_id}", cursor, -1)
    return [json.loads(e) for e in raw]


async def push_kg_event(project_id: str, event_type: str, data: dict) -> None:
    """RPUSH kg:{project_id}, 2h TTL — KG build progress events."""
    r = await _redis()
    key = f"kg:{project_id}"
    await r.rpush(key, json.dumps({"type": event_type, "data": data}))
    await r.expire(key, 2 * 3600)


async def pop_kg_events(project_id: str, cursor: int) -> list[dict]:
    """LRANGE kg:{project_id} from cursor to end."""
    r = await _redis()
    raw = await r.lrange(f"kg:{project_id}", cursor, -1)
    return [json.loads(e) for e in raw]


async def get_all_turns(project_id: str, cell_id: str) -> list[dict]:
    """KEYS cell_ctx:{pid}:{cid}:* — LRANGE all, return list of {user_id, turns}."""
    r = await _redis()
    pattern = f"cell_ctx:{project_id}:{cell_id}:*"
    keys = await r.keys(pattern)
    result = []
    for key in keys:
        key_str = key.decode() if isinstance(key, bytes) else key
        user_id = key_str.split(":")[-1]
        raw = await r.lrange(key_str, 0, -1)
        turns = [json.loads(t) for t in raw]
        result.append({"user_id": user_id, "turns": turns})
    return result
