"""LLM wrappers: NER extraction and asset analysis.
Uses OpenAI when OPENAI_API_KEY is set, falls back to Anthropic OAuth token.
"""
from __future__ import annotations
import json
import os

_KIND_MAP = {
    "org": "company", "organisation": "company", "organization": "company",
    "place": "location", "city": "location", "country": "location",
    "product": "concept", "other": "concept", "technology": "concept",
    "number": "metric", "percentage": "metric", "amount": "metric",
}

NER_PROMPT = """\
Extract named entities from the text below. Return JSON only:
{{"entities": [{{"name": "...", "kind": "person|company|location|metric|concept"}}]}}

Text: {text}"""

ANALYSIS_PROMPT = """\
Analyse this investment document excerpt for due diligence.
Return JSON only:
{{"summary": "...", "topics": ["..."], "entities": ["..."]}}

Text: {text}"""


def _strip_fences(raw: str) -> str:
    raw = raw.strip()
    raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return raw


# ── OpenAI path ──────────────────────────────────────────────────────────────

_openai_client = None


def _get_openai():
    global _openai_client
    if _openai_client is None:
        from openai import AsyncOpenAI
        _openai_client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])
    return _openai_client


async def _openai_chat(prompt: str, max_tokens: int = 1024) -> str:
    client = _get_openai()
    resp = await client.chat.completions.create(
        model="gpt-4o-mini",
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )
    return resp.choices[0].message.content or ""


# ── Anthropic path (fallback) ─────────────────────────────────────────────────

_anthropic_client = None


def _get_anthropic():
    global _anthropic_client
    import platform, subprocess, anthropic
    if _anthropic_client is not None:
        return _anthropic_client

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if api_key:
        _anthropic_client = anthropic.AsyncAnthropic(api_key=api_key)
        return _anthropic_client

    # OAuth fallback — read fresh each time so expired tokens don't get cached
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
        token = json.loads(raw).get("claudeAiOauth", {}).get("accessToken")
        if token:
            # ponytail: don't cache when using OAuth; token expires
            return anthropic.AsyncAnthropic(
                auth_token=token,
                default_headers={"anthropic-beta": "oauth-2025-04-20"},
            )
    raise RuntimeError("No ANTHROPIC_API_KEY and no Claude OAuth token found")


async def _anthropic_chat(prompt: str, model: str, max_tokens: int) -> str:
    client = _get_anthropic()
    msg = await client.messages.create(
        model=model, max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text


# ── Public API ────────────────────────────────────────────────────────────────

def get_async_client():
    """Returns Anthropic client — used by pipeline workers that need Sonnet."""
    return _get_anthropic()


async def stream_tokens(system: str, user_content: str, max_tokens: int = 1024):
    """Async generator yielding text tokens. Uses OpenAI if key available, else Anthropic."""
    if os.environ.get("OPENAI_API_KEY"):
        client = _get_openai()
        stream = await client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=max_tokens,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user_content},
            ],
            stream=True,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta
    else:
        client = _get_anthropic()
        async with client.messages.stream(
            model="claude-haiku-4-5-20251001",
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user_content}],
        ) as stream:
            async for tok in stream.text_stream:
                yield tok


async def extract_entities(text: str) -> list[dict]:
    prompt = NER_PROMPT.format(text=text[:4000])
    try:
        if os.environ.get("OPENAI_API_KEY"):
            raw = await _openai_chat(prompt, max_tokens=512)
        else:
            raw = await _anthropic_chat(prompt, "claude-haiku-4-5-20251001", 512)
        data = json.loads(_strip_fences(raw))
        entities = data.get("entities", [])
        for e in entities:
            e["kind"] = _KIND_MAP.get(e.get("kind", ""), e.get("kind", "concept"))
            if e["kind"] not in ("person", "company", "location", "metric", "concept"):
                e["kind"] = "concept"
        return entities
    except Exception:
        return []


async def analyse_asset(text: str) -> dict:
    prompt = ANALYSIS_PROMPT.format(text=text[:8000])
    try:
        if os.environ.get("OPENAI_API_KEY"):
            raw = await _openai_chat(prompt, max_tokens=1024)
        else:
            raw = await _anthropic_chat(prompt, "claude-sonnet-4-6", 1024)
        return json.loads(_strip_fences(raw))
    except Exception:
        return {"summary": "", "topics": [], "entities": []}
