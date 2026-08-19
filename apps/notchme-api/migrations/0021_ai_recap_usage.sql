CREATE TABLE IF NOT EXISTS ai_recap_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  recap_id UUID REFERENCES meeting_recaps(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'openai' CHECK (provider IN ('openai')),
  transcription_model TEXT NOT NULL,
  extraction_model TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started','succeeded','failed')),
  audio_bytes INTEGER NOT NULL CHECK (audio_bytes > 0),
  transcription_input_tokens INTEGER,
  transcription_output_tokens INTEGER,
  extraction_input_tokens INTEGER,
  extraction_output_tokens INTEGER,
  error_code TEXT,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT ai_recap_usage_error_code_length CHECK (
    error_code IS NULL OR char_length(error_code) <= 80
  )
);

CREATE INDEX IF NOT EXISTS ai_recap_usage_org_created_idx
  ON ai_recap_usage(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_recap_usage_user_created_idx
  ON ai_recap_usage(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_recap_usage_booking_idx
  ON ai_recap_usage(booking_id, created_at DESC);
