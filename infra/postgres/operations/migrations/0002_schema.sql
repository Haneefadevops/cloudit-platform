-- CloudIT Operations Portal — Phase 3 migration 0002: data model.
--
-- Implements the Phase 0 specification section 8.1 core schema for the
-- private multi-client `operations` database:
--   * every tenant table carries a non-null client_id;
--   * child tables reference their parent through a composite foreign key
--     (client_id, parent_id) so a row can never link to another client's
--     parent;
--   * ingested evidence tables carry (publisher_id, source_record_type,
--     idempotency_key) with a unique constraint so retries create no
--     duplicate evidence;
--   * audit_events, report_events, incident_events and ingestion_receipts
--     are append-only (enforced in migration 0003);
--   * all timestamps are timestamptz (UTC); display conversion is explicit.
--
-- Safe-text and enum allowlists mirror the sanitized publishing contract
-- (Phase 0 specification section 7). Unknown values are rejected at
-- validation time, never stored.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS operations;
CREATE SCHEMA IF NOT EXISTS operations_private;
CREATE SCHEMA IF NOT EXISTS operations_ingest;

REVOKE ALL ON SCHEMA operations FROM PUBLIC;
REVOKE ALL ON SCHEMA operations_private FROM PUBLIC;
REVOKE ALL ON SCHEMA operations_ingest FROM PUBLIC;

COMMENT ON SCHEMA operations IS 'CloudIT Operations Portal multi-client operational evidence.';
COMMENT ON SCHEMA operations_private IS 'Private security-definer helpers. No PUBLIC access.';
COMMENT ON SCHEMA operations_ingest IS 'Private ingestion entry points for the operations_ingest role only.';

-- ---------------------------------------------------------------------------
-- Clients, environments, domains, endpoints
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS operations.clients (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_key   text NOT NULL,
  display_name text NOT NULL,
  state        text NOT NULL DEFAULT 'active'
               CHECK (state IN ('onboarding', 'active', 'disabled')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_clients_key UNIQUE (client_key),
  CONSTRAINT ck_clients_key CHECK (client_key ~ '^[a-z0-9][a-z0-9_-]{1,62}$')
);

CREATE TABLE IF NOT EXISTS operations.environments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES operations.clients (id),
  environment_key text NOT NULL,
  display_name    text NOT NULL,
  state           text NOT NULL DEFAULT 'active'
                  CHECK (state IN ('active', 'disabled')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_environments_tenant UNIQUE (client_id, id),
  CONSTRAINT uq_environments_key UNIQUE (client_id, environment_key),
  CONSTRAINT ck_environments_key CHECK (environment_key ~ '^[a-z0-9][a-z0-9_-]{1,62}$')
);

CREATE TABLE IF NOT EXISTS operations.domains (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      uuid NOT NULL,
  environment_id uuid NOT NULL,
  domain_name    text NOT NULL,
  state          text NOT NULL DEFAULT 'active'
                 CHECK (state IN ('active', 'disabled')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_domains_tenant UNIQUE (client_id, id),
  CONSTRAINT uq_domains_name UNIQUE (client_id, environment_id, domain_name),
  CONSTRAINT ck_domains_name CHECK (domain_name ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  CONSTRAINT fk_domains_environment
    FOREIGN KEY (client_id, environment_id)
    REFERENCES operations.environments (client_id, id)
);

CREATE TABLE IF NOT EXISTS operations.endpoints (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id          uuid NOT NULL,
  environment_id     uuid NOT NULL,
  domain_id          uuid,
  endpoint_key       text NOT NULL,
  display_name       text NOT NULL,
  monitor_kind       text NOT NULL DEFAULT 'http'
                     CHECK (monitor_kind IN ('http', 'kuma', 'synthetic')),
  registered_path    text,
  expected_status_class smallint CHECK (expected_status_class IN (2, 3)),
  state              text NOT NULL DEFAULT 'active'
                     CHECK (state IN ('active', 'disabled')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_endpoints_tenant UNIQUE (client_id, id),
  CONSTRAINT uq_endpoints_key UNIQUE (client_id, endpoint_key),
  CONSTRAINT ck_endpoints_key CHECK (endpoint_key ~ '^[a-z0-9][a-z0-9_.-]{1,80}$'),
  CONSTRAINT ck_endpoints_path CHECK (
    registered_path IS NULL
    OR (registered_path ~ '^/[ -~]{0,200}$' AND registered_path !~ '[?#]')
  ),
  CONSTRAINT fk_endpoints_environment
    FOREIGN KEY (client_id, environment_id)
    REFERENCES operations.environments (client_id, id),
  CONSTRAINT fk_endpoints_domain
    FOREIGN KEY (client_id, domain_id)
    REFERENCES operations.domains (client_id, id)
);

-- ---------------------------------------------------------------------------
-- Portal identities and memberships
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS operations.user_profiles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text NOT NULL,
  display_name text NOT NULL,
  global_role  text NOT NULL
               CHECK (global_role IN ('cloud_owner', 'cloud_operator', 'client_viewer', 'client_report_approver')),
  state        text NOT NULL DEFAULT 'active'
               CHECK (state IN ('active', 'disabled')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_profiles_email UNIQUE (email),
  CONSTRAINT ck_user_profiles_email CHECK (email = lower(email) AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

CREATE TABLE IF NOT EXISTS operations.client_memberships (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES operations.user_profiles (id),
  client_id   uuid NOT NULL REFERENCES operations.clients (id),
  client_role text NOT NULL
              CHECK (client_role IN ('viewer', 'operator', 'report_approver')),
  state       text NOT NULL DEFAULT 'active'
              CHECK (state IN ('active', 'disabled')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_memberships_pair UNIQUE (user_id, client_id)
);

-- ---------------------------------------------------------------------------
-- Ingestion identities and receipts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS operations.publishers (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id            uuid NOT NULL,
  environment_id       uuid NOT NULL,
  publisher_key        text NOT NULL,
  display_name         text,
  key_version          integer NOT NULL DEFAULT 1 CHECK (key_version > 0),
  -- '<salt hex>:<sha256 hex>' of the secret. The secret itself is never
  -- stored recoverably and is never returned by any function.
  key_hash             text NOT NULL,
  allowed_record_types text[] NOT NULL,
  disabled_at          timestamptz,
  last_used_at         timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_publishers_tenant UNIQUE (client_id, id),
  CONSTRAINT uq_publishers_key UNIQUE (publisher_key),
  CONSTRAINT ck_publishers_key CHECK (publisher_key ~ '^[a-z0-9][a-z0-9_.-]{1,80}$'),
  CONSTRAINT ck_publishers_hash CHECK (key_hash ~ '^[0-9a-f]{16,128}:[0-9a-f]{64}$'),
  CONSTRAINT ck_publishers_types CHECK (cardinality(allowed_record_types) > 0),
  CONSTRAINT fk_publishers_environment
    FOREIGN KEY (client_id, environment_id)
    REFERENCES operations.environments (client_id, id)
);

CREATE TABLE IF NOT EXISTS operations.ingestion_receipts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id    uuid NOT NULL,
  client_id       uuid NOT NULL,
  record_type     text NOT NULL,
  batch_nonce     text NOT NULL,
  batch_digest    text NOT NULL,
  body_bytes      integer NOT NULL CHECK (body_bytes BETWEEN 1 AND 1048576),
  accepted_count  integer NOT NULL DEFAULT 0 CHECK (accepted_count >= 0),
  duplicate_count integer NOT NULL DEFAULT 0 CHECK (duplicate_count >= 0),
  rejected_count  integer NOT NULL DEFAULT 0 CHECK (rejected_count >= 0),
  result          text NOT NULL
                  CHECK (result IN ('accepted', 'duplicate_batch', 'rejected_validation')),
  safe_code       text CHECK (safe_code IS NULL OR length(safe_code) <= 80),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_ingestion_receipts_tenant UNIQUE (client_id, id),
  CONSTRAINT uq_ingestion_receipts_nonce UNIQUE (publisher_id, batch_nonce),
  CONSTRAINT ck_ingestion_receipts_nonce CHECK (batch_nonce <> '' AND length(batch_nonce) <= 160),
  CONSTRAINT ck_ingestion_receipts_digest CHECK (batch_digest ~ '^[0-9a-f]{64}$'),
  CONSTRAINT fk_ingestion_receipts_publisher
    FOREIGN KEY (client_id, publisher_id)
    REFERENCES operations.publishers (client_id, id)
);

-- ---------------------------------------------------------------------------
-- Workflow catalogue, curated steps and sanitized executions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS operations.workflow_definitions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             uuid NOT NULL,
  environment_id        uuid NOT NULL,
  workflow_key          text NOT NULL,
  display_name          text NOT NULL,
  trigger_kind          text NOT NULL DEFAULT 'unknown'
                        CHECK (trigger_kind IN ('cron', 'schedule', 'webhook', 'manual', 'sub_workflow', 'error_workflow', 'unknown')),
  schedule_expression   text CHECK (schedule_expression IS NULL OR length(schedule_expression) <= 200),
  schedule_timezone     text NOT NULL DEFAULT 'Europe/Malta'
                        CHECK (length(schedule_timezone) <= 64),
  enabled               boolean NOT NULL DEFAULT true,
  expected_start_rule   text CHECK (expected_start_rule IS NULL OR length(expected_start_rule) <= 200),
  completion_sla_seconds integer CHECK (completion_sla_seconds IS NULL OR completion_sla_seconds BETWEEN 1 AND 604800),
  criticality           text NOT NULL DEFAULT 'standard'
                        CHECK (criticality IN ('critical', 'high', 'standard', 'low')),
  version               integer NOT NULL DEFAULT 1 CHECK (version > 0),
  publisher_id          uuid,
  source_record_type    text NOT NULL DEFAULT 'workflow_catalog'
                        CHECK (source_record_type = 'workflow_catalog'),
  idempotency_key       text,
  observed_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_workflow_definitions_tenant UNIQUE (client_id, id),
  CONSTRAINT uq_workflow_definitions_key UNIQUE (client_id, environment_id, workflow_key),
  CONSTRAINT ck_workflow_definitions_key CHECK (workflow_key ~ '^[a-z0-9][a-z0-9_.-]{1,80}$'),
  CONSTRAINT ck_workflow_definitions_idem CHECK (idempotency_key IS NULL OR length(idempotency_key) <= 160),
  CONSTRAINT fk_workflow_definitions_environment
    FOREIGN KEY (client_id, environment_id)
    REFERENCES operations.environments (client_id, id),
  CONSTRAINT fk_workflow_definitions_publisher
    FOREIGN KEY (client_id, publisher_id)
    REFERENCES operations.publishers (client_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_workflow_definitions_idem
  ON operations.workflow_definitions (publisher_id, source_record_type, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS operations.workflow_steps (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id              uuid NOT NULL,
  workflow_definition_id uuid NOT NULL,
  step_key               text NOT NULL,
  kind                   text NOT NULL
                         CHECK (kind IN ('trigger', 'action', 'check', 'condition', 'output', 'note')),
  display_label          text NOT NULL,
  position               integer NOT NULL CHECK (position >= 0),
  safe_config            jsonb NOT NULL DEFAULT '{}'::jsonb
                         CHECK (jsonb_typeof(safe_config) = 'object'),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_workflow_steps_tenant UNIQUE (client_id, id),
  CONSTRAINT uq_workflow_steps_key UNIQUE (client_id, workflow_definition_id, step_key),
  CONSTRAINT ck_workflow_steps_key CHECK (step_key ~ '^[a-z0-9][a-z0-9_.-]{1,80}$'),
  CONSTRAINT fk_workflow_steps_definition
    FOREIGN KEY (client_id, workflow_definition_id)
    REFERENCES operations.workflow_definitions (client_id, id)
);

CREATE TABLE IF NOT EXISTS operations.workflow_executions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id            uuid NOT NULL,
  environment_id       uuid NOT NULL,
  workflow_definition_id uuid,
  execution_key        text NOT NULL,
  trigger_kind         text CHECK (trigger_kind IS NULL OR trigger_kind IN ('cron', 'schedule', 'webhook', 'manual', 'sub_workflow', 'error_workflow', 'unknown')),
  scheduled_for        timestamptz,
  started_at           timestamptz,
  finished_at          timestamptz,
  duration_ms          integer CHECK (duration_ms IS NULL OR duration_ms BETWEEN 0 AND 86400000),
  schedule_delay_ms    integer CHECK (schedule_delay_ms IS NULL OR schedule_delay_ms BETWEEN 0 AND 86400000),
  outcome              text NOT NULL
                       CHECK (outcome IN ('success', 'failure', 'cancelled', 'waiting', 'missed')),
  failure_category     text CHECK (failure_category IS NULL OR failure_category IN (
                         'timeout', 'dns', 'tls', 'http_4xx', 'http_5xx', 'authentication',
                         'authorization', 'rate_limit', 'quota', 'provider_unavailable',
                         'invalid_response', 'missing_evidence', 'overdue', 'stuck_send',
                         'unknown_sanitized')),
  failure_code         text CHECK (failure_code IS NULL OR (failure_code ~ '^[a-z0-9_.-]{1,80}$')),
  attempt              integer NOT NULL DEFAULT 1 CHECK (attempt BETWEEN 1 AND 100),
  source_revision_key  text CHECK (source_revision_key IS NULL OR length(source_revision_key) <= 160),
  source_system        text NOT NULL,
  status               text CHECK (status IN ('GREEN', 'AMBER', 'RED', 'NO_DATA', 'UNKNOWN')),
  severity             text CHECK (severity IN ('info', 'warning', 'critical', 'none')),
  correlation_key      text CHECK (correlation_key IS NULL OR length(correlation_key) <= 160),
  observed_at          timestamptz NOT NULL,
  publisher_id         uuid NOT NULL,
  source_record_type   text NOT NULL DEFAULT 'workflow_execution'
                       CHECK (source_record_type = 'workflow_execution'),
  idempotency_key      text NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_workflow_executions_tenant UNIQUE (client_id, id),
  CONSTRAINT uq_workflow_executions_key UNIQUE (client_id, execution_key),
  CONSTRAINT uq_workflow_executions_idem UNIQUE (publisher_id, source_record_type, idempotency_key),
  CONSTRAINT ck_workflow_executions_keys CHECK (
    execution_key <> '' AND length(execution_key) <= 160
    AND length(idempotency_key) <= 160
  ),
  CONSTRAINT fk_workflow_executions_environment
    FOREIGN KEY (client_id, environment_id)
    REFERENCES operations.environments (client_id, id),
  CONSTRAINT fk_workflow_executions_definition
    FOREIGN KEY (client_id, workflow_definition_id)
    REFERENCES operations.workflow_definitions (client_id, id),
  CONSTRAINT fk_workflow_executions_publisher
    FOREIGN KEY (client_id, publisher_id)
    REFERENCES operations.publishers (client_id, id)
);

-- ---------------------------------------------------------------------------
-- Metric definitions and samples
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS operations.metric_definitions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id          uuid NOT NULL,
  metric_key         text NOT NULL,
  display_name       text NOT NULL,
  value_type         text NOT NULL CHECK (value_type IN ('number', 'boolean')),
  unit               text NOT NULL CHECK (length(unit) <= 32),
  allowed_dimensions jsonb NOT NULL DEFAULT '[]'::jsonb
                     CHECK (jsonb_typeof(allowed_dimensions) = 'array'),
  frequency_seconds  integer NOT NULL CHECK (frequency_seconds BETWEEN 60 AND 86400),
  freshness_seconds  integer NOT NULL CHECK (freshness_seconds BETWEEN 60 AND 86400),
  retention_class    text NOT NULL DEFAULT 'detailed_90d'
                     CHECK (retention_class IN ('detailed_90d', 'daily_24m', 'permanent')),
  thresholds         jsonb NOT NULL DEFAULT '{}'::jsonb
                     CHECK (jsonb_typeof(thresholds) = 'object'),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_metric_definitions_tenant UNIQUE (client_id, id),
  CONSTRAINT uq_metric_definitions_key UNIQUE (client_id, metric_key),
  CONSTRAINT ck_metric_definitions_key CHECK (metric_key ~ '^[a-z0-9][a-z0-9_.-]{1,80}$')
);

CREATE TABLE IF NOT EXISTS operations.metric_samples (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           uuid NOT NULL,
  metric_definition_id uuid NOT NULL,
  environment_id      uuid,
  value_number        numeric,
  value_boolean       boolean,
  unit                text NOT NULL CHECK (length(unit) <= 32),
  period_start        timestamptz NOT NULL,
  period_end          timestamptz NOT NULL,
  coverage            text NOT NULL DEFAULT 'full'
                      CHECK (coverage IN ('full', 'partial', 'no_data')),
  dimensions          jsonb NOT NULL DEFAULT '{}'::jsonb
                      CHECK (jsonb_typeof(dimensions) = 'object'),
  source_system       text NOT NULL,
  status              text CHECK (status IN ('GREEN', 'AMBER', 'RED', 'NO_DATA', 'UNKNOWN')),
  severity            text CHECK (severity IN ('info', 'warning', 'critical', 'none')),
  correlation_key     text CHECK (correlation_key IS NULL OR length(correlation_key) <= 160),
  observed_at         timestamptz NOT NULL,
  publisher_id        uuid NOT NULL,
  source_record_type  text NOT NULL DEFAULT 'metric_sample'
                      CHECK (source_record_type IN ('metric_sample', 'traffic_summary')),
  idempotency_key     text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_metric_samples_tenant UNIQUE (client_id, id),
  CONSTRAINT uq_metric_samples_idem UNIQUE (publisher_id, source_record_type, idempotency_key),
  CONSTRAINT ck_metric_samples_value CHECK (value_number IS NOT NULL OR value_boolean IS NOT NULL),
  CONSTRAINT ck_metric_samples_period CHECK (period_end >= period_start),
  CONSTRAINT ck_metric_samples_idem CHECK (length(idempotency_key) <= 200),
  CONSTRAINT fk_metric_samples_definition
    FOREIGN KEY (client_id, metric_definition_id)
    REFERENCES operations.metric_definitions (client_id, id),
  CONSTRAINT fk_metric_samples_environment
    FOREIGN KEY (client_id, environment_id)
    REFERENCES operations.environments (client_id, id),
  CONSTRAINT fk_metric_samples_publisher
    FOREIGN KEY (client_id, publisher_id)
    REFERENCES operations.publishers (client_id, id)
);

-- ---------------------------------------------------------------------------
-- Endpoint observations and provider connections
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS operations.endpoint_observations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id          uuid NOT NULL,
  environment_id     uuid NOT NULL,
  endpoint_id        uuid NOT NULL,
  checked_at         timestamptz NOT NULL,
  available          boolean NOT NULL,
  http_status_class  smallint CHECK (http_status_class BETWEEN 1 AND 5),
  http_status        integer CHECK (http_status BETWEEN 100 AND 599),
  response_time_ms   integer CHECK (response_time_ms IS NULL OR response_time_ms BETWEEN 0 AND 120000),
  tls_days_remaining integer CHECK (tls_days_remaining IS NULL OR tls_days_remaining BETWEEN -1 AND 2000),
  confirmation_state text NOT NULL
                     CHECK (confirmation_state IN ('unconfirmed', 'confirmed', 'recovered', 'rejected')),
  monitor_key        text CHECK (monitor_key IS NULL OR length(monitor_key) <= 120),
  source_system      text NOT NULL,
  status             text CHECK (status IN ('GREEN', 'AMBER', 'RED', 'NO_DATA', 'UNKNOWN')),
  severity           text CHECK (severity IN ('info', 'warning', 'critical', 'none')),
  correlation_key    text CHECK (correlation_key IS NULL OR length(correlation_key) <= 160),
  observed_at        timestamptz NOT NULL,
  publisher_id       uuid NOT NULL,
  source_record_type text NOT NULL DEFAULT 'endpoint_observation'
                     CHECK (source_record_type = 'endpoint_observation'),
  idempotency_key    text NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_endpoint_observations_tenant UNIQUE (client_id, id),
  CONSTRAINT uq_endpoint_observations_idem UNIQUE (publisher_id, source_record_type, idempotency_key),
  CONSTRAINT ck_endpoint_observations_idem CHECK (length(idempotency_key) <= 160),
  CONSTRAINT fk_endpoint_observations_endpoint
    FOREIGN KEY (client_id, endpoint_id)
    REFERENCES operations.endpoints (client_id, id),
  CONSTRAINT fk_endpoint_observations_environment
    FOREIGN KEY (client_id, environment_id)
    REFERENCES operations.environments (client_id, id),
  CONSTRAINT fk_endpoint_observations_publisher
    FOREIGN KEY (client_id, publisher_id)
    REFERENCES operations.publishers (client_id, id)
);

CREATE TABLE IF NOT EXISTS operations.provider_connections (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id            uuid NOT NULL,
  environment_id       uuid,
  provider             text NOT NULL
                       CHECK (provider IN ('vercel', 'imagekit', 'supabase', 'github', 'google_drive', 'smtp', 'ga4', 'uptime_kuma', 'n8n')),
  connection_key       text NOT NULL,
  reachable            boolean NOT NULL,
  authorization_state  text NOT NULL
                       CHECK (authorization_state IN ('ok', 'denied', 'unknown')),
  last_successful_at   timestamptz,
  failure_category     text CHECK (failure_category IS NULL OR failure_category IN (
                         'timeout', 'dns', 'tls', 'http_4xx', 'http_5xx', 'authentication',
                         'authorization', 'rate_limit', 'quota', 'provider_unavailable',
                         'invalid_response', 'missing_evidence', 'overdue', 'stuck_send',
                         'unknown_sanitized')),
  source_system        text NOT NULL,
  status               text CHECK (status IN ('GREEN', 'AMBER', 'RED', 'NO_DATA', 'UNKNOWN')),
  severity             text CHECK (severity IN ('info', 'warning', 'critical', 'none')),
  correlation_key      text CHECK (correlation_key IS NULL OR length(correlation_key) <= 160),
  observed_at          timestamptz NOT NULL,
  publisher_id         uuid NOT NULL,
  source_record_type   text NOT NULL DEFAULT 'provider_connection'
                       CHECK (source_record_type = 'provider_connection'),
  idempotency_key      text NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_provider_connections_tenant UNIQUE (client_id, id),
  CONSTRAINT uq_provider_connections_key UNIQUE (client_id, provider, connection_key),
  CONSTRAINT uq_provider_connections_idem UNIQUE (publisher_id, source_record_type, idempotency_key),
  CONSTRAINT ck_provider_connections_keys CHECK (
    connection_key ~ '^[a-z0-9][a-z0-9_.-]{1,80}$'
    AND length(idempotency_key) <= 160
  ),
  CONSTRAINT fk_provider_connections_environment
    FOREIGN KEY (client_id, environment_id)
    REFERENCES operations.environments (client_id, id),
  CONSTRAINT fk_provider_connections_publisher
    FOREIGN KEY (client_id, publisher_id)
    REFERENCES operations.publishers (client_id, id)
);

-- ---------------------------------------------------------------------------
-- Deployments, backup and restore-test evidence
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS operations.deployments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             uuid NOT NULL,
  environment_id        uuid NOT NULL,
  deployment_key        text NOT NULL,
  provider              text NOT NULL
                        CHECK (provider IN ('vercel', 'imagekit', 'github_actions', 'other')),
  state                 text NOT NULL
                        CHECK (state IN ('building', 'ready', 'failed', 'cancelled', 'unknown')),
  created_at            timestamptz,
  ready_at              timestamptz,
  duration_ms           integer CHECK (duration_ms IS NULL OR duration_ms BETWEEN 0 AND 86400000),
  public_domain_key     text CHECK (public_domain_key IS NULL OR length(public_domain_key) <= 120),
  is_current_production boolean NOT NULL DEFAULT false,
  failure_category      text CHECK (failure_category IS NULL OR failure_category IN (
                          'timeout', 'dns', 'tls', 'http_4xx', 'http_5xx', 'authentication',
                          'authorization', 'rate_limit', 'quota', 'provider_unavailable',
                          'invalid_response', 'missing_evidence', 'overdue', 'stuck_send',
                          'unknown_sanitized')),
  source_system         text NOT NULL,
  status                text CHECK (status IN ('GREEN', 'AMBER', 'RED', 'NO_DATA', 'UNKNOWN')),
  severity              text CHECK (severity IN ('info', 'warning', 'critical', 'none')),
  correlation_key       text CHECK (correlation_key IS NULL OR length(correlation_key) <= 160),
  observed_at           timestamptz NOT NULL,
  publisher_id          uuid NOT NULL,
  source_record_type    text NOT NULL DEFAULT 'deployment_summary'
                        CHECK (source_record_type = 'deployment_summary'),
  idempotency_key       text NOT NULL,
  ingested_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_deployments_tenant UNIQUE (client_id, id),
  CONSTRAINT uq_deployments_key UNIQUE (client_id, provider, deployment_key),
  CONSTRAINT uq_deployments_idem UNIQUE (publisher_id, source_record_type, idempotency_key),
  CONSTRAINT ck_deployments_keys CHECK (
    deployment_key <> '' AND length(deployment_key) <= 160
    AND length(idempotency_key) <= 160
  ),
  CONSTRAINT fk_deployments_environment
    FOREIGN KEY (client_id, environment_id)
    REFERENCES operations.environments (client_id, id),
  CONSTRAINT fk_deployments_publisher
    FOREIGN KEY (client_id, publisher_id)
    REFERENCES operations.publishers (client_id, id)
);

CREATE TABLE IF NOT EXISTS operations.backup_evidence (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                  uuid NOT NULL,
  environment_id             uuid NOT NULL,
  backup_key                 text NOT NULL,
  backup_timestamp           timestamptz NOT NULL,
  retention_class            text NOT NULL CHECK (retention_class IN ('daily', 'monthly')),
  sanitized_file_name        text NOT NULL,
  encrypted_archive_present  boolean NOT NULL,
  checksum_file_present      boolean NOT NULL,
  checksum_verified          boolean NOT NULL,
  drive_round_trip_passed    boolean NOT NULL,
  archive_structure_validated boolean NOT NULL,
  size_bytes                 bigint CHECK (size_bytes IS NULL OR size_bytes BETWEEN 0 AND 10^13),
  run_started_at             timestamptz,
  run_completed_at           timestamptz,
  duration_ms                integer CHECK (duration_ms IS NULL OR duration_ms BETWEEN 0 AND 86400000),
  github_run_key             text CHECK (github_run_key IS NULL OR length(github_run_key) <= 120),
  github_run_url             text CHECK (github_run_url IS NULL OR github_run_url ~ '^https://github\.com/[ -~]{1,200}$'),
  -- Server-only Drive object key. Never rendered to browser payloads.
  drive_object_key           text CHECK (drive_object_key IS NULL OR length(drive_object_key) <= 200),
  source_system              text NOT NULL,
  status                     text CHECK (status IN ('GREEN', 'AMBER', 'RED', 'NO_DATA', 'UNKNOWN')),
  severity                   text CHECK (severity IN ('info', 'warning', 'critical', 'none')),
  correlation_key            text CHECK (correlation_key IS NULL OR length(correlation_key) <= 160),
  observed_at                timestamptz NOT NULL,
  publisher_id               uuid NOT NULL,
  source_record_type         text NOT NULL DEFAULT 'backup_evidence'
                             CHECK (source_record_type = 'backup_evidence'),
  idempotency_key            text NOT NULL,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_backup_evidence_tenant UNIQUE (client_id, id),
  CONSTRAINT uq_backup_evidence_key UNIQUE (client_id, backup_key),
  CONSTRAINT uq_backup_evidence_idem UNIQUE (publisher_id, source_record_type, idempotency_key),
  CONSTRAINT ck_backup_evidence_keys CHECK (
    backup_key ~ '^[a-z0-9][a-z0-9_.-]{1,120}$'
    AND sanitized_file_name <> ''
    AND length(sanitized_file_name) <= 200
    AND sanitized_file_name !~ '[/\\]'
    AND length(idempotency_key) <= 160
  ),
  CONSTRAINT fk_backup_evidence_environment
    FOREIGN KEY (client_id, environment_id)
    REFERENCES operations.environments (client_id, id),
  CONSTRAINT fk_backup_evidence_publisher
    FOREIGN KEY (client_id, publisher_id)
    REFERENCES operations.publishers (client_id, id)
);

CREATE TABLE IF NOT EXISTS operations.restore_tests (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               uuid NOT NULL,
  environment_id          uuid NOT NULL,
  backup_id               uuid NOT NULL,
  restore_test_key        text NOT NULL,
  source_retention_class  text NOT NULL CHECK (source_retention_class IN ('daily', 'monthly')),
  started_at              timestamptz NOT NULL,
  completed_at            timestamptz,
  duration_ms             integer CHECK (duration_ms IS NULL OR duration_ms BETWEEN 0 AND 86400000),
  result                  text CHECK (result IS NULL OR result IN ('passed', 'failed')),
  checksum_passed         boolean,
  decrypt_passed          boolean,
  isolated_restore_passed boolean,
  required_objects_passed boolean,
  rls_passed              boolean,
  anonymous_denial_passed boolean,
  public_whitelist_passed boolean,
  cleanup_passed          boolean,
  github_run_key          text CHECK (github_run_key IS NULL OR length(github_run_key) <= 120),
  github_run_url          text CHECK (github_run_url IS NULL OR github_run_url ~ '^https://github\.com/[ -~]{1,200}$'),
  source_system           text NOT NULL,
  status                  text CHECK (status IN ('GREEN', 'AMBER', 'RED', 'NO_DATA', 'UNKNOWN')),
  severity                text CHECK (severity IN ('info', 'warning', 'critical', 'none')),
  correlation_key         text CHECK (correlation_key IS NULL OR length(correlation_key) <= 160),
  observed_at             timestamptz NOT NULL,
  publisher_id            uuid NOT NULL,
  source_record_type      text NOT NULL DEFAULT 'restore_test_evidence'
                          CHECK (source_record_type = 'restore_test_evidence'),
  idempotency_key         text NOT NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_restore_tests_tenant UNIQUE (client_id, id),
  CONSTRAINT uq_restore_tests_key UNIQUE (client_id, restore_test_key),
  CONSTRAINT uq_restore_tests_idem UNIQUE (publisher_id, source_record_type, idempotency_key),
  CONSTRAINT ck_restore_tests_keys CHECK (
    restore_test_key ~ '^[a-z0-9][a-z0-9_.-]{1,120}$'
    AND length(idempotency_key) <= 160
  ),
  CONSTRAINT fk_restore_tests_environment
    FOREIGN KEY (client_id, environment_id)
    REFERENCES operations.environments (client_id, id),
  CONSTRAINT fk_restore_tests_backup
    FOREIGN KEY (client_id, backup_id)
    REFERENCES operations.backup_evidence (client_id, id),
  CONSTRAINT fk_restore_tests_publisher
    FOREIGN KEY (client_id, publisher_id)
    REFERENCES operations.publishers (client_id, id)
);

-- ---------------------------------------------------------------------------
-- Monthly reports, findings, events, commands
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS operations.reports (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                  uuid NOT NULL,
  environment_id             uuid,
  report_key                 text NOT NULL,
  report_month               date NOT NULL
                             CHECK (report_month = date_trunc('month', report_month)::date),
  report_type                text NOT NULL DEFAULT 'monthly_maintenance'
                             CHECK (report_type ~ '^[a-z0-9][a-z0-9_.-]{1,60}$'),
  overall_status             text CHECK (overall_status IN ('GREEN', 'AMBER', 'RED', 'NO_DATA', 'UNKNOWN')),
  document_status            text
                             CHECK (document_status IS NULL OR document_status IN ('DRAFT', 'APPROVED', 'SENDING', 'SENT', 'REJECTED', 'SEND_FAILED')),
  generated_at               timestamptz,
  coverage                   text CHECK (coverage IS NULL OR coverage IN ('FULL', 'PARTIAL', 'NO_DATA')),
  finding_counts_by_severity jsonb NOT NULL DEFAULT '{}'::jsonb
                             CHECK (jsonb_typeof(finding_counts_by_severity) = 'object'),
  pdf_available              boolean NOT NULL DEFAULT false,
  approved_at                timestamptz,
  rejected_at                timestamptz,
  sending_started_at         timestamptz,
  sent_at                    timestamptz,
  send_attempt_count         integer NOT NULL DEFAULT 0 CHECK (send_attempt_count BETWEEN 0 AND 1000),
  delivery_failure_category  text CHECK (delivery_failure_category IS NULL OR delivery_failure_category IN (
                             'timeout', 'dns', 'tls', 'http_4xx', 'http_5xx', 'authentication',
                             'authorization', 'rate_limit', 'quota', 'provider_unavailable',
                             'invalid_response', 'missing_evidence', 'overdue', 'stuck_send',
                             'unknown_sanitized')),
  row_version                integer NOT NULL DEFAULT 1 CHECK (row_version > 0),
  source_system              text NOT NULL,
  status                     text CHECK (status IN ('GREEN', 'AMBER', 'RED', 'NO_DATA', 'UNKNOWN')),
  severity                   text CHECK (severity IN ('info', 'warning', 'critical', 'none')),
  correlation_key            text CHECK (correlation_key IS NULL OR length(correlation_key) <= 160),
  observed_at                timestamptz NOT NULL,
  publisher_id               uuid NOT NULL,
  source_record_type         text NOT NULL DEFAULT 'report_summary'
                             CHECK (source_record_type = 'report_summary'),
  idempotency_key            text NOT NULL,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_reports_tenant UNIQUE (client_id, id),
  CONSTRAINT uq_reports_key UNIQUE (client_id, report_key),
  CONSTRAINT uq_reports_month UNIQUE (client_id, report_month, report_type),
  CONSTRAINT uq_reports_idem UNIQUE (publisher_id, source_record_type, idempotency_key),
  CONSTRAINT ck_reports_keys CHECK (
    report_key ~ '^[a-z0-9][a-z0-9_.-]{1,120}$'
    AND length(idempotency_key) <= 160
  ),
  CONSTRAINT fk_reports_environment
    FOREIGN KEY (client_id, environment_id)
    REFERENCES operations.environments (client_id, id),
  CONSTRAINT fk_reports_publisher
    FOREIGN KEY (client_id, publisher_id)
    REFERENCES operations.publishers (client_id, id)
);

CREATE TABLE IF NOT EXISTS operations.report_findings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        uuid NOT NULL,
  report_id        uuid NOT NULL,
  finding_key      text NOT NULL,
  category         text NOT NULL
                   CHECK (category IN ('endpoint', 'workflow', 'database', 'backup', 'restore_test',
                                       'deployment', 'traffic', 'provider_connection', 'report_delivery',
                                       'automation', 'security', 'quota', 'other')),
  severity         text NOT NULL CHECK (severity IN ('info', 'warning', 'critical', 'none')),
  status           text NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open', 'acknowledged', 'resolved', 'dismissed')),
  safe_title       text NOT NULL CHECK (length(safe_title) BETWEEN 1 AND 200),
  safe_summary     text CHECK (safe_summary IS NULL OR length(safe_summary) <= 500),
  safe_action      text CHECK (safe_action IS NULL OR length(safe_action) <= 300),
  first_observed_at timestamptz,
  last_observed_at timestamptz,
  source_system    text NOT NULL,
  status_color     text CHECK (status_color IN ('GREEN', 'AMBER', 'RED', 'NO_DATA', 'UNKNOWN')),
  severity_echo    text CHECK (severity_echo IN ('info', 'warning', 'critical', 'none')),
  correlation_key  text CHECK (correlation_key IS NULL OR length(correlation_key) <= 160),
  observed_at      timestamptz NOT NULL,
  publisher_id     uuid NOT NULL,
  source_record_type text NOT NULL DEFAULT 'report_finding'
                     CHECK (source_record_type = 'report_finding'),
  idempotency_key  text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_report_findings_tenant UNIQUE (client_id, id),
  CONSTRAINT uq_report_findings_key UNIQUE (client_id, finding_key),
  CONSTRAINT uq_report_findings_idem UNIQUE (publisher_id, source_record_type, idempotency_key),
  CONSTRAINT ck_report_findings_keys CHECK (
    finding_key ~ '^[a-z0-9][a-z0-9_.-]{1,120}$'
    AND length(idempotency_key) <= 160
  ),
  CONSTRAINT fk_report_findings_report
    FOREIGN KEY (client_id, report_id)
    REFERENCES operations.reports (client_id, id),
  CONSTRAINT fk_report_findings_publisher
    FOREIGN KEY (client_id, publisher_id)
    REFERENCES operations.publishers (client_id, id)
);

CREATE TABLE IF NOT EXISTS operations.report_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        uuid NOT NULL,
  report_id        uuid NOT NULL,
  event_key        text NOT NULL,
  event_type       text NOT NULL
                   CHECK (event_type IN ('GENERATED', 'APPROVED', 'REJECTED', 'SENDING', 'SENT', 'SEND_FAILED', 'STATE_RECONCILED')),
  from_status      text CHECK (from_status IS NULL OR from_status IN ('DRAFT', 'APPROVED', 'SENDING', 'SENT', 'REJECTED', 'SEND_FAILED')),
  to_status        text CHECK (to_status IS NULL OR to_status IN ('DRAFT', 'APPROVED', 'SENDING', 'SENT', 'REJECTED', 'SEND_FAILED')),
  occurred_at      timestamptz NOT NULL,
  correlation_key  text CHECK (correlation_key IS NULL OR length(correlation_key) <= 160),
  source_system    text NOT NULL,
  status_color     text CHECK (status_color IN ('GREEN', 'AMBER', 'RED', 'NO_DATA', 'UNKNOWN')),
  severity         text CHECK (severity IN ('info', 'warning', 'critical', 'none')),
  observed_at      timestamptz NOT NULL,
  publisher_id     uuid NOT NULL,
  source_record_type text NOT NULL DEFAULT 'report_summary'
                     CHECK (source_record_type = 'report_summary'),
  idempotency_key  text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_report_events_tenant UNIQUE (client_id, id),
  CONSTRAINT uq_report_events_key UNIQUE (client_id, event_key),
  CONSTRAINT uq_report_events_idem UNIQUE (publisher_id, source_record_type, idempotency_key),
  CONSTRAINT ck_report_events_keys CHECK (
    event_key <> '' AND length(event_key) <= 160
    AND length(idempotency_key) <= 160
  ),
  CONSTRAINT fk_report_events_report
    FOREIGN KEY (client_id, report_id)
    REFERENCES operations.reports (client_id, id),
  CONSTRAINT fk_report_events_publisher
    FOREIGN KEY (client_id, publisher_id)
    REFERENCES operations.publishers (client_id, id)
);

CREATE TABLE IF NOT EXISTS operations.report_commands (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           uuid NOT NULL,
  report_id           uuid NOT NULL,
  command_key         text NOT NULL,
  command_type        text NOT NULL
                      CHECK (command_type IN ('APPROVE_AND_SEND', 'REJECT', 'RETRY_SEND')),
  expected_row_version integer NOT NULL CHECK (expected_row_version > 0),
  expected_state      text NOT NULL
                      CHECK (expected_state IN ('DRAFT', 'APPROVED', 'SENDING', 'SENT', 'REJECTED', 'SEND_FAILED')),
  nonce               text NOT NULL,
  expires_at          timestamptz NOT NULL,
  requested_by        uuid REFERENCES operations.user_profiles (id),
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'signed', 'sent', 'acknowledged', 'completed',
                                        'failed_safe', 'rejected_stale_version', 'rejected_state',
                                        'rejected_expired', 'rejected_replay')),
  result_code         text CHECK (result_code IS NULL OR length(result_code) <= 80),
  requested_at        timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_report_commands_tenant UNIQUE (client_id, id),
  CONSTRAINT uq_report_commands_key UNIQUE (client_id, command_key),
  CONSTRAINT uq_report_commands_nonce UNIQUE (nonce),
  CONSTRAINT ck_report_commands_keys CHECK (
    command_key <> '' AND length(command_key) <= 160
    AND length(nonce) <= 160
  ),
  CONSTRAINT fk_report_commands_report
    FOREIGN KEY (client_id, report_id)
    REFERENCES operations.reports (client_id, id)
);

-- ---------------------------------------------------------------------------
-- Incidents and incident events
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS operations.incidents (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        uuid NOT NULL,
  environment_id   uuid,
  endpoint_id      uuid,
  incident_key     text NOT NULL,
  service_key      text NOT NULL,
  state            text NOT NULL CHECK (state IN ('open', 'recovered', 'resolved')),
  severity         text NOT NULL CHECK (severity IN ('info', 'warning', 'critical', 'none')),
  failure_category text CHECK (failure_category IS NULL OR failure_category IN (
                   'timeout', 'dns', 'tls', 'http_4xx', 'http_5xx', 'authentication',
                   'authorization', 'rate_limit', 'quota', 'provider_unavailable',
                   'invalid_response', 'missing_evidence', 'overdue', 'stuck_send',
                   'unknown_sanitized')),
  started_at       timestamptz NOT NULL,
  confirmed_at     timestamptz,
  recovered_at     timestamptz,
  resolved_at      timestamptz,
  occurrence_count integer NOT NULL DEFAULT 1 CHECK (occurrence_count BETWEEN 1 AND 100000),
  safe_summary     text CHECK (safe_summary IS NULL OR length(safe_summary) <= 500),
  safe_action      text CHECK (safe_action IS NULL OR length(safe_action) <= 300),
  source_system    text NOT NULL,
  status_color     text CHECK (status_color IN ('GREEN', 'AMBER', 'RED', 'NO_DATA', 'UNKNOWN')),
  severity_echo    text CHECK (severity_echo IN ('info', 'warning', 'critical', 'none')),
  correlation_key  text CHECK (correlation_key IS NULL OR length(correlation_key) <= 160),
  observed_at      timestamptz NOT NULL,
  publisher_id     uuid NOT NULL,
  source_record_type text NOT NULL DEFAULT 'incident'
                     CHECK (source_record_type = 'incident'),
  idempotency_key  text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_incidents_tenant UNIQUE (client_id, id),
  CONSTRAINT uq_incidents_key UNIQUE (client_id, incident_key),
  CONSTRAINT uq_incidents_idem UNIQUE (publisher_id, source_record_type, idempotency_key),
  CONSTRAINT ck_incidents_keys CHECK (
    incident_key ~ '^[a-z0-9][a-z0-9_.-]{1,120}$'
    AND service_key ~ '^[a-z0-9][a-z0-9_.-]{1,80}$'
    AND length(idempotency_key) <= 160
  ),
  CONSTRAINT fk_incidents_environment
    FOREIGN KEY (client_id, environment_id)
    REFERENCES operations.environments (client_id, id),
  CONSTRAINT fk_incidents_endpoint
    FOREIGN KEY (client_id, endpoint_id)
    REFERENCES operations.endpoints (client_id, id),
  CONSTRAINT fk_incidents_publisher
    FOREIGN KEY (client_id, publisher_id)
    REFERENCES operations.publishers (client_id, id)
);

CREATE TABLE IF NOT EXISTS operations.incident_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        uuid NOT NULL,
  incident_id      uuid NOT NULL,
  event_key        text NOT NULL,
  event_type       text NOT NULL
                   CHECK (event_type IN ('detected', 'confirmed', 'recovered', 'resolved', 'rejected', 'updated')),
  occurred_at      timestamptz NOT NULL,
  correlation_key  text CHECK (correlation_key IS NULL OR length(correlation_key) <= 160),
  source_system    text NOT NULL,
  status_color     text CHECK (status_color IN ('GREEN', 'AMBER', 'RED', 'NO_DATA', 'UNKNOWN')),
  severity         text CHECK (severity IN ('info', 'warning', 'critical', 'none')),
  observed_at      timestamptz NOT NULL,
  publisher_id     uuid NOT NULL,
  source_record_type text NOT NULL DEFAULT 'incident'
                     CHECK (source_record_type = 'incident'),
  idempotency_key  text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_incident_events_tenant UNIQUE (client_id, id),
  CONSTRAINT uq_incident_events_key UNIQUE (client_id, event_key),
  CONSTRAINT uq_incident_events_idem UNIQUE (publisher_id, source_record_type, idempotency_key),
  CONSTRAINT ck_incident_events_keys CHECK (
    event_key <> '' AND length(event_key) <= 160
    AND length(idempotency_key) <= 160
  ),
  CONSTRAINT fk_incident_events_incident
    FOREIGN KEY (client_id, incident_id)
    REFERENCES operations.incidents (client_id, id),
  CONSTRAINT fk_incident_events_publisher
    FOREIGN KEY (client_id, publisher_id)
    REFERENCES operations.publishers (client_id, id)
);

-- ---------------------------------------------------------------------------
-- Audit events (append-only; written only through operations_private helpers)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS operations.audit_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key        text NOT NULL,
  client_id        uuid,              -- nullable: global events (e.g. sign-in)
  actor_type       text NOT NULL
                   CHECK (actor_type IN ('portal_user', 'publisher', 'system', 'n8n')),
  actor_key        text NOT NULL CHECK (length(actor_key) BETWEEN 1 AND 160),
  action           text NOT NULL CHECK (action ~ '^[a-z0-9_.-]{1,120}$'),
  target_type      text CHECK (target_type IS NULL OR length(target_type) <= 60),
  target_key       text CHECK (target_key IS NULL OR length(target_key) <= 160),
  result           text NOT NULL CHECK (result IN ('success', 'denied', 'error', 'allowed')),
  occurred_at      timestamptz NOT NULL DEFAULT now(),
  command_key      text CHECK (command_key IS NULL OR length(command_key) <= 160),
  safe_reason_code text CHECK (safe_reason_code IS NULL OR length(safe_reason_code) <= 80),
  correlation_key  text CHECK (correlation_key IS NULL OR length(correlation_key) <= 160),
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_audit_events_key UNIQUE (event_key),
  CONSTRAINT fk_audit_events_client
    FOREIGN KEY (client_id)
    REFERENCES operations.clients (id)
);

-- ---------------------------------------------------------------------------
-- Indexes for expected portal read patterns and foreign keys
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS ix_environments_client ON operations.environments (client_id);
CREATE INDEX IF NOT EXISTS ix_domains_environment ON operations.domains (client_id, environment_id);
CREATE INDEX IF NOT EXISTS ix_endpoints_environment ON operations.endpoints (client_id, environment_id);
CREATE INDEX IF NOT EXISTS ix_endpoints_domain ON operations.endpoints (client_id, domain_id);
CREATE INDEX IF NOT EXISTS ix_memberships_client ON operations.client_memberships (client_id);
CREATE INDEX IF NOT EXISTS ix_publishers_client ON operations.publishers (client_id);
CREATE INDEX IF NOT EXISTS ix_ingestion_receipts_created ON operations.ingestion_receipts (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_workflow_executions_observed ON operations.workflow_executions (client_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS ix_workflow_executions_definition ON operations.workflow_executions (client_id, workflow_definition_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS ix_workflow_executions_started ON operations.workflow_executions (client_id, started_at DESC);
CREATE INDEX IF NOT EXISTS ix_metric_samples_period ON operations.metric_samples (client_id, metric_definition_id, period_start DESC);
CREATE INDEX IF NOT EXISTS ix_metric_samples_observed ON operations.metric_samples (client_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS ix_endpoint_observations_checked ON operations.endpoint_observations (client_id, endpoint_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS ix_provider_connections_client ON operations.provider_connections (client_id, provider);
CREATE INDEX IF NOT EXISTS ix_deployments_client ON operations.deployments (client_id, provider, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_backup_evidence_client ON operations.backup_evidence (client_id, backup_timestamp DESC);
CREATE INDEX IF NOT EXISTS ix_restore_tests_client ON operations.restore_tests (client_id, started_at DESC);
CREATE INDEX IF NOT EXISTS ix_reports_month ON operations.reports (client_id, report_month DESC);
CREATE INDEX IF NOT EXISTS ix_report_findings_report ON operations.report_findings (client_id, report_id);
CREATE INDEX IF NOT EXISTS ix_report_events_report ON operations.report_events (client_id, report_id, occurred_at);
CREATE INDEX IF NOT EXISTS ix_report_commands_report ON operations.report_commands (client_id, report_id);
CREATE INDEX IF NOT EXISTS ix_incidents_client ON operations.incidents (client_id, state, started_at DESC);
CREATE INDEX IF NOT EXISTS ix_incident_events_incident ON operations.incident_events (client_id, incident_id, occurred_at);
CREATE INDEX IF NOT EXISTS ix_audit_events_occurred ON operations.audit_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS ix_audit_events_client ON operations.audit_events (client_id, occurred_at DESC);

COMMIT;
