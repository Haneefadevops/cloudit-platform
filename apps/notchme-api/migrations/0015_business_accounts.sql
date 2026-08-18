-- Phase 4: B2B accounts and lightweight business networking.

CREATE TABLE IF NOT EXISTS business_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  industry TEXT,
  website TEXT,
  billing_address TEXT,
  tax_id TEXT,
  lifecycle_stage TEXT NOT NULL DEFAULT 'prospect'
    CHECK (lifecycle_stage IN ('prospect', 'qualified', 'customer', 'churned', 'archived')),
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT business_accounts_org_slug_unique UNIQUE (organization_id, slug),
  CONSTRAINT business_accounts_name_length CHECK (char_length(name) BETWEEN 1 AND 120),
  CONSTRAINT business_accounts_slug_length CHECK (char_length(slug) BETWEEN 1 AND 120)
);

CREATE INDEX IF NOT EXISTS business_accounts_organization_id_idx ON business_accounts(organization_id);
CREATE INDEX IF NOT EXISTS business_accounts_slug_idx ON business_accounts(slug);
CREATE INDEX IF NOT EXISTS business_accounts_lifecycle_stage_idx ON business_accounts(lifecycle_stage);

DROP TRIGGER IF EXISTS business_accounts_set_updated_at ON business_accounts;
CREATE TRIGGER business_accounts_set_updated_at
BEFORE UPDATE ON business_accounts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

ALTER TABLE customers
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES business_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS customers_account_id_idx ON customers(account_id);

CREATE TABLE IF NOT EXISTS business_account_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_account_id UUID NOT NULL REFERENCES business_accounts(id) ON DELETE CASCADE,
  to_account_id UUID NOT NULL REFERENCES business_accounts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT business_connections_unique_pair UNIQUE (from_account_id, to_account_id),
  CONSTRAINT business_connections_no_self CHECK (from_account_id != to_account_id)
);

CREATE INDEX IF NOT EXISTS business_connections_from_idx ON business_account_connections(from_account_id);
CREATE INDEX IF NOT EXISTS business_connections_to_idx ON business_account_connections(to_account_id);

DROP TRIGGER IF EXISTS business_account_connections_set_updated_at ON business_account_connections;
CREATE TRIGGER business_account_connections_set_updated_at
BEFORE UPDATE ON business_account_connections
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
