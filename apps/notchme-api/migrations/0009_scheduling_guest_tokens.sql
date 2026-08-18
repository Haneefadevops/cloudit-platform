-- OrbitOne Scheduling S5 host approval and guest self-service tokens.

ALTER TABLE meeting_types
ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS booking_guest_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  guest_email CITEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('reschedule', 'cancel')),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (booking_id, type)
);

CREATE INDEX IF NOT EXISTS booking_guest_tokens_token_hash_idx
  ON booking_guest_tokens(token_hash);

ALTER TABLE booking_audit_events
DROP CONSTRAINT IF EXISTS booking_audit_events_type_check;

ALTER TABLE booking_audit_events
ADD CONSTRAINT booking_audit_events_type_check
CHECK (event_type IN (
  'created',
  'cancelled',
  'rescheduled',
  'external_event_created',
  'external_event_cancelled',
  'approved',
  'rejected',
  'guest_rescheduled',
  'guest_cancelled'
));
