-- CloudIT Operations Portal — Phase 3 gate: isolation and security suite.
--
-- Proves the Phase 3 gate from the approved plan:
--   anonymous denial, owner access, client isolation, ingestion
--   authentication, idempotent replay, composite tenant foreign keys,
--   append-only audit behavior and secret hygiene.
--
-- The whole suite runs inside ONE transaction and is rolled back at the end,
-- so no test data is ever left behind. Run through isolation-tests.sh, which
-- fails (non-zero exit) if any assertion fails. The publisher secrets in this
-- file are throwaway test-only values used solely inside the rolled-back
-- transaction; they are never valid anywhere else.
--
-- Requires: migrations applied (ensure-operations-database.sh) against a
-- dedicated test database/container. Do not run against any database that
-- serves other applications.

BEGIN;

CREATE TEMP TABLE test_results (
  id serial PRIMARY KEY,
  name text UNIQUE,
  passed boolean,
  detail text
) ON COMMIT DROP;
GRANT ALL ON test_results TO PUBLIC;
GRANT USAGE, SELECT ON test_results_id_seq TO PUBLIC;

CREATE OR REPLACE FUNCTION pg_temp.t_assert(p_name text, p_ok boolean, p_detail text DEFAULT '')
RETURNS void
LANGUAGE sql
AS $$
  INSERT INTO test_results (name, passed, detail)
  VALUES ($1, $2, left($3, 400))
  ON CONFLICT (name) DO UPDATE SET passed = EXCLUDED.passed, detail = EXCLUDED.detail;
$$;

-- Builds a contract-valid envelope (section 7.2) with fresh timestamps.
CREATE OR REPLACE FUNCTION pg_temp.t_env(p_type text, p_idem text, p_payload jsonb, p_env_key text DEFAULT 'production')
RETURNS jsonb
LANGUAGE sql
AS $$
  SELECT jsonb_build_object(
    'contractVersion', '1.0',
    'recordType', p_type,
    'idempotencyKey', p_idem,
    'environmentKey', p_env_key,
    'sourceSystem', 'n8n',
    'observedAt', now(),
    'publishedAt', now(),
    'freshUntil', now() + interval '1 hour',
    'status', 'GREEN',
    'severity', 'none',
    'correlationKey', NULL,
    'payload', p_payload
  );
$$;

-- Valid 64-hex digest placeholder (digest content is not validated).
SELECT repeat('ab', 32) AS dummy_digest \gset

-- ---------------------------------------------------------------------------
-- Fixtures (superuser; bypasses RLS; rolled back at the end)
-- ---------------------------------------------------------------------------

INSERT INTO operations.clients (client_key, display_name) VALUES
  ('test-client-a', 'Test Client A'),
  ('test-client-b', 'Test Client B');

INSERT INTO operations.environments (client_id, environment_key, display_name)
SELECT id, 'production', 'Production' FROM operations.clients WHERE client_key = 'test-client-a';
INSERT INTO operations.environments (client_id, environment_key, display_name)
SELECT id, 'production', 'Production' FROM operations.clients WHERE client_key = 'test-client-b';

INSERT INTO operations.endpoints (client_id, environment_id, endpoint_key, display_name, monitor_kind, registered_path)
SELECT c.id, e.id, 'site-a', 'Site A', 'http', '/'
FROM operations.clients c JOIN operations.environments e ON e.client_id = c.id
WHERE c.client_key = 'test-client-a';
INSERT INTO operations.endpoints (client_id, environment_id, endpoint_key, display_name, monitor_kind, registered_path)
SELECT c.id, e.id, 'site-b', 'Site B', 'http', '/'
FROM operations.clients c JOIN operations.environments e ON e.client_id = c.id
WHERE c.client_key = 'test-client-b';

INSERT INTO operations.workflow_definitions (client_id, environment_id, workflow_key, display_name, trigger_kind, criticality)
SELECT c.id, e.id, 'wf.backup', 'Daily Backup', 'cron', 'critical'
FROM operations.clients c JOIN operations.environments e ON e.client_id = c.id
WHERE c.client_key = 'test-client-a';
INSERT INTO operations.workflow_definitions (client_id, environment_id, workflow_key, display_name, trigger_kind, criticality)
SELECT c.id, e.id, 'wf.health', 'Weekly Health', 'cron', 'standard'
FROM operations.clients c JOIN operations.environments e ON e.client_id = c.id
WHERE c.client_key = 'test-client-b';

INSERT INTO operations.metric_definitions (client_id, metric_key, display_name, value_type, unit, allowed_dimensions, frequency_seconds, freshness_seconds)
SELECT id, 'test.metric', 'Test Metric', 'number', 'count', '[]'::jsonb, 300, 600 FROM operations.clients WHERE client_key = 'test-client-a';
INSERT INTO operations.metric_definitions (client_id, metric_key, display_name, value_type, unit, allowed_dimensions, frequency_seconds, freshness_seconds)
SELECT id, 'vercel.traffic.visitors', 'Visitors', 'number', 'count', '[]'::jsonb, 3600, 7200 FROM operations.clients WHERE client_key = 'test-client-a';
INSERT INTO operations.metric_definitions (client_id, metric_key, display_name, value_type, unit, allowed_dimensions, frequency_seconds, freshness_seconds)
SELECT id, 'vercel.traffic.pageviews', 'Pageviews', 'number', 'count', '[]'::jsonb, 3600, 7200 FROM operations.clients WHERE client_key = 'test-client-a';
INSERT INTO operations.metric_definitions (client_id, metric_key, display_name, value_type, unit, allowed_dimensions, frequency_seconds, freshness_seconds)
SELECT id, 'vercel.traffic.top_route', 'Top Routes', 'number', 'count', '["path"]'::jsonb, 3600, 7200 FROM operations.clients WHERE client_key = 'test-client-a';

-- Throwaway test-only publisher secrets (valid only inside this transaction).
INSERT INTO operations.publishers (client_id, environment_id, publisher_key, display_name, key_hash, allowed_record_types)
SELECT c.id, e.id, 'pub-a', 'Publisher A',
  'a1b2c3d4e5f60718293a4b5c6d7e8f90' || ':' || encode(public.digest('a1b2c3d4e5f60718293a4b5c6d7e8f90' || ':' || 'test-secret-a-0123456789abcdef', 'sha256'), 'hex'),
  ARRAY['workflow_catalog','workflow_execution','endpoint_observation','metric_sample','traffic_summary','provider_connection','deployment_summary','backup_evidence','restore_test_evidence','report_summary','report_finding','incident','audit_event']
FROM operations.clients c JOIN operations.environments e ON e.client_id = c.id
WHERE c.client_key = 'test-client-a';

INSERT INTO operations.publishers (client_id, environment_id, publisher_key, display_name, key_hash, allowed_record_types)
SELECT c.id, e.id, 'pub-b', 'Publisher B',
  'b2c3d4e5f60718293a4b5c6d7e8f90a1' || ':' || encode(public.digest('b2c3d4e5f60718293a4b5c6d7e8f90a1' || ':' || 'test-secret-b-0123456789abcdef', 'sha256'), 'hex'),
  ARRAY['workflow_execution','endpoint_observation','report_summary']
FROM operations.clients c JOIN operations.environments e ON e.client_id = c.id
WHERE c.client_key = 'test-client-b';

INSERT INTO operations.publishers (client_id, environment_id, publisher_key, display_name, key_hash, allowed_record_types, disabled_at)
SELECT c.id, e.id, 'pub-disabled', 'Publisher Disabled',
  'c3d4e5f60718293a4b5c6d7e8f90a1b2' || ':' || encode(public.digest('c3d4e5f60718293a4b5c6d7e8f90a1b2' || ':' || 'test-secret-d-0123456789abcdef', 'sha256'), 'hex'),
  ARRAY['workflow_execution'], now()
FROM operations.clients c JOIN operations.environments e ON e.client_id = c.id
WHERE c.client_key = 'test-client-a';

INSERT INTO operations.user_profiles (email, display_name, global_role) VALUES
  ('owner@test.invalid', 'Owner', 'cloud_owner'),
  ('viewer-a@test.invalid', 'Viewer A', 'client_viewer'),
  ('viewer-b@test.invalid', 'Viewer B', 'client_viewer'),
  ('viewer-none@test.invalid', 'Viewer None', 'client_viewer'),
  ('viewer-dis-member@test.invalid', 'Viewer Disabled Membership', 'client_viewer'),
  ('viewer-dis-user@test.invalid', 'Viewer Disabled User', 'client_viewer');

INSERT INTO operations.client_memberships (user_id, client_id, client_role)
SELECT u.id, c.id, 'viewer' FROM operations.user_profiles u, operations.clients c
WHERE u.email = 'viewer-a@test.invalid' AND c.client_key = 'test-client-a';
INSERT INTO operations.client_memberships (user_id, client_id, client_role)
SELECT u.id, c.id, 'viewer' FROM operations.user_profiles u, operations.clients c
WHERE u.email = 'viewer-b@test.invalid' AND c.client_key = 'test-client-b';
INSERT INTO operations.client_memberships (user_id, client_id, client_role, state)
SELECT u.id, c.id, 'viewer', 'disabled' FROM operations.user_profiles u, operations.clients c
WHERE u.email = 'viewer-dis-member@test.invalid' AND c.client_key = 'test-client-a';
INSERT INTO operations.client_memberships (user_id, client_id, client_role)
SELECT u.id, c.id, 'viewer' FROM operations.user_profiles u, operations.clients c
WHERE u.email = 'viewer-dis-user@test.invalid' AND c.client_key = 'test-client-b';
UPDATE operations.user_profiles SET state = 'disabled' WHERE email = 'viewer-dis-user@test.invalid';

-- Client B report fixture: cross-tenant FK negative tests and viewer isolation.
INSERT INTO operations.reports (client_id, report_key, report_month, document_status, source_system, observed_at, publisher_id, idempotency_key)
SELECT c.id, 'report-b-2026-09', '2026-09-01', 'DRAFT', 'n8n', now(), p.id, 'fixture-report-b'
FROM operations.clients c JOIN operations.publishers p ON p.client_id = c.id
WHERE c.client_key = 'test-client-b';

-- User id lookup table for GUC switching: later blocks run under restricted
-- acting identities that cannot read operations.user_profiles.
CREATE TEMP TABLE fx_users (email text PRIMARY KEY, id uuid);
INSERT INTO fx_users SELECT email, id FROM operations.user_profiles;
GRANT SELECT ON fx_users TO PUBLIC;

\echo '== fixtures ready =='

-- ===========================================================================
-- 1. Anonymous denial (operations_anon: zero grants, NOLOGIN)
-- ===========================================================================

SET ROLE operations_anon;

DO $$
BEGIN
  PERFORM count(*) FROM operations.clients;
  PERFORM pg_temp.t_assert('anon_select_clients_denied', false, 'query succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  PERFORM pg_temp.t_assert('anon_select_clients_denied', true, 'permission denied');
END $$;

DO $$
BEGIN
  PERFORM count(*) FROM operations.audit_events;
  PERFORM pg_temp.t_assert('anon_select_audit_denied', false, 'query succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  PERFORM pg_temp.t_assert('anon_select_audit_denied', true, 'permission denied');
END $$;

DO $$
BEGIN
  INSERT INTO operations.clients (client_key, display_name) VALUES ('anon-attack', 'Anon');
  PERFORM pg_temp.t_assert('anon_insert_client_denied', false, 'insert succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  PERFORM pg_temp.t_assert('anon_insert_client_denied', true, 'permission denied');
END $$;

DO $$
BEGIN
  PERFORM operations_ingest.submit_batch('pub-a', 'x', 'n', repeat('ab', 32), '[]'::jsonb);
  PERFORM pg_temp.t_assert('anon_submit_batch_denied', false, 'call succeeded');
EXCEPTION WHEN insufficient_privilege OR undefined_function THEN
  PERFORM pg_temp.t_assert('anon_submit_batch_denied', true, 'blocked');
END $$;

DO $$
BEGIN
  PERFORM operations_private.record_audit_event('system', 'x', 'test.action', NULL, NULL, 'success');
  PERFORM pg_temp.t_assert('anon_record_audit_denied', false, 'call succeeded');
EXCEPTION WHEN insufficient_privilege OR undefined_function THEN
  PERFORM pg_temp.t_assert('anon_record_audit_denied', true, 'blocked');
END $$;

RESET ROLE;

-- ===========================================================================
-- 2. Fail-closed default: no GUC identity set
-- ===========================================================================

SET ROLE operations_owner;

DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM operations.clients;
  PERFORM pg_temp.t_assert('owner_no_guc_sees_nothing', v_count = 0, 'count=' || v_count);
END $$;

-- ===========================================================================
-- 3. Owner access (cloud_owner acting identity)
-- ===========================================================================

SET operations.global_role = 'cloud_owner';

DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM operations.clients;
  PERFORM pg_temp.t_assert('owner_sees_all_clients', v_count = 2, 'count=' || v_count);
END $$;

DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM operations.user_profiles;
  PERFORM pg_temp.t_assert('owner_manages_identities', v_count = 6, 'count=' || v_count);
END $$;

DO $$
BEGIN
  INSERT INTO operations.clients (client_key, display_name) VALUES ('scratch-owner-test', 'Scratch');
  UPDATE operations.clients SET display_name = 'Scratch 2' WHERE client_key = 'scratch-owner-test';
  DELETE FROM operations.clients WHERE client_key = 'scratch-owner-test';
  PERFORM pg_temp.t_assert('owner_config_dml_allowed', true, '');
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.t_assert('owner_config_dml_allowed', false, SQLERRM);
END $$;

DO $$
BEGIN
  INSERT INTO operations.workflow_executions (
    client_id, environment_id, workflow_definition_id, execution_key, outcome,
    source_system, observed_at, publisher_id, idempotency_key
  )
  SELECT c.id, e.id, d.id, 'direct-attack', 'success', 'n8n', now(), p.id, 'direct-attack-idem'
  FROM operations.clients c
  JOIN operations.environments e ON e.client_id = c.id
  JOIN operations.workflow_definitions d ON d.client_id = c.id
  JOIN operations.publishers p ON p.client_id = c.id
  WHERE c.client_key = 'test-client-a' LIMIT 1;
  PERFORM pg_temp.t_assert('owner_direct_evidence_insert_denied', false, 'insert succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  PERFORM pg_temp.t_assert('owner_direct_evidence_insert_denied', true, 'permission denied');
END $$;

DO $$
BEGIN
  INSERT INTO operations.audit_events (event_key, actor_type, actor_key, action, result)
  VALUES ('direct-audit-attack', 'system', 'test', 'test.direct', 'success');
  PERFORM pg_temp.t_assert('owner_direct_audit_insert_denied', false, 'insert succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  PERFORM pg_temp.t_assert('owner_direct_audit_insert_denied', true, 'permission denied');
END $$;

DO $$
BEGIN
  UPDATE operations.audit_events SET result = 'error' WHERE event_key = 'x';
  PERFORM pg_temp.t_assert('owner_direct_audit_update_denied', false, 'update succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  PERFORM pg_temp.t_assert('owner_direct_audit_update_denied', true, 'permission denied');
END $$;

DO $$
DECLARE v_id uuid; v_count integer;
BEGIN
  SELECT id INTO v_id FROM operations.user_profiles WHERE email = 'owner@test.invalid';
  v_id := operations_private.record_audit_event(
    'portal_user', v_id::text, 'test.portal_action', 'client', 'test-client-a', 'success',
    (SELECT id FROM operations.clients WHERE client_key = 'test-client-a')
  );
  SELECT count(*) INTO v_count FROM operations.audit_events WHERE id = v_id;
  PERFORM pg_temp.t_assert('owner_audit_via_function', v_count = 1, 'id=' || v_id::text);
END $$;

-- ===========================================================================
-- 4. Client isolation (viewer acting identities through one connection role)
-- ===========================================================================

DO $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM pg_temp.fx_users WHERE email = 'viewer-a@test.invalid';
  PERFORM set_config('operations.global_role', 'client_viewer', false);
  PERFORM set_config('operations.user_id', v_id::text, false);
END $$;

DO $$
DECLARE v_count integer; v_cross integer;
BEGIN
  SELECT count(*) INTO v_count FROM operations.clients;
  SELECT count(*) INTO v_cross FROM operations.clients WHERE client_key = 'test-client-b';
  PERFORM pg_temp.t_assert('viewer_a_sees_only_client_a', v_count = 1 AND v_cross = 0,
    'count=' || v_count || ' cross=' || v_cross);
END $$;

DO $$
DECLARE v_count integer; v_cross integer;
BEGIN
  SELECT count(*) INTO v_count FROM operations.environments;
  SELECT count(*) INTO v_cross FROM operations.environments e
    JOIN operations.clients c ON c.id = e.client_id WHERE c.client_key = 'test-client-b';
  PERFORM pg_temp.t_assert('viewer_a_environments_isolated', v_count = 1 AND v_cross = 0,
    'count=' || v_count);
END $$;

DO $$
BEGIN
  INSERT INTO operations.clients (client_key, display_name) VALUES ('viewer-attack', 'Attack');
  PERFORM pg_temp.t_assert('viewer_insert_client_denied', false, 'insert succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  PERFORM pg_temp.t_assert('viewer_insert_client_denied', true, 'permission denied');
END $$;

DO $$
BEGIN
  UPDATE operations.clients SET display_name = 'Hijacked' WHERE client_key = 'test-client-a';
  PERFORM pg_temp.t_assert('viewer_update_denied', false, 'update succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  PERFORM pg_temp.t_assert('viewer_update_denied', true, 'permission denied');
END $$;

DO $$
DECLARE v_scratch uuid; v_count integer;
BEGIN
  SELECT id INTO v_scratch FROM operations.publishers WHERE publisher_key = 'pub-a';
  PERFORM pg_temp.t_assert('viewer_a_sees_own_publisher', v_scratch IS NOT NULL, '');
  SELECT count(*) INTO v_count FROM operations.publishers WHERE publisher_key = 'pub-b';
  PERFORM pg_temp.t_assert('viewer_a_publisher_isolated', v_count = 0, 'cross=' || v_count);
END $$;

DO $$
DECLARE v_count integer; v_cross integer;
BEGIN
  SELECT count(*) INTO v_count FROM operations.reports;
  SELECT count(*) INTO v_cross FROM operations.reports r
    JOIN operations.clients c ON c.id = r.client_id WHERE c.client_key = 'test-client-b';
  PERFORM pg_temp.t_assert('viewer_a_reports_isolated', v_count = 0 AND v_cross = 0,
    'count=' || v_count);
END $$;

DO $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM pg_temp.fx_users WHERE email = 'viewer-b@test.invalid';
  PERFORM set_config('operations.global_role', 'client_viewer', false);
  PERFORM set_config('operations.user_id', v_id::text, false);
END $$;

DO $$
DECLARE v_count integer; v_cross integer;
BEGIN
  SELECT count(*) INTO v_count FROM operations.clients;
  SELECT count(*) INTO v_cross FROM operations.clients WHERE client_key = 'test-client-a';
  PERFORM pg_temp.t_assert('viewer_b_sees_only_client_b', v_count = 1 AND v_cross = 0,
    'count=' || v_count || ' cross=' || v_cross);
END $$;

DO $$
DECLARE v_count integer; v_own integer;
BEGIN
  SELECT count(*) INTO v_count FROM operations.reports;
  SELECT count(*) INTO v_own FROM operations.reports r
    JOIN operations.clients c ON c.id = r.client_id WHERE c.client_key = 'test-client-b';
  PERFORM pg_temp.t_assert('viewer_b_sees_own_report', v_count = 1 AND v_own = 1,
    'count=' || v_count);
END $$;

DO $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM pg_temp.fx_users WHERE email = 'viewer-none@test.invalid';
  PERFORM set_config('operations.global_role', 'client_viewer', false);
  PERFORM set_config('operations.user_id', v_id::text, false);
END $$;

DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM operations.clients;
  PERFORM pg_temp.t_assert('unassigned_viewer_sees_nothing', v_count = 0, 'count=' || v_count);
END $$;

DO $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM pg_temp.fx_users WHERE email = 'viewer-dis-member@test.invalid';
  PERFORM set_config('operations.global_role', 'client_viewer', false);
  PERFORM set_config('operations.user_id', v_id::text, false);
END $$;

DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM operations.clients;
  PERFORM pg_temp.t_assert('disabled_membership_sees_nothing', v_count = 0, 'count=' || v_count);
END $$;

DO $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM pg_temp.fx_users WHERE email = 'viewer-dis-user@test.invalid';
  PERFORM set_config('operations.global_role', 'client_viewer', false);
  PERFORM set_config('operations.user_id', v_id::text, false);
END $$;

DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM operations.clients;
  PERFORM pg_temp.t_assert('disabled_user_sees_nothing', v_count = 0, 'count=' || v_count);
END $$;

RESET operations.global_role;
RESET operations.user_id;
SET operations.global_role = 'cloud_owner';

-- ===========================================================================
-- 5. Composite tenant foreign keys cannot cross tenants
-- ===========================================================================

RESET ROLE;

DO $$
BEGIN
  INSERT INTO operations.domains (client_id, environment_id, domain_name)
  SELECT c.id, e.id, 'cross.example.com'
  FROM operations.clients c, operations.environments e
  WHERE c.client_key = 'test-client-a'
    AND e.id IN (SELECT id FROM operations.environments WHERE client_id IN (SELECT id FROM operations.clients WHERE client_key = 'test-client-b'))
  LIMIT 1;
  PERFORM pg_temp.t_assert('fk_domain_cross_tenant_denied', false, 'insert succeeded');
EXCEPTION WHEN foreign_key_violation THEN
  PERFORM pg_temp.t_assert('fk_domain_cross_tenant_denied', true, 'foreign key violation');
END $$;

DO $$
BEGIN
  INSERT INTO operations.workflow_executions (
    client_id, environment_id, workflow_definition_id, execution_key, outcome,
    source_system, observed_at, publisher_id, idempotency_key
  )
  SELECT ca.id, ea.id, da.id, 'fk-attack-exec', 'success', 'n8n', now(), pb.id, 'fk-attack-idem'
  FROM operations.clients ca
  JOIN operations.environments ea ON ea.client_id = ca.id
  JOIN operations.workflow_definitions da ON da.client_id = ca.id
  JOIN operations.publishers pb ON pb.publisher_key = 'pub-b'
  WHERE ca.client_key = 'test-client-a' LIMIT 1;
  PERFORM pg_temp.t_assert('fk_execution_cross_publisher_denied', false, 'insert succeeded');
EXCEPTION WHEN foreign_key_violation THEN
  PERFORM pg_temp.t_assert('fk_execution_cross_publisher_denied', true, 'foreign key violation');
END $$;

DO $$
BEGIN
  INSERT INTO operations.report_findings (
    client_id, report_id, finding_key, category, severity, safe_title,
    source_system, observed_at, publisher_id, idempotency_key
  )
  SELECT ca.id, rb.id, 'fk-attack-finding', 'other', 'info', 'FK attack',
    'n8n', now(), pa.id, 'fk-finding-idem'
  FROM operations.clients ca, operations.reports rb, operations.publishers pa
  WHERE ca.client_key = 'test-client-a' AND pa.publisher_key = 'pub-a'
    AND rb.report_key = 'report-b-2026-09'
  LIMIT 1;
  PERFORM pg_temp.t_assert('fk_finding_cross_report_denied', false, 'insert succeeded');
EXCEPTION WHEN foreign_key_violation THEN
  PERFORM pg_temp.t_assert('fk_finding_cross_report_denied', true, 'foreign key violation');
END $$;

-- client_key immutability
DO $$
BEGIN
  UPDATE operations.clients SET client_key = 'renamed-a' WHERE client_key = 'test-client-a';
  PERFORM pg_temp.t_assert('client_key_immutable', false, 'update succeeded');
EXCEPTION WHEN raise_exception THEN
  PERFORM pg_temp.t_assert('client_key_immutable', SQLERRM = 'client_key_is_immutable', SQLERRM);
END $$;

-- ===========================================================================
-- 6. Ingestion authentication and scoping (operations_ingest role)
-- ===========================================================================

SET ROLE operations_ingest;

DO $$
BEGIN
  PERFORM count(*) FROM operations.workflow_executions;
  PERFORM pg_temp.t_assert('ingest_select_evidence_denied', false, 'select succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  PERFORM pg_temp.t_assert('ingest_select_evidence_denied', true, 'permission denied');
END $$;

DO $$
BEGIN
  INSERT INTO operations.workflow_executions (
    client_id, environment_id, execution_key, outcome, source_system,
    observed_at, publisher_id, idempotency_key
  )
  SELECT c.id, e.id, 'ingest-attack', 'success', 'n8n', now(), p.id, 'ingest-attack-idem'
  FROM operations.clients c JOIN operations.environments e ON e.client_id = c.id
  JOIN operations.publishers p ON p.client_id = c.id
  WHERE c.client_key = 'test-client-a' LIMIT 1;
  PERFORM pg_temp.t_assert('ingest_direct_insert_denied', false, 'insert succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  PERFORM pg_temp.t_assert('ingest_direct_insert_denied', true, 'permission denied');
END $$;

DO $$
BEGIN
  UPDATE operations.publishers SET disabled_at = now() WHERE publisher_key = 'pub-a';
  PERFORM pg_temp.t_assert('ingest_update_publisher_denied', false, 'update succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  PERFORM pg_temp.t_assert('ingest_update_publisher_denied', true, 'permission denied');
END $$;

DO $$
BEGIN
  PERFORM operations_ingest.insert_workflow_execution(NULL, NULL);
  PERFORM pg_temp.t_assert('ingest_inner_function_not_executable', false, 'call succeeded');
EXCEPTION WHEN insufficient_privilege OR undefined_function THEN
  PERFORM pg_temp.t_assert('ingest_inner_function_not_executable', true, 'blocked');
END $$;

-- 6a. Authentication failures (no receipt, safe codes only)
DO $$
DECLARE v jsonb;
BEGIN
  v := operations_ingest.submit_batch('pub-unknown', 'x', 'nonce-neg-1', repeat('ab', 32),
    jsonb_build_array(pg_temp.t_env('workflow_execution', 'neg-1', '{}'::jsonb)));
  PERFORM pg_temp.t_assert('ingest_unknown_publisher', v->>'result' = 'rejected_authentication'
    AND v->>'code' = 'unknown_publisher', v::text);
END $$;

DO $$
DECLARE v jsonb;
BEGIN
  v := operations_ingest.submit_batch('pub-a', 'wrong-secret', 'nonce-neg-2', repeat('ab', 32),
    jsonb_build_array(pg_temp.t_env('workflow_execution', 'neg-2', '{}'::jsonb)));
  PERFORM pg_temp.t_assert('ingest_wrong_secret', v->>'result' = 'rejected_authentication'
    AND v->>'code' = 'invalid_publisher_secret', v::text);
END $$;

DO $$
DECLARE v jsonb;
BEGIN
  v := operations_ingest.submit_batch('pub-a', 'wrong-secret', 'nonce-neg-3', repeat('ab', 32),
    jsonb_build_array(pg_temp.t_env('workflow_execution', 'neg-3', '{}'::jsonb)));
  PERFORM pg_temp.t_assert('ingest_wrong_secret_response_only', v->>'receiptId' IS NULL, v::text);
END $$;

DO $$
DECLARE v jsonb;
BEGIN
  v := operations_ingest.submit_batch('pub-disabled', 'test-secret-d-0123456789abcdef', 'nonce-neg-4', repeat('ab', 32),
    jsonb_build_array(pg_temp.t_env('workflow_execution', 'neg-4', '{}'::jsonb)));
  PERFORM pg_temp.t_assert('ingest_disabled_publisher', v->>'result' = 'rejected_authentication'
    AND v->>'code' = 'publisher_disabled', v::text);
END $$;

-- 6b. Happy path across all record types
DO $$
DECLARE v jsonb;
BEGIN
  v := operations_ingest.submit_batch('pub-a', 'test-secret-a-0123456789abcdef', 'nonce-pos-1', repeat('ab', 32),
    jsonb_build_array(pg_temp.t_env('workflow_catalog', 'idem-cat-1', jsonb_build_object(
      'workflowKey', 'wf.catalog', 'displayName', 'Catalog Workflow', 'triggerKind', 'cron',
      'scheduleExpression', '15 7 * * *', 'scheduleTimezone', 'Europe/Malta',
      'enabled', true, 'criticality', 'high', 'safeStepKeys', to_jsonb(ARRAY['load', 'publish']::text[])
    ))));
  PERFORM pg_temp.t_assert('ingest_workflow_catalog_accepted', v->>'result' = 'accepted'
    AND v->>'accepted' = '1', v::text);
END $$;

DO $$
DECLARE v jsonb;
BEGIN
  v := operations_ingest.submit_batch('pub-a', 'test-secret-a-0123456789abcdef', 'nonce-pos-2', repeat('ab', 32),
    jsonb_build_array(pg_temp.t_env('workflow_execution', 'idem-exec-1', jsonb_build_object(
      'workflowKey', 'wf.backup', 'executionKey', 'exec-a-1', 'triggerKind', 'cron',
      'scheduledFor', now(), 'startedAt', now(), 'finishedAt', now() + interval '1 second',
      'durationMs', 950, 'scheduleDelayMs', 120, 'outcome', 'success',
      'sourceRevisionKey', 'rev-abc'
    ))));
  PERFORM pg_temp.t_assert('ingest_workflow_execution_accepted', v->>'result' = 'accepted'
    AND v->>'accepted' = '1', v::text);
END $$;

DO $$
DECLARE v jsonb;
BEGIN
  v := operations_ingest.submit_batch('pub-a', 'test-secret-a-0123456789abcdef', 'nonce-pos-3', repeat('ab', 32),
    jsonb_build_array(pg_temp.t_env('endpoint_observation', 'idem-eo-1', jsonb_build_object(
      'endpointKey', 'site-a', 'checkedAt', now(), 'available', true,
      'httpStatusClass', 2, 'httpStatus', 200, 'responseTimeMs', 187,
      'tlsDaysRemaining', 89, 'confirmationState', 'recovered', 'monitorKey', 'mon-a'
    ))));
  PERFORM pg_temp.t_assert('ingest_endpoint_observation_accepted', v->>'result' = 'accepted'
    AND v->>'accepted' = '1', v::text);
END $$;

DO $$
DECLARE v jsonb;
BEGIN
  v := operations_ingest.submit_batch('pub-a', 'test-secret-a-0123456789abcdef', 'nonce-pos-4', repeat('ab', 32),
    jsonb_build_array(pg_temp.t_env('metric_sample', 'idem-ms-1', jsonb_build_object(
      'metricKey', 'test.metric', 'sampledAt', now(), 'valueNumber', 42,
      'periodStart', now(), 'periodEnd', now() + interval '5 minutes',
      'coverage', 'full', 'dimensions', '{}'::jsonb
    ))));
  PERFORM pg_temp.t_assert('ingest_metric_sample_accepted', v->>'result' = 'accepted'
    AND v->>'accepted' = '1', v::text);
END $$;

DO $$
DECLARE v jsonb;
BEGIN
  v := operations_ingest.submit_batch('pub-a', 'test-secret-a-0123456789abcdef', 'nonce-pos-5', repeat('ab', 32),
    jsonb_build_array(pg_temp.t_env('traffic_summary', 'idem-ts-1', jsonb_build_object(
      'provider', 'vercel', 'periodStart', now() - interval '1 day', 'periodEnd', now(),
      'timezone', 'UTC', 'boundary', 'day', 'coverage', 'full',
      'visitors', 120, 'pageviews', 340,
      'topRoutes', jsonb_build_array(
        jsonb_build_object('path', '/', 'views', 200),
        jsonb_build_object('path', '/properties', 'views', 60)
      )
    ))));
  PERFORM pg_temp.t_assert('ingest_traffic_summary_accepted', v->>'result' = 'accepted'
    AND v->>'accepted' = '1', v::text);
END $$;

DO $$
DECLARE v jsonb;
BEGIN
  v := operations_ingest.submit_batch('pub-a', 'test-secret-a-0123456789abcdef', 'nonce-pos-6', repeat('ab', 32),
    jsonb_build_array(pg_temp.t_env('provider_connection', 'idem-pc-1', jsonb_build_object(
      'provider', 'imagekit', 'connectionKey', 'usage_api', 'reachable', true,
      'authorizationState', 'ok', 'lastSuccessfulAt', now()
    ))));
  PERFORM pg_temp.t_assert('ingest_provider_connection_accepted', v->>'result' = 'accepted'
    AND v->>'accepted' = '1', v::text);
END $$;

DO $$
DECLARE v jsonb;
BEGIN
  v := operations_ingest.submit_batch('pub-a', 'test-secret-a-0123456789abcdef', 'nonce-pos-7', repeat('ab', 32),
    jsonb_build_array(pg_temp.t_env('deployment_summary', 'idem-ds-1', jsonb_build_object(
      'deploymentKey', 'dep-1', 'environment', 'production', 'state', 'ready',
      'createdAt', now(), 'readyAt', now() + interval '2 minutes', 'durationMs', 120000,
      'publicDomainKey', 'site-a', 'isCurrentProduction', true
    ))));
  PERFORM pg_temp.t_assert('ingest_deployment_accepted', v->>'result' = 'accepted'
    AND v->>'accepted' = '1', v::text);
END $$;

DO $$
DECLARE v jsonb;
BEGIN
  v := operations_ingest.submit_batch('pub-a', 'test-secret-a-0123456789abcdef', 'nonce-pos-8', repeat('ab', 32),
    jsonb_build_array(pg_temp.t_env('backup_evidence', 'idem-be-1', jsonb_build_object(
      'backupKey', 'backup-2026-09-01', 'backupTimestamp', now(), 'retentionClass', 'daily',
      'sanitizedFileName', 'backup-2026-09-01.enc', 'encryptedArchivePresent', true,
      'checksumFilePresent', true, 'checksumVerified', true, 'driveRoundTripPassed', true,
      'archiveStructureValidated', true, 'sizeBytes', 71512832,
      'githubRunKey', '123456', 'githubRunUrl', 'https://github.com/example/repo/actions/runs/123456',
      'driveObjectKey', 'server-only-object-key'
    ))));
  PERFORM pg_temp.t_assert('ingest_backup_evidence_accepted', v->>'result' = 'accepted'
    AND v->>'accepted' = '1', v::text);
END $$;

DO $$
DECLARE v jsonb;
BEGIN
  v := operations_ingest.submit_batch('pub-a', 'test-secret-a-0123456789abcdef', 'nonce-pos-9', repeat('ab', 32),
    jsonb_build_array(pg_temp.t_env('restore_test_evidence', 'idem-rt-1', jsonb_build_object(
      'restoreTestKey', 'restore-2026-09-02', 'backupKey', 'backup-2026-09-01',
      'sourceRetentionClass', 'daily', 'startedAt', now(), 'completedAt', now() + interval '10 minutes',
      'durationMs', 600000, 'result', 'passed', 'checksumPassed', true, 'decryptPassed', true,
      'isolatedRestorePassed', true, 'requiredObjectsPassed', true, 'rlsPassed', true,
      'anonymousDenialPassed', true, 'publicWhitelistPassed', true, 'cleanupPassed', true,
      'githubRunKey', '123457', 'githubRunUrl', 'https://github.com/example/repo/actions/runs/123457'
    ))));
  PERFORM pg_temp.t_assert('ingest_restore_test_accepted', v->>'result' = 'accepted'
    AND v->>'accepted' = '1', v::text);
END $$;

DO $$
DECLARE v jsonb;
BEGIN
  v := operations_ingest.submit_batch('pub-a', 'test-secret-a-0123456789abcdef', 'nonce-pos-10', repeat('ab', 32),
    jsonb_build_array(pg_temp.t_env('incident', 'idem-inc-1', jsonb_build_object(
      'incidentKey', 'incident-a-1', 'serviceKey', 'site-a', 'endpointKey', 'site-a',
      'state', 'open', 'severity', 'critical', 'failureCategory', 'http_5xx',
      'startedAt', now(), 'occurrenceCount', 1, 'safeSummary', 'Site returned 5xx',
      'safeAction', 'Check provider status page'
    ))));
  PERFORM pg_temp.t_assert('ingest_incident_accepted', v->>'result' = 'accepted'
    AND v->>'accepted' = '1', v::text);
END $$;

DO $$
DECLARE v jsonb;
BEGIN
  v := operations_ingest.submit_batch('pub-a', 'test-secret-a-0123456789abcdef', 'nonce-pos-11', repeat('ab', 32),
    jsonb_build_array(pg_temp.t_env('audit_event', 'idem-ae-1', jsonb_build_object(
      'eventKey', 'n8n-test-event-1', 'actorType', 'n8n', 'actorKey', 'watchdog',
      'action', 'watchdog.heartbeat', 'targetType', 'workflow', 'targetKey', 'wf.backup',
      'result', 'success', 'occurredAt', now(), 'safeReasonCode', 'test_only'
    ))));
  PERFORM pg_temp.t_assert('ingest_audit_event_accepted', v->>'result' = 'accepted'
    AND v->>'accepted' = '1', v::text);
END $$;

-- 6c. Idempotent replay: nonce replay returns the original receipt
DO $$
DECLARE v_first jsonb; v_replay jsonb;
BEGIN
  SELECT result INTO v_first FROM operations_ingest.submit_batch('pub-a', 'test-secret-a-0123456789abcdef', 'nonce-pos-3', repeat('ab', 32),
    jsonb_build_array(pg_temp.t_env('endpoint_observation', 'idem-eo-1', jsonb_build_object(
      'endpointKey', 'site-a', 'checkedAt', now(), 'available', true,
      'confirmationState', 'confirmed'
    )))) AS t(result);
  PERFORM pg_temp.t_assert('ingest_nonce_replay_is_duplicate', v_first->>'result' = 'duplicate_batch'
    AND v_first->>'accepted' = '1', v_first::text);
END $$;

DO $$
DECLARE v jsonb;
BEGIN
  v := operations_ingest.submit_batch('pub-a', 'test-secret-a-0123456789abcdef', 'nonce-rep-1', repeat('ab', 32),
    jsonb_build_array(pg_temp.t_env('workflow_execution', 'idem-exec-1', jsonb_build_object(
      'workflowKey', 'wf.backup', 'executionKey', 'exec-a-1', 'outcome', 'success'
    ))));
  PERFORM pg_temp.t_assert('ingest_record_replay_no_duplicate', v->>'result' = 'accepted'
    AND v->>'duplicates' = '1' AND v->>'accepted' = '0', v::text);
END $$;

-- 6d. Validation rejections (safe codes, whole batch rejected transactionally)
DO $$
DECLARE v jsonb; v_count integer;
BEGIN
  v := operations_ingest.submit_batch('pub-b', 'test-secret-b-0123456789abcdef', 'nonce-neg-5', repeat('ab', 32),
    jsonb_build_array(pg_temp.t_env('endpoint_observation', 'neg-cross-1', jsonb_build_object(
      'endpointKey', 'site-a', 'checkedAt', now(), 'available', true,
      'confirmationState', 'confirmed'
    ))));
  PERFORM pg_temp.t_assert('ingest_cross_tenant_endpoint_rejected', v->>'result' = 'rejected_validation'
    AND v->>'code' = 'endpoint_not_registered', v::text);
END $$;

DO $$
DECLARE v jsonb;
BEGIN
  v := operations_ingest.submit_batch('pub-b', 'test-secret-b-0123456789abcdef', 'nonce-neg-6', repeat('ab', 32),
    jsonb_build_array(pg_temp.t_env('workflow_catalog', 'neg-type-1', jsonb_build_object(
      'workflowKey', 'x', 'displayName', 'X'
    ))));
  PERFORM pg_temp.t_assert('ingest_record_type_not_allowed', v->>'result' = 'rejected_validation'
    AND v->>'code' = 'record_type_not_allowed', v::text);
END $$;

DO $$
DECLARE v jsonb;
BEGIN
  v := operations_ingest.submit_batch('pub-a', 'test-secret-a-0123456789abcdef', 'nonce-neg-7', repeat('ab', 32),
    jsonb_build_array(pg_temp.t_env('metric_sample', 'neg-unknown-field', jsonb_build_object(
      'metricKey', 'test.metric', 'valueNumber', 1, 'periodStart', now(), 'periodEnd', now(),
      'mystery', 1
    ))));
  PERFORM pg_temp.t_assert('ingest_unknown_field_rejected', v->>'result' = 'rejected_validation'
    AND v->>'code' = 'unknown_field', v::text);
END $$;

DO $$
DECLARE v jsonb;
BEGIN
  v := operations_ingest.submit_batch('pub-a', 'test-secret-a-0123456789abcdef', 'nonce-neg-8', repeat('ab', 32),
    jsonb_build_array(pg_temp.t_env('workflow_execution', 'neg-forbidden', jsonb_build_object(
      'workflowKey', 'wf.backup', 'executionKey', 'e', 'outcome', 'success', 'stack', 'boom'
    ))));
  PERFORM pg_temp.t_assert('ingest_forbidden_field_rejected', v->>'result' = 'rejected_validation'
    AND v->>'code' = 'forbidden_field', v::text);
END $$;

DO $$
DECLARE v jsonb;
BEGIN
  v := operations_ingest.submit_batch('pub-a', 'test-secret-a-0123456789abcdef', 'nonce-neg-9', repeat('ab', 32),
    jsonb_build_array(pg_temp.t_env('workflow_execution', 'neg-status', jsonb_build_object(
      'workflowKey', 'wf.backup', 'executionKey', 'e', 'outcome', 'success'
    )) || jsonb_build_object('status', 'PURPLE')));
  PERFORM pg_temp.t_assert('ingest_invalid_status_rejected', v->>'result' = 'rejected_validation'
    AND v->>'code' = 'invalid_status', v::text);
END $$;

DO $$
DECLARE v jsonb;
BEGIN
  v := operations_ingest.submit_batch('pub-a', 'test-secret-a-0123456789abcdef', 'nonce-neg-10', repeat('ab', 32),
    jsonb_build_array(pg_temp.t_env('workflow_execution', 'neg-stale', jsonb_build_object(
      'workflowKey', 'wf.backup', 'executionKey', 'e', 'outcome', 'success'
    )) || jsonb_build_object('publishedAt', now() - interval '10 minutes')));
  PERFORM pg_temp.t_assert('ingest_stale_timestamp_rejected', v->>'result' = 'rejected_validation'
    AND v->>'code' = 'stale_timestamp', v::text);
END $$;

DO $$
DECLARE v jsonb;
BEGIN
  v := operations_ingest.submit_batch('pub-a', 'test-secret-a-0123456789abcdef', 'nonce-neg-11', repeat('ab', 32),
    jsonb_build_array(pg_temp.t_env('workflow_execution', 'neg-bad-ts', jsonb_build_object(
      'workflowKey', 'wf.backup', 'executionKey', 'e', 'outcome', 'success'
    )) || jsonb_build_object('observedAt', 'not-a-timestamp')));
  PERFORM pg_temp.t_assert('ingest_invalid_timestamp_rejected', v->>'result' = 'rejected_validation'
    AND v->>'code' = 'invalid_timestamp', v::text);
END $$;

DO $$
DECLARE v jsonb;
BEGIN
  v := operations_ingest.submit_batch('pub-a', 'test-secret-a-0123456789abcdef', 'nonce-neg-12', repeat('ab', 32),
    jsonb_build_array(pg_temp.t_env('workflow_execution', 'neg-env', jsonb_build_object(
      'workflowKey', 'wf.backup', 'executionKey', 'e', 'outcome', 'success'
    ), 'staging')));
  PERFORM pg_temp.t_assert('ingest_environment_scope_rejected', v->>'result' = 'rejected_validation'
    AND v->>'code' = 'environment_scope_violation', v::text);
END $$;

DO $$
DECLARE v jsonb;
BEGIN
  v := operations_ingest.submit_batch('pub-a', 'test-secret-a-0123456789abcdef', 'nonce-neg-13', repeat('ab', 32),
    jsonb_build_array(
      pg_temp.t_env('workflow_execution', 'neg-mixed-1', jsonb_build_object(
        'workflowKey', 'wf.backup', 'executionKey', 'mixed-exec', 'outcome', 'success')),
      pg_temp.t_env('workflow_execution', 'neg-mixed-2', jsonb_build_object(
        'workflowKey', 'wf.backup', 'executionKey', 'mixed-exec-2', 'outcome', 'success', 'token', 'leak'))
    ));
  PERFORM pg_temp.t_assert('ingest_mixed_batch_atomic', v->>'result' = 'rejected_validation'
    AND v->>'code' = 'forbidden_field', v::text);
END $$;

DO $$
DECLARE v jsonb; v_big jsonb;
BEGIN
  SELECT jsonb_agg(pg_temp.t_env('metric_sample', 'bulk-' || g, jsonb_build_object(
      'metricKey', 'test.metric', 'valueNumber', g, 'periodStart', now(), 'periodEnd', now())))
  INTO v_big FROM generate_series(1, 501) AS g;
  v := operations_ingest.submit_batch('pub-a', 'test-secret-a-0123456789abcdef', 'nonce-neg-14', repeat('ab', 32), v_big);
  PERFORM pg_temp.t_assert('ingest_batch_size_limit', v->>'result' = 'rejected_validation'
    AND v->>'code' = 'batch_too_large', left(v::text, 200));
END $$;

DO $$
DECLARE v jsonb;
BEGIN
  v := operations_ingest.submit_batch('pub-a', 'test-secret-a-0123456789abcdef', 'nonce-neg-15', repeat('ab', 32),
    jsonb_build_array(pg_temp.t_env('metric_sample', 'neg-dims', jsonb_build_object(
      'metricKey', 'test.metric', 'valueNumber', 1, 'periodStart', now(), 'periodEnd', now(),
      'dimensions', jsonb_build_object('unexpected', 1)
    ))));
  PERFORM pg_temp.t_assert('ingest_invalid_dimensions_rejected', v->>'result' = 'rejected_validation'
    AND v->>'code' = 'invalid_dimensions', v::text);
END $$;

DO $$
DECLARE v jsonb;
BEGIN
  v := operations_ingest.submit_batch('pub-a', 'test-secret-a-0123456789abcdef', 'nonce-neg-16', repeat('ab', 32),
    jsonb_build_array(pg_temp.t_env('metric_sample', 'neg-vtype', jsonb_build_object(
      'metricKey', 'test.metric', 'valueBoolean', true, 'periodStart', now(), 'periodEnd', now()
    ))));
  PERFORM pg_temp.t_assert('ingest_value_type_mismatch', v->>'result' = 'rejected_validation'
    AND v->>'code' = 'metric_value_type_mismatch', v::text);
END $$;

DO $$
DECLARE v jsonb;
BEGIN
  v := operations_ingest.submit_batch('pub-a', 'test-secret-a-0123456789abcdef', 'nonce-neg-17', repeat('ab', 32),
    jsonb_build_array(pg_temp.t_env('metric_sample', 'neg-unknown-metric', jsonb_build_object(
      'metricKey', 'unknown.metric', 'valueNumber', 1, 'periodStart', now(), 'periodEnd', now()
    ))));
  PERFORM pg_temp.t_assert('ingest_unknown_metric_rejected', v->>'result' = 'rejected_validation'
    AND v->>'code' = 'unknown_metric', v::text);
END $$;

DO $$
DECLARE v jsonb;
BEGIN
  v := operations_ingest.submit_batch('pub-a', 'test-secret-a-0123456789abcdef', 'nonce-neg-18', repeat('ab', 32),
    jsonb_build_array(pg_temp.t_env('traffic_summary', 'neg-route', jsonb_build_object(
      'provider', 'vercel', 'periodStart', now() - interval '1 day', 'periodEnd', now(),
      'visitors', 1, 'topRoutes', jsonb_build_array(jsonb_build_object('path', '/admin/secret', 'views', 5))
    ))));
  PERFORM pg_temp.t_assert('ingest_unsafe_route_rejected', v->>'result' = 'rejected_validation'
    AND v->>'code' = 'unsafe_route', v::text);
END $$;

-- 6e. Positive publisher-b batch (isolation evidence counts)
DO $$
DECLARE v jsonb;
BEGIN
  v := operations_ingest.submit_batch('pub-b', 'test-secret-b-0123456789abcdef', 'nonce-pos-b-1', repeat('ab', 32),
    jsonb_build_array(pg_temp.t_env('workflow_execution', 'idem-b-exec-1', jsonb_build_object(
      'workflowKey', 'wf.health', 'executionKey', 'exec-b-1', 'outcome', 'success'
    ))));
  PERFORM pg_temp.t_assert('ingest_publisher_b_accepted', v->>'result' = 'accepted'
    AND v->>'accepted' = '1', v::text);
END $$;

-- 6f. Auth failures wrote no receipts and wrote denied audit events
RESET ROLE;

DO $$
DECLARE v_bad_receipts integer; v_audit_auth integer; v_exec integer;
BEGIN
  SELECT count(*) INTO v_bad_receipts FROM operations.ingestion_receipts
  WHERE batch_nonce IN ('nonce-neg-1', 'nonce-neg-2', 'nonce-neg-3', 'nonce-neg-4');
  SELECT count(*) INTO v_audit_auth FROM operations.audit_events
  WHERE safe_reason_code IN ('unknown_publisher', 'publisher_disabled', 'invalid_publisher_secret', 'client_disabled');
  SELECT count(*) INTO v_exec FROM operations.workflow_executions WHERE execution_key = 'exec-a-1';
  PERFORM pg_temp.t_assert('ingest_auth_failure_no_receipt', v_bad_receipts = 0,
    'auth-failure receipts=' || v_bad_receipts);
  PERFORM pg_temp.t_assert('ingest_auth_failure_audited', v_audit_auth = 3,
    'auth-failure audit rows=' || v_audit_auth);
  PERFORM pg_temp.t_assert('ingest_replay_left_single_row', v_exec = 1, 'exec rows=' || v_exec);
  PERFORM pg_temp.t_assert('ingest_mixed_batch_wrote_nothing',
    NOT EXISTS (SELECT 1 FROM operations.workflow_executions
                WHERE execution_key IN ('mixed-exec', 'mixed-exec-2')),
    'mixed rows present');
END $$;

-- ===========================================================================
-- 7. Report lifecycle mirror: upsert, events, SENT guard
-- ===========================================================================

DO $$
DECLARE v jsonb;
BEGIN
  v := operations_ingest.submit_batch('pub-a', 'test-secret-a-0123456789abcdef', 'nonce-pos-12', repeat('ab', 32),
    jsonb_build_array(pg_temp.t_env('report_summary', 'idem-rs-1', jsonb_build_object(
      'reportKey', 'report-a-2026-09', 'reportMonth', '2026-09',
      'overallStatus', 'AMBER', 'documentStatus', 'DRAFT',
      'generatedAt', now(), 'coverage', 'FULL',
      'findingCountsBySeverity', jsonb_build_object('warning', 2, 'info', 4),
      'pdfAvailable', true, 'rowVersion', 1
    ))));
  PERFORM pg_temp.t_assert('ingest_report_summary_accepted', v->>'result' = 'accepted', v::text);
END $$;

DO $$
DECLARE v jsonb; v_reports integer; v_events integer;
BEGIN
  SELECT count(*) INTO v_reports FROM operations.reports WHERE report_key = 'report-a-2026-09';
  SELECT count(*) INTO v_events FROM operations.report_events
    WHERE report_id IN (SELECT id FROM operations.reports WHERE report_key = 'report-a-2026-09');
  PERFORM pg_temp.t_assert('report_created_with_generated_event', v_reports = 1 AND v_events = 1,
    'reports=' || v_reports || ' events=' || v_events);
END $$;

DO $$
DECLARE v jsonb; v_status text; v_events integer;
BEGIN
  v := operations_ingest.submit_batch('pub-a', 'test-secret-a-0123456789abcdef', 'nonce-pos-13', repeat('ab', 32),
    jsonb_build_array(pg_temp.t_env('report_summary', 'idem-rs-2', jsonb_build_object(
      'reportKey', 'report-a-2026-09', 'reportMonth', '2026-09',
      'documentStatus', 'APPROVED', 'approvedAt', now(), 'rowVersion', 2
    ))));
  SELECT document_status INTO v_status FROM operations.reports WHERE report_key = 'report-a-2026-09';
  SELECT count(*) INTO v_events FROM operations.report_events
    WHERE report_id IN (SELECT id FROM operations.reports WHERE report_key = 'report-a-2026-09');
  PERFORM pg_temp.t_assert('report_approved_event_appended', v_status = 'APPROVED' AND v_events = 2,
    'status=' || v_status || ' events=' || v_events);
END $$;

DO $$
DECLARE v jsonb; v_status text; v_sent timestamptz; v_events integer;
BEGIN
  v := operations_ingest.submit_batch('pub-a', 'test-secret-a-0123456789abcdef', 'nonce-pos-14', repeat('ab', 32),
    jsonb_build_array(pg_temp.t_env('report_summary', 'idem-rs-3', jsonb_build_object(
      'reportKey', 'report-a-2026-09', 'reportMonth', '2026-09',
      'documentStatus', 'SENT', 'sentAt', now(), 'rowVersion', 3
    ))));
  SELECT document_status, sent_at INTO v_status, v_sent FROM operations.reports WHERE report_key = 'report-a-2026-09';
  SELECT count(*) INTO v_events FROM operations.report_events
    WHERE report_id IN (SELECT id FROM operations.reports WHERE report_key = 'report-a-2026-09');
  PERFORM pg_temp.t_assert('report_sent_transition', v_status = 'SENT' AND v_sent IS NOT NULL AND v_events = 3,
    'status=' || v_status || ' events=' || v_events);
END $$;

DO $$
DECLARE v jsonb; v_status text; v_sent timestamptz; v_attempts integer;
BEGIN
  v := operations_ingest.submit_batch('pub-a', 'test-secret-a-0123456789abcdef', 'nonce-pos-15', repeat('ab', 32),
    jsonb_build_array(pg_temp.t_env('report_summary', 'idem-rs-4', jsonb_build_object(
      'reportKey', 'report-a-2026-09', 'reportMonth', '2026-09',
      'documentStatus', 'DRAFT', 'sendAttemptCount', 1, 'rowVersion', 1
    ))));
  SELECT document_status, sent_at, send_attempt_count INTO v_status, v_sent, v_attempts
  FROM operations.reports WHERE report_key = 'report-a-2026-09';
  PERFORM pg_temp.t_assert('report_sent_never_regressed', v_status = 'SENT' AND v_sent IS NOT NULL AND v_attempts = 1,
    'status=' || v_status || ' attempts=' || v_attempts);
END $$;

DO $$
DECLARE v jsonb; v_findings integer;
BEGIN
  v := operations_ingest.submit_batch('pub-a', 'test-secret-a-0123456789abcdef', 'nonce-pos-16', repeat('ab', 32),
    jsonb_build_array(pg_temp.t_env('report_finding', 'idem-rf-1', jsonb_build_object(
      'reportKey', 'report-a-2026-09', 'findingKey', 'finding-a-1',
      'category', 'workflow', 'severity', 'warning', 'status', 'open',
      'safeTitle', 'Backup watchdog delayed', 'safeSummary', 'Two late runs',
      'safeAction', 'Review schedule'
    ))));
  SELECT count(*) INTO v_findings FROM operations.report_findings WHERE finding_key = 'finding-a-1';
  PERFORM pg_temp.t_assert('ingest_report_finding_accepted', v->>'result' = 'accepted' AND v_findings = 1, v::text);
END $$;

-- ===========================================================================
-- 8. Incident dedupe, occurrence counting and events
-- ===========================================================================

DO $$
DECLARE v jsonb; v_count integer; v_occ integer; v_events integer;
BEGIN
  v := operations_ingest.submit_batch('pub-a', 'test-secret-a-0123456789abcdef', 'nonce-pos-17', repeat('ab', 32),
    jsonb_build_array(pg_temp.t_env('incident', 'idem-inc-2', jsonb_build_object(
      'incidentKey', 'incident-a-1', 'serviceKey', 'site-a', 'state', 'open',
      'severity', 'critical', 'startedAt', now(), 'occurrenceCount', 2
    ))));
  SELECT count(*) INTO v_count FROM operations.incidents WHERE incident_key = 'incident-a-1';
  SELECT occurrence_count INTO v_occ FROM operations.incidents WHERE incident_key = 'incident-a-1';
  SELECT count(*) INTO v_events FROM operations.incident_events
    WHERE incident_id IN (SELECT id FROM operations.incidents WHERE incident_key = 'incident-a-1');
  PERFORM pg_temp.t_assert('incident_occurrences_increment', v_count = 1 AND v_occ = 3 AND v_events = 1,
    'count=' || v_count || ' occ=' || v_occ || ' events=' || v_events);
END $$;

DO $$
DECLARE v jsonb; v_state text; v_events integer;
BEGIN
  v := operations_ingest.submit_batch('pub-a', 'test-secret-a-0123456789abcdef', 'nonce-pos-18', repeat('ab', 32),
    jsonb_build_array(pg_temp.t_env('incident', 'idem-inc-3', jsonb_build_object(
      'incidentKey', 'incident-a-1', 'serviceKey', 'site-a', 'state', 'recovered',
      'severity', 'warning', 'startedAt', now(), 'recoveredAt', now()
    ))));
  SELECT state INTO v_state FROM operations.incidents WHERE incident_key = 'incident-a-1';
  SELECT count(*) INTO v_events FROM operations.incident_events
    WHERE incident_id IN (SELECT id FROM operations.incidents WHERE incident_key = 'incident-a-1');
  PERFORM pg_temp.t_assert('incident_recovery_event_appended', v_state = 'recovered' AND v_events = 2,
    'state=' || v_state || ' events=' || v_events);
END $$;

-- ===========================================================================
-- 9. Report commands (owner function; stale/replay/role guards)
-- ===========================================================================

RESET ROLE;
SET ROLE operations_owner;
SET operations.global_role = 'cloud_owner';

DO $$
DECLARE v_id uuid; v_count integer;
  v_report uuid; v_owner uuid;
BEGIN
  SELECT id INTO v_report FROM operations.reports WHERE report_key = 'report-a-2026-09';
  SELECT id INTO v_owner FROM operations.user_profiles WHERE email = 'owner@test.invalid';
  v_id := operations_private.create_report_command(
    'cmd-1', 'report-a-2026-09', 'RETRY_SEND', 3, 'SENT',
    'nonce-cmd-1', now() + interval '5 minutes', v_owner,
    (SELECT id FROM operations.clients WHERE client_key = 'test-client-a')
  );
  SELECT count(*) INTO v_count FROM operations.report_commands WHERE id = v_id;
  PERFORM pg_temp.t_assert('command_created_for_owner', v_count = 1, 'id=' || v_id::text);
END $$;

DO $$
DECLARE v_owner uuid;
BEGIN
  SELECT id INTO v_owner FROM operations.user_profiles WHERE email = 'owner@test.invalid';
  PERFORM operations_private.create_report_command(
    'cmd-2', 'report-a-2026-09', 'RETRY_SEND', 99, 'DRAFT',
    'nonce-cmd-2', now() + interval '5 minutes', v_owner,
    (SELECT id FROM operations.clients WHERE client_key = 'test-client-a')
  );
  PERFORM pg_temp.t_assert('command_stale_version_rejected', false, 'created');
EXCEPTION WHEN raise_exception THEN
  PERFORM pg_temp.t_assert('command_stale_version_rejected', SQLERRM = 'rejected_stale_version', SQLERRM);
END $$;

DO $$
DECLARE v_owner uuid;
BEGIN
  SELECT id INTO v_owner FROM operations.user_profiles WHERE email = 'owner@test.invalid';
  PERFORM operations_private.create_report_command(
    'cmd-3', 'report-a-2026-09', 'RETRY_SEND', 3, 'SENT',
    'nonce-cmd-1', now() + interval '5 minutes', v_owner,
    (SELECT id FROM operations.clients WHERE client_key = 'test-client-a')
  );
  PERFORM pg_temp.t_assert('command_nonce_replay_rejected', false, 'created');
EXCEPTION WHEN raise_exception THEN
  PERFORM pg_temp.t_assert('command_nonce_replay_rejected', SQLERRM = 'rejected_replay', SQLERRM);
END $$;

DO $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM pg_temp.fx_users WHERE email = 'viewer-a@test.invalid';
  PERFORM set_config('operations.global_role', 'client_viewer', false);
  PERFORM set_config('operations.user_id', v_id::text, false);
END $$;

DO $$
DECLARE v_owner uuid;
BEGIN
  PERFORM operations_private.create_report_command(
    'cmd-4', 'report-a-2026-09', 'RETRY_SEND', 3, 'SENT',
    'nonce-cmd-4', now() + interval '5 minutes', NULL,
    (SELECT id FROM operations.clients WHERE client_key = 'test-client-a')
  );
  PERFORM pg_temp.t_assert('command_viewer_context_rejected', false, 'created');
EXCEPTION WHEN raise_exception THEN
  PERFORM pg_temp.t_assert('command_viewer_context_rejected', SQLERRM = 'denied_role', SQLERRM);
END $$;

RESET operations.global_role;
RESET operations.user_id;

-- ===========================================================================
-- 10. Append-only enforcement (even the provisioning admin is blocked)
-- ===========================================================================

RESET ROLE;

DO $$
BEGIN
  UPDATE operations.audit_events SET result = 'error' WHERE event_key = 'n8n-test-event-1';
  PERFORM pg_temp.t_assert('append_only_audit_update', false, 'updated');
EXCEPTION WHEN raise_exception THEN
  PERFORM pg_temp.t_assert('append_only_audit_update', SQLERRM = 'append_only_table', SQLERRM);
END $$;

DO $$
BEGIN
  DELETE FROM operations.report_events WHERE event_type = 'GENERATED';
  PERFORM pg_temp.t_assert('append_only_report_events_delete', false, 'deleted');
EXCEPTION WHEN raise_exception THEN
  PERFORM pg_temp.t_assert('append_only_report_events_delete', SQLERRM = 'append_only_table', SQLERRM);
END $$;

DO $$
BEGIN
  DELETE FROM operations.incident_events WHERE event_type = 'detected';
  PERFORM pg_temp.t_assert('append_only_incident_events_delete', false, 'deleted');
EXCEPTION WHEN raise_exception THEN
  PERFORM pg_temp.t_assert('append_only_incident_events_delete', SQLERRM = 'append_only_table', SQLERRM);
END $$;

DO $$
BEGIN
  UPDATE operations.ingestion_receipts SET accepted_count = 99;
  PERFORM pg_temp.t_assert('append_only_receipts_update', false, 'updated');
EXCEPTION WHEN raise_exception THEN
  PERFORM pg_temp.t_assert('append_only_receipts_update', SQLERRM = 'append_only_table', SQLERRM);
END $$;

DO $$
BEGIN
  DELETE FROM operations.ingestion_receipts;
  PERFORM pg_temp.t_assert('append_only_receipts_delete', false, 'deleted');
EXCEPTION WHEN raise_exception THEN
  PERFORM pg_temp.t_assert('append_only_receipts_delete', SQLERRM = 'append_only_table', SQLERRM);
END $$;

-- ===========================================================================
-- 11. Secret hygiene and response shape
-- ===========================================================================

DO $$
DECLARE v_hash text;
BEGIN
  SELECT key_hash INTO v_hash FROM operations.publishers WHERE publisher_key = 'pub-a';
  PERFORM pg_temp.t_assert('publisher_secret_not_stored_recoverably',
    v_hash IS NOT NULL AND v_hash <> 'test-secret-a-0123456789abcdef'
    AND v_hash NOT LIKE '%test-secret-a%',
    'hash present and does not contain the secret');
END $$;

DO $$
DECLARE v jsonb; v_bad integer;
BEGIN
  v := operations_ingest.submit_batch('pub-a', 'test-secret-a-0123456789abcdef', 'nonce-shape-1', repeat('ab', 32),
    jsonb_build_array(pg_temp.t_env('workflow_execution', 'idem-shape-1', jsonb_build_object(
      'workflowKey', 'wf.backup', 'executionKey', 'exec-shape', 'outcome', 'success'
    ))));
  SELECT count(*) INTO v_bad
  FROM jsonb_object_keys(v) AS k
  WHERE NOT (k IN ('receiptId', 'result', 'accepted', 'duplicates', 'rejected', 'code'));
  PERFORM pg_temp.t_assert('ingest_response_safe_keys_only', v_bad = 0, v::text);
END $$;

DO $$
DECLARE v_leak integer;
BEGIN
  SELECT count(*) INTO v_leak
  FROM operations.ingestion_receipts
  WHERE batch_digest LIKE '%secret%' OR batch_nonce LIKE '%secret%';
  PERFORM pg_temp.t_assert('receipts_carry_no_secrets', v_leak = 0, 'leaks=' || v_leak);
END $$;

-- ===========================================================================
-- Results (printed before the rollback)
-- ===========================================================================

SELECT
  name,
  CASE passed WHEN true THEN 'PASS' ELSE 'FAIL' END AS status,
  detail
FROM test_results
ORDER BY id;

SELECT count(*) AS total,
       count(*) FILTER (WHERE passed) AS passed,
       count(*) FILTER (WHERE NOT passed) AS failed
FROM test_results;

ROLLBACK;
