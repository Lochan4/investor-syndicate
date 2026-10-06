"""OpenAI embedding wrapper."""
from __future__ import annotations
import os

from openai import AsyncOpenAI

_client: AsyncOpenAI | None = None

MODEL = "text-embedding-3-large"
DIMS = 1536


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])
    return _client


async def embed_batch(texts: list[str]) -> list[list[float]]:
    """Return one 1536-dim vector per text."""
    if not texts:
        return []
    resp = await _get_client().embeddings.create(model=MODEL, input=texts, dimensions=DIMS)
    return [item.embedding for item in resp.data]
