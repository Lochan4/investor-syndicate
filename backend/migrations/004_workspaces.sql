-- ─────────────────────────────────────────
-- WORKSPACES
-- ─────────────────────────────────────────

CREATE TABLE workspaces (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  created_by  text REFERENCES users(id),
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE workspace_members (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  added_by     text REFERENCES users(id),
  added_at     timestamptz DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);
CREATE INDEX ON workspace_members (user_id);

-- Scope projects to a workspace (nullable to preserve existing data)
ALTER TABLE projects ADD COLUMN workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL;
CREATE INDEX ON projects (workspace_id);
