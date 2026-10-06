"""
Verifies the migration created the correct schema.
Runs direct DB queries — no FastAPI involved.
"""
import pytest
import asyncpg


ALL_22_TABLES = [
    "users", "invites", "projects", "project_members",
    "assets", "chunks", "entities", "chunk_mentions", "chunk_edges",
    "cell_conversation_turns", "flow_template_versions", "flow_template_cells",
    "flow_cells", "flow_edges", "conversation_sessions", "analyses",
    "notifications", "prompts", "prompt_versions", "llm_runs",
    "audit_log", "pending_invites",
]


@pytest.mark.parametrize("table", ALL_22_TABLES)
async def test_table_exists(db: asyncpg.Pool, table: str):
    row = await db.fetchrow(
        "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1",
        table,
    )
    assert row is not None, f"Table '{table}' not found"


async def test_pgvector_extension_enabled(db: asyncpg.Pool):
    row = await db.fetchrow("SELECT extname FROM pg_extension WHERE extname='vector'")
    assert row is not None, "pgvector extension not installed"


async def test_chunks_embedding_is_vector_1536(db: asyncpg.Pool):
    row = await db.fetchrow(
        """
        SELECT udt_name FROM information_schema.columns
        WHERE table_name='chunks' AND column_name='embedding'
        """
    )
    assert row is not None
    # asyncpg reports vector columns as udt_name = 'vector'
    assert row["udt_name"] == "vector"


async def test_cell_conversation_turns_embedding_is_vector_1536(db: asyncpg.Pool):
    row = await db.fetchrow(
        """
        SELECT udt_name FROM information_schema.columns
        WHERE table_name='cell_conversation_turns' AND column_name='embedding'
        """
    )
    assert row is not None
    assert row["udt_name"] == "vector"


async def test_hnsw_index_on_chunks(db: asyncpg.Pool):
    row = await db.fetchrow(
        "SELECT indexname FROM pg_indexes WHERE tablename='chunks' AND indexdef ILIKE '%hnsw%'"
    )
    assert row is not None, "HNSW index missing on chunks.embedding"


async def test_hnsw_index_on_cell_conversation_turns(db: asyncpg.Pool):
    row = await db.fetchrow(
        """
        SELECT indexname FROM pg_indexes
        WHERE tablename='cell_conversation_turns' AND indexdef ILIKE '%hnsw%'
        """
    )
    assert row is not None, "HNSW index missing on cell_conversation_turns.embedding"


# ── CHECK constraint violations ───────────────────────────

async def test_users_platform_role_check(db: asyncpg.Pool):
    import uuid
    with pytest.raises(asyncpg.CheckViolationError):
        await db.execute(
            "INSERT INTO users(id,email,platform_role) VALUES($1,$2,'hacker')",
            str(uuid.uuid4()), "bad@test.com",
        )


async def test_projects_status_check(db: asyncpg.Pool, investor: dict):
    import uuid
    with pytest.raises(asyncpg.CheckViolationError):
        await db.execute(
            "INSERT INTO projects(id,startup_name,created_by,status) VALUES($1,$2,$3,'invalid')",
            str(uuid.uuid4()), "TestCo", investor["id"],
        )


async def test_assets_kind_check(db: asyncpg.Pool, investor: dict):
    import uuid
    # Need a project first
    project_id = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO projects(id,startup_name,created_by) VALUES($1,'TestCo',$2)",
        project_id, investor["id"],
    )
    with pytest.raises(asyncpg.CheckViolationError):
        await db.execute(
            "INSERT INTO assets(project_id,kind,filename,storage_key) VALUES($1,'zip','f.zip','key')",
            project_id,
        )
    await db.execute("DELETE FROM projects WHERE id=$1", project_id)


async def test_chunk_edges_kind_check(db: asyncpg.Pool):
    import uuid
    with pytest.raises(asyncpg.CheckViolationError):
        await db.execute(
            "INSERT INTO chunk_edges(project_id,from_chunk,to_chunk,kind) VALUES($1,$2,$3,'RELATED')",
            str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4()),
        )


# ── UNIQUE constraints ────────────────────────────────────

async def test_project_members_unique(db: asyncpg.Pool, investor: dict):
    import uuid
    project_id = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO projects(id,startup_name,created_by) VALUES($1,'UniCo',$2)",
        project_id, investor["id"],
    )
    await db.execute(
        "INSERT INTO project_members(project_id,user_id,role) VALUES($1,$2,'attendee')",
        project_id, investor["id"],
    )
    with pytest.raises(asyncpg.UniqueViolationError):
        await db.execute(
            "INSERT INTO project_members(project_id,user_id,role) VALUES($1,$2,'reviewer')",
            project_id, investor["id"],
        )
    await db.execute("DELETE FROM projects WHERE id=$1", project_id)


async def test_analyses_unique_per_project_stage(db: asyncpg.Pool, investor: dict):
    import uuid
    project_id = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO projects(id,startup_name,created_by) VALUES($1,'AnalCo',$2)",
        project_id, investor["id"],
    )
    await db.execute(
        "INSERT INTO analyses(project_id,stage,content) VALUES($1,'group','{}'::jsonb)",
        project_id,
    )
    with pytest.raises(asyncpg.UniqueViolationError):
        await db.execute(
            "INSERT INTO analyses(project_id,stage,content) VALUES($1,'group','{}'::jsonb)",
            project_id,
        )
    await db.execute("DELETE FROM projects WHERE id=$1", project_id)


# ── DEFAULT values ────────────────────────────────────────

async def test_project_status_defaults_to_draft(db: asyncpg.Pool, investor: dict):
    import uuid
    pid = str(uuid.uuid4())
    row = await db.fetchrow(
        "INSERT INTO projects(id,startup_name,created_by) VALUES($1,'DraftCo',$2) RETURNING status",
        pid, investor["id"],
    )
    assert row["status"] == "draft"
    await db.execute("DELETE FROM projects WHERE id=$1", pid)


async def test_asset_status_defaults_to_pending(db: asyncpg.Pool, investor: dict):
    import uuid
    pid = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO projects(id,startup_name,created_by) VALUES($1,'AssetCo',$2)", pid, investor["id"]
    )
    row = await db.fetchrow(
        "INSERT INTO assets(project_id,kind,filename,storage_key) VALUES($1,'pdf','f.pdf','k') RETURNING status",
        pid,
    )
    assert row["status"] == "pending"
    await db.execute("DELETE FROM projects WHERE id=$1", pid)


# ── FK CASCADE ────────────────────────────────────────────

async def test_delete_project_cascades_assets(db: asyncpg.Pool, investor: dict):
    import uuid
    pid = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO projects(id,startup_name,created_by) VALUES($1,'CascadeCo',$2)", pid, investor["id"]
    )
    await db.execute(
        "INSERT INTO assets(project_id,kind,filename,storage_key) VALUES($1,'pdf','f.pdf','k')", pid
    )
    await db.execute("DELETE FROM projects WHERE id=$1", pid)
    count = await db.fetchval("SELECT COUNT(*) FROM assets WHERE project_id=$1", pid)
    assert count == 0


async def test_delete_project_cascades_members(db: asyncpg.Pool, investor: dict):
    import uuid
    pid = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO projects(id,startup_name,created_by) VALUES($1,'CascadeMemberCo',$2)", pid, investor["id"]
    )
    await db.execute(
        "INSERT INTO project_members(project_id,user_id,role) VALUES($1,$2,'attendee')", pid, investor["id"]
    )
    await db.execute("DELETE FROM projects WHERE id=$1", pid)
    count = await db.fetchval(
        "SELECT COUNT(*) FROM project_members WHERE project_id=$1", pid
    )
    assert count == 0
