"""Image description via Claude Vision."""
from __future__ import annotations
import base64

from app.services.llm import get_async_client


async def extract(data: bytes, media_type: str = "image/jpeg") -> str:
    b64 = base64.standard_b64encode(data).decode()
    msg = await get_async_client().messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
                {"type": "text", "text": "Describe this image concisely for investment due diligence."},
            ],
        }],
    )
    return msg.content[0].text
