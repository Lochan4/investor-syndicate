"""Agent action services: web search, page text extraction, headless screenshot."""
from __future__ import annotations
import base64
import json as _json
import os
from html.parser import HTMLParser

import httpx

_HAIKU = "claude-haiku-4-5-20251001"


class _TextExtractor(HTMLParser):
    _skip_tags = {"script", "style", "nav", "footer", "head", "noscript"}

    def __init__(self):
        super().__init__()
        self._parts: list[str] = []
        self._depth = 0

    def handle_starttag(self, tag, attrs):
        if tag in self._skip_tags:
            self._depth += 1

    def handle_endtag(self, tag):
        if tag in self._skip_tags and self._depth:
            self._depth -= 1

    def handle_data(self, data):
        if not self._depth:
            t = data.strip()
            if t:
                self._parts.append(t)

    def get_text(self) -> str:
        return " ".join(self._parts)


async def web_search(query: str, num: int = 8) -> list[dict]:
    """Serper search → [{title, link, snippet}]."""
    async with httpx.AsyncClient(timeout=10) as http:
        r = await http.post(
            "https://google.serper.dev/search",
            json={"q": query, "num": num},
            headers={"X-API-KEY": os.environ.get("SERPER_API_KEY", "")},
        )
    if r.status_code != 200:
        return []
    return [
        {"title": item.get("title", ""), "link": item.get("link", ""), "snippet": item.get("snippet", "")}
        for item in r.json().get("organic", [])
    ]


async def classify_search_intent(
    question: str,
    company: str,
    kg_context: list[str],
) -> dict:
    """Condense investor question into clean search queries using key entities from documents."""
    from app.services.llm import get_async_client

    context_preview = "\n---\n".join(kg_context[:2])[:1200] if kg_context else "(no document context)"

    prompt = f"""You are a search query generator for investment due diligence.

Company being evaluated: {company}

Document excerpts (ignore OCR noise/garbled text — only use clean recognizable words):
{context_preview}

Investor question (may be voice-transcribed, may contain noise — extract the CORE intent only):
"{question}"

Your job — two steps:

STEP 1: Identify the core intent in one clean sentence. Ignore noise/filler words.

STEP 2: Extract clean named entities from the DOCUMENTS (not the question):
- Founder/person full names (properly capitalized)
- Company or product names
- Any URLs (http/www links)

STEP 3: Build 2 targeted search queries using those entities.
- Each query: [person name or company name] + [specific topic from intent]
- Example: "Sai Trilochan Munigela university degree", "{company} founding team background"
- NEVER copy garbled words or noise into queries
- NEVER use a vague query like just the company name alone

Return ONLY this JSON (no explanation):
{{
  "intent": "clean one-sentence description of what the investor needs",
  "queries": ["query 1", "query 2"],
  "urls": ["any verbatim URLs from documents"]
}}"""

    try:
        client = get_async_client()
        msg = await client.messages.create(
            model=_HAIKU,
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = msg.content[0].text.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        result = _json.loads(raw.strip())
        # Sanitise: ensure queries are non-empty strings, cap at 2
        queries = [q for q in result.get("queries", []) if isinstance(q, str) and len(q) > 5][:2]
        if not queries:
            queries = [f"{company} {result.get('intent', 'overview')}"]
        result["queries"] = queries
        return result
    except Exception:
        # Safe fallback: company + condensed question (first 8 words only)
        short = " ".join(question.split()[:8])
        return {
            "intent": short,
            "queries": [f"{company} {short}"],
            "urls": [],
        }


async def extract_page_text(url: str) -> str:
    """Fetch URL and strip HTML to plain text (stdlib html.parser, no new deps)."""
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as http:
            resp = await http.get(url, headers={"User-Agent": "Mozilla/5.0"})
        parser = _TextExtractor()
        parser.feed(resp.text)
        return parser.get_text()[:20_000]
    except Exception:
        return ""


async def capture_screenshot(url: str) -> str:
    """Playwright headless screenshot → base64 PNG. Lazy import — playwright is optional."""
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1280, "height": 800})
        await page.goto(url, wait_until="domcontentloaded", timeout=20_000)
        data = await page.screenshot(type="png", full_page=False)
        await browser.close()
    return base64.b64encode(data).decode()
