-- Copy characteristics and policy_doc_ids from template cells to project cells
ALTER TABLE flow_cells
  ADD COLUMN IF NOT EXISTS characteristics jsonb DEFAULT '[]';

ALTER TABLE flow_cells
  ADD COLUMN IF NOT EXISTS policy_doc_ids uuid[] DEFAULT '{}';
