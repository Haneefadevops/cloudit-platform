-- CloudIT Operations Portal — Phase 8 migration 0008: cloudflare_r2 source systems.
--
-- Phase 8 (Backup centre) moves backup storage from Google Drive to
-- Cloudflare R2 (see cloudit-operations-portal-transfer/docs/
-- cloudit-operations-portal-phase-8-backup-centre.md). The n8n backup
-- collector will therefore publish backup_evidence and restore_test_evidence
-- envelopes with sourceSystem 'cloudflare_r2', plus provider_connection
-- records for the R2 bucket. Two allowlists must know about it:
--
--   * operations_ingest.allowed_source_systems() (0004) — re-created here with
--     'cloudflare_r2' appended after 'google_drive' (CREATE OR REPLACE
--     FUNCTION keeps the signature, so dependent grants stay intact).
--   * the inline provider CHECK on operations.provider_connections (0002) —
--     widened to also allow 'cloudflare_r2'. The 0002 constraint is unnamed
--     inline, so its catalog name is resolved at run time and the constraint
--     is dropped and re-added with the wider allowlist.
--
-- Widening a CHECK is backward compatible: every existing row remains valid
-- and 'google_drive' stays in both allowlists (legacy rows keep ingesting).
-- The provider CHECK update is guarded on the current definition (no-op when
-- it already includes 'cloudflare_r2'), so the migration is idempotent and
-- safe to re-apply on an already-0008 database.

BEGIN;

CREATE OR REPLACE FUNCTION operations_ingest.allowed_source_systems()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $func$
  SELECT ARRAY['n8n', 'uptime_kuma', 'github_actions', 'vercel', 'supabase', 'imagekit', 'google_drive', 'cloudflare_r2', 'ga4', 'smtp'];
$func$;

-- Widen the provider allowlist on operations.provider_connections -----------
-- 0002 created the CHECK inline (unnamed), so PostgreSQL assigned a generated
-- catalog name. Resolve it, skip when the definition already allows
-- 'cloudflare_r2', otherwise drop and re-add with the widened list.

DO $$
DECLARE
  v_conname text;
  v_condef  text;
BEGIN
  SELECT con.conname, pg_get_constraintdef(con.oid)
    INTO v_conname, v_condef
  FROM pg_constraint con
  WHERE con.conrelid = 'operations.provider_connections'::regclass
    AND con.contype = 'c'
    AND con.conkey = (SELECT array_agg(a.attnum ORDER BY a.attnum)
                      FROM pg_attribute a
                      WHERE a.attrelid = 'operations.provider_connections'::regclass
                        AND a.attname = 'provider')
  ORDER BY con.conname
  LIMIT 1;

  IF v_conname IS NULL THEN
    RAISE EXCEPTION 'provider CHECK constraint on operations.provider_connections not found';
  END IF;

  IF v_condef LIKE '%cloudflare_r2%' THEN
    RAISE NOTICE 'provider CHECK % already allows cloudflare_r2; skipping', v_conname;
    RETURN;
  END IF;

  EXECUTE format(
    'ALTER TABLE operations.provider_connections DROP CONSTRAINT IF EXISTS %I',
    v_conname
  );
  ALTER TABLE operations.provider_connections
    ADD CONSTRAINT ck_provider_connections_provider
    CHECK (provider IN ('vercel', 'imagekit', 'supabase', 'github', 'google_drive', 'cloudflare_r2', 'smtp', 'ga4', 'uptime_kuma', 'n8n'));
END
$$;

COMMIT;
