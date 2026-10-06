"""Pipeline workers: group consensus and final consensus."""
from __future__ import annotations
import json

from app.services.llm import get_async_client
from app.services import cell_context
from app.services import notifications as notif_svc

_SONNET = "claude-sonnet-4-6"


async def run_group_consensus(ctx: dict, project_id: str) -> None:
    """Read all cell analyses → Claude Sonnet → INSERT analyses(stage='group') → enqueue final."""
    db = ctx["db"]
    cells = await db.fetch(
        "SELECT id, topic FROM flow_cells WHERE project_id=$1", project_id
    )

    summaries = []
    for cell in cells:
        analysis = await cell_context.get_cell_analysis(project_id, str(cell["id"]))
        if analysis:
            summaries.append(f"## {cell['topic']}\n{analysis}")

    combined = "\n\n".join(summaries) or "No investor responses collected."

    client = get_async_client()
    msg = await client.messages.create(
        model=_SONNET,
        max_tokens=2048,
        messages=[{
            "role": "user",
            "content": (
                "You are summarising investor due diligence responses for a deal team.\n\n"
                f"Responses per topic:\n{combined}\n\n"
                'Return JSON: {"overall_sentiment": "positive|mixed|cautious", '
                '"per_topic": [{"topic": ..., "summary": ..., "sentiment": ...}], '
                '"key_concerns": [...], "key_positives": [...]}'
            ),
        }],
    )
    content = json.loads(msg.content[0].text)

    await db.execute(
        """INSERT INTO analyses(project_id, stage, content) VALUES($1,'group',$2)
           ON CONFLICT (project_id, stage) DO UPDATE SET content=$2""",
        project_id, content,
    )

    await db.execute("UPDATE projects SET status='consensus' WHERE id=$1", project_id)
    await notif_svc.notify_all_members(db, project_id, "collection_closed")
    await ctx["arq"].enqueue_job("run_final_consensus", project_id)


async def run_final_consensus(ctx: dict, project_id: str) -> None:
    """Group analysis → Claude Sonnet → final report → project=final."""
    db = ctx["db"]
    row = await db.fetchrow(
        "SELECT content FROM analyses WHERE project_id=$1 AND stage='group'", project_id
    )
    if not row:
        return

    client = get_async_client()
    msg = await client.messages.create(
        model=_SONNET,
        max_tokens=3000,
        messages=[{
            "role": "user",
            "content": (
                f"Generate a final investment committee report from this group analysis:\n"
                f"{json.dumps(row['content'])}\n\n"
                'Return JSON: {"executive_summary": ..., "recommendation": "invest|pass|more_info", '
                '"confidence": "high|medium|low", '
                '"topics": [{"name": ..., "finding": ..., "sentiment": ...}], '
                '"risks": [...], "next_steps": [...]}'
            ),
        }],
    )
    content = json.loads(msg.content[0].text)

    await db.execute(
        """INSERT INTO analyses(project_id, stage, content) VALUES($1,'final',$2)
           ON CONFLICT (project_id, stage) DO UPDATE SET content=$2""",
        project_id, content,
    )
    await db.execute("UPDATE projects SET status='final' WHERE id=$1", project_id)
    await notif_svc.notify_all_members(db, project_id, "final_ready")
