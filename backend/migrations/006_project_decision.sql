-- Decision outcome on a project (set by panel after consensus)
ALTER TABLE projects ADD COLUMN is_investable  boolean;        -- null = no decision yet
ALTER TABLE projects ADD COLUMN decision_notes text;
ALTER TABLE projects ADD COLUMN decided_by     text REFERENCES users(id);
ALTER TABLE projects ADD COLUMN decided_at     timestamptz;
