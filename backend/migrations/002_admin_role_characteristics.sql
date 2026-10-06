-- Add 'admin' platform role
ALTER TABLE users DROP CONSTRAINT users_platform_role_check;
ALTER TABLE users ADD CONSTRAINT users_platform_role_check
  CHECK (platform_role IN ('super_admin', 'admin', 'developer', 'investor'));

-- Store extracted characteristics per template cell
ALTER TABLE flow_template_cells
  ADD COLUMN IF NOT EXISTS characteristics jsonb DEFAULT '[]';

-- Canvas-level policy documents (global pool, not project-scoped)
CREATE TABLE IF NOT EXISTS canvas_policy_docs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename     text NOT NULL,
  storage_key  text NOT NULL UNIQUE,
  text_content text NOT NULL DEFAULT '',
  created_by   text REFERENCES users(id),
  created_at   timestamptz DEFAULT now()
);

-- Per-cell selected policy doc IDs (saved alongside characteristics at publish time)
ALTER TABLE flow_template_cells
  ADD COLUMN IF NOT EXISTS policy_doc_ids uuid[] DEFAULT '{}';
