-- CloudIT Operations Portal — Phase 3 migration 0001: dedicated roles.
--
-- Cluster-level roles for the private `operations` database. These roles are
-- created once per PostgreSQL cluster and are re-used by every database, so
-- this file is idempotent and never drops or weakens an existing role.
--
-- Role model (CloudIT Operations Portal Phase 0 specification, section 8.2):
--   operations_anon        anonymous: NOLOGIN, zero grants. Represents the
--                          unauthenticated browser; it can never reach data.
--   operations_owner       cloud_owner application login used by the portal
--                          server. Row scope is enforced by RLS policies that
--                          read per-transaction settings
--                          (operations.global_role / operations.user_id); the
--                          connection alone grants no cross-tenant trust.
--   operations_ingest      dedicated least-privilege login for the private
--                          ingestion endpoint (n8n publishing, Phase 4). It
--                          has no table privileges at all; it may only EXECUTE
--                          narrowly scoped functions in the private
--                          operations_ingest schema.
--   operations_maintenance placeholder for a future, separately approved
--                          retention role. NOLOGIN and no grants; it is the
--                          only role the append-only triggers will accept.
--
-- Passwords are applied by infra/scripts/ensure-operations-database.sh from
-- protected environment values and are never stored in this repository.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'operations_anon') THEN
    CREATE ROLE operations_anon NOLOGIN;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'operations_owner') THEN
    CREATE ROLE operations_owner LOGIN;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'operations_ingest') THEN
    CREATE ROLE operations_ingest LOGIN;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'operations_maintenance') THEN
    CREATE ROLE operations_maintenance NOLOGIN;
  END IF;
END
$$;

COMMENT ON ROLE operations_anon IS 'Anonymous portal identity: no grants, no login.';
COMMENT ON ROLE operations_owner IS 'Portal application login (cloud_owner); row scope enforced by RLS and per-transaction GUCs.';
COMMENT ON ROLE operations_ingest IS 'Private ingestion endpoint login; EXECUTE-only on operations_ingest schema functions.';
COMMENT ON ROLE operations_maintenance IS 'Future separately-approved retention role; only role accepted by append-only guards.';

COMMIT;
