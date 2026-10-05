"""Sliding-window text chunker."""
from __future__ import annotations

CHUNK_SIZE = 1500
OVERLAP = 150
MIN_CHUNK = 100


def chunk_text(text: str) -> list[str]:
    """Split text into overlapping chunks of ~1500 chars, dropping tiny tail."""
    if not text:
        return []
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = start + CHUNK_SIZE
        chunk = text[start:end]
        if len(chunk) >= MIN_CHUNK:
            chunks.append(chunk)
        elif chunks:
            chunks[-1] = chunks[-1] + chunk
        else:
            # entire text is shorter than MIN_CHUNK — keep it
            chunks.append(chunk)
        start += CHUNK_SIZE - OVERLAP
    return chunks
