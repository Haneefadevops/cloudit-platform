-- OrbitOne Scheduling S1 foundation.
-- Scope: internal scheduling data model before external calendar provider integration.

CREATE TABLE IF NOT EXISTS calendar_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_account_id TEXT,
  email CITEXT,
  calendar_id TEXT,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  is_connected BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT calendar_accounts_provider_check CHECK (provider IN ('google', 'microsoft')),
  UNIQUE (owner_user_id, provider)
);

CREATE TABLE IF NOT EXISTS meeting_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL,
  location_type TEXT NOT NULL DEFAULT 'video',
  location_value TEXT,
  buffer_before_minutes INTEGER NOT NULL DEFAULT 0,
  buffer_after_minutes INTEGER NOT NULL DEFAULT 0,
  min_notice_minutes INTEGER NOT NULL DEFAULT 60,
  booking_window_days INTEGER NOT NULL DEFAULT 30,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT meeting_types_slug_format CHECK (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$'),
  CONSTRAINT meeting_types_title_length CHECK (char_length(title) BETWEEN 1 AND 120),
  CONSTRAINT meeting_types_duration_check CHECK (duration_minutes BETWEEN 5 AND 480),
  CONSTRAINT meeting_types_location_type_check CHECK (location_type IN ('video', 'phone', 'in_person', 'custom')),
  CONSTRAINT meeting_types_buffer_before_check CHECK (buffer_before_minutes BETWEEN 0 AND 240),
  CONSTRAINT meeting_types_buffer_after_check CHECK (buffer_after_minutes BETWEEN 0 AND 240),
  CONSTRAINT meeting_types_min_notice_check CHECK (min_notice_minutes BETWEEN 0 AND 43200),
  CONSTRAINT meeting_types_booking_window_check CHECK (booking_window_days BETWEEN 1 AND 365),
  UNIQUE (owner_user_id, slug)
);

CREATE TABLE IF NOT EXISTS availability_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT availability_rules_day_check CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT availability_rules_time_order CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS availability_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exception_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  is_available BOOLEAN NOT NULL DEFAULT FALSE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT availability_exceptions_time_order CHECK (
    start_time IS NULL
    OR end_time IS NULL
    OR end_time > start_time
  ),
  UNIQUE (owner_user_id, exception_date, start_time, end_time)
);

CREATE TABLE IF NOT EXISTS booking_guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email CITEXT NOT NULL,
  company TEXT,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT booking_guests_name_length CHECK (char_length(name) BETWEEN 1 AND 120)
);

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meeting_type_id UUID NOT NULL REFERENCES meeting_types(id) ON DELETE RESTRICT,
  guest_id UUID NOT NULL REFERENCES booking_guests(id) ON DELETE RESTRICT,
  connection_id UUID REFERENCES connections(id) ON DELETE SET NULL,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'profile',
  status TEXT NOT NULL DEFAULT 'confirmed',
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  cancellation_reason TEXT,
  rescheduled_from_booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  external_provider TEXT,
  external_event_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bookings_source_check CHECK (source IN ('profile', 'connection', 'event', 'direct')),
  CONSTRAINT bookings_status_check CHECK (status IN ('pending', 'confirmed', 'cancelled', 'rescheduled')),
  CONSTRAINT bookings_time_order CHECK (end_at > start_at)
);

CREATE TABLE IF NOT EXISTS booking_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_type_id UUID NOT NULL REFERENCES meeting_types(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT booking_questions_question_length CHECK (char_length(question) BETWEEN 1 AND 200)
);

CREATE TABLE IF NOT EXISTS booking_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT booking_audit_events_type_check CHECK (
    event_type IN ('created', 'cancelled', 'rescheduled', 'external_event_created', 'external_event_cancelled')
  )
);

CREATE INDEX IF NOT EXISTS calendar_accounts_owner_provider_idx
  ON calendar_accounts(owner_user_id, provider);

CREATE INDEX IF NOT EXISTS meeting_types_owner_active_idx
  ON meeting_types(owner_user_id, is_active);

CREATE INDEX IF NOT EXISTS availability_rules_owner_day_idx
  ON availability_rules(owner_user_id, day_of_week);

CREATE INDEX IF NOT EXISTS availability_exceptions_owner_date_idx
  ON availability_exceptions(owner_user_id, exception_date);

CREATE INDEX IF NOT EXISTS bookings_owner_start_idx
  ON bookings(owner_user_id, start_at DESC);

CREATE INDEX IF NOT EXISTS bookings_meeting_type_start_idx
  ON bookings(meeting_type_id, start_at DESC);

DROP TRIGGER IF EXISTS calendar_accounts_set_updated_at ON calendar_accounts;
CREATE TRIGGER calendar_accounts_set_updated_at
BEFORE UPDATE ON calendar_accounts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS meeting_types_set_updated_at ON meeting_types;
CREATE TRIGGER meeting_types_set_updated_at
BEFORE UPDATE ON meeting_types
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS availability_rules_set_updated_at ON availability_rules;
CREATE TRIGGER availability_rules_set_updated_at
BEFORE UPDATE ON availability_rules
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS availability_exceptions_set_updated_at ON availability_exceptions;
CREATE TRIGGER availability_exceptions_set_updated_at
BEFORE UPDATE ON availability_exceptions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS bookings_set_updated_at ON bookings;
CREATE TRIGGER bookings_set_updated_at
BEFORE UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
