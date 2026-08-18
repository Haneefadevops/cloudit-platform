-- Add plan column to users so freelancers can have individual plans
-- without needing an organization record.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free';

-- Ensure only valid plan values are stored.
ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_plan_check;

ALTER TABLE users
ADD CONSTRAINT users_plan_check
CHECK (plan = ANY (ARRAY[
  'free',
  'pro_individual',
  'pro_business_starter',
  'pro_business_growth',
  'pro_business_enterprise'
]));

-- Existing users start on the free plan.
UPDATE users SET plan = 'free' WHERE plan IS NULL;
