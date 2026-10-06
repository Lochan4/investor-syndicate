"""Agent action services: web search, page text extraction, headless screenshot."""
from __future__ import annotations
import base64
import os
from html.parser import HTMLParser

import httpx


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
