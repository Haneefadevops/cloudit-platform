-- CloudIT Operations Portal — Phase 8 migration 0009: cloudflare_r2 provider
-- in the provider_connection writer.
--
-- 0008 widened the operations.provider_connections table CHECK and the
-- envelope sourceSystem allowlist, but the ingest writer
-- operations_ingest.insert_provider_connection (created by 0005) validates
-- payload.provider against its OWN hardcoded enum — which still rejects
-- 'cloudflare_r2' with invalid_provider (discovered live on the first
-- backup-collector run, 15 Sep 2026; the 0008 verification exercised the
-- table CHECK via a direct INSERT but not the writer path). This migration
-- re-creates the writer with 'cloudflare_r2' added to the provider enum,
-- body otherwise byte-identical to 0005. CREATE OR REPLACE makes
-- re-application a no-op, so the migration is idempotent.
--
-- Every statement is idempotent so the migration can be re-applied by every
-- deployment.

BEGIN;

CREATE OR REPLACE FUNCTION operations_ingest.insert_provider_connection(p_pub operations.publishers, p_env operations_ingest.envelope)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_payload jsonb := p_env.payload;
  v_provider text;
  v_connection_key text;
  v_id uuid;
BEGIN
  PERFORM operations_ingest.check_payload_keys(v_payload, ARRAY[
    'provider', 'connectionKey', 'reachable', 'authorizationState',
    'lastSuccessfulAt', 'failureCategory'
  ]);
  v_provider := operations_ingest.req_enum(v_payload, 'provider', ARRAY[
    'vercel', 'imagekit', 'supabase', 'github', 'google_drive', 'cloudflare_r2', 'smtp', 'ga4', 'uptime_kuma', 'n8n'
  ], 'invalid_provider');
  v_connection_key := operations_ingest.req_text(v_payload, 'connectionKey', 80);

  PERFORM 1 FROM operations.provider_connections
  WHERE publisher_id = p_pub.id AND source_record_type = 'provider_connection'
    AND idempotency_key = p_env.idempotency_key;
  IF FOUND THEN RETURN 'duplicate'; END IF;

  INSERT INTO operations.provider_connections (
    client_id, environment_id, provider, connection_key, reachable,
    authorization_state, last_successful_at, failure_category, source_system,
    status, severity, correlation_key, observed_at, publisher_id, idempotency_key
  ) VALUES (
    p_pub.client_id, p_pub.environment_id, v_provider, v_connection_key,
    operations_ingest.req_bool(v_payload, 'reachable'),
    operations_ingest.req_enum(v_payload, 'authorizationState', ARRAY['ok', 'denied', 'unknown'], 'invalid_authorization_state'),
    operations_ingest.opt_ts(v_payload, 'lastSuccessfulAt'),
    operations_ingest.opt_enum(v_payload, 'failureCategory', operations_ingest.allowed_failure_categories(), 'invalid_failure_category'),
    p_env.source_system, p_env.status, p_env.severity, p_env.correlation_key,
    p_env.observed_at, p_pub.id, p_env.idempotency_key
  )
  ON CONFLICT (client_id, provider, connection_key) DO UPDATE SET
    environment_id = EXCLUDED.environment_id,
    reachable = EXCLUDED.reachable,
    authorization_state = EXCLUDED.authorization_state,
    last_successful_at = EXCLUDED.last_successful_at,
    failure_category = EXCLUDED.failure_category,
    source_system = EXCLUDED.source_system,
    status = EXCLUDED.status,
    severity = EXCLUDED.severity,
    correlation_key = EXCLUDED.correlation_key,
    observed_at = EXCLUDED.observed_at,
    publisher_id = EXCLUDED.publisher_id,
    idempotency_key = EXCLUDED.idempotency_key,
    updated_at = now()
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN RETURN 'duplicate'; END IF;
  RETURN 'inserted';
END;
$func$;

COMMIT;
