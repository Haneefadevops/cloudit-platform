-- OrbitOne Scheduling S3 public booking hardening.

ALTER TABLE calendar_accounts
ADD COLUMN IF NOT EXISTS scopes TEXT;

ALTER TABLE meeting_types
ADD COLUMN IF NOT EXISTS max_bookings_per_day INTEGER;

ALTER TABLE meeting_types
DROP CONSTRAINT IF EXISTS meeting_types_max_bookings_per_day_check;

ALTER TABLE meeting_types
ADD CONSTRAINT meeting_types_max_bookings_per_day_check
CHECK (max_bookings_per_day IS NULL OR max_bookings_per_day BETWEEN 1 AND 100);

CREATE INDEX IF NOT EXISTS bookings_owner_time_active_idx
  ON bookings(owner_user_id, start_at, end_at)
  WHERE status IN ('pending', 'confirmed');
