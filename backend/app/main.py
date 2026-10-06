from contextlib import asynccontextmanager
import json
import os

import asyncpg
from arq import create_pool
from arq.connections import RedisSettings
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import admin, analyses, assets, conversation, flow, notifications, projects


async def _init_conn(conn) -> None:
    await conn.set_type_codec("jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog")
    await conn.set_type_codec("json",  encoder=json.dumps, decoder=json.loads, schema="pg_catalog")


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.db = await asyncpg.create_pool(os.environ["DATABASE_URL"], init=_init_conn)
    app.state.arq = await create_pool(RedisSettings.from_dsn(os.environ.get("REDIS_URL", "redis://localhost:6379")))
    yield
    await app.state.db.close()
    await app.state.arq.close()


app = FastAPI(title="Syndicate Platform API", version="1.0.0", lifespan=lifespan, redirect_slashes=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router,      prefix="/api/v1")
app.include_router(assets.router,        prefix="/api/v1")
app.include_router(conversation.router,  prefix="/api/v1")
app.include_router(flow.router,          prefix="/api/v1")
app.include_router(analyses.router,      prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(admin.router,         prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok"}
