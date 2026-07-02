-- OrbitOne Redesign v2 — Organization, plan, and customer model.
-- Scope: introduce businesses (organizations), user roles, paid plans,
--         and a customer-centric CRM that replaces connection-based CRM.

-- ============================================================
-- 1. Organizations
-- ============================================================
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  logo_url TEXT,
  industry TEXT,
  plan TEXT NOT NULL DEFAULT 'free'
    CHECK (plan IN (
      'free',
      'pro_individual',
      'pro_business_starter',
      'pro_business_growth',
      'pro_business_enterprise'
    )),
  plan_status TEXT NOT NULL DEFAULT 'active'
    CHECK (plan_status IN ('active', 'trialing', 'past_due', 'cancelled')),
  trial_ends_at TIMESTAMPTZ,
  subscription_renewal_at TIMESTAMPTZ,
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT organizations_slug_format
    CHECK (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$'),
  CONSTRAINT organizations_name_length
    CHECK (char_length(name) BETWEEN 1 AND 120)
);

DROP TRIGGER IF EXISTS organizations_set_updated_at ON organizations;
CREATE TRIGGER organizations_set_updated_at
BEFORE UPDATE ON organizations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS organizations_slug_idx ON organizations(slug);

-- ============================================================
-- 2. Users: roles and organization membership
-- ============================================================
ALTER TABLE users
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'freelancer'
  CHECK (role IN ('freelancer', 'admin', 'staff')),
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_billing_contact BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS users_organization_id_idx ON users(organization_id);

-- ============================================================
-- 3. Profiles: distinguish personal vs staff profiles
-- ============================================================
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'personal'
  CHECK (type IN ('personal', 'staff')),
ADD COLUMN IF NOT EXISTS department TEXT,
ADD COLUMN IF NOT EXISTS job_title TEXT;

CREATE INDEX IF NOT EXISTS profiles_type_idx ON profiles(type);

-- ============================================================
-- 4. Customers (CRM records)
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  owned_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email CITEXT,
  phone TEXT,
  company TEXT,
  notes TEXT,
  lifecycle_stage TEXT NOT NULL DEFAULT 'new'
    CHECK (lifecycle_stage IN (
      'new', 'contacted', 'qualified', 'meeting', 'proposal', 'customer', 'lost', 'archived'
    )),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high')),
  next_step TEXT,
  last_contacted_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('scan', 'booking', 'manual', 'import')),
  source_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  legacy_connection_id UUID REFERENCES connections(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customers_full_name_length CHECK (char_length(full_name) BETWEEN 1 AND 120)
);

DROP TRIGGER IF EXISTS customers_set_updated_at ON customers;
CREATE TRIGGER customers_set_updated_at
BEFORE UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS customers_organization_id_idx ON customers(organization_id);
CREATE INDEX IF NOT EXISTS customers_owned_by_user_id_idx ON customers(owned_by_user_id);
CREATE INDEX IF NOT EXISTS customers_source_profile_id_idx ON customers(source_profile_id);
CREATE INDEX IF NOT EXISTS customers_lifecycle_stage_idx ON customers(lifecycle_stage);
CREATE INDEX IF NOT EXISTS customers_priority_idx ON customers(priority);
CREATE INDEX IF NOT EXISTS customers_organization_lifecycle_idx ON customers(organization_id, lifecycle_stage);

-- ============================================================
-- 5. Customer tags (extend existing tags table to org scope)
-- ============================================================
ALTER TABLE tags
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Existing tags remain user-scoped (organization_id IS NULL).
-- For org-scoped tags, enforce uniqueness within the organization.
CREATE UNIQUE INDEX IF NOT EXISTS tags_organization_name_unique_idx
  ON tags(organization_id, name)
  WHERE organization_id IS NOT NULL;

-- ============================================================
-- 6. Customer activities (notes/calls/emails/meetings)
-- ============================================================
CREATE TABLE IF NOT EXISTS customer_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL
    CHECK (type IN ('note', 'call', 'email', 'meeting', 'sms', 'whatsapp', 'other')),
  title TEXT NOT NULL,
  body TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customer_activities_title_length CHECK (char_length(title) BETWEEN 1 AND 160),
  CONSTRAINT customer_activities_body_length CHECK (body IS NULL OR char_length(body) <= 2000)
);

DROP TRIGGER IF EXISTS customer_activities_set_updated_at ON customer_activities;
CREATE TRIGGER customer_activities_set_updated_at
BEFORE UPDATE ON customer_activities
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS customer_activities_customer_occurred_at_idx
  ON customer_activities(customer_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS customer_activities_created_by_occurred_at_idx
  ON customer_activities(created_by_user_id, occurred_at DESC);

-- ============================================================
-- 7. Customer follow-ups
-- ============================================================
CREATE TABLE IF NOT EXISTS customer_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customer_follow_ups_title_length CHECK (char_length(title) BETWEEN 1 AND 160)
);

DROP TRIGGER IF EXISTS customer_follow_ups_set_updated_at ON customer_follow_ups;
CREATE TRIGGER customer_follow_ups_set_updated_at
BEFORE UPDATE ON customer_follow_ups
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS customer_follow_ups_created_by_due_at_idx
  ON customer_follow_ups(created_by_user_id, due_at ASC);
CREATE INDEX IF NOT EXISTS customer_follow_ups_customer_due_at_idx
  ON customer_follow_ups(customer_id, due_at ASC);

-- ============================================================
-- 8. Customer ratings (post-meeting feedback)
-- ============================================================
CREATE TABLE IF NOT EXISTS customer_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customer_ratings_review_length CHECK (review IS NULL OR char_length(review) <= 1000)
);

CREATE INDEX IF NOT EXISTS customer_ratings_profile_id_idx ON customer_ratings(profile_id);
CREATE INDEX IF NOT EXISTS customer_ratings_customer_id_idx ON customer_ratings(customer_id);
CREATE INDEX IF NOT EXISTS customer_ratings_booking_id_idx ON customer_ratings(booking_id);

-- ============================================================
-- 9. Usage tracking (weekly booking limits)
-- ============================================================
CREATE TABLE IF NOT EXISTS usage_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  week INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, year, week),
  CONSTRAINT usage_bookings_week_check CHECK (week BETWEEN 1 AND 53)
);

DROP TRIGGER IF EXISTS usage_bookings_set_updated_at ON usage_bookings;
CREATE TRIGGER usage_bookings_set_updated_at
BEFORE UPDATE ON usage_bookings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS usage_bookings_profile_year_week_idx
  ON usage_bookings(profile_id, year, week);

-- ============================================================
-- 10. Organization invites (admin adds staff by email)
-- ============================================================
CREATE TABLE IF NOT EXISTS organization_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email CITEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff'
    CHECK (role IN ('staff', 'admin')),
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email)
);

CREATE INDEX IF NOT EXISTS organization_invites_token_idx ON organization_invites(token);
CREATE INDEX IF NOT EXISTS organization_invites_organization_email_idx
  ON organization_invites(organization_id, email);

-- ============================================================
-- 11. Data migration: existing users → freelancers on free plan
-- ============================================================
UPDATE users
SET role = 'freelancer'
WHERE role IS NULL;

-- ============================================================
-- 12. Data migration: existing connections → customers
-- ============================================================
INSERT INTO customers (
  owned_by_user_id,
  full_name,
  email,
  phone,
  company,
  source,
  source_profile_id,
  lifecycle_stage,
  priority,
  legacy_connection_id,
  created_at,
  updated_at
)
SELECT
  c.owner_user_id,
  c.full_name,
  c.email,
  c.phone,
  c.company,
  'scan'::TEXT,
  c.connected_profile_id,
  COALESCE(c.lifecycle_stage, 'new'),
  COALESCE(c.priority, 'medium'),
  c.id,
  c.created_at,
  now()
FROM connections c
WHERE c.id NOT IN (
  SELECT legacy_connection_id FROM customers WHERE legacy_connection_id IS NOT NULL
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 13. Data migration: existing connection notes → customer activities
-- ============================================================
INSERT INTO customer_activities (
  customer_id,
  created_by_user_id,
  type,
  title,
  body,
  occurred_at,
  created_at
)
SELECT
  cust.id,
  cn.owner_user_id,
  'note',
  'Imported note',
  cn.body,
  cn.created_at,
  cn.created_at
FROM connection_notes cn
JOIN customers cust ON cust.legacy_connection_id = cn.connection_id
WHERE NOT EXISTS (
  SELECT 1 FROM customer_activities ca
  WHERE ca.customer_id = cust.id AND ca.body = cn.body AND ca.created_at = cn.created_at
);

-- ============================================================
-- 14. Data migration: existing connection activities → customer activities
-- ============================================================
INSERT INTO customer_activities (
  customer_id,
  created_by_user_id,
  type,
  title,
  body,
  occurred_at,
  created_at
)
SELECT
  cust.id,
  ca.owner_user_id,
  ca.activity_type,
  ca.title,
  ca.body,
  ca.occurred_at,
  ca.created_at
FROM connection_activities ca
JOIN customers cust ON cust.legacy_connection_id = ca.connection_id
WHERE NOT EXISTS (
  SELECT 1 FROM customer_activities ca2
  WHERE ca2.customer_id = cust.id AND ca2.title = ca.title AND ca2.occurred_at = ca.occurred_at
);

-- ============================================================
-- 15. Data migration: existing follow-ups → customer follow-ups
-- ============================================================
INSERT INTO customer_follow_ups (
  customer_id,
  created_by_user_id,
  title,
  due_at,
  completed_at,
  created_at
)
SELECT
  cust.id,
  fu.owner_user_id,
  fu.title,
  fu.due_at,
  fu.completed_at,
  fu.created_at
FROM follow_ups fu
JOIN customers cust ON cust.legacy_connection_id = fu.connection_id
WHERE NOT EXISTS (
  SELECT 1 FROM customer_follow_ups fu2
  WHERE fu2.customer_id = cust.id AND fu2.title = fu.title AND fu2.due_at = fu.due_at
);

-- ============================================================
-- 16. Update analytics event enum to include rating and plan events
-- ============================================================
ALTER TYPE analytics_event_type ADD VALUE IF NOT EXISTS 'booking_created';
ALTER TYPE analytics_event_type ADD VALUE IF NOT EXISTS 'rating_submitted';
ALTER TYPE analytics_event_type ADD VALUE IF NOT EXISTS 'plan_upgraded';
