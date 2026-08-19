ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- Preserve access for accounts created before verification existed.
UPDATE users
SET email_verified_at = COALESCE(email_verified_at, created_at)
WHERE email_verified_at IS NULL;

CREATE TABLE IF NOT EXISTS auth_action_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('email_verification','password_reset')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT auth_action_tokens_hash_length CHECK (char_length(token_hash) = 64)
);

CREATE INDEX IF NOT EXISTS auth_action_tokens_user_type_idx
  ON auth_action_tokens(user_id, type, created_at DESC);
CREATE INDEX IF NOT EXISTS auth_action_tokens_expiry_idx
  ON auth_action_tokens(expires_at)
  WHERE consumed_at IS NULL;
