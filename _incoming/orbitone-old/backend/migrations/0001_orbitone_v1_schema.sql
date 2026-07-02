-- OrbitOne V1 PostgreSQL schema.
-- Scope: auth users, digital card profiles, connections, vCard support data, and basic analytics.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

CREATE TYPE analytics_event_type AS ENUM (
  'profile_view',
  'qr_scan',
  'vcard_download',
  'connection_added'
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_full_name_length CHECK (char_length(full_name) BETWEEN 1 AND 120)
);

CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  headline TEXT,
  company TEXT,
  location TEXT,
  bio TEXT,
  avatar_url TEXT,
  email CITEXT,
  phone TEXT,
  website_url TEXT,
  linkedin_url TEXT,
  x_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT profiles_slug_format CHECK (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$'),
  CONSTRAINT profiles_full_name_length CHECK (char_length(full_name) BETWEEN 1 AND 120)
);

CREATE TABLE connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  connected_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'public_profile',
  full_name TEXT NOT NULL,
  headline TEXT,
  company TEXT,
  email CITEXT,
  phone TEXT,
  website_url TEXT,
  linkedin_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT connections_source_check CHECK (source IN ('public_profile', 'qr_code')),
  CONSTRAINT connections_full_name_length CHECK (char_length(full_name) BETWEEN 1 AND 120)
);

CREATE UNIQUE INDEX connections_owner_connected_profile_key
  ON connections(owner_user_id, connected_profile_id)
  WHERE connected_profile_id IS NOT NULL;

CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type analytics_event_type NOT NULL,
  visitor_id TEXT,
  referrer TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX profiles_user_id_idx ON profiles(user_id);
CREATE INDEX profiles_slug_idx ON profiles(slug);
CREATE INDEX connections_owner_user_id_created_at_idx ON connections(owner_user_id, created_at DESC);
CREATE INDEX analytics_events_profile_id_created_at_idx ON analytics_events(profile_id, created_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE VIEW profile_metrics AS
SELECT
  p.id AS profile_id,
  count(ae.id) FILTER (WHERE ae.event_type = 'profile_view') AS profile_views,
  count(ae.id) FILTER (WHERE ae.event_type = 'qr_scan') AS qr_scans,
  count(ae.id) FILTER (WHERE ae.event_type = 'vcard_download') AS vcard_downloads,
  count(ae.id) FILTER (WHERE ae.event_type = 'connection_added') AS connections_added
FROM profiles p
LEFT JOIN analytics_events ae ON ae.profile_id = p.id
GROUP BY p.id;
