CREATE TABLE IF NOT EXISTS meeting_recaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','finalized')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','ai_assisted')),
  summary TEXT NOT NULL DEFAULT '',
  key_points JSONB NOT NULL DEFAULT '[]'::jsonb,
  commitments JSONB NOT NULL DEFAULT '[]'::jsonb,
  private_note TEXT,
  proposed_follow_up_title TEXT,
  proposed_follow_up_due_at TIMESTAMPTZ,
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, booking_id),
  CONSTRAINT meeting_recaps_summary_length CHECK (char_length(summary) <= 2000),
  CONSTRAINT meeting_recaps_key_points_array CHECK (jsonb_typeof(key_points) = 'array'),
  CONSTRAINT meeting_recaps_commitments_array CHECK (jsonb_typeof(commitments) = 'array'),
  CONSTRAINT meeting_recaps_private_note_length CHECK (private_note IS NULL OR char_length(private_note) <= 2000),
  CONSTRAINT meeting_recaps_follow_up_title_length CHECK (proposed_follow_up_title IS NULL OR char_length(proposed_follow_up_title) <= 160),
  CONSTRAINT meeting_recaps_finalized_state CHECK (
    (status = 'draft' AND finalized_at IS NULL) OR
    (status = 'finalized' AND finalized_at IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS meeting_recaps_org_customer_idx ON meeting_recaps(organization_id, customer_id);
CREATE INDEX IF NOT EXISTS meeting_recaps_author_idx ON meeting_recaps(author_user_id);
