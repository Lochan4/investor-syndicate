CREATE TABLE IF NOT EXISTS financial_commitments (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID         NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id        TEXT         NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  amount_promised NUMERIC(15,2) NOT NULL DEFAULT 0,
  amount_given   NUMERIC(15,2) NOT NULL DEFAULT 0,
  currency       VARCHAR(3)   NOT NULL DEFAULT 'USD',
  notes          TEXT,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);
