CREATE TABLE IF NOT EXISTS billing_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE RESTRICT,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL DEFAULT 'stripe' CHECK (provider = 'stripe'),
  provider_customer_id TEXT NOT NULL UNIQUE,
  provider_subscription_id TEXT UNIQUE,
  provider_price_id TEXT,
  product_key TEXT NOT NULL CHECK (product_key IN ('founding_pro','teams')),
  billing_interval TEXT NOT NULL CHECK (billing_interval IN ('monthly','annual')),
  status TEXT NOT NULL CHECK (status IN (
    'incomplete','incomplete_expired','trialing','active','past_due',
    'canceled','unpaid','paused'
  )),
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  last_event_created BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_subscriptions_org_unique_idx
  ON billing_subscriptions(organization_id)
  WHERE organization_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS billing_subscriptions_individual_unique_idx
  ON billing_subscriptions(owner_user_id)
  WHERE organization_id IS NULL;
CREATE INDEX IF NOT EXISTS billing_subscriptions_status_idx
  ON billing_subscriptions(status, current_period_end);

CREATE TABLE IF NOT EXISTS billing_webhook_events (
  provider_event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  event_created BIGINT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT billing_webhook_event_type_length CHECK (char_length(event_type) <= 120)
);
