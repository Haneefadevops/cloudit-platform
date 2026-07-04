ALTER TABLE organizations ADD COLUMN IF NOT EXISTS platform_org_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS organizations_platform_org_id_idx
  ON organizations(platform_org_id)
  WHERE platform_org_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_invite_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_invite_tokens_token_idx ON user_invite_tokens(token);
CREATE INDEX IF NOT EXISTS user_invite_tokens_user_id_idx ON user_invite_tokens(user_id);
