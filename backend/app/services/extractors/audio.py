"""Audio transcription via OpenAI Whisper API."""
from __future__ import annotations
import io
import os

from openai import AsyncOpenAI

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])
    return _client


async def extract(data: bytes, filename: str = "audio.mp3") -> str:
    if len(data) < 1000:  # too short to be valid audio
        return ""
    try:
        resp = await _get_client().audio.transcriptions.create(
            model="whisper-1",
            file=(filename, io.BytesIO(data)),
        )
        return resp.text
    except Exception:
        return ""  # bad format or too short — caller handles empty string
