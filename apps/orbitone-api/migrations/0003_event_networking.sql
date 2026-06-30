-- OrbitOne Phase 4 event networking.
-- Scope: lightweight networking events, profile check-ins, and event attendee discovery.

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  location TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT events_slug_format CHECK (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$'),
  CONSTRAINT events_name_length CHECK (char_length(name) BETWEEN 1 AND 160),
  CONSTRAINT events_time_order CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS event_check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS events_owner_user_id_starts_at_idx
  ON events(owner_user_id, starts_at DESC);

CREATE INDEX IF NOT EXISTS events_slug_idx
  ON events(slug);

CREATE INDEX IF NOT EXISTS event_check_ins_event_id_checked_in_at_idx
  ON event_check_ins(event_id, checked_in_at DESC);

CREATE INDEX IF NOT EXISTS event_check_ins_user_id_checked_in_at_idx
  ON event_check_ins(user_id, checked_in_at DESC);

DROP TRIGGER IF EXISTS events_set_updated_at ON events;
CREATE TRIGGER events_set_updated_at
BEFORE UPDATE ON events
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
