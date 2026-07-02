-- OrbitOne Redesign v2 — add customer_id to bookings.
-- Scope: link bookings to customer records for CRM.

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS bookings_customer_id_idx ON bookings(customer_id);
