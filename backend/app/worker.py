"""Arq WorkerSettings — entry point for the background worker process."""
from __future__ import annotations
import json
import os

import asyncpg
from arq import create_pool
from arq.connections import RedisSettings

from app.workers.agent_actions import ingest_page_to_kg, run_agent_browser_session, run_agent_web_search
from app.workers.cell_views import build_cell_views
from app.workers.competitive_scan import run_competitive_scan
from app.workers.pipeline import run_final_consensus, run_group_consensus
from app.workers.process_asset import build_graph_edges, process_asset, run_asset_analysis


async def _init_conn(conn) -> None:
    await conn.set_type_codec("jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog")
    await conn.set_type_codec("json",  encoder=json.dumps, decoder=json.loads, schema="pg_catalog")


async def startup(ctx: dict) -> None:
    ctx["db"] = await asyncpg.create_pool(os.environ["DATABASE_URL"], init=_init_conn)
    ctx["arq"] = await create_pool(
        RedisSettings.from_dsn(os.environ.get("REDIS_URL", "redis://localhost:6379"))
    )


async def shutdown(ctx: dict) -> None:
    await ctx["db"].close()
    await ctx["arq"].close()


class WorkerSettings:
    functions = [
        process_asset,
        build_graph_edges,
        run_asset_analysis,
        run_group_consensus,
        run_final_consensus,
        build_cell_views,
        run_competitive_scan,
        run_agent_web_search,
        run_agent_browser_session,
        ingest_page_to_kg,
    ]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = None  # reads REDIS_URL env var by default via arq
