ALTER TABLE organizations ADD COLUMN IF NOT EXISTS platform_org_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS organizations_platform_org_id_idx
  ON organizations(platform_org_id)
  WHERE platform_org_id IS NOT NULL;

ALTER TABLE organization_invites ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'product';
