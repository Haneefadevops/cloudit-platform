-- OrbitOne Phase 5 light CRM.
-- Scope: connection lifecycle, priority, next step, and simple activity timeline.

ALTER TABLE connections
ADD COLUMN IF NOT EXISTS lifecycle_stage TEXT NOT NULL DEFAULT 'new',
ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS next_step TEXT,
ADD CONSTRAINT connections_lifecycle_stage_check
  CHECK (lifecycle_stage IN ('new', 'contacted', 'meeting', 'proposal', 'won', 'lost')),
ADD CONSTRAINT connections_priority_check
  CHECK (priority IN ('low', 'medium', 'high'));

CREATE TABLE IF NOT EXISTS connection_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT connection_activities_type_check
    CHECK (activity_type IN ('note', 'call', 'email', 'meeting', 'other')),
  CONSTRAINT connection_activities_title_length CHECK (char_length(title) BETWEEN 1 AND 160),
  CONSTRAINT connection_activities_body_length CHECK (body IS NULL OR char_length(body) <= 2000)
);

CREATE INDEX IF NOT EXISTS connection_activities_connection_occurred_at_idx
  ON connection_activities(connection_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS connection_activities_owner_occurred_at_idx
  ON connection_activities(owner_user_id, occurred_at DESC);

DROP TRIGGER IF EXISTS connection_activities_set_updated_at ON connection_activities;
CREATE TRIGGER connection_activities_set_updated_at
BEFORE UPDATE ON connection_activities
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
