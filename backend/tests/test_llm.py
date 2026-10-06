"""Tests: llm.extract_entities and llm.analyse_asset — mocked Anthropic client."""
from __future__ import annotations
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


def _mock_msg(text: str):
    content = MagicMock()
    content.text = text
    msg = MagicMock()
    msg.content = [content]
    return msg


@pytest.fixture(autouse=True)
def patch_anthropic():
    mock_create = AsyncMock()
    with patch("app.services.llm._get_client") as mock_client_fn:
        mock_client = MagicMock()
        mock_client.messages.create = mock_create
        mock_client_fn.return_value = mock_client
        yield mock_create


async def test_extract_entities_returns_list(patch_anthropic):
    patch_anthropic.return_value = _mock_msg(
        json.dumps({"entities": [{"name": "Alice", "kind": "person"}]})
    )
    from app.services import llm
    result = await llm.extract_entities("Alice founded Acme Corp.")
    assert result == [{"name": "Alice", "kind": "person"}]


async def test_extract_entities_bad_json_returns_empty(patch_anthropic):
    patch_anthropic.return_value = _mock_msg("not json at all")
    from app.services import llm
    result = await llm.extract_entities("some text")
    assert result == []


async def test_extract_entities_missing_key_returns_empty(patch_anthropic):
    patch_anthropic.return_value = _mock_msg(json.dumps({"other": []}))
    from app.services import llm
    result = await llm.extract_entities("some text")
    assert result == []


async def test_analyse_asset_returns_dict(patch_anthropic):
    payload = {"summary": "Strong team", "topics": ["AI"], "entities": ["Alice"]}
    patch_anthropic.return_value = _mock_msg(json.dumps(payload))
    from app.services import llm
    result = await llm.analyse_asset("We are building an AI company.")
    assert result["summary"] == "Strong team"
    assert "AI" in result["topics"]


async def test_analyse_asset_bad_json_returns_defaults(patch_anthropic):
    patch_anthropic.return_value = _mock_msg("not json")
    from app.services import llm
    result = await llm.analyse_asset("some text")
    assert result == {"summary": "", "topics": [], "entities": []}
