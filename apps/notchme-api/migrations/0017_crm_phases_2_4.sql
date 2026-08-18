-- CRM Tailoring Phases 2-4: activity types, templates, automation, webhooks, bulk/duplicates

-- ============================================================
-- Activity types
-- ============================================================

CREATE TABLE IF NOT EXISTS activity_type_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  owner_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  icon TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (organization_id IS NOT NULL OR owner_user_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_type_org_key
  ON activity_type_definitions (organization_id, key)
  WHERE organization_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_type_owner_key
  ON activity_type_definitions (owner_user_id, key)
  WHERE owner_user_id IS NOT NULL;

ALTER TABLE customer_activities
  ADD COLUMN IF NOT EXISTS activity_type_definition_id UUID REFERENCES activity_type_definitions(id) ON DELETE SET NULL;

-- ============================================================
-- Templates
-- ============================================================

CREATE TABLE IF NOT EXISTS crm_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  owner_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('activity', 'follow_up', 'email', 'note')),
  subject TEXT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (organization_id IS NOT NULL OR owner_user_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_template_org_name
  ON crm_templates (organization_id, name)
  WHERE organization_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_template_owner_name
  ON crm_templates (owner_user_id, name)
  WHERE owner_user_id IS NOT NULL;

-- ============================================================
-- Automation rules
-- ============================================================

CREATE TABLE IF NOT EXISTS crm_automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  owner_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_event TEXT NOT NULL CHECK (trigger_event IN (
    'customer_created', 'stage_changed', 'lifecycle_changed',
    'activity_created', 'follow_up_created', 'follow_up_completed'
  )),
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (organization_id IS NOT NULL OR owner_user_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_crm_automation_rules_active
  ON crm_automation_rules (organization_id, owner_user_id, trigger_event, is_active);

-- ============================================================
-- Webhooks
-- ============================================================

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  owner_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  secret TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (organization_id IS NOT NULL OR owner_user_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_active
  ON webhook_subscriptions (organization_id, owner_user_id, is_active);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
  response_status INTEGER,
  response_body TEXT,
  attempted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_subscription
  ON webhook_deliveries (subscription_id, created_at DESC);

-- ============================================================
-- Duplicate detection helpers
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_customers_email ON customers (email);
CREATE INDEX IF NOT EXISTS idx_customers_full_name ON customers USING gin (full_name gin_trgm_ops);
