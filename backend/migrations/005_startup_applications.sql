-- ─────────────────────────────────────────
-- STARTUP APPLICATIONS (applicant-facing)
-- ─────────────────────────────────────────

CREATE TABLE startup_applications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Founder details
  founder_name    text NOT NULL,
  founder_email   text NOT NULL,
  startup_name    text NOT NULL,
  sector          text,
  stage           text,
  one_liner       text,
  website         text,
  -- Pitch document (uploaded to R2 before submission)
  pitch_doc_key   text,
  pitch_doc_name  text,
  -- Status flow: submitted → reviewing → added | rejected
  status          text NOT NULL DEFAULT 'submitted'
                  CHECK (status IN ('submitted', 'reviewing', 'added', 'rejected')),
  -- Opaque token for founder status-check URL (no login required)
  status_token    text UNIQUE NOT NULL,
  -- Set once admin adds to workspace
  workspace_id    uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  project_id      uuid REFERENCES projects(id) ON DELETE SET NULL,
  reviewed_by     text REFERENCES users(id),
  reviewed_at     timestamptz,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX ON startup_applications (status);
CREATE INDEX ON startup_applications (status_token);
