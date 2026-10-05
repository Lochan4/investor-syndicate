"""Claude wrappers: NER extraction and asset analysis."""
from __future__ import annotations
import json
import os
import platform
import subprocess

import anthropic

_client: anthropic.AsyncAnthropic | None = None


def _get_oauth_token() -> str | None:
    """Read Claude Code's OAuth token from macOS Keychain or ~/.claude/.credentials.json."""
    raw = None
    if platform.system() == "Darwin":
        try:
            r = subprocess.run(
                ["security", "find-generic-password", "-a", os.environ.get("USER", ""), "-w", "-s", "Claude Code-credentials"],
                capture_output=True, text=True, timeout=5,
            )
            if r.returncode == 0:
                raw = r.stdout.strip()
        except Exception:
            pass
    if not raw:
        try:
            with open(os.path.expanduser("~/.claude/.credentials.json")) as f:
                raw = f.read()
        except Exception:
            pass
    if raw:
        try:
            return json.loads(raw).get("claudeAiOauth", {}).get("accessToken")
        except Exception:
            pass
    return None

NER_PROMPT = """\
Extract named entities from the text below. Return JSON only:
{{"entities": [{{"name": "...", "kind": "person|company|location|metric|concept"}}]}}

Text: {text}"""

# Normalise any unexpected kinds Claude might return → DB-allowed kinds
_KIND_MAP = {
    "org": "company", "organisation": "company", "organization": "company",
    "place": "location", "city": "location", "country": "location",
    "product": "concept", "other": "concept", "technology": "concept",
    "number": "metric", "percentage": "metric", "amount": "metric",
}

ANALYSIS_PROMPT = """\
Analyse this investment document excerpt for due diligence.
Return JSON only:
{{"summary": "...", "topics": ["..."], "entities": ["..."]}}

Text: {text}"""


def get_async_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if api_key:
            _client = anthropic.AsyncAnthropic(api_key=api_key)
        else:
            token = _get_oauth_token()
            if not token:
                raise RuntimeError("No ANTHROPIC_API_KEY set and Claude Code OAuth token not found — run `claude auth`")
            # ponytail: shares Claude Code's subscription quota; set ANTHROPIC_API_KEY for prod
            _client = anthropic.AsyncAnthropic(
                auth_token=token,
                default_headers={"anthropic-beta": "oauth-2025-04-20"},
            )
    return _client


async def extract_entities(text: str) -> list[dict]:
    """Return list of {name, kind} dicts."""
    msg = await get_async_client().messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        messages=[{"role": "user", "content": NER_PROMPT.format(text=text[:4000])}],
    )
    try:
        raw = msg.content[0].text.strip()
        raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        data = json.loads(raw)
        entities = data.get("entities", [])
        for e in entities:
            e["kind"] = _KIND_MAP.get(e.get("kind", ""), e.get("kind", "concept"))
            if e["kind"] not in ("person", "company", "location", "metric", "concept"):
                e["kind"] = "concept"
        return entities
    except (json.JSONDecodeError, IndexError, KeyError):
        return []


async def analyse_asset(text: str) -> dict:
    """Return {summary, topics, entities} dict."""
    msg = await get_async_client().messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{"role": "user", "content": ANALYSIS_PROMPT.format(text=text[:8000])}],
    )
    try:
        raw = msg.content[0].text.strip()
        raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        return json.loads(raw)
    except (json.JSONDecodeError, IndexError):
        return {"summary": "", "topics": [], "entities": []}
