-- Workspace-level pending invites (mirrors pending_invites but scoped to a workspace)
CREATE TABLE pending_workspace_invites (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text NOT NULL,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  role         text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  invited_by   text REFERENCES users(id),
  accepted_at  timestamptz,
  created_at   timestamptz DEFAULT now()
);
CREATE INDEX ON pending_workspace_invites (email) WHERE accepted_at IS NULL;
