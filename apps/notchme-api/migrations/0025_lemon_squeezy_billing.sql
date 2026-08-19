ALTER TABLE billing_subscriptions
  DROP CONSTRAINT IF EXISTS billing_subscriptions_provider_check;

ALTER TABLE billing_subscriptions
  ADD CONSTRAINT billing_subscriptions_provider_check
  CHECK (provider IN ('stripe', 'lemon_squeezy'));
