"""Worker: competitive intelligence scan via Serper + Claude."""
from __future__ import annotations
import json
import os
import uuid

import httpx
from app.services.llm import get_async_client

_HAIKU = "claude-haiku-4-5-20251001"
_SONNET = "claude-sonnet-4-6"


async def run_competitive_scan(ctx: dict, project_id: str) -> None:
    db = ctx["db"]

    proj = await db.fetchrow(
        "SELECT startup_name, sector FROM projects WHERE id=$1", project_id
    )
    chunks = await db.fetch(
        "SELECT text FROM chunks WHERE project_id=$1 LIMIT 10", project_id
    )
    context = "\n".join(r["text"] for r in chunks)  # noqa: F841 — available if needed

    client = get_async_client()

    qmsg = await client.messages.create(
        model=_HAIKU,
        max_tokens=256,
        messages=[{
            "role": "user",
            "content": (
                f"Generate 5 Google search queries to find competitors of "
                f"'{proj['startup_name']}' in sector '{proj['sector']}'.\n"
                'Return JSON: {"queries": ["...", ...]}'
            ),
        }],
    )
    raw_q = qmsg.content[0].text.strip()
    raw_q = raw_q.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    queries = json.loads(raw_q).get("queries", [])

    results = []
    async with httpx.AsyncClient() as http:
        for q in queries[:5]:
            r = await http.post(
                "https://google.serper.dev/search",
                json={"q": q, "num": 10},
                headers={"X-API-KEY": os.environ.get("SERPER_API_KEY", "")},
            )
            if r.status_code == 200:
                results.extend(r.json().get("organic", []))

    if results:
        result_text = "\n".join(
            f"- {r.get('title')}: {r.get('snippet')}" for r in results[:30]
        )
        amsg = await client.messages.create(
            model=_SONNET,
            max_tokens=2048,
            messages=[{
                "role": "user",
                "content": (
                    f"Assess these search results for competitors of '{proj['startup_name']}':\n"
                    f"{result_text}\n\n"
                    "Return a markdown competitive intelligence report with sections: "
                    "## Overview, ## Key Competitors (table: Name|Description|Overlap), "
                    "## Differentiation Opportunities, ## Market Landscape"
                ),
            }],
        )
        report_md = amsg.content[0].text
    else:
        report_md = f"# Competitive Intelligence: {proj['startup_name']}\n\nNo external data retrieved."

    storage_key = f"{project_id}/competitive_intel_{uuid.uuid4()}.md"
    asset_id = await db.fetchval(
        """INSERT INTO assets(project_id, kind, filename, storage_key)
           VALUES($1,'competitive_intel','competitive_intel.md',$2) RETURNING id""",
        project_id, storage_key,
    )
    await db.execute(
        "UPDATE assets SET analysis_cache=$1, status='ready', processed_at=now() WHERE id=$2",
        {"summary": report_md, "entities": [], "topics": ["competitive intelligence"]},
        str(asset_id),
    )
