-- Phase 3: Documents and feedback requests.

-- ============================================================
-- Documents (quotation / invoice / agreement / other)
-- ============================================================
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('quotation', 'invoice', 'agreement', 'other')),
  title TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  file_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT documents_title_length CHECK (char_length(title) BETWEEN 1 AND 200)
);

CREATE INDEX IF NOT EXISTS documents_organization_id_idx ON documents(organization_id);
CREATE INDEX IF NOT EXISTS documents_customer_id_idx ON documents(customer_id);
CREATE INDEX IF NOT EXISTS documents_created_by_user_id_idx ON documents(created_by_user_id);

DROP TRIGGER IF EXISTS documents_set_updated_at ON documents;
CREATE TRIGGER documents_set_updated_at
BEFORE UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Feedback requests (post-deal rating links)
-- ============================================================
CREATE TABLE IF NOT EXISTS feedback_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  token TEXT NOT NULL UNIQUE,
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms', 'whatsapp')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'opened', 'completed')),
  rating_id UUID REFERENCES customer_ratings(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_requests_customer_id_idx ON feedback_requests(customer_id);
CREATE INDEX IF NOT EXISTS feedback_requests_token_idx ON feedback_requests(token);
CREATE INDEX IF NOT EXISTS feedback_requests_rating_id_idx ON feedback_requests(rating_id);

DROP TRIGGER IF EXISTS feedback_requests_set_updated_at ON feedback_requests;
CREATE TRIGGER feedback_requests_set_updated_at
BEFORE UPDATE ON feedback_requests
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
