-- OrbitOne Phase 3 relationship management.
-- Scope: lightweight connection notes, tags, follow-ups, and relationship status.

ALTER TABLE connections
ADD COLUMN IF NOT EXISTS relationship_status TEXT NOT NULL DEFAULT 'new',
ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ,
ADD CONSTRAINT connections_relationship_status_check
  CHECK (relationship_status IN ('new', 'active', 'follow_up', 'opportunity', 'archived'));

CREATE TABLE IF NOT EXISTS connection_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT connection_notes_body_length CHECK (char_length(body) BETWEEN 1 AND 2000)
);

CREATE INDEX IF NOT EXISTS connection_notes_connection_created_at_idx
  ON connection_notes(connection_id, created_at DESC);

CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#2563EB',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tags_name_length CHECK (char_length(name) BETWEEN 1 AND 40),
  CONSTRAINT tags_color_format CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  UNIQUE (owner_user_id, name)
);

CREATE INDEX IF NOT EXISTS tags_owner_name_idx
  ON tags(owner_user_id, name);

CREATE TABLE IF NOT EXISTS connection_tags (
  connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (connection_id, tag_id)
);

CREATE INDEX IF NOT EXISTS connection_tags_owner_idx
  ON connection_tags(owner_user_id);

CREATE TABLE IF NOT EXISTS follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT follow_ups_title_length CHECK (char_length(title) BETWEEN 1 AND 160)
);

CREATE INDEX IF NOT EXISTS follow_ups_owner_due_at_idx
  ON follow_ups(owner_user_id, due_at ASC);

CREATE INDEX IF NOT EXISTS follow_ups_connection_due_at_idx
  ON follow_ups(connection_id, due_at ASC);

DROP TRIGGER IF EXISTS connection_notes_set_updated_at ON connection_notes;
CREATE TRIGGER connection_notes_set_updated_at
BEFORE UPDATE ON connection_notes
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS follow_ups_set_updated_at ON follow_ups;
CREATE TRIGGER follow_ups_set_updated_at
BEFORE UPDATE ON follow_ups
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
