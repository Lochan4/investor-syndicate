# Database Schema (Postgres + Neo4j)

## Two Databases

| Database | What lives here |
| --- | --- |
| **Supabase Postgres** | Users, projects, assets (metadata), forms, responses, notifications, prompts, LLM runs, audit |
| **Neo4j** | Chunk nodes, Entity nodes, all edges — the knowledge graph |

Postgres is the source of truth for identity, access control, and project state. Neo4j is the knowledge store — queried only during conversation traversal and graph visualisation. They are linked by shared IDs (asset_id, project_id stored on Neo4j nodes).

---

## Postgres Tables

### users
```sql
CREATE TABLE users (
  id            uuid PRIMARY KEY,  -- = Supabase auth.users.id
  email         text UNIQUE NOT NULL,
  platform_role text NOT NULL CHECK (platform_role IN
                  ('super_admin','developer','investor')),
  status        text NOT NULL DEFAULT 'active',
  created_at    timestamptz DEFAULT now()
);
```

### invites
```sql
CREATE TABLE invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  token_hash  text NOT NULL,
  invited_by  uuid REFERENCES users(id),
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz
);
```

### projects
```sql
CREATE TABLE projects (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_name         text NOT NULL,
  sector               text,
  stage                text,        -- seed / series-a / etc.
  status               text NOT NULL DEFAULT 'draft'
                         CHECK (status IN (
                           'draft','building_graph','open',
                           'consensus','rebuttals','final','failed'
                         )),
  created_by           uuid REFERENCES users(id),
  collection_closed_at timestamptz,
  created_at           timestamptz DEFAULT now()
);
```

### project_members
```sql
CREATE TABLE project_members (
  project_id  uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES users(id),
  role        text NOT NULL CHECK (role IN ('attendee','reviewer')),
  added_by    uuid REFERENCES users(id),
  notified_at timestamptz,
  PRIMARY KEY (project_id, user_id)
);
```

### assets
```sql
CREATE TABLE assets (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid REFERENCES projects(id) ON DELETE CASCADE,
  kind           text NOT NULL CHECK (kind IN
                   ('pdf','pptx','audio','image','spreadsheet','text','video')),
  filename       text NOT NULL,
  storage_key    text NOT NULL,
  file_size_bytes bigint,
  status         text NOT NULL DEFAULT 'pending'
                   CHECK (status IN
                     ('pending','processing','embedding','ready','failed')),
  chunk_count    int,
  error_message  text,
  created_at     timestamptz DEFAULT now(),
  processed_at   timestamptz
);
```

### conversation_sessions
```sql
CREATE TABLE conversation_sessions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES users(id),
  status     text NOT NULL DEFAULT 'active'
               CHECK (status IN ('active','submitted')),
  created_at timestamptz DEFAULT now(),
  submitted_at timestamptz,
  UNIQUE (project_id, user_id)
);
```

### conversation_messages
```sql
CREATE TABLE conversation_messages (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         uuid REFERENCES conversation_sessions(id) ON DELETE CASCADE,
  role               text NOT NULL CHECK (role IN ('user','assistant')),
  content            text NOT NULL,
  voice_storage_key  text,           -- raw audio if voice input
  transcript         text,           -- Whisper output if voice
  traversal_summary  jsonb,          -- [{node_id, score, asset_kind, text_preview}]
  source_asset_ids   uuid[],         -- assets used in this answer
  created_at         timestamptz DEFAULT now()
);
```

### forms
```sql
CREATE TABLE forms (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id                  uuid REFERENCES projects(id) ON DELETE CASCADE,
  kind                        text NOT NULL CHECK (kind IN ('review','rebuttal')),
  schema                      jsonb NOT NULL,
  generated_by_prompt_version uuid REFERENCES prompt_versions(id),
  approved_by                 uuid REFERENCES users(id),
  approved_at                 timestamptz,
  status                      text NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft','open','closed'))
);
```

### responses
```sql
CREATE TABLE responses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id      uuid REFERENCES forms(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES users(id),
  answers      jsonb NOT NULL,
  submitted_at timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  UNIQUE (form_id, user_id)
);
```

### attendee_takes
```sql
CREATE TABLE attendee_takes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES users(id),
  thesis       text,
  concerns     text,
  probe_points text,
  created_at   timestamptz DEFAULT now(),
  UNIQUE (project_id, user_id)
);
```

### analyses
```sql
CREATE TABLE analyses (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid REFERENCES projects(id) ON DELETE CASCADE,
  stage             text NOT NULL CHECK (stage IN ('group','final')),
  content           jsonb NOT NULL,
  prompt_version_id uuid REFERENCES prompt_versions(id),
  created_at        timestamptz DEFAULT now(),
  UNIQUE (project_id, stage)
);
```

### notifications
```sql
CREATE TABLE notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES users(id),
  project_id uuid REFERENCES projects(id),
  kind       text NOT NULL CHECK (kind IN (
               'added_to_project','graph_ready','collection_closed',
               'rebuttal_open','final_ready','reminder'
             )),
  read_at    timestamptz,
  created_at timestamptz DEFAULT now()
);
```

### prompts + prompt_versions
```sql
CREATE TABLE prompts (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_key text UNIQUE NOT NULL,
  -- stage_keys: conversation | group_consensus | rebuttal_gen
  --             final_consensus | form_editor | ner_extraction
  name      text NOT NULL
);

CREATE TABLE prompt_versions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id     uuid REFERENCES prompts(id),
  template      text NOT NULL,
  model         text NOT NULL,
  params        jsonb NOT NULL,
  output_schema jsonb,
  status        text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','live','archived')),
  author_id     uuid REFERENCES users(id),
  created_at    timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX prompt_versions_one_live
  ON prompt_versions (prompt_id)
  WHERE status = 'live';
```

### llm_runs
```sql
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
```

### audit_log
```sql
CREATE TABLE audit_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     uuid REFERENCES users(id),
  action       text NOT NULL,
  target_table text,
  target_id    uuid,
  payload      jsonb,
  created_at   timestamptz DEFAULT now()
  -- NO DELETE RLS policy
);
```

---

## Neo4j Schema

```cypher
-- Node labels
(:Project  {id, name})
(:Asset    {id, project_id, kind, filename, storage_key})
(:Chunk    {id, asset_id, project_id, text, chunk_index,
            page_number, timestamp_start, embedding})
(:Entity   {id, project_id, name, kind})

-- Relationships
(Asset)-[:BELONGS_TO]->(Project)
(Chunk)-[:PART_OF]->(Asset)
(Chunk)-[:NEXT]->(Chunk)                        -- sequential
(Chunk)-[:SIMILAR_TO {score: float}]->(Chunk)   -- cosine sim > 0.82
(Chunk)-[:MENTIONS]->(Entity)
(Entity)-[:RELATED_TO {via: chunk_id}]->(Entity)

-- Vector index
CREATE VECTOR INDEX chunk_embeddings
FOR (c:Chunk) ON (c.embedding)
OPTIONS {indexConfig: {
  `vector.dimensions`: 1536,
  `vector.similarity_function`: 'cosine'
}}
```

---

## Key Constraints

```sql
UNIQUE (project_id, user_id)   -- project_members, attendee_takes, conversation_sessions
UNIQUE (form_id, user_id)      -- responses
UNIQUE (project_id, stage)     -- analyses
UNIQUE WHERE status='live'     -- prompt_versions
```

## Indexes

```sql
CREATE INDEX ON project_members (user_id);
CREATE INDEX ON assets (project_id, status);
CREATE INDEX ON conversation_sessions (project_id, status);
CREATE INDEX ON conversation_messages (session_id, created_at);
CREATE INDEX ON notifications (user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX ON llm_runs (project_id);
```
