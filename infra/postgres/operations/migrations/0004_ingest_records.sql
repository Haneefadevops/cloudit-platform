
-- ---------------------------------------------------------------------------
-- Per-record-type writers. Each returns 'inserted' or 'duplicate'.
-- Every writer enforces the strict payload contract of Phase 0 section 7.3;
-- tenant identity always comes from the authenticated publisher row.
-- ---------------------------------------------------------------------------

BEGIN;

CREATE OR REPLACE FUNCTION operations_ingest.insert_workflow_catalog(p_pub operations.publishers, p_env operations_ingest.envelope)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_payload jsonb := p_env.payload;
  v_steps jsonb;
  v_id uuid;
BEGIN
  PERFORM operations_ingest.check_payload_keys(v_payload, ARRAY[
    'workflowKey', 'displayName', 'triggerKind', 'scheduleExpression',
    'scheduleTimezone', 'enabled', 'expectedStartRule', 'completionSlaSeconds',
    'criticality', 'safeStepKeys'
  ]);

  PERFORM 1 FROM operations.workflow_definitions
  WHERE publisher_id = p_pub.id AND source_record_type = 'workflow_catalog'
    AND idempotency_key = p_env.idempotency_key;
  IF FOUND THEN RETURN 'duplicate'; END IF;

  v_steps := v_payload -> 'safeStepKeys';
  IF v_steps IS NOT NULL AND jsonb_typeof(v_steps) <> 'array' THEN
    PERFORM operations_ingest.fail('invalid_field_type');
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(COALESCE(v_steps, '[]'::jsonb)) AS s
    WHERE NOT (s ~ '^[a-z0-9][a-z0-9_.-]{0,63}$')
  ) THEN
    PERFORM operations_ingest.fail('invalid_step_key');
  END IF;

  INSERT INTO operations.workflow_definitions (
    client_id, environment_id, workflow_key, display_name, trigger_kind,
    schedule_expression, schedule_timezone, enabled, expected_start_rule,
    completion_sla_seconds, criticality, publisher_id, idempotency_key, observed_at
  ) VALUES (
    p_pub.client_id, p_pub.environment_id,
    operations_ingest.req_text(v_payload, 'workflowKey', 80),
    operations_ingest.safe_text(operations_ingest.req_text(v_payload, 'displayName', 160), 160),
    COALESCE(operations_ingest.opt_enum(v_payload, 'triggerKind', operations_ingest.allowed_trigger_kinds(), 'invalid_trigger_kind'), 'unknown'),
    operations_ingest.opt_text(v_payload, 'scheduleExpression', 200),
    COALESCE(operations_ingest.opt_text(v_payload, 'scheduleTimezone', 64), 'Europe/Malta'),
    COALESCE(operations_ingest.opt_bool(v_payload, 'enabled'), true),
    operations_ingest.safe_text(operations_ingest.opt_text(v_payload, 'expectedStartRule', 200), 200),
    operations_ingest.opt_int(v_payload, 'completionSlaSeconds', 1, 604800),
    COALESCE(operations_ingest.opt_enum(v_payload, 'criticality', ARRAY['critical', 'high', 'standard', 'low'], 'invalid_criticality'), 'standard'),
    p_pub.id, p_env.idempotency_key, p_env.observed_at
  )
  ON CONFLICT (client_id, environment_id, workflow_key) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    trigger_kind = EXCLUDED.trigger_kind,
    schedule_expression = EXCLUDED.schedule_expression,
    schedule_timezone = EXCLUDED.schedule_timezone,
    enabled = EXCLUDED.enabled,
    expected_start_rule = EXCLUDED.expected_start_rule,
    completion_sla_seconds = EXCLUDED.completion_sla_seconds,
    criticality = EXCLUDED.criticality,
    version = operations.workflow_definitions.version + 1,
    publisher_id = EXCLUDED.publisher_id,
    idempotency_key = EXCLUDED.idempotency_key,
    observed_at = EXCLUDED.observed_at,
    updated_at = now()
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN RETURN 'duplicate'; END IF;
  RETURN 'inserted';
END;
$func$;

CREATE OR REPLACE FUNCTION operations_ingest.insert_workflow_execution(p_pub operations.publishers, p_env operations_ingest.envelope)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_payload jsonb := p_env.payload;
  v_workflow_key text;
  v_def uuid;
  v_id uuid;
BEGIN
  PERFORM operations_ingest.check_payload_keys(v_payload, ARRAY[
    'workflowKey', 'executionKey', 'triggerKind', 'scheduledFor', 'startedAt',
    'finishedAt', 'durationMs', 'scheduleDelayMs', 'outcome', 'failureCategory',
    'failureCode', 'attempt', 'sourceRevisionKey'
  ]);
  v_workflow_key := operations_ingest.req_text(v_payload, 'workflowKey', 80);

  SELECT id INTO v_def FROM operations.workflow_definitions
  WHERE client_id = p_pub.client_id AND environment_id = p_pub.environment_id
    AND workflow_key = v_workflow_key;
  IF NOT FOUND THEN PERFORM operations_ingest.fail('unknown_workflow'); END IF;

  INSERT INTO operations.workflow_executions (
    client_id, environment_id, workflow_definition_id, execution_key, trigger_kind,
    scheduled_for, started_at, finished_at, duration_ms, schedule_delay_ms, outcome,
    failure_category, failure_code, attempt, source_revision_key, source_system,
    status, severity, correlation_key, observed_at, publisher_id, idempotency_key
  ) VALUES (
    p_pub.client_id, p_pub.environment_id, v_def,
    operations_ingest.req_text(v_payload, 'executionKey', 160),
    operations_ingest.opt_enum(v_payload, 'triggerKind', operations_ingest.allowed_trigger_kinds(), 'invalid_trigger_kind'),
    operations_ingest.opt_ts(v_payload, 'scheduledFor'),
    operations_ingest.opt_ts(v_payload, 'startedAt'),
    operations_ingest.opt_ts(v_payload, 'finishedAt'),
    operations_ingest.opt_int(v_payload, 'durationMs', 0, 86400000),
    operations_ingest.opt_int(v_payload, 'scheduleDelayMs', 0, 86400000),
    operations_ingest.req_enum(v_payload, 'outcome', ARRAY['success', 'failure', 'cancelled', 'waiting', 'missed'], 'invalid_outcome'),
    operations_ingest.opt_enum(v_payload, 'failureCategory', operations_ingest.allowed_failure_categories(), 'invalid_failure_category'),
    operations_ingest.opt_text(v_payload, 'failureCode', 80),
    COALESCE(operations_ingest.opt_int(v_payload, 'attempt', 1, 100), 1),
    operations_ingest.opt_text(v_payload, 'sourceRevisionKey', 160),
    p_env.source_system, p_env.status, p_env.severity, p_env.correlation_key,
    p_env.observed_at, p_pub.id, p_env.idempotency_key
  )
  ON CONFLICT (publisher_id, source_record_type, idempotency_key) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN RETURN 'duplicate'; END IF;
  RETURN 'inserted';
END;
$func$;

CREATE OR REPLACE FUNCTION operations_ingest.insert_endpoint_observation(p_pub operations.publishers, p_env operations_ingest.envelope)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_payload jsonb := p_env.payload;
  v_endpoint_key text;
  v_endpoint uuid;
  v_id uuid;
BEGIN
  PERFORM operations_ingest.check_payload_keys(v_payload, ARRAY[
    'endpointKey', 'checkedAt', 'available', 'httpStatusClass', 'httpStatus',
    'responseTimeMs', 'tlsDaysRemaining', 'confirmationState', 'monitorKey'
  ]);
  v_endpoint_key := operations_ingest.req_text(v_payload, 'endpointKey', 80);

  SELECT id INTO v_endpoint FROM operations.endpoints
  WHERE client_id = p_pub.client_id AND endpoint_key = v_endpoint_key;
  IF NOT FOUND THEN PERFORM operations_ingest.fail('endpoint_not_registered'); END IF;

  INSERT INTO operations.endpoint_observations (
    client_id, environment_id, endpoint_id, checked_at, available,
    http_status_class, http_status, response_time_ms, tls_days_remaining,
    confirmation_state, monitor_key, source_system, status, severity,
    correlation_key, observed_at, publisher_id, idempotency_key
  ) VALUES (
    p_pub.client_id, p_pub.environment_id, v_endpoint,
    operations_ingest.req_ts(v_payload, 'checkedAt'),
    operations_ingest.req_bool(v_payload, 'available'),
    operations_ingest.opt_int(v_payload, 'httpStatusClass', 1, 5)::smallint,
    operations_ingest.opt_int(v_payload, 'httpStatus', 100, 599),
    operations_ingest.opt_int(v_payload, 'responseTimeMs', 0, 120000),
    operations_ingest.opt_int(v_payload, 'tlsDaysRemaining', -1, 2000),
    operations_ingest.req_enum(v_payload, 'confirmationState', ARRAY['unconfirmed', 'confirmed', 'recovered', 'rejected'], 'invalid_confirmation_state'),
    operations_ingest.opt_text(v_payload, 'monitorKey', 120),
    p_env.source_system, p_env.status, p_env.severity, p_env.correlation_key,
    p_env.observed_at, p_pub.id, p_env.idempotency_key
  )
  ON CONFLICT (publisher_id, source_record_type, idempotency_key) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN RETURN 'duplicate'; END IF;
  RETURN 'inserted';
END;
$func$;

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
    'vercel', 'imagekit', 'supabase', 'github', 'google_drive', 'smtp', 'ga4', 'uptime_kuma', 'n8n'
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

CREATE OR REPLACE FUNCTION operations_ingest.insert_metric_sample(p_pub operations.publishers, p_env operations_ingest.envelope)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_payload jsonb := p_env.payload;
  v_metric_key text;
  v_def operations.metric_definitions%ROWTYPE;
  v_num numeric;
  v_bool boolean;
  v_dims jsonb;
  v_id uuid;
BEGIN
  PERFORM operations_ingest.check_payload_keys(v_payload, ARRAY[
    'metricKey', 'sampledAt', 'valueNumber', 'valueBoolean', 'unit',
    'periodStart', 'periodEnd', 'coverage', 'dimensions'
  ]);
  v_metric_key := operations_ingest.req_text(v_payload, 'metricKey', 80);

  SELECT * INTO v_def FROM operations.metric_definitions
  WHERE client_id = p_pub.client_id AND metric_key = v_metric_key;
  IF NOT FOUND THEN PERFORM operations_ingest.fail('unknown_metric'); END IF;

  v_num := operations_ingest.opt_number(v_payload, 'valueNumber', -1e15, 1e15);
  v_bool := operations_ingest.opt_bool(v_payload, 'valueBoolean');
  IF v_def.value_type = 'number' AND v_num IS NULL THEN
    PERFORM operations_ingest.fail('metric_value_type_mismatch');
  END IF;
  IF v_def.value_type = 'boolean' AND v_bool IS NULL THEN
    PERFORM operations_ingest.fail('metric_value_type_mismatch');
  END IF;

  IF operations_ingest.opt_text(v_payload, 'unit', 32) IS NOT NULL
     AND operations_ingest.opt_text(v_payload, 'unit', 32) <> v_def.unit THEN
    PERFORM operations_ingest.fail('unit_mismatch');
  END IF;

  v_dims := COALESCE(v_payload -> 'dimensions', '{}'::jsonb);
  IF jsonb_typeof(v_dims) <> 'object' THEN
    PERFORM operations_ingest.fail('invalid_field_type');
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(v_dims) AS k
    WHERE NOT (k IN (SELECT jsonb_array_elements_text(v_def.allowed_dimensions)))
  ) THEN
    PERFORM operations_ingest.fail('invalid_dimensions');
  END IF;

  INSERT INTO operations.metric_samples (
    client_id, metric_definition_id, environment_id, value_number, value_boolean,
    unit, period_start, period_end, coverage, dimensions, source_system,
    status, severity, correlation_key, observed_at, publisher_id, idempotency_key
  ) VALUES (
    p_pub.client_id, v_def.id, p_pub.environment_id, v_num, v_bool, v_def.unit,
    operations_ingest.req_ts(v_payload, 'periodStart'),
    operations_ingest.req_ts(v_payload, 'periodEnd'),
    COALESCE(operations_ingest.opt_enum(v_payload, 'coverage', ARRAY['full', 'partial', 'no_data'], 'invalid_coverage'), 'full'),
    v_dims,
    p_env.source_system, p_env.status, p_env.severity, p_env.correlation_key,
    COALESCE(operations_ingest.opt_ts(v_payload, 'sampledAt'), p_env.observed_at),
    p_pub.id, p_env.idempotency_key
  )
  ON CONFLICT (publisher_id, source_record_type, idempotency_key) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN RETURN 'duplicate'; END IF;
  RETURN 'inserted';
END;
$func$;

CREATE OR REPLACE FUNCTION operations_ingest.insert_traffic_summary(p_pub operations.publishers, p_env operations_ingest.envelope)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_payload jsonb := p_env.payload;
  v_provider text;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_coverage text;
  v_visitors integer;
  v_pageviews integer;
  v_routes jsonb;
  v_route jsonb;
  v_route_path text;
  v_def operations.metric_definitions%ROWTYPE;
  v_id uuid;
  v_inserted boolean := false;
BEGIN
  PERFORM operations_ingest.check_payload_keys(v_payload, ARRAY[
    'provider', 'periodStart', 'periodEnd', 'timezone', 'boundary', 'coverage',
    'visitors', 'pageviews', 'topRoutes'
  ]);
  v_provider := operations_ingest.req_enum(v_payload, 'provider', ARRAY['ga4', 'vercel', 'imagekit', 'other'], 'invalid_provider');
  v_period_start := operations_ingest.req_ts(v_payload, 'periodStart');
  v_period_end := operations_ingest.req_ts(v_payload, 'periodEnd');
  v_coverage := COALESCE(operations_ingest.opt_enum(v_payload, 'coverage', ARRAY['full', 'partial', 'no_data'], 'invalid_coverage'), 'full');
  v_visitors := operations_ingest.opt_int(v_payload, 'visitors', 0, 1000000000);
  v_pageviews := operations_ingest.opt_int(v_payload, 'pageviews', 0, 1000000000);

  IF v_provider = 'other' AND (v_visitors IS NOT NULL OR v_pageviews IS NOT NULL OR (v_payload -> 'topRoutes') IS NOT NULL) THEN
    PERFORM operations_ingest.fail('record_type_not_allowed');
  END IF;

  IF v_visitors IS NOT NULL THEN
    SELECT * INTO v_def FROM operations.metric_definitions
    WHERE client_id = p_pub.client_id AND metric_key = v_provider || '.traffic.visitors';
    IF NOT FOUND THEN PERFORM operations_ingest.fail('unknown_metric'); END IF;
    INSERT INTO operations.metric_samples (
      client_id, metric_definition_id, environment_id, value_number, unit,
      period_start, period_end, coverage, dimensions, source_system, source_record_type,
      status, severity, correlation_key, observed_at, publisher_id, idempotency_key
    ) VALUES (
      p_pub.client_id, v_def.id, p_pub.environment_id, v_visitors, v_def.unit,
      v_period_start, v_period_end, v_coverage, '{}'::jsonb, p_env.source_system, 'traffic_summary',
      p_env.status, p_env.severity, p_env.correlation_key, p_env.observed_at,
      p_pub.id, p_env.idempotency_key || ':visitors'
    )
    ON CONFLICT (publisher_id, source_record_type, idempotency_key) DO NOTHING
    RETURNING id INTO v_id;
    IF v_id IS NOT NULL THEN v_inserted := true; END IF;
  END IF;

  IF v_pageviews IS NOT NULL THEN
    SELECT * INTO v_def FROM operations.metric_definitions
    WHERE client_id = p_pub.client_id AND metric_key = v_provider || '.traffic.pageviews';
    IF NOT FOUND THEN PERFORM operations_ingest.fail('unknown_metric'); END IF;
    INSERT INTO operations.metric_samples (
      client_id, metric_definition_id, environment_id, value_number, unit,
      period_start, period_end, coverage, dimensions, source_system, source_record_type,
      status, severity, correlation_key, observed_at, publisher_id, idempotency_key
    ) VALUES (
      p_pub.client_id, v_def.id, p_pub.environment_id, v_pageviews, v_def.unit,
      v_period_start, v_period_end, v_coverage, '{}'::jsonb, p_env.source_system, 'traffic_summary',
      p_env.status, p_env.severity, p_env.correlation_key, p_env.observed_at,
      p_pub.id, p_env.idempotency_key || ':pageviews'
    )
    ON CONFLICT (publisher_id, source_record_type, idempotency_key) DO NOTHING
    RETURNING id INTO v_id;
    IF v_id IS NOT NULL THEN v_inserted := true; END IF;
  END IF;

  v_routes := v_payload -> 'topRoutes';
  IF v_routes IS NOT NULL THEN
    IF jsonb_typeof(v_routes) <> 'array' OR jsonb_array_length(v_routes) > 20 THEN
      PERFORM operations_ingest.fail('invalid_field_type');
    END IF;
    FOR v_route IN SELECT jsonb_array_elements(v_routes) LOOP
      IF jsonb_typeof(v_route) <> 'object'
         OR NOT (v_route ? 'path') OR NOT (v_route ? 'views') THEN
        PERFORM operations_ingest.fail('invalid_field_type');
      END IF;
      v_route_path := operations_ingest.req_text(v_route, 'path', 200);
      IF v_route_path !~ '^/[a-z0-9/._~-]{0,200}$'
         OR v_route_path LIKE '/admin%' OR v_route_path LIKE '/agent%'
         OR v_route_path LIKE '/share%' OR v_route_path LIKE '/api%'
         OR v_route_path LIKE '/_next%' OR v_route_path LIKE '/_vercel%'
         OR lower(v_route_path) = '/others' THEN
        PERFORM operations_ingest.fail('unsafe_route');
      END IF;

      SELECT * INTO v_def FROM operations.metric_definitions
      WHERE client_id = p_pub.client_id AND metric_key = v_provider || '.traffic.top_route';
      IF NOT FOUND THEN PERFORM operations_ingest.fail('unknown_metric'); END IF;
      IF NOT ('path' IN (SELECT jsonb_array_elements_text(v_def.allowed_dimensions))) THEN
        PERFORM operations_ingest.fail('invalid_dimensions');
      END IF;
      INSERT INTO operations.metric_samples (
        client_id, metric_definition_id, environment_id, value_number, unit,
        period_start, period_end, coverage, dimensions, source_system, source_record_type,
        status, severity, correlation_key, observed_at, publisher_id, idempotency_key
      ) VALUES (
        p_pub.client_id, v_def.id, p_pub.environment_id,
        operations_ingest.req_int(v_route, 'views', 0, 1000000000), v_def.unit,
        v_period_start, v_period_end, v_coverage,
        jsonb_build_object('path', v_route_path), p_env.source_system, 'traffic_summary',
        p_env.status, p_env.severity, p_env.correlation_key, p_env.observed_at,
        p_pub.id, p_env.idempotency_key || ':route:' || v_route_path
      )
      ON CONFLICT (publisher_id, source_record_type, idempotency_key) DO NOTHING
      RETURNING id INTO v_id;
      IF v_id IS NOT NULL THEN v_inserted := true; END IF;
    END LOOP;
  END IF;

  IF NOT v_inserted THEN RETURN 'duplicate'; END IF;
  RETURN 'inserted';
END;
$func$;

CREATE OR REPLACE FUNCTION operations_ingest.insert_deployment_summary(p_pub operations.publishers, p_env operations_ingest.envelope)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_payload jsonb := p_env.payload;
  v_provider text;
  v_deployment_key text;
  v_id uuid;
BEGIN
  PERFORM operations_ingest.check_payload_keys(v_payload, ARRAY[
    'deploymentKey', 'environment', 'state', 'createdAt', 'readyAt',
    'durationMs', 'publicDomainKey', 'isCurrentProduction', 'failureCategory'
  ]);
  IF operations_ingest.req_text(v_payload, 'environment', 62) <>
     (SELECT environment_key FROM operations.environments WHERE id = p_pub.environment_id) THEN
    PERFORM operations_ingest.fail('environment_scope_violation');
  END IF;

  v_provider := CASE p_env.source_system
    WHEN 'vercel' THEN 'vercel'
    WHEN 'github_actions' THEN 'github_actions'
    ELSE 'other'
  END;
  v_deployment_key := operations_ingest.req_text(v_payload, 'deploymentKey', 160);

  PERFORM 1 FROM operations.deployments
  WHERE publisher_id = p_pub.id AND source_record_type = 'deployment_summary'
    AND idempotency_key = p_env.idempotency_key;
  IF FOUND THEN RETURN 'duplicate'; END IF;

  INSERT INTO operations.deployments (
    client_id, environment_id, deployment_key, provider, state, created_at,
    ready_at, duration_ms, public_domain_key, is_current_production,
    failure_category, source_system, status, severity, correlation_key,
    observed_at, publisher_id, idempotency_key
  ) VALUES (
    p_pub.client_id, p_pub.environment_id, v_deployment_key, v_provider,
    operations_ingest.req_enum(v_payload, 'state', ARRAY['building', 'ready', 'failed', 'cancelled', 'unknown'], 'invalid_state'),
    operations_ingest.opt_ts(v_payload, 'createdAt'),
    operations_ingest.opt_ts(v_payload, 'readyAt'),
    operations_ingest.opt_int(v_payload, 'durationMs', 0, 86400000),
    operations_ingest.opt_text(v_payload, 'publicDomainKey', 120),
    COALESCE(operations_ingest.opt_bool(v_payload, 'isCurrentProduction'), false),
    operations_ingest.opt_enum(v_payload, 'failureCategory', operations_ingest.allowed_failure_categories(), 'invalid_failure_category'),
    p_env.source_system, p_env.status, p_env.severity, p_env.correlation_key,
    p_env.observed_at, p_pub.id, p_env.idempotency_key
  )
  ON CONFLICT (client_id, provider, deployment_key) DO UPDATE SET
    environment_id = EXCLUDED.environment_id,
    state = EXCLUDED.state,
    created_at = EXCLUDED.created_at,
    ready_at = EXCLUDED.ready_at,
    duration_ms = EXCLUDED.duration_ms,
    public_domain_key = EXCLUDED.public_domain_key,
    is_current_production = EXCLUDED.is_current_production,
    failure_category = EXCLUDED.failure_category,
    source_system = EXCLUDED.source_system,
    status = EXCLUDED.status,
    severity = EXCLUDED.severity,
    correlation_key = EXCLUDED.correlation_key,
    observed_at = EXCLUDED.observed_at,
    publisher_id = EXCLUDED.publisher_id,
    idempotency_key = EXCLUDED.idempotency_key
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN RETURN 'duplicate'; END IF;
  RETURN 'inserted';
END;
$func$;

CREATE OR REPLACE FUNCTION operations_ingest.insert_backup_evidence(p_pub operations.publishers, p_env operations_ingest.envelope)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_payload jsonb := p_env.payload;
  v_id uuid;
BEGIN
  PERFORM operations_ingest.check_payload_keys(v_payload, ARRAY[
    'backupKey', 'backupTimestamp', 'retentionClass', 'sanitizedFileName',
    'encryptedArchivePresent', 'checksumFilePresent', 'checksumVerified',
    'driveRoundTripPassed', 'archiveStructureValidated', 'sizeBytes',
    'runStartedAt', 'runCompletedAt', 'durationMs', 'githubRunKey',
    'githubRunUrl', 'driveObjectKey'
  ]);

  PERFORM 1 FROM operations.backup_evidence
  WHERE publisher_id = p_pub.id AND source_record_type = 'backup_evidence'
    AND idempotency_key = p_env.idempotency_key;
  IF FOUND THEN RETURN 'duplicate'; END IF;

  INSERT INTO operations.backup_evidence (
    client_id, environment_id, backup_key, backup_timestamp, retention_class,
    sanitized_file_name, encrypted_archive_present, checksum_file_present,
    checksum_verified, drive_round_trip_passed, archive_structure_validated,
    size_bytes, run_started_at, run_completed_at, duration_ms, github_run_key,
    github_run_url, drive_object_key, source_system, status, severity,
    correlation_key, observed_at, publisher_id, idempotency_key
  ) VALUES (
    p_pub.client_id, p_pub.environment_id,
    operations_ingest.req_text(v_payload, 'backupKey', 120),
    operations_ingest.req_ts(v_payload, 'backupTimestamp'),
    operations_ingest.req_enum(v_payload, 'retentionClass', ARRAY['daily', 'monthly'], 'invalid_retention_class'),
    operations_ingest.req_text(v_payload, 'sanitizedFileName', 200),
    operations_ingest.req_bool(v_payload, 'encryptedArchivePresent'),
    operations_ingest.req_bool(v_payload, 'checksumFilePresent'),
    operations_ingest.req_bool(v_payload, 'checksumVerified'),
    operations_ingest.req_bool(v_payload, 'driveRoundTripPassed'),
    operations_ingest.req_bool(v_payload, 'archiveStructureValidated'),
    operations_ingest.opt_number(v_payload, 'sizeBytes', 0, 1e13)::bigint,
    operations_ingest.opt_ts(v_payload, 'runStartedAt'),
    operations_ingest.opt_ts(v_payload, 'runCompletedAt'),
    operations_ingest.opt_int(v_payload, 'durationMs', 0, 86400000),
    operations_ingest.opt_text(v_payload, 'githubRunKey', 120),
    operations_ingest.opt_text(v_payload, 'githubRunUrl', 240),
    operations_ingest.opt_text(v_payload, 'driveObjectKey', 200),
    p_env.source_system, p_env.status, p_env.severity, p_env.correlation_key,
    p_env.observed_at, p_pub.id, p_env.idempotency_key
  )
  ON CONFLICT (client_id, backup_key) DO UPDATE SET
    backup_timestamp = EXCLUDED.backup_timestamp,
    retention_class = EXCLUDED.retention_class,
    sanitized_file_name = EXCLUDED.sanitized_file_name,
    encrypted_archive_present = EXCLUDED.encrypted_archive_present,
    checksum_file_present = EXCLUDED.checksum_file_present,
    checksum_verified = EXCLUDED.checksum_verified,
    drive_round_trip_passed = EXCLUDED.drive_round_trip_passed,
    archive_structure_validated = EXCLUDED.archive_structure_validated,
    size_bytes = EXCLUDED.size_bytes,
    run_started_at = EXCLUDED.run_started_at,
    run_completed_at = EXCLUDED.run_completed_at,
    duration_ms = EXCLUDED.duration_ms,
    github_run_key = EXCLUDED.github_run_key,
    github_run_url = EXCLUDED.github_run_url,
    source_system = EXCLUDED.source_system,
    status = EXCLUDED.status,
    severity = EXCLUDED.severity,
    correlation_key = EXCLUDED.correlation_key,
    observed_at = EXCLUDED.observed_at,
    publisher_id = EXCLUDED.publisher_id,
    idempotency_key = EXCLUDED.idempotency_key
    -- drive_object_key and contents are never updated through reconciliation.
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN RETURN 'duplicate'; END IF;
  RETURN 'inserted';
END;
$func$;

CREATE OR REPLACE FUNCTION operations_ingest.insert_restore_test_evidence(p_pub operations.publishers, p_env operations_ingest.envelope)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_payload jsonb := p_env.payload;
  v_backup_key text;
  v_backup uuid;
  v_id uuid;
BEGIN
  PERFORM operations_ingest.check_payload_keys(v_payload, ARRAY[
    'restoreTestKey', 'backupKey', 'sourceRetentionClass', 'startedAt',
    'completedAt', 'durationMs', 'result', 'checksumPassed', 'decryptPassed',
    'isolatedRestorePassed', 'requiredObjectsPassed', 'rlsPassed',
    'anonymousDenialPassed', 'publicWhitelistPassed', 'cleanupPassed',
    'githubRunKey', 'githubRunUrl'
  ]);
  v_backup_key := operations_ingest.req_text(v_payload, 'backupKey', 120);

  SELECT id INTO v_backup FROM operations.backup_evidence
  WHERE client_id = p_pub.client_id AND backup_key = v_backup_key;
  IF NOT FOUND THEN PERFORM operations_ingest.fail('unknown_backup'); END IF;

  PERFORM 1 FROM operations.restore_tests
  WHERE publisher_id = p_pub.id AND source_record_type = 'restore_test_evidence'
    AND idempotency_key = p_env.idempotency_key;
  IF FOUND THEN RETURN 'duplicate'; END IF;

  INSERT INTO operations.restore_tests (
    client_id, environment_id, backup_id, restore_test_key, source_retention_class,
    started_at, completed_at, duration_ms, result, checksum_passed, decrypt_passed,
    isolated_restore_passed, required_objects_passed, rls_passed,
    anonymous_denial_passed, public_whitelist_passed, cleanup_passed,
    github_run_key, github_run_url, source_system, status, severity,
    correlation_key, observed_at, publisher_id, idempotency_key
  ) VALUES (
    p_pub.client_id, p_pub.environment_id, v_backup,
    operations_ingest.req_text(v_payload, 'restoreTestKey', 120),
    operations_ingest.req_enum(v_payload, 'sourceRetentionClass', ARRAY['daily', 'monthly'], 'invalid_retention_class'),
    operations_ingest.req_ts(v_payload, 'startedAt'),
    operations_ingest.opt_ts(v_payload, 'completedAt'),
    operations_ingest.opt_int(v_payload, 'durationMs', 0, 86400000),
    operations_ingest.opt_enum(v_payload, 'result', ARRAY['passed', 'failed'], 'invalid_result'),
    operations_ingest.opt_bool(v_payload, 'checksumPassed'),
    operations_ingest.opt_bool(v_payload, 'decryptPassed'),
    operations_ingest.opt_bool(v_payload, 'isolatedRestorePassed'),
    operations_ingest.opt_bool(v_payload, 'requiredObjectsPassed'),
    operations_ingest.opt_bool(v_payload, 'rlsPassed'),
    operations_ingest.opt_bool(v_payload, 'anonymousDenialPassed'),
    operations_ingest.opt_bool(v_payload, 'publicWhitelistPassed'),
    operations_ingest.opt_bool(v_payload, 'cleanupPassed'),
    operations_ingest.opt_text(v_payload, 'githubRunKey', 120),
    operations_ingest.opt_text(v_payload, 'githubRunUrl', 240),
    p_env.source_system, p_env.status, p_env.severity, p_env.correlation_key,
    p_env.observed_at, p_pub.id, p_env.idempotency_key
  )
  ON CONFLICT (client_id, restore_test_key) DO UPDATE SET
    environment_id = EXCLUDED.environment_id,
    backup_id = EXCLUDED.backup_id,
    source_retention_class = EXCLUDED.source_retention_class,
    started_at = EXCLUDED.started_at,
    completed_at = EXCLUDED.completed_at,
    duration_ms = EXCLUDED.duration_ms,
    result = EXCLUDED.result,
    checksum_passed = EXCLUDED.checksum_passed,
    decrypt_passed = EXCLUDED.decrypt_passed,
    isolated_restore_passed = EXCLUDED.isolated_restore_passed,
    required_objects_passed = EXCLUDED.required_objects_passed,
    rls_passed = EXCLUDED.rls_passed,
    anonymous_denial_passed = EXCLUDED.anonymous_denial_passed,
    public_whitelist_passed = EXCLUDED.public_whitelist_passed,
    cleanup_passed = EXCLUDED.cleanup_passed,
    github_run_key = EXCLUDED.github_run_key,
    github_run_url = EXCLUDED.github_run_url,
    source_system = EXCLUDED.source_system,
    status = EXCLUDED.status,
    severity = EXCLUDED.severity,
    correlation_key = EXCLUDED.correlation_key,
    observed_at = EXCLUDED.observed_at,
    publisher_id = EXCLUDED.publisher_id,
    idempotency_key = EXCLUDED.idempotency_key
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN RETURN 'duplicate'; END IF;
  RETURN 'inserted';
END;
$func$;

CREATE OR REPLACE FUNCTION operations_ingest.insert_report_summary(p_pub operations.publishers, p_env operations_ingest.envelope)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_payload jsonb := p_env.payload;
  v_report_key text;
  v_month_text text;
  v_month date;
  v_doc_status text;
  v_existing_id uuid;
  v_existing_status text;
  v_id uuid;
  v_event_type text;
BEGIN
  PERFORM operations_ingest.check_payload_keys(v_payload, ARRAY[
    'reportKey', 'reportMonth', 'reportType', 'overallStatus', 'documentStatus',
    'generatedAt', 'coverage', 'findingCountsBySeverity', 'pdfAvailable',
    'approvedAt', 'rejectedAt', 'sendingStartedAt', 'sentAt', 'sendAttemptCount',
    'deliveryFailureCategory', 'rowVersion'
  ]);
  v_report_key := operations_ingest.req_text(v_payload, 'reportKey', 120);
  v_month_text := operations_ingest.req_text(v_payload, 'reportMonth', 7);
  IF v_month_text !~ '^\d{4}-\d{2}$' THEN
    PERFORM operations_ingest.fail('invalid_report_month');
  END IF;
  v_month := (v_month_text || '-01')::date;
  v_doc_status := operations_ingest.opt_enum(v_payload, 'documentStatus', ARRAY[
    'DRAFT', 'APPROVED', 'SENDING', 'SENT', 'REJECTED', 'SEND_FAILED'
  ], 'invalid_document_status');

  PERFORM 1 FROM operations.reports
  WHERE publisher_id = p_pub.id AND source_record_type = 'report_summary'
    AND idempotency_key = p_env.idempotency_key;
  IF FOUND THEN RETURN 'duplicate'; END IF;

  SELECT id, document_status INTO v_existing_id, v_existing_status
  FROM operations.reports
  WHERE client_id = p_pub.client_id AND report_key = v_report_key;

  INSERT INTO operations.reports (
    client_id, report_key, report_month, report_type, overall_status,
    document_status, generated_at, coverage, finding_counts_by_severity,
    pdf_available, approved_at, rejected_at, sending_started_at, sent_at,
    send_attempt_count, delivery_failure_category, row_version, source_system,
    status, severity, correlation_key, observed_at, publisher_id, idempotency_key
  ) VALUES (
    p_pub.client_id, v_report_key, v_month,
    COALESCE(operations_ingest.opt_text(v_payload, 'reportType', 60), 'monthly_maintenance'),
    operations_ingest.opt_enum(v_payload, 'overallStatus', operations_ingest.allowed_statuses(), 'invalid_status'),
    v_doc_status,
    operations_ingest.opt_ts(v_payload, 'generatedAt'),
    operations_ingest.opt_enum(v_payload, 'coverage', ARRAY['FULL', 'PARTIAL', 'NO_DATA'], 'invalid_coverage'),
    COALESCE(v_payload -> 'findingCountsBySeverity', '{}'::jsonb),
    COALESCE(operations_ingest.opt_bool(v_payload, 'pdfAvailable'), false),
    operations_ingest.opt_ts(v_payload, 'approvedAt'),
    operations_ingest.opt_ts(v_payload, 'rejectedAt'),
    operations_ingest.opt_ts(v_payload, 'sendingStartedAt'),
    operations_ingest.opt_ts(v_payload, 'sentAt'),
    COALESCE(operations_ingest.opt_int(v_payload, 'sendAttemptCount', 0, 1000), 0),
    operations_ingest.opt_enum(v_payload, 'deliveryFailureCategory', operations_ingest.allowed_failure_categories(), 'invalid_failure_category'),
    COALESCE(operations_ingest.opt_int(v_payload, 'rowVersion', 1, 1000000), 1),
    p_env.source_system, p_env.status, p_env.severity, p_env.correlation_key,
    p_env.observed_at, p_pub.id, p_env.idempotency_key
  )
  ON CONFLICT (client_id, report_key) DO UPDATE SET
    report_month = EXCLUDED.report_month,
    report_type = EXCLUDED.report_type,
    overall_status = EXCLUDED.overall_status,
    -- SENT is terminal in the portal mirror and can never be regressed or
    -- replayed; sentAt is preserved once set (existing n8n guard).
    document_status = CASE
      WHEN operations.reports.document_status = 'SENT' THEN 'SENT'
      ELSE EXCLUDED.document_status
    END,
    generated_at = COALESCE(EXCLUDED.generated_at, operations.reports.generated_at),
    coverage = EXCLUDED.coverage,
    finding_counts_by_severity = EXCLUDED.finding_counts_by_severity,
    pdf_available = EXCLUDED.pdf_available,
    approved_at = COALESCE(EXCLUDED.approved_at, operations.reports.approved_at),
    rejected_at = COALESCE(EXCLUDED.rejected_at, operations.reports.rejected_at),
    sending_started_at = COALESCE(EXCLUDED.sending_started_at, operations.reports.sending_started_at),
    sent_at = CASE
      WHEN operations.reports.sent_at IS NULL THEN EXCLUDED.sent_at
      ELSE operations.reports.sent_at
    END,
    send_attempt_count = GREATEST(operations.reports.send_attempt_count, EXCLUDED.send_attempt_count),
    delivery_failure_category = EXCLUDED.delivery_failure_category,
    row_version = GREATEST(operations.reports.row_version, EXCLUDED.row_version),
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

  -- Append-only mirror of authoritative n8n report state transitions.
  IF v_existing_id IS NULL THEN
    v_event_type := 'GENERATED';
  ELSIF v_existing_status IS DISTINCT FROM v_doc_status AND v_doc_status IS NOT NULL THEN
    -- 'DRAFT' is not an event type; a reconciliation back to DRAFT is a
    -- STATE_RECONCILED event, everything else mirrors the new status.
    v_event_type := CASE
      WHEN v_doc_status = 'DRAFT' THEN 'STATE_RECONCILED'
      ELSE v_doc_status
    END;
  ELSE
    RETURN 'inserted';
  END IF;

  INSERT INTO operations.report_events (
    client_id, report_id, event_key, event_type, from_status, to_status,
    occurred_at, correlation_key, source_system, status_color, severity,
    observed_at, publisher_id, idempotency_key
  ) VALUES (
    p_pub.client_id, v_id, p_env.idempotency_key || '.event', v_event_type,
    v_existing_status, v_doc_status, p_env.observed_at, p_env.correlation_key,
    p_env.source_system, p_env.status, p_env.severity, p_env.observed_at,
    p_pub.id, p_env.idempotency_key || '.event'
  )
  ON CONFLICT (publisher_id, source_record_type, idempotency_key) DO NOTHING;

  RETURN 'inserted';
END;
$func$;

CREATE OR REPLACE FUNCTION operations_ingest.insert_report_finding(p_pub operations.publishers, p_env operations_ingest.envelope)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_payload jsonb := p_env.payload;
  v_report_key text;
  v_report uuid;
  v_id uuid;
BEGIN
  PERFORM operations_ingest.check_payload_keys(v_payload, ARRAY[
    'reportKey', 'findingKey', 'category', 'severity', 'status', 'safeTitle',
    'safeSummary', 'safeAction', 'firstObservedAt', 'lastObservedAt'
  ]);
  v_report_key := operations_ingest.req_text(v_payload, 'reportKey', 120);

  SELECT id INTO v_report FROM operations.reports
  WHERE client_id = p_pub.client_id AND report_key = v_report_key;
  IF NOT FOUND THEN PERFORM operations_ingest.fail('unknown_report'); END IF;

  PERFORM 1 FROM operations.report_findings
  WHERE publisher_id = p_pub.id AND source_record_type = 'report_finding'
    AND idempotency_key = p_env.idempotency_key;
  IF FOUND THEN RETURN 'duplicate'; END IF;

  INSERT INTO operations.report_findings (
    client_id, report_id, finding_key, category, severity, status, safe_title,
    safe_summary, safe_action, first_observed_at, last_observed_at, source_system,
    status_color, severity_echo, correlation_key, observed_at, publisher_id, idempotency_key
  ) VALUES (
    p_pub.client_id, v_report,
    operations_ingest.req_text(v_payload, 'findingKey', 120),
    operations_ingest.req_enum(v_payload, 'category', ARRAY[
      'endpoint', 'workflow', 'database', 'backup', 'restore_test', 'deployment',
      'traffic', 'provider_connection', 'report_delivery', 'automation',
      'security', 'quota', 'other'
    ], 'invalid_category'),
    operations_ingest.req_enum(v_payload, 'severity', operations_ingest.allowed_severities(), 'invalid_severity'),
    COALESCE(operations_ingest.opt_enum(v_payload, 'status', ARRAY['open', 'acknowledged', 'resolved', 'dismissed'], 'invalid_finding_status'), 'open'),
    operations_ingest.safe_text(operations_ingest.req_text(v_payload, 'safeTitle', 200), 200),
    operations_ingest.safe_text(operations_ingest.opt_text(v_payload, 'safeSummary', 500), 500),
    operations_ingest.safe_text(operations_ingest.opt_text(v_payload, 'safeAction', 300), 300),
    operations_ingest.opt_ts(v_payload, 'firstObservedAt'),
    operations_ingest.opt_ts(v_payload, 'lastObservedAt'),
    p_env.source_system, p_env.status, p_env.severity, p_env.correlation_key,
    p_env.observed_at, p_pub.id, p_env.idempotency_key
  )
  ON CONFLICT (client_id, finding_key) DO UPDATE SET
    report_id = EXCLUDED.report_id,
    category = EXCLUDED.category,
    severity = EXCLUDED.severity,
    status = EXCLUDED.status,
    safe_title = EXCLUDED.safe_title,
    safe_summary = EXCLUDED.safe_summary,
    safe_action = EXCLUDED.safe_action,
    first_observed_at = COALESCE(operations.report_findings.first_observed_at, EXCLUDED.first_observed_at),
    last_observed_at = GREATEST(COALESCE(operations.report_findings.last_observed_at, EXCLUDED.last_observed_at), COALESCE(EXCLUDED.last_observed_at, operations.report_findings.last_observed_at)),
    source_system = EXCLUDED.source_system,
    status_color = EXCLUDED.status_color,
    severity_echo = EXCLUDED.severity_echo,
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

CREATE OR REPLACE FUNCTION operations_ingest.insert_incident(p_pub operations.publishers, p_env operations_ingest.envelope)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_payload jsonb := p_env.payload;
  v_endpoint_key text;
  v_endpoint uuid;
  v_incident_key text;
  v_state text;
  v_existing_id uuid;
  v_existing_state text;
  v_id uuid;
  v_event_type text;
BEGIN
  PERFORM operations_ingest.check_payload_keys(v_payload, ARRAY[
    'incidentKey', 'serviceKey', 'endpointKey', 'state', 'severity',
    'failureCategory', 'startedAt', 'confirmedAt', 'recoveredAt', 'resolvedAt',
    'occurrenceCount', 'safeSummary', 'safeAction'
  ]);
  v_incident_key := operations_ingest.req_text(v_payload, 'incidentKey', 120);
  v_state := operations_ingest.req_enum(v_payload, 'state', ARRAY['open', 'recovered', 'resolved'], 'invalid_incident_state');

  v_endpoint_key := operations_ingest.opt_text(v_payload, 'endpointKey', 80);
  IF v_endpoint_key IS NOT NULL THEN
    SELECT id INTO v_endpoint FROM operations.endpoints
    WHERE client_id = p_pub.client_id AND endpoint_key = v_endpoint_key;
    IF NOT FOUND THEN PERFORM operations_ingest.fail('endpoint_not_registered'); END IF;
  END IF;

  PERFORM 1 FROM operations.incidents
  WHERE publisher_id = p_pub.id AND source_record_type = 'incident'
    AND idempotency_key = p_env.idempotency_key;
  IF FOUND THEN RETURN 'duplicate'; END IF;

  SELECT id, state INTO v_existing_id, v_existing_state
  FROM operations.incidents
  WHERE client_id = p_pub.client_id AND incident_key = v_incident_key;

  INSERT INTO operations.incidents (
    client_id, environment_id, endpoint_id, incident_key, service_key, state,
    severity, failure_category, started_at, confirmed_at, recovered_at,
    resolved_at, occurrence_count, safe_summary, safe_action, source_system,
    status_color, severity_echo, correlation_key, observed_at, publisher_id, idempotency_key
  ) VALUES (
    p_pub.client_id, p_pub.environment_id, v_endpoint, v_incident_key,
    operations_ingest.req_text(v_payload, 'serviceKey', 80),
    v_state,
    operations_ingest.req_enum(v_payload, 'severity', operations_ingest.allowed_severities(), 'invalid_severity'),
    operations_ingest.opt_enum(v_payload, 'failureCategory', operations_ingest.allowed_failure_categories(), 'invalid_failure_category'),
    operations_ingest.req_ts(v_payload, 'startedAt'),
    operations_ingest.opt_ts(v_payload, 'confirmedAt'),
    operations_ingest.opt_ts(v_payload, 'recoveredAt'),
    operations_ingest.opt_ts(v_payload, 'resolvedAt'),
    COALESCE(operations_ingest.opt_int(v_payload, 'occurrenceCount', 1, 100000), 1),
    operations_ingest.safe_text(operations_ingest.opt_text(v_payload, 'safeSummary', 500), 500),
    operations_ingest.safe_text(operations_ingest.opt_text(v_payload, 'safeAction', 300), 300),
    p_env.source_system, p_env.status, p_env.severity, p_env.correlation_key,
    p_env.observed_at, p_pub.id, p_env.idempotency_key
  )
  ON CONFLICT (client_id, incident_key) DO UPDATE SET
    environment_id = EXCLUDED.environment_id,
    endpoint_id = EXCLUDED.endpoint_id,
    service_key = EXCLUDED.service_key,
    state = EXCLUDED.state,
    severity = EXCLUDED.severity,
    failure_category = EXCLUDED.failure_category,
    started_at = LEAST(operations.incidents.started_at, EXCLUDED.started_at),
    confirmed_at = COALESCE(EXCLUDED.confirmed_at, operations.incidents.confirmed_at),
    recovered_at = COALESCE(EXCLUDED.recovered_at, operations.incidents.recovered_at),
    resolved_at = COALESCE(EXCLUDED.resolved_at, operations.incidents.resolved_at),
    occurrence_count = operations.incidents.occurrence_count + EXCLUDED.occurrence_count,
    safe_summary = EXCLUDED.safe_summary,
    safe_action = EXCLUDED.safe_action,
    source_system = EXCLUDED.source_system,
    status_color = EXCLUDED.status_color,
    severity_echo = EXCLUDED.severity_echo,
    correlation_key = EXCLUDED.correlation_key,
    observed_at = EXCLUDED.observed_at,
    publisher_id = EXCLUDED.publisher_id,
    idempotency_key = EXCLUDED.idempotency_key,
    updated_at = now()
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN RETURN 'duplicate'; END IF;

  IF v_existing_id IS NULL THEN
    v_event_type := 'detected';
  ELSIF v_existing_state IS DISTINCT FROM v_state THEN
    v_event_type := CASE v_state
      WHEN 'open' THEN 'updated'
      WHEN 'recovered' THEN 'recovered'
      ELSE 'resolved'
    END;
  ELSE
    RETURN 'inserted';
  END IF;

  INSERT INTO operations.incident_events (
    client_id, incident_id, event_key, event_type, occurred_at, correlation_key,
    source_system, status_color, severity, observed_at, publisher_id, idempotency_key
  ) VALUES (
    p_pub.client_id, v_id, p_env.idempotency_key || '.event', v_event_type,
    p_env.observed_at, p_env.correlation_key, p_env.source_system,
    p_env.status, p_env.severity, p_env.observed_at,
    p_pub.id, p_env.idempotency_key || '.event'
  )
  ON CONFLICT (publisher_id, source_record_type, idempotency_key) DO NOTHING;

  RETURN 'inserted';
END;
$func$;

CREATE OR REPLACE FUNCTION operations_ingest.insert_audit_event(p_pub operations.publishers, p_env operations_ingest.envelope)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_payload jsonb := p_env.payload;
  v_id uuid;
BEGIN
  PERFORM operations_ingest.check_payload_keys(v_payload, ARRAY[
    'eventKey', 'actorType', 'actorKey', 'action', 'targetType', 'targetKey',
    'result', 'occurredAt', 'commandKey', 'safeReasonCode'
  ]);

  INSERT INTO operations.audit_events (
    event_key, client_id, actor_type, actor_key, action, target_type, target_key,
    result, occurred_at, command_key, safe_reason_code, correlation_key
  ) VALUES (
    operations_ingest.req_text(v_payload, 'eventKey', 160),
    p_pub.client_id,
    operations_ingest.req_enum(v_payload, 'actorType', ARRAY['portal_user', 'publisher', 'system', 'n8n'], 'invalid_actor_type'),
    operations_ingest.req_text(v_payload, 'actorKey', 160),
    operations_ingest.req_text(v_payload, 'action', 120),
    operations_ingest.opt_text(v_payload, 'targetType', 60),
    operations_ingest.opt_text(v_payload, 'targetKey', 160),
    operations_ingest.req_enum(v_payload, 'result', ARRAY['success', 'denied', 'error', 'allowed'], 'invalid_result'),
    operations_ingest.req_ts(v_payload, 'occurredAt'),
    operations_ingest.opt_text(v_payload, 'commandKey', 160),
    operations_ingest.opt_text(v_payload, 'safeReasonCode', 80),
    p_env.correlation_key
  )
  ON CONFLICT (event_key) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN RETURN 'duplicate'; END IF;
  RETURN 'inserted';
END;
$func$;

-- ---------------------------------------------------------------------------
-- Batch entry point
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION operations_ingest.submit_batch(
  p_publisher_key text,
  p_presented_secret text,
  p_batch_nonce text,
  p_batch_digest text,
  p_records jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_pub operations.publishers%ROWTYPE;
  v_parts text[];
  v_env_key text;
  v_receipt_id uuid;
  v_receipt_acc integer;
  v_receipt_dup integer;
  v_receipt_rej integer;
  v_arr jsonb[];
  v_rec jsonb;
  v_env operations_ingest.envelope;
  v_outcome text;
  v_accepted integer := 0;
  v_duplicates integer := 0;
  v_batch_size integer;
  v_i integer;
  v_code text;
  v_record_types text[];
BEGIN
  -- 1. Authenticate the publisher. Tenant identity comes only from this row.
  SELECT * INTO v_pub FROM operations.publishers WHERE publisher_key = p_publisher_key;
  IF NOT FOUND THEN
    PERFORM operations_ingest.fail('unknown_publisher');
  END IF;
  IF v_pub.disabled_at IS NOT NULL THEN
    PERFORM operations_ingest.fail('publisher_disabled');
  END IF;
  IF EXISTS (SELECT 1 FROM operations.clients WHERE id = v_pub.client_id AND state = 'disabled') THEN
    PERFORM operations_ingest.fail('client_disabled');
  END IF;

  v_parts := string_to_array(v_pub.key_hash, ':');
  IF encode(
       public.digest((v_parts[1] || ':' || COALESCE(p_presented_secret, ''))::bytea, 'sha256'),
       'hex'
     ) <> v_parts[2] THEN
    PERFORM operations_ingest.fail('invalid_publisher_secret');
  END IF;

  UPDATE operations.publishers SET last_used_at = now() WHERE id = v_pub.id;

  -- 2. Nonce replay returns the original receipt; no evidence is rewritten.
  SELECT id, accepted_count, duplicate_count, rejected_count
  INTO v_receipt_id, v_receipt_acc, v_receipt_dup, v_receipt_rej
  FROM operations.ingestion_receipts
  WHERE publisher_id = v_pub.id AND batch_nonce = p_batch_nonce;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'receiptId', v_receipt_id,
      'result', 'duplicate_batch',
      'accepted', v_receipt_acc,
      'duplicates', v_receipt_dup,
      'rejected', v_receipt_rej
    );
  END IF;

  -- 3. Batch shape limits (500 records / 1 MiB).
  IF p_batch_nonce IS NULL OR length(p_batch_nonce) = 0 OR length(p_batch_nonce) > 160 THEN
    PERFORM operations_ingest.fail('invalid_nonce');
  END IF;
  IF p_batch_digest IS NULL OR p_batch_digest !~ '^[0-9a-f]{64}$' THEN
    PERFORM operations_ingest.fail('invalid_digest');
  END IF;
  IF jsonb_typeof(p_records) <> 'array' THEN
    PERFORM operations_ingest.fail('invalid_batch');
  END IF;
  IF length(p_records::text) > 1048576 THEN
    PERFORM operations_ingest.fail('oversized_body');
  END IF;

  SELECT array_agg(j ORDER BY ord) INTO v_arr
  FROM (SELECT j, ord FROM jsonb_array_elements(p_records) WITH ORDINALITY AS t(j, ord)) s;
  IF v_arr IS NULL OR array_length(v_arr, 1) IS NULL THEN
    PERFORM operations_ingest.fail('invalid_batch');
  END IF;
  IF array_length(v_arr, 1) > 500 THEN
    PERFORM operations_ingest.fail('batch_too_large');
  END IF;
  v_batch_size := array_length(v_arr, 1);

  SELECT environment_key INTO v_env_key
  FROM operations.environments WHERE id = v_pub.environment_id;

  -- 4. Validate and write every record; partial acceptance is forbidden.
  FOR v_i IN 1 .. v_batch_size LOOP
    v_rec := v_arr[v_i];
    v_env := operations_ingest.parse_envelope(v_rec, v_env_key, v_pub.allowed_record_types);

    v_outcome := CASE v_env.record_type
      WHEN 'workflow_catalog' THEN operations_ingest.insert_workflow_catalog(v_pub, v_env)
      WHEN 'workflow_execution' THEN operations_ingest.insert_workflow_execution(v_pub, v_env)
      WHEN 'endpoint_observation' THEN operations_ingest.insert_endpoint_observation(v_pub, v_env)
      WHEN 'provider_connection' THEN operations_ingest.insert_provider_connection(v_pub, v_env)
      WHEN 'metric_sample' THEN operations_ingest.insert_metric_sample(v_pub, v_env)
      WHEN 'traffic_summary' THEN operations_ingest.insert_traffic_summary(v_pub, v_env)
      WHEN 'deployment_summary' THEN operations_ingest.insert_deployment_summary(v_pub, v_env)
      WHEN 'backup_evidence' THEN operations_ingest.insert_backup_evidence(v_pub, v_env)
      WHEN 'restore_test_evidence' THEN operations_ingest.insert_restore_test_evidence(v_pub, v_env)
      WHEN 'report_summary' THEN operations_ingest.insert_report_summary(v_pub, v_env)
      WHEN 'report_finding' THEN operations_ingest.insert_report_finding(v_pub, v_env)
      WHEN 'incident' THEN operations_ingest.insert_incident(v_pub, v_env)
      WHEN 'audit_event' THEN operations_ingest.insert_audit_event(v_pub, v_env)
      ELSE NULL
    END;
    IF v_outcome IS NULL THEN
      PERFORM operations_ingest.fail('unknown_record_type');
    ELSIF v_outcome = 'duplicate' THEN
      v_duplicates := v_duplicates + 1;
    ELSE
      v_accepted := v_accepted + 1;
    END IF;
  END LOOP;

  SELECT array_agg(DISTINCT r ->> 'recordType') INTO v_record_types
  FROM jsonb_array_elements(p_records) AS r;

  -- 5. Append-only receipt for the accepted batch.
  INSERT INTO operations.ingestion_receipts (
    publisher_id, client_id, record_type, batch_nonce, batch_digest, body_bytes,
    accepted_count, duplicate_count, rejected_count, result
  ) VALUES (
    v_pub.id, v_pub.client_id, COALESCE(array_to_string(v_record_types, ','), 'unknown'),
    p_batch_nonce, p_batch_digest, length(p_records::text),
    v_accepted, v_duplicates, 0, 'accepted'
  )
  RETURNING id INTO v_receipt_id;

  RETURN jsonb_build_object(
    'receiptId', v_receipt_id,
    'result', 'accepted',
    'accepted', v_accepted,
    'duplicates', v_duplicates,
    'rejected', 0
  );

EXCEPTION
  WHEN unique_violation THEN
    -- A natural-key race (never a partial write; the transaction rolls back).
    INSERT INTO operations.ingestion_receipts (
      publisher_id, client_id, record_type, batch_nonce, batch_digest, body_bytes,
      accepted_count, duplicate_count, rejected_count, result, safe_code
    ) VALUES (
      v_pub.id, v_pub.client_id, 'unknown', p_batch_nonce, p_batch_digest,
      length(COALESCE(p_records::text, '')),
      0, 0, COALESCE(v_batch_size, 0), 'rejected_validation', 'duplicate_natural_key'
    )
    ON CONFLICT (publisher_id, batch_nonce) DO NOTHING
    RETURNING id INTO v_receipt_id;
    PERFORM operations_private.record_audit_event(
      'publisher', p_publisher_key, 'ingestion.submit_batch', 'ingestion_receipt', NULL,
      'denied', v_pub.client_id, NULL, 'duplicate_natural_key', NULL
    );
    RETURN jsonb_build_object(
      'receiptId', v_receipt_id, 'result', 'rejected_validation',
      'code', 'duplicate_natural_key', 'accepted', 0, 'duplicates', 0,
      'rejected', COALESCE(v_batch_size, 0)
    );

  WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_code = MESSAGE_TEXT;

    IF v_code IN ('unknown_publisher', 'publisher_disabled', 'invalid_publisher_secret', 'client_disabled') THEN
      IF v_pub.id IS NOT NULL THEN
        PERFORM operations_private.record_audit_event(
          'publisher', p_publisher_key, 'ingestion.submit_batch', 'ingestion_receipt', NULL,
          'denied', v_pub.client_id, NULL, v_code, NULL
        );
      END IF;
      RETURN jsonb_build_object(
        'result', 'rejected_authentication', 'code', v_code,
        'accepted', 0, 'duplicates', 0, 'rejected', 0
      );
    END IF;

    INSERT INTO operations.ingestion_receipts (
      publisher_id, client_id, record_type, batch_nonce, batch_digest, body_bytes,
      accepted_count, duplicate_count, rejected_count, result, safe_code
    ) VALUES (
      v_pub.id, v_pub.client_id, 'unknown', p_batch_nonce, p_batch_digest,
      length(COALESCE(p_records::text, '')),
      0, 0, COALESCE(v_batch_size, 0), 'rejected_validation', left(v_code, 80)
    )
    ON CONFLICT (publisher_id, batch_nonce) DO NOTHING
    RETURNING id INTO v_receipt_id;

    PERFORM operations_private.record_audit_event(
      'publisher', p_publisher_key, 'ingestion.submit_batch', 'ingestion_receipt', NULL,
      'denied', v_pub.client_id, NULL, left(v_code, 80), NULL
    );

    RETURN jsonb_build_object(
      'receiptId', v_receipt_id, 'result', 'rejected_validation',
      'code', v_code, 'accepted', 0, 'duplicates', 0,
      'rejected', COALESCE(v_batch_size, 0)
    );
END;
$func$;

-- ---------------------------------------------------------------------------
-- Grants: the ingestion login may only call submit_batch.
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA operations_ingest FROM PUBLIC;
REVOKE ALL ON TYPE operations_ingest.envelope FROM PUBLIC;

GRANT USAGE ON SCHEMA operations_ingest TO operations_ingest;
GRANT EXECUTE ON FUNCTION operations_ingest.submit_batch(text, text, text, text, jsonb) TO operations_ingest;

COMMIT;
