-- CloudIT Operations Portal — Phase 3 migration 0003: grants, RLS, guards.
--
-- Implements the Phase 0 specification section 8.2 security model:
--   * anonymous (operations_anon): no grants on any portal schema, table,
--     function or view;
--   * the portal application role (operations_owner) receives only the
--     explicit grants it needs. It can maintain catalogue/config tables and
--     SELECT evidence, but has no direct INSERT/UPDATE/DELETE on evidence,
--     reports, commands, incidents, receipts or audit tables — those writes
--     happen only through narrowly scoped security-definer functions;
--   * every tenant table has row-level security with an active-membership
--     policy. A per-transaction setting declares the acting portal identity:
--       SET LOCAL operations.global_role = 'cloud_owner';
--       SET LOCAL operations.user_id   = '<user_profiles uuid>';
--     cloud_owner sees all clients; any other role sees only clients with an
--     active membership for that active user. With no GUC set the policy is
--     fail-closed (zero rows);
--   * audit_events, report_events, incident_events and ingestion_receipts
--     are append-only for portal users and ingestion publishers. Updates and
--     deletes are blocked by trigger for every role except the future,
--     separately approved operations_maintenance role;
--   * helper functions live in the private operations_private schema with an
--     empty search_path and revoked PUBLIC execution.

BEGIN;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

REVOKE ALL ON ALL TABLES IN SCHEMA operations FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA operations FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA operations_private FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA operations_private FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA operations_ingest FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA operations_ingest FROM PUBLIC;

GRANT USAGE ON SCHEMA operations TO operations_owner;

-- Evidence and audit tables are read-only for the portal role.
GRANT SELECT ON
  operations.workflow_executions,
  operations.metric_samples,
  operations.endpoint_observations,
  operations.provider_connections,
  operations.deployments,
  operations.backup_evidence,
  operations.restore_tests,
  operations.reports,
  operations.report_findings,
  operations.report_events,
  operations.report_commands,
  operations.incidents,
  operations.incident_events,
  operations.audit_events,
  operations.ingestion_receipts
TO operations_owner;

-- Catalogue/config tables may be maintained by the portal owner.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  operations.clients,
  operations.environments,
  operations.domains,
  operations.endpoints,
  operations.user_profiles,
  operations.client_memberships,
  operations.publishers,
  operations.workflow_definitions,
  operations.workflow_steps,
  operations.metric_definitions
TO operations_owner;

GRANT SELECT ON operations.publishers TO operations_owner;

ALTER DEFAULT PRIVILEGES IN SCHEMA operations
  GRANT SELECT ON TABLES TO operations_owner;

-- The ingestion login has no table grants whatsoever; it can only EXECUTE
-- functions in the private operations_ingest schema (granted in migration
-- 0004). The anonymous role keeps its zero-grant state.

-- ---------------------------------------------------------------------------
-- Private helpers (security definer, empty search_path, no PUBLIC execute)
-- ---------------------------------------------------------------------------

-- Row-scope check used by every RLS policy. SECURITY DEFINER (owned by the
-- provisioning superuser) so the membership lookup is not itself restricted
-- by RLS; fail-closed when the acting identity GUCs are absent or invalid.
CREATE OR REPLACE FUNCTION operations_private.has_client_access(p_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $func$
  SELECT
    COALESCE(current_setting('operations.global_role', true), '') = 'cloud_owner'
    OR EXISTS (
      SELECT 1
      FROM operations.client_memberships AS m
      JOIN operations.user_profiles AS u ON u.id = m.user_id
      WHERE m.client_id = p_client_id
        AND m.state = 'active'
        AND u.state = 'active'
        AND u.id = NULLIF(current_setting('operations.user_id', true), '')::uuid
    );
$func$;

-- True only when the acting portal identity is the cloud owner. DML policies
-- on catalogue/config tables require this in addition to row scope, so a
-- viewer-context transaction is structurally read-only even where the
-- connection role holds table DML grants.
CREATE OR REPLACE FUNCTION operations_private.is_owner_context()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $func$
  SELECT COALESCE(current_setting('operations.global_role', true), '') = 'cloud_owner';
$func$;

GRANT EXECUTE ON FUNCTION operations_private.is_owner_context() TO operations_owner;

-- Append-only guard: blocks UPDATE and DELETE on mirror/audit tables for
-- every role except the future, separately approved maintenance role.
CREATE OR REPLACE FUNCTION operations_private.deny_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
BEGIN
  IF session_user = 'operations_maintenance' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'append_only_table' USING ERRCODE = 'P0001';
END;
$func$;

-- Maintains updated_at on mutable catalogue tables.
CREATE OR REPLACE FUNCTION operations_private.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$func$;

-- client_key is immutable once provisioned.
CREATE OR REPLACE FUNCTION operations_private.prevent_client_key_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
BEGIN
  IF NEW.client_key <> OLD.client_key THEN
    RAISE EXCEPTION 'client_key_is_immutable' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$func$;

-- Single audit entry point for the portal. The portal role has no direct
-- INSERT on operations.audit_events; it must call this function, which
-- validates shape and stamps the event key.
CREATE OR REPLACE FUNCTION operations_private.record_audit_event(
  p_actor_type text,
  p_actor_key text,
  p_action text,
  p_target_type text DEFAULT NULL,
  p_target_key text DEFAULT NULL,
  p_result text DEFAULT 'success',
  p_client_id uuid DEFAULT NULL,
  p_command_key text DEFAULT NULL,
  p_safe_reason_code text DEFAULT NULL,
  p_correlation_key text DEFAULT NULL,
  p_occurred_at timestamptz DEFAULT now(),
  p_event_key text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO operations.audit_events (
    event_key, client_id, actor_type, actor_key, action, target_type, target_key,
    result, occurred_at, command_key, safe_reason_code, correlation_key
  ) VALUES (
    COALESCE(NULLIF(p_event_key, ''), gen_random_uuid()::text),
    p_client_id,
    p_actor_type,
    p_actor_key,
    p_action,
    NULLIF(p_target_type, ''),
    NULLIF(p_target_key, ''),
    p_result,
    p_occurred_at,
    NULLIF(p_command_key, ''),
    NULLIF(p_safe_reason_code, ''),
    NULLIF(p_correlation_key, '')
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$func$;

-- Guarded report-command creation for the portal (Phase 10 uses this; the
-- portal role has no direct INSERT on operations.report_commands). The
-- function checks role expectation, report state and nonce uniqueness so a
-- stale, replayed or wrong-state command is refused before it is recorded.
CREATE OR REPLACE FUNCTION operations_private.create_report_command(
  p_command_key text,
  p_report_key text,
  p_command_type text,
  p_expected_row_version integer,
  p_expected_state text,
  p_nonce text,
  p_expires_at timestamptz,
  p_requested_by uuid DEFAULT NULL,
  p_client_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_report operations.reports%ROWTYPE;
  v_id uuid;
BEGIN
  IF NOT operations_private.is_owner_context() THEN
    PERFORM operations_private.record_audit_event(
      'portal_user', COALESCE(p_requested_by::text, 'unknown'),
      'report.command.request', 'report', p_report_key,
      'denied', p_client_id, p_command_key, 'denied_role'
    );
    RAISE EXCEPTION 'denied_role' USING ERRCODE = 'P0001';
  END IF;

  IF p_command_type NOT IN ('APPROVE_AND_SEND', 'REJECT', 'RETRY_SEND') THEN
    RAISE EXCEPTION 'unsupported_command_type' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_report
  FROM operations.reports
  WHERE client_id = p_client_id AND report_key = p_report_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown_report' USING ERRCODE = 'P0001';
  END IF;

  IF v_report.row_version IS DISTINCT FROM p_expected_row_version
     OR v_report.document_status IS DISTINCT FROM p_expected_state THEN
    PERFORM operations_private.record_audit_event(
      'portal_user', COALESCE(p_requested_by::text, 'unknown'),
      'report.command.request', 'report', p_report_key,
      'denied', p_client_id, p_command_key, 'rejected_stale_version'
    );
    RAISE EXCEPTION 'rejected_stale_version' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO operations.report_commands (
    client_id, report_id, command_key, command_type, expected_row_version,
    expected_state, nonce, expires_at, requested_by
  ) VALUES (
    p_client_id, v_report.id, p_command_key, p_command_type,
    p_expected_row_version, p_expected_state, p_nonce, p_expires_at, p_requested_by
  )
  ON CONFLICT (nonce) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    PERFORM operations_private.record_audit_event(
      'portal_user', COALESCE(p_requested_by::text, 'unknown'),
      'report.command.request', 'report', p_report_key,
      'denied', p_client_id, p_command_key, 'rejected_replay'
    );
    RAISE EXCEPTION 'rejected_replay' USING ERRCODE = 'P0001';
  END IF;

  RETURN v_id;
END;
$func$;

GRANT USAGE ON SCHEMA operations_private TO operations_owner;
GRANT EXECUTE ON FUNCTION operations_private.has_client_access(uuid) TO operations_owner;
GRANT EXECUTE ON FUNCTION operations_private.record_audit_event(text, text, text, text, text, text, uuid, text, text, text, timestamptz, text) TO operations_owner;
GRANT EXECUTE ON FUNCTION operations_private.create_report_command(text, text, text, integer, text, text, timestamptz, uuid, uuid) TO operations_owner;

-- ---------------------------------------------------------------------------
-- Row level security: active-membership tenant isolation
-- ---------------------------------------------------------------------------

ALTER TABLE operations.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations.environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations.domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations.endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations.client_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations.publishers ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations.ingestion_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations.workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations.workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations.workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations.metric_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations.metric_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations.endpoint_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations.provider_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations.deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations.backup_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations.restore_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations.report_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations.report_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations.report_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations.incident_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations.audit_events ENABLE ROW LEVEL SECURITY;

-- user_profiles and client_memberships are global identity tables; the
-- portal may manage them but only the cloud_owner acting identity may do so.
DROP POLICY IF EXISTS global_owner_only ON operations.user_profiles;
CREATE POLICY global_owner_only ON operations.user_profiles
  FOR ALL TO operations_owner
  USING (COALESCE(current_setting('operations.global_role', true), '') = 'cloud_owner')
  WITH CHECK (COALESCE(current_setting('operations.global_role', true), '') = 'cloud_owner');

DROP POLICY IF EXISTS global_owner_only ON operations.client_memberships;
CREATE POLICY global_owner_only ON operations.client_memberships
  FOR ALL TO operations_owner
  USING (COALESCE(current_setting('operations.global_role', true), '') = 'cloud_owner')
  WITH CHECK (COALESCE(current_setting('operations.global_role', true), '') = 'cloud_owner');

DROP POLICY IF EXISTS tenant_isolation ON operations.clients;
CREATE POLICY tenant_isolation ON operations.clients
  FOR ALL TO operations_owner
  USING (operations_private.has_client_access(id))
  WITH CHECK (operations_private.has_client_access(id) AND operations_private.is_owner_context());

DROP POLICY IF EXISTS tenant_isolation ON operations.environments;
CREATE POLICY tenant_isolation ON operations.environments
  FOR ALL TO operations_owner
  USING (operations_private.has_client_access(client_id))
  WITH CHECK (operations_private.has_client_access(client_id) AND operations_private.is_owner_context());

DROP POLICY IF EXISTS tenant_isolation ON operations.domains;
CREATE POLICY tenant_isolation ON operations.domains
  FOR ALL TO operations_owner
  USING (operations_private.has_client_access(client_id))
  WITH CHECK (operations_private.has_client_access(client_id) AND operations_private.is_owner_context());

DROP POLICY IF EXISTS tenant_isolation ON operations.endpoints;
CREATE POLICY tenant_isolation ON operations.endpoints
  FOR ALL TO operations_owner
  USING (operations_private.has_client_access(client_id))
  WITH CHECK (operations_private.has_client_access(client_id) AND operations_private.is_owner_context());

DROP POLICY IF EXISTS tenant_isolation ON operations.publishers;
CREATE POLICY tenant_isolation ON operations.publishers
  FOR ALL TO operations_owner
  USING (operations_private.has_client_access(client_id))
  WITH CHECK (operations_private.has_client_access(client_id) AND operations_private.is_owner_context());

DROP POLICY IF EXISTS tenant_isolation ON operations.ingestion_receipts;
CREATE POLICY tenant_isolation ON operations.ingestion_receipts
  FOR ALL TO operations_owner
  USING (operations_private.has_client_access(client_id))
  WITH CHECK (operations_private.has_client_access(client_id));

DROP POLICY IF EXISTS tenant_isolation ON operations.workflow_definitions;
CREATE POLICY tenant_isolation ON operations.workflow_definitions
  FOR ALL TO operations_owner
  USING (operations_private.has_client_access(client_id))
  WITH CHECK (operations_private.has_client_access(client_id) AND operations_private.is_owner_context());

DROP POLICY IF EXISTS tenant_isolation ON operations.workflow_steps;
CREATE POLICY tenant_isolation ON operations.workflow_steps
  FOR ALL TO operations_owner
  USING (operations_private.has_client_access(client_id))
  WITH CHECK (operations_private.has_client_access(client_id) AND operations_private.is_owner_context());

DROP POLICY IF EXISTS tenant_isolation ON operations.workflow_executions;
CREATE POLICY tenant_isolation ON operations.workflow_executions
  FOR ALL TO operations_owner
  USING (operations_private.has_client_access(client_id))
  WITH CHECK (operations_private.has_client_access(client_id));

DROP POLICY IF EXISTS tenant_isolation ON operations.metric_definitions;
CREATE POLICY tenant_isolation ON operations.metric_definitions
  FOR ALL TO operations_owner
  USING (operations_private.has_client_access(client_id))
  WITH CHECK (operations_private.has_client_access(client_id) AND operations_private.is_owner_context());

DROP POLICY IF EXISTS tenant_isolation ON operations.metric_samples;
CREATE POLICY tenant_isolation ON operations.metric_samples
  FOR ALL TO operations_owner
  USING (operations_private.has_client_access(client_id))
  WITH CHECK (operations_private.has_client_access(client_id));

DROP POLICY IF EXISTS tenant_isolation ON operations.endpoint_observations;
CREATE POLICY tenant_isolation ON operations.endpoint_observations
  FOR ALL TO operations_owner
  USING (operations_private.has_client_access(client_id))
  WITH CHECK (operations_private.has_client_access(client_id));

DROP POLICY IF EXISTS tenant_isolation ON operations.provider_connections;
CREATE POLICY tenant_isolation ON operations.provider_connections
  FOR ALL TO operations_owner
  USING (operations_private.has_client_access(client_id))
  WITH CHECK (operations_private.has_client_access(client_id));

DROP POLICY IF EXISTS tenant_isolation ON operations.deployments;
CREATE POLICY tenant_isolation ON operations.deployments
  FOR ALL TO operations_owner
  USING (operations_private.has_client_access(client_id))
  WITH CHECK (operations_private.has_client_access(client_id));

DROP POLICY IF EXISTS tenant_isolation ON operations.backup_evidence;
CREATE POLICY tenant_isolation ON operations.backup_evidence
  FOR ALL TO operations_owner
  USING (operations_private.has_client_access(client_id))
  WITH CHECK (operations_private.has_client_access(client_id));

DROP POLICY IF EXISTS tenant_isolation ON operations.restore_tests;
CREATE POLICY tenant_isolation ON operations.restore_tests
  FOR ALL TO operations_owner
  USING (operations_private.has_client_access(client_id))
  WITH CHECK (operations_private.has_client_access(client_id));

DROP POLICY IF EXISTS tenant_isolation ON operations.reports;
CREATE POLICY tenant_isolation ON operations.reports
  FOR ALL TO operations_owner
  USING (operations_private.has_client_access(client_id))
  WITH CHECK (operations_private.has_client_access(client_id));

DROP POLICY IF EXISTS tenant_isolation ON operations.report_findings;
CREATE POLICY tenant_isolation ON operations.report_findings
  FOR ALL TO operations_owner
  USING (operations_private.has_client_access(client_id))
  WITH CHECK (operations_private.has_client_access(client_id));

DROP POLICY IF EXISTS tenant_isolation ON operations.report_events;
CREATE POLICY tenant_isolation ON operations.report_events
  FOR ALL TO operations_owner
  USING (operations_private.has_client_access(client_id))
  WITH CHECK (operations_private.has_client_access(client_id));

DROP POLICY IF EXISTS tenant_isolation ON operations.report_commands;
CREATE POLICY tenant_isolation ON operations.report_commands
  FOR ALL TO operations_owner
  USING (operations_private.has_client_access(client_id))
  WITH CHECK (operations_private.has_client_access(client_id));

DROP POLICY IF EXISTS tenant_isolation ON operations.incidents;
CREATE POLICY tenant_isolation ON operations.incidents
  FOR ALL TO operations_owner
  USING (operations_private.has_client_access(client_id))
  WITH CHECK (operations_private.has_client_access(client_id));

DROP POLICY IF EXISTS tenant_isolation ON operations.incident_events;
CREATE POLICY tenant_isolation ON operations.incident_events
  FOR ALL TO operations_owner
  USING (operations_private.has_client_access(client_id))
  WITH CHECK (operations_private.has_client_access(client_id));

-- Audit rows with no client belong to global (owner-visible) scope only.
DROP POLICY IF EXISTS tenant_isolation ON operations.audit_events;
CREATE POLICY tenant_isolation ON operations.audit_events
  FOR ALL TO operations_owner
  USING (client_id IS NULL OR operations_private.has_client_access(client_id))
  WITH CHECK (
    COALESCE(current_setting('operations.global_role', true), '') = 'cloud_owner'
    AND (client_id IS NULL OR operations_private.has_client_access(client_id))
  );

-- ---------------------------------------------------------------------------
-- Append-only and maintenance triggers
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_audit_events_append_only ON operations.audit_events;
CREATE TRIGGER trg_audit_events_append_only
  BEFORE UPDATE OR DELETE ON operations.audit_events
  FOR EACH ROW EXECUTE FUNCTION operations_private.deny_mutation();

DROP TRIGGER IF EXISTS trg_report_events_append_only ON operations.report_events;
CREATE TRIGGER trg_report_events_append_only
  BEFORE UPDATE OR DELETE ON operations.report_events
  FOR EACH ROW EXECUTE FUNCTION operations_private.deny_mutation();

DROP TRIGGER IF EXISTS trg_incident_events_append_only ON operations.incident_events;
CREATE TRIGGER trg_incident_events_append_only
  BEFORE UPDATE OR DELETE ON operations.incident_events
  FOR EACH ROW EXECUTE FUNCTION operations_private.deny_mutation();

DROP TRIGGER IF EXISTS trg_ingestion_receipts_append_only ON operations.ingestion_receipts;
CREATE TRIGGER trg_ingestion_receipts_append_only
  BEFORE UPDATE OR DELETE ON operations.ingestion_receipts
  FOR EACH ROW EXECUTE FUNCTION operations_private.deny_mutation();

DROP TRIGGER IF EXISTS trg_clients_updated_at ON operations.clients;
CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON operations.clients
  FOR EACH ROW EXECUTE FUNCTION operations_private.touch_updated_at();

DROP TRIGGER IF EXISTS trg_clients_key_immutable ON operations.clients;
CREATE TRIGGER trg_clients_key_immutable
  BEFORE UPDATE ON operations.clients
  FOR EACH ROW EXECUTE FUNCTION operations_private.prevent_client_key_change();

DROP TRIGGER IF EXISTS trg_environments_updated_at ON operations.environments;
CREATE TRIGGER trg_environments_updated_at
  BEFORE UPDATE ON operations.environments
  FOR EACH ROW EXECUTE FUNCTION operations_private.touch_updated_at();

DROP TRIGGER IF EXISTS trg_domains_updated_at ON operations.domains;
CREATE TRIGGER trg_domains_updated_at
  BEFORE UPDATE ON operations.domains
  FOR EACH ROW EXECUTE FUNCTION operations_private.touch_updated_at();

DROP TRIGGER IF EXISTS trg_endpoints_updated_at ON operations.endpoints;
CREATE TRIGGER trg_endpoints_updated_at
  BEFORE UPDATE ON operations.endpoints
  FOR EACH ROW EXECUTE FUNCTION operations_private.touch_updated_at();

DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON operations.user_profiles;
CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON operations.user_profiles
  FOR EACH ROW EXECUTE FUNCTION operations_private.touch_updated_at();

DROP TRIGGER IF EXISTS trg_client_memberships_updated_at ON operations.client_memberships;
CREATE TRIGGER trg_client_memberships_updated_at
  BEFORE UPDATE ON operations.client_memberships
  FOR EACH ROW EXECUTE FUNCTION operations_private.touch_updated_at();

DROP TRIGGER IF EXISTS trg_publishers_updated_at ON operations.publishers;
CREATE TRIGGER trg_publishers_updated_at
  BEFORE UPDATE ON operations.publishers
  FOR EACH ROW EXECUTE FUNCTION operations_private.touch_updated_at();

DROP TRIGGER IF EXISTS trg_workflow_definitions_updated_at ON operations.workflow_definitions;
CREATE TRIGGER trg_workflow_definitions_updated_at
  BEFORE UPDATE ON operations.workflow_definitions
  FOR EACH ROW EXECUTE FUNCTION operations_private.touch_updated_at();

DROP TRIGGER IF EXISTS trg_workflow_steps_updated_at ON operations.workflow_steps;
CREATE TRIGGER trg_workflow_steps_updated_at
  BEFORE UPDATE ON operations.workflow_steps
  FOR EACH ROW EXECUTE FUNCTION operations_private.touch_updated_at();

DROP TRIGGER IF EXISTS trg_metric_definitions_updated_at ON operations.metric_definitions;
CREATE TRIGGER trg_metric_definitions_updated_at
  BEFORE UPDATE ON operations.metric_definitions
  FOR EACH ROW EXECUTE FUNCTION operations_private.touch_updated_at();

DROP TRIGGER IF EXISTS trg_reports_updated_at ON operations.reports;
CREATE TRIGGER trg_reports_updated_at
  BEFORE UPDATE ON operations.reports
  FOR EACH ROW EXECUTE FUNCTION operations_private.touch_updated_at();

DROP TRIGGER IF EXISTS trg_report_findings_updated_at ON operations.report_findings;
CREATE TRIGGER trg_report_findings_updated_at
  BEFORE UPDATE ON operations.report_findings
  FOR EACH ROW EXECUTE FUNCTION operations_private.touch_updated_at();

DROP TRIGGER IF EXISTS trg_report_commands_updated_at ON operations.report_commands;
CREATE TRIGGER trg_report_commands_updated_at
  BEFORE UPDATE ON operations.report_commands
  FOR EACH ROW EXECUTE FUNCTION operations_private.touch_updated_at();

DROP TRIGGER IF EXISTS trg_incidents_updated_at ON operations.incidents;
CREATE TRIGGER trg_incidents_updated_at
  BEFORE UPDATE ON operations.incidents
  FOR EACH ROW EXECUTE FUNCTION operations_private.touch_updated_at();

COMMIT;
