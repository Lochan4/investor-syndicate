"""Entity extraction storage — persists NER results to entities + chunk_mentions."""
from __future__ import annotations
import asyncpg


async def store_entities(
    db: asyncpg.Pool,
    project_id: str,
    chunk_id: str,
    entities: list[dict],
) -> None:
    """
    Upsert entities and link each to the given chunk via chunk_mentions.
    entities: list of {"name": str, "kind": "person|company|location|metric|concept"}
    """
    for entity in entities:
        entity_id = await db.fetchval(
            """
            INSERT INTO entities(project_id, name, kind)
            VALUES($1, $2, $3)
            ON CONFLICT (project_id, name, kind) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
            """,
            project_id, entity["name"], entity["kind"],
        )
        await db.execute(
            """
            INSERT INTO chunk_mentions(chunk_id, entity_id)
            VALUES($1, $2)
            ON CONFLICT DO NOTHING
            """,
            chunk_id, str(entity_id),
        )
