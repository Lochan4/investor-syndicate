"""Worker: synthesise investor conversation turns into a cell analysis."""
from __future__ import annotations
import json

from app.services.llm import get_async_client
from app.services import cell_context

_SONNET = "claude-sonnet-4-6"


async def build_cell_views(ctx: dict, project_id: str, cell_id: str) -> None:
    """Read all investor turns for this cell → Claude Sonnet synthesis → Redis + DB."""
    db = ctx["db"]
    all_turns = await cell_context.get_all_turns(project_id, cell_id)

    if not all_turns:
        return

    parts = []
    for entry in all_turns:
        turns_text = "\n".join(
            f"{t['role'].upper()}: {t['content']}" for t in entry["turns"]
        )
        parts.append(f"Investor {entry['user_id'][:8]}:\n{turns_text}")

    combined = "\n\n---\n\n".join(parts)

    client = get_async_client()
    msg = await client.messages.create(
        model=_SONNET,
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": (
                f"Synthesise these investor responses into a cell analysis:\n{combined}\n\n"
                'Return JSON: {"summary": ..., "sentiment": "positive|mixed|cautious", '
                '"investor_views": [{"user_id": ..., "quote": ..., "sentiment": ...}], '
                '"key_themes": [...]}'
            ),
        }],
    )
    raw = msg.content[0].text.strip()
    raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    synthesis = json.loads(raw)

    await cell_context.set_cell_analysis(project_id, cell_id, json.dumps(synthesis))
    await db.execute(
        "UPDATE flow_cells SET output_cache=$1 WHERE id=$2 AND project_id=$3",
        synthesis, cell_id, project_id,
    )
