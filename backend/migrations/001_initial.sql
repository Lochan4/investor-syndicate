-- Enable extensions
-- gen_random_uuid() is built-in since PG 13; pgcrypto not needed
CREATE EXTENSION IF NOT EXISTS "vector";

-- ─────────────────────────────────────────
-- IDENTITY & ACCESS
-- ─────────────────────────────────────────

CREATE TABLE users (
  id            text PRIMARY KEY,           -- = WorkOS user ID (sub claim, e.g. user_01M...)
  email         text UNIQUE NOT NULL,
  platform_role text NOT NULL CHECK (platform_role IN ('super_admin','developer','investor')),
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at    timestamptz DEFAULT now()
);

-- Legacy audit trail; functional invite tracking is in pending_invites
CREATE TABLE invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  token_hash  text NOT NULL,
  invited_by  text REFERENCES users(id),
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz
);

-- ─────────────────────────────────────────
-- PROJECTS
-- ─────────────────────────────────────────

CREATE TABLE projects (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_name         text NOT NULL,
  sector               text,
  stage                text,
  status               text NOT NULL DEFAULT 'draft' CHECK (status IN (
                         'draft','building_graph','open','consensus','rebuttals','final','failed'
                       )),
  created_by           text REFERENCES users(id),
  collection_closed_at timestamptz,
  created_at           timestamptz DEFAULT now()
);

CREATE TABLE project_members (
  project_id  uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id     text REFERENCES users(id),
  role        text NOT NULL CHECK (role IN ('attendee','reviewer')),
  added_by    text REFERENCES users(id),
  notified_at timestamptz,
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX ON project_members (user_id);

-- ─────────────────────────────────────────
-- ASSETS & GRAPH (pgvector replaces Neo4j)
-- ─────────────────────────────────────────

CREATE TABLE assets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  kind            text NOT NULL CHECK (kind IN (
                    'pdf','pptx','audio','image','spreadsheet','text','video','competitive_intel'
                  )),
  filename        text NOT NULL,
  storage_key     text NOT NULL,
  file_size_bytes bigint,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN (
                    'pending','processing','embedding','ready','failed'
                  )),
  chunk_count     int,
  analysis_cache  jsonb,        -- {entities, summary, topics} written by run_asset_analysis
  error_message   text,
  created_at      timestamptz DEFAULT now(),
  processed_at    timestamptz
);
CREATE INDEX ON assets (project_id, status);

-- Chunk nodes (replaces Neo4j :Chunk)
CREATE TABLE chunks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id        uuid REFERENCES assets(id) ON DELETE CASCADE,
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  text            text NOT NULL,
  chunk_index     int NOT NULL,
  page_number     int,
  timestamp_start float,        -- seconds, for audio chunks
  embedding       vector(1536),
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX ON chunks (asset_id, chunk_index);
CREATE INDEX ON chunks (project_id);
CREATE INDEX ON chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Entity nodes (replaces Neo4j :Entity)
CREATE TABLE entities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid REFERENCES projects(id) ON DELETE CASCADE,
  name        text NOT NULL,
  kind        text NOT NULL CHECK (kind IN ('person','company','location','metric','concept')),
  created_at  timestamptz DEFAULT now(),
  UNIQUE (project_id, name, kind)
);
CREATE INDEX ON entities (project_id);

-- MENTIONS edges (replaces Neo4j MENTIONS relationship)
CREATE TABLE chunk_mentions (
  chunk_id    uuid REFERENCES chunks(id) ON DELETE CASCADE,
  entity_id   uuid REFERENCES entities(id) ON DELETE CASCADE,
  PRIMARY KEY (chunk_id, entity_id)
);

-- NEXT / SIMILAR_TO edges (replaces Neo4j NEXT + SIMILAR_TO relationships)
CREATE TABLE chunk_edges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid REFERENCES projects(id) ON DELETE CASCADE,
  from_chunk  uuid REFERENCES chunks(id) ON DELETE CASCADE,
  to_chunk    uuid REFERENCES chunks(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('NEXT','SIMILAR_TO')),
  score       float,            -- cosine score, for SIMILAR_TO only
  UNIQUE (from_chunk, to_chunk, kind)
);

-- ─────────────────────────────────────────
-- FLOW CANVAS
-- ─────────────────────────────────────────

CREATE TABLE flow_template_versions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_num  int NOT NULL,
  status       text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','live','archived')),
  published_by text REFERENCES users(id),
  published_at timestamptz,
  created_at   timestamptz DEFAULT now()
);
-- Only one live template version at a time
CREATE UNIQUE INDEX flow_template_versions_one_live
  ON flow_template_versions (status) WHERE status = 'live';

CREATE TABLE flow_template_cells (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id  uuid REFERENCES flow_template_versions(id) ON DELETE CASCADE,
  topic       text NOT NULL,
  prompt      text,
  position_x  float DEFAULT 0,
  position_y  float DEFAULT 0,
  cell_order  int NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- Per-project copy of template cells (copied when project transitions to 'open')
CREATE TABLE flow_cells (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid REFERENCES projects(id) ON DELETE CASCADE,
  template_cell_id uuid REFERENCES flow_template_cells(id),
  topic            text NOT NULL,
  prompt           text,
  position_x       float DEFAULT 0,
  position_y       float DEFAULT 0,
  output_cache     jsonb,       -- cell synthesis result (written by build_cell_views worker)
  created_at       timestamptz DEFAULT now()
);
CREATE INDEX ON flow_cells (project_id);

CREATE TABLE flow_edges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid REFERENCES projects(id) ON DELETE CASCADE,
  from_cell   uuid REFERENCES flow_cells(id) ON DELETE CASCADE,
  to_cell     uuid REFERENCES flow_cells(id) ON DELETE CASCADE,
  UNIQUE (project_id, from_cell, to_cell)
);

-- ─────────────────────────────────────────
-- CONVERSATION
-- ─────────────────────────────────────────

CREATE TABLE conversation_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id      text REFERENCES users(id),
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active','submitted')),
  created_at   timestamptz DEFAULT now(),
  submitted_at timestamptz,
  UNIQUE (project_id, user_id)
);
CREATE INDEX ON conversation_sessions (project_id, status);

-- Per-cell conversation context with embeddings (powers upstream context injection)
CREATE TABLE cell_conversation_turns (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid REFERENCES projects(id) ON DELETE CASCADE,
  cell_id     uuid NOT NULL,    -- references flow_cells.id (no FK to allow lazy resolution)
  user_id     text REFERENCES users(id),
  role        text NOT NULL CHECK (role IN ('user','assistant')),
  content     text NOT NULL,
  embedding   vector(1536),
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX ON cell_conversation_turns (project_id, cell_id, user_id);
CREATE INDEX ON cell_conversation_turns USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ─────────────────────────────────────────
-- PROMPTS & LLM TRACKING
-- ─────────────────────────────────────────

CREATE TABLE prompts (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_key text UNIQUE NOT NULL,
  -- stage_keys: conversation | group_consensus | final_consensus
  --             run_asset_analysis | ner_extraction | competitive_scan
  name      text NOT NULL
);

CREATE TABLE prompt_versions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id     uuid REFERENCES prompts(id),
  template      text NOT NULL,
  model         text NOT NULL,
  params        jsonb NOT NULL DEFAULT '{}',
  output_schema jsonb,
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','live','archived')),
  author_id     text REFERENCES users(id),
  created_at    timestamptz DEFAULT now()
);
-- Only one live version per prompt
CREATE UNIQUE INDEX prompt_versions_one_live
  ON prompt_versions (prompt_id) WHERE status = 'live';

-- ─────────────────────────────────────────
-- ANALYSES
-- ─────────────────────────────────────────

CREATE TABLE analyses (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid REFERENCES projects(id) ON DELETE CASCADE,
  stage             text NOT NULL CHECK (stage IN ('group','final')),
  content           jsonb NOT NULL,
  prompt_version_id uuid REFERENCES prompt_versions(id),
  created_at        timestamptz DEFAULT now(),
  UNIQUE (project_id, stage)
);

-- ─────────────────────────────────────────
-- NOTIFICATIONS
-- ─────────────────────────────────────────

CREATE TABLE notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    text REFERENCES users(id),
  project_id uuid REFERENCES projects(id),
  kind       text NOT NULL CHECK (kind IN (
               'added_to_project','graph_ready','collection_closed',
               'rebuttal_open','final_ready','reminder'
             )),
  read_at    timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX ON notifications (user_id, read_at) WHERE read_at IS NULL;

-- ─────────────────────────────────────────
-- LLM AUDIT
-- ─────────────────────────────────────────

CREATE TABLE llm_runs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_version_id uuid REFERENCES prompt_versions(id),
  project_id        uuid REFERENCES projects(id),
  session_id        uuid REFERENCES conversation_sessions(id),
  inputs_hash       text,
  tokens_in         int,
  tokens_out        int,
  cost_usd          numeric(10,6),
  latency_ms        int,
  status            text NOT NULL CHECK (status IN ('ok','failed')),
  created_at        timestamptz DEFAULT now()
);
CREATE INDEX ON llm_runs (project_id);

CREATE TABLE audit_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     text REFERENCES users(id),
  action       text NOT NULL,
  target_table text,
  target_id    uuid,
  payload      jsonb,
  created_at   timestamptz DEFAULT now()
  -- Intentionally no DELETE policy
);

-- ─────────────────────────────────────────
-- INVITES (WorkOS flow)
-- ─────────────────────────────────────────

-- Pre-associates an email with a project before WorkOS signup.
-- WorkOS webhook user.created moves these rows into project_members.
CREATE TABLE pending_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  project_id  uuid REFERENCES projects(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('attendee','reviewer')),
  invited_by  text REFERENCES users(id),
  accepted_at timestamptz,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX ON pending_invites (email) WHERE accepted_at IS NULL;
