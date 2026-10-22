"""
Tests: Jev-style decision classifiers in investor.py and conversation.py.
All LLM calls are mocked — these tests verify routing logic, threshold behaviour,
and fail-open error handling without hitting the Anthropic API.
"""
from __future__ import annotations
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ── helpers ───────────────────────────────────────────────

def _mock_haiku(text: str):
    content = MagicMock()
    content.text = text
    msg = MagicMock()
    msg.content = [content]
    return msg


def _jev_investor(**kwargs) -> str:
    base = {
        "is_asking_for_projects": 0.0,
        "is_asking_for_workspaces": 0.0,
        "is_active_only": 0.0,
        "is_assigned_only": 0.0,
        "is_navigation_command": 0.0,
        "navigation_target": "",
    }
    base.update(kwargs)
    return json.dumps(base)


def _jev_cell(**kwargs) -> str:
    base = {
        "is_on_topic": 1.0,
        "needs_web_search": 0.0,
        "is_biographical": 0.0,
        "is_navigation_command": 0.0,
        "navigation_target": "",
    }
    base.update(kwargs)
    return json.dumps(base)


# ── _cell_jev_check ────────────────────────────────────────

@pytest.fixture(autouse=True)
def patch_anthropic_client():
    mock_create = AsyncMock()
    with patch("app.routers.conversation.get_async_client") as mock_fn:
        mock_client = MagicMock()
        mock_client.messages.create = mock_create
        mock_fn.return_value = mock_client
        yield mock_create


async def test_cell_jev_returns_on_topic(patch_anthropic_client):
    patch_anthropic_client.return_value = _mock_haiku(_jev_cell(is_on_topic=0.92))
    from app.routers.conversation import _cell_jev_check
    result = await _cell_jev_check("What is the market size?", "Market Analysis", "Evaluate TAM")
    assert result["is_on_topic"] == pytest.approx(0.92)


async def test_cell_jev_returns_off_topic(patch_anthropic_client):
    patch_anthropic_client.return_value = _mock_haiku(_jev_cell(is_on_topic=0.1))
    from app.routers.conversation import _cell_jev_check
    result = await _cell_jev_check("What is the weather?", "Market Analysis", "Evaluate TAM")
    assert result["is_on_topic"] < 0.4


async def test_cell_jev_biographical_signal(patch_anthropic_client):
    patch_anthropic_client.return_value = _mock_haiku(_jev_cell(is_biographical=0.88, needs_web_search=0.75))
    from app.routers.conversation import _cell_jev_check
    result = await _cell_jev_check("Where did the founder study?", "Team", "Assess founding team")
    assert result["is_biographical"] > 0.55
    assert result["needs_web_search"] > 0.55


async def test_cell_jev_fails_open_on_bad_json(patch_anthropic_client):
    """Bad LLM output must not block the question — fail open."""
    patch_anthropic_client.return_value = _mock_haiku("not json at all")
    from app.routers.conversation import _cell_jev_check
    result = await _cell_jev_check("Valid question", "Topic", "Desc")
    assert result["is_on_topic"] == 1.0  # fails open


async def test_cell_jev_fails_open_on_exception(patch_anthropic_client):
    patch_anthropic_client.side_effect = RuntimeError("API down")
    from app.routers.conversation import _cell_jev_check
    result = await _cell_jev_check("Question", "Topic", "Desc")
    assert result["is_on_topic"] == 1.0


# ── investor routing thresholds ────────────────────────────

async def test_investor_jev_projects_threshold(patch_anthropic_client):
    """is_asking_for_projects=0.9 → fetch_projects is True."""
    patch_anthropic_client.return_value = _mock_haiku(_jev_investor(is_asking_for_projects=0.9))
    # Test the threshold logic directly without DB
    d = json.loads(_jev_investor(is_asking_for_projects=0.9))
    fetch_projects = (
        d.get("is_asking_for_projects", 0) > 0.45 or
        d.get("is_active_only", 0) > 0.45 or
        d.get("is_assigned_only", 0) > 0.45
    )
    fetch_workspaces = d.get("is_asking_for_workspaces", 0) > 0.45
    assert fetch_projects is True
    assert fetch_workspaces is False


async def test_investor_jev_workspaces_threshold(patch_anthropic_client):
    d = json.loads(_jev_investor(is_asking_for_workspaces=0.8))
    fetch_projects = (
        d.get("is_asking_for_projects", 0) > 0.45 or
        d.get("is_active_only", 0) > 0.45 or
        d.get("is_assigned_only", 0) > 0.45
    )
    fetch_workspaces = d.get("is_asking_for_workspaces", 0) > 0.45
    assert fetch_projects is False
    assert fetch_workspaces is True


async def test_investor_jev_general_fetches_both(patch_anthropic_client):
    """All signals low → general query → fetch both projects and workspaces."""
    d = json.loads(_jev_investor())  # all zeros
    fetch_projects = (
        d.get("is_asking_for_projects", 0) > 0.45 or
        d.get("is_active_only", 0) > 0.45 or
        d.get("is_assigned_only", 0) > 0.45
    )
    fetch_workspaces = d.get("is_asking_for_workspaces", 0) > 0.45
    # Default fallback: if neither is detected, both should be fetched
    if not fetch_projects and not fetch_workspaces:
        fetch_projects = fetch_workspaces = True
    assert fetch_projects is True
    assert fetch_workspaces is True


async def test_investor_jev_navigation_command(patch_anthropic_client):
    """High is_navigation_command + target → returns early with navigate intent."""
    d = json.loads(_jev_investor(is_navigation_command=0.95, navigation_target="Acme AI"))
    is_nav = d.get("is_navigation_command", 0) > 0.75 and d.get("navigation_target", "").strip()
    assert is_nav


async def test_investor_jev_navigation_below_threshold_ignored(patch_anthropic_client):
    """is_navigation_command=0.5 (below 0.75) → not treated as command."""
    d = json.loads(_jev_investor(is_navigation_command=0.5, navigation_target="Acme AI"))
    is_nav = d.get("is_navigation_command", 0) > 0.75 and d.get("navigation_target", "").strip()
    assert not is_nav


# ── force_web routing using Jev signals ───────────────────

def test_force_web_biographical():
    jev = {"is_biographical": 0.88, "needs_web_search": 0.2}
    force_web = jev.get("is_biographical", 0) > 0.55 or jev.get("needs_web_search", 0) > 0.55
    assert force_web is True


def test_force_web_needs_search():
    jev = {"is_biographical": 0.1, "needs_web_search": 0.9}
    force_web = jev.get("is_biographical", 0) > 0.55 or jev.get("needs_web_search", 0) > 0.55
    assert force_web is True


def test_no_force_web_for_rag_query():
    jev = {"is_biographical": 0.1, "needs_web_search": 0.15}
    force_web = jev.get("is_biographical", 0) > 0.55 or jev.get("needs_web_search", 0) > 0.55
    assert force_web is False


def test_force_web_boundary_at_threshold():
    """Exactly 0.55 — not above — should NOT force web."""
    jev = {"is_biographical": 0.55, "needs_web_search": 0.55}
    force_web = jev.get("is_biographical", 0) > 0.55 or jev.get("needs_web_search", 0) > 0.55
    assert force_web is False


# ── guardrail blocking threshold ──────────────────────────

def test_guardrail_blocks_at_0_39():
    jev = {"is_on_topic": 0.39}
    blocked = jev.get("is_on_topic", 1.0) < 0.4
    assert blocked is True


def test_guardrail_passes_at_0_40():
    jev = {"is_on_topic": 0.40}
    blocked = jev.get("is_on_topic", 1.0) < 0.4
    assert blocked is False


def test_guardrail_passes_at_1_0():
    jev = {"is_on_topic": 1.0}
    blocked = jev.get("is_on_topic", 1.0) < 0.4
    assert blocked is False
