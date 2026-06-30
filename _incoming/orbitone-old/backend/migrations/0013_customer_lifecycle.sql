-- Customer lifecycle foundation: assignment, value, outcome, source attribution, and stage history.

ALTER TABLE customers
RENAME COLUMN owned_by_user_id TO assigned_to_user_id;

ALTER INDEX IF EXISTS customers_owned_by_user_id_idx
RENAME TO customers_assigned_to_user_id_idx;

ALTER TABLE customers
ADD COLUMN IF NOT EXISTS value_amount NUMERIC(12, 2),
ADD COLUMN IF NOT EXISTS value_currency TEXT NOT NULL DEFAULT 'LKR',
ADD COLUMN IF NOT EXISTS expected_close_date DATE,
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS closed_reason TEXT,
ADD COLUMN IF NOT EXISTS outcome TEXT NOT NULL DEFAULT 'in_progress' CHECK (outcome IN ('in_progress', 'won', 'lost', 'nurture')),
ADD COLUMN IF NOT EXISTS source_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS source_booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS customers_assigned_to_user_id_idx ON customers(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS customers_outcome_idx ON customers(outcome);
CREATE INDEX IF NOT EXISTS customers_source_booking_id_idx ON customers(source_booking_id);

CREATE TABLE IF NOT EXISTS customer_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  note TEXT,
  changed_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_stage_history_customer_id_created_at_idx
ON customer_stage_history(customer_id, created_at DESC);
