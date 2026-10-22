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
    project_entities: list[str] | None = None,
) -> dict:
    """Condense investor question into precise search queries using company context and extracted entities."""
    from app.services.llm import get_async_client

    context_preview = "\n---\n".join(kg_context[:2])[:1200] if kg_context else "(no document context)"
    entities_str = ", ".join(project_entities) if project_entities else "(none extracted yet)"

    prompt = f"""You are a precise search query generator for investment due diligence.

COMPANY BEING EVALUATED: "{company}"
⚠️  Always use this EXACT name verbatim in queries. Never stem, abbreviate, or pluralise it.
    Example: company = "Leaps" → use "Leaps", NOT "leap", NOT "leaping", NOT "leaps.io"

KEY ENTITIES EXTRACTED FROM UPLOADED DOCUMENTS (pitch deck, financials, etc.):
{entities_str}

DOCUMENT EXCERPTS (ignore OCR noise — only use clean recognizable text):
{context_preview}

INVESTOR QUESTION (may be voice-transcribed — extract CORE intent only):
"{question}"

INSTRUCTIONS:

STEP 1: Identify the precise intent in one clean sentence. What specific information does the investor need?

STEP 2: Build 2–3 laser-targeted search queries.
- Always anchor queries with the EXACT company name "{company}" unless the question is specifically about a named person
- Use entities from the extracted list above when they are directly relevant to the question
- Each query must be specific: company name + precise topic (e.g. "{company} job application automation competitors")
- If the question is about a person: "[Full Person Name] [topic]" and "[Full Person Name] site:linkedin.com"
- NEVER use a stemmed, partial, or modified version of the company name
- NEVER generate generic queries without the company anchor

STEP 3: Pull any verbatim URLs found in the document excerpts.

Return ONLY this JSON (no explanation, no markdown):
{{
  "intent": "one precise sentence describing what the investor needs to find",
  "queries": ["query 1", "query 2", "optional query 3"],
  "urls": ["any verbatim URLs from documents"],
  "card_type": "maps or company or web"
}}

card_type must be exactly one of:
- "maps": location/geography/where company or person is based
- "company": specific people, founders, team, education, LinkedIn, work history
- "web": product, market, competitors, funding, industry — everything else"""

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
        queries = [q for q in result.get("queries", []) if isinstance(q, str) and len(q) > 5][:3]
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


def _extract_meta_description(html: str) -> str:
    """Pull og:description or meta description from raw HTML — works for LinkedIn public profiles."""
    import re as _re
    for pattern in (
        r'<meta[^>]+property=["\']og:description["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:description["\']',
        r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']description["\']',
    ):
        m = _re.search(pattern, html, _re.IGNORECASE)
        if m:
            return m.group(1).strip()
    return ""


async def _scrape_linkedin(url: str) -> str:
    """Try meta description first (no auth needed), then Playwright for public profiles."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    }
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as http:
            resp = await http.get(url, headers=headers)
        meta = _extract_meta_description(resp.text)
        if meta and len(meta) > 40:
            return meta
    except Exception:
        pass

    # Playwright fallback — gets more body text for truly public profiles
    try:
        from playwright.async_api import async_playwright
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            ctx = await browser.new_context(
                user_agent=headers["User-Agent"],
                locale="en-US",
                viewport={"width": 1280, "height": 800},
            )
            page = await ctx.new_page()
            await page.goto(url, wait_until="domcontentloaded", timeout=15_000)
            await page.wait_for_timeout(1500)
            text = await page.evaluate("() => document.body.innerText")
            await browser.close()
            # Strip the login-wall boilerplate LinkedIn adds
            lines = [l.strip() for l in text.splitlines() if l.strip()]
            meaningful = [l for l in lines if len(l) > 20 and "sign in" not in l.lower() and "join now" not in l.lower()]
            return "\n".join(meaningful[:60])
    except Exception:
        return ""


async def extract_page_text(url: str) -> str:
    """Fetch URL and strip HTML to plain text. LinkedIn gets special handling."""
    if "linkedin.com" in url:
        return await _scrape_linkedin(url)
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
