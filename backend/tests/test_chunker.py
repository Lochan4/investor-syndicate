"""Tests: chunker.chunk_text"""
from app.services.chunker import chunk_text, CHUNK_SIZE, MIN_CHUNK


def test_empty_returns_empty():
    assert chunk_text("") == []


def test_short_text_single_chunk():
    chunks = chunk_text("Hello world")
    assert len(chunks) == 1
    assert chunks[0] == "Hello world"


def test_long_text_multiple_chunks():
    text = "x" * 1200
    chunks = chunk_text(text)
    assert len(chunks) > 1


def test_each_chunk_at_most_chunk_size_plus_overlap():
    # Because tiny tails get merged, we allow some slack
    text = "a" * 1600
    chunks = chunk_text(text)
    for c in chunks[:-1]:
        assert len(c) == CHUNK_SIZE


def test_overlap_present():
    # With overlap=50, consecutive chunks share 50 chars
    text = "abcdefghij" * 60  # 600 chars
    chunks = chunk_text(text)
    assert len(chunks) >= 2
    # The start of chunk[1] equals the last OVERLAP chars of chunk[0]
    from app.services.chunker import OVERLAP
    assert chunks[0][-OVERLAP:] == chunks[1][:OVERLAP]


def test_tiny_tail_merged():
    # text shorter than MIN_CHUNK with no prior chunk → kept as single chunk
    text = "x" * 30
    chunks = chunk_text(text)
    assert len(chunks) == 1
    assert chunks[0] == text


def test_min_chunk_boundary():
    # Exactly MIN_CHUNK chars → kept as its own chunk
    text = "y" * MIN_CHUNK
    chunks = chunk_text(text)
    assert len(chunks) == 1
