"""
Tests: Redis key operations used by Arq and the cell context store.
Uses fakeredis — no Redis daemon required.
"""
import uuid

import pytest
import fakeredis.aioredis as fakeredis


@pytest.fixture
async def redis_client():
    client = fakeredis.FakeRedis(decode_responses=True)
    yield client
    await client.aclose()


async def test_redis_ping(redis_client):
    pong = await redis_client.ping()
    assert pong is True


async def test_redis_set_and_get(redis_client):
    key = f"test:{uuid.uuid4()}"
    await redis_client.set(key, "hello", ex=10)
    value = await redis_client.get(key)
    assert value == "hello"


async def test_redis_delete(redis_client):
    key = f"test:{uuid.uuid4()}"
    await redis_client.set(key, "temp")
    await redis_client.delete(key)
    assert await redis_client.get(key) is None


async def test_redis_list_operations(redis_client):
    """Validates RPUSH/LRANGE used by Arq queue and cell_ctx store."""
    key = f"list:{uuid.uuid4()}"
    await redis_client.rpush(key, "turn_1", "turn_2")
    items = await redis_client.lrange(key, 0, -1)
    assert items == ["turn_1", "turn_2"]


async def test_redis_expiry(redis_client):
    """cell_ctx keys use 30-day TTL — verify expiry is set correctly."""
    key = f"cell_ctx:{uuid.uuid4()}"
    await redis_client.set(key, "ctx", ex=2592000)  # 30 days
    ttl = await redis_client.ttl(key)
    assert ttl > 0
