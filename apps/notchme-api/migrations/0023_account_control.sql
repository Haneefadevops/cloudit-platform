ALTER TABLE billing_subscriptions
  DROP CONSTRAINT IF EXISTS billing_subscriptions_organization_id_fkey,
  DROP CONSTRAINT IF EXISTS billing_subscriptions_owner_user_id_fkey;

ALTER TABLE billing_subscriptions
  ALTER COLUMN organization_id DROP NOT NULL,
  ALTER COLUMN owner_user_id DROP NOT NULL;

ALTER TABLE billing_subscriptions
  ADD CONSTRAINT billing_subscriptions_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL,
  ADD CONSTRAINT billing_subscriptions_owner_user_id_fkey
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL;
