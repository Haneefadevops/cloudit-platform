-- CloudIT Operations Portal — Phase 4 migration 0006: Cavetta catalogue seed.
--
-- Owner-visible catalogue data only (Phase 0 specification sections 3 and
-- 7.4): the Cavetta client, its production environment and domain, the five
-- registered public endpoints, the workflow catalogue from the documented
-- n8n inventory, and the allowed metric registry. No secrets are stored
-- here; the publisher row is created only when the operator provisions the
-- publisher secret through the protected environment (see
-- infra/scripts/ensure-operations-database.sh).
--
-- Every statement is idempotent (natural-key ON CONFLICT DO NOTHING) so the
-- migration can be re-applied by every deployment.

BEGIN;

-- Client, environment and domain -------------------------------------------

INSERT INTO operations.clients (client_key, display_name, state)
VALUES ('cavetta', 'Cavetta', 'active')
ON CONFLICT (client_key) DO NOTHING;

INSERT INTO operations.environments (client_id, environment_key, display_name, state)
SELECT id, 'production', 'Production', 'active'
FROM operations.clients
WHERE client_key = 'cavetta'
ON CONFLICT (client_id, environment_key) DO NOTHING;

INSERT INTO operations.domains (client_id, environment_id, domain_name, state)
SELECT c.id, e.id, 'cavetta.mt', 'active'
FROM operations.clients c
JOIN operations.environments e ON e.client_id = c.id AND e.environment_key = 'production'
WHERE c.client_key = 'cavetta'
ON CONFLICT (client_id, environment_id, domain_name) DO NOTHING;

-- Registered public endpoints (Phase 0 specification section 3: five
-- production public checks) -----------------------------------------------

INSERT INTO operations.endpoints (client_id, environment_id, domain_id, endpoint_key, display_name, monitor_kind, registered_path, expected_status_class, state)
SELECT c.id, e.id, d.id, v.endpoint_key, v.display_name, 'http', v.registered_path, 2, 'active'
FROM operations.clients c
JOIN operations.environments e ON e.client_id = c.id AND e.environment_key = 'production'
JOIN operations.domains d ON d.client_id = c.id AND d.environment_id = e.id AND d.domain_name = 'cavetta.mt'
JOIN (VALUES
  ('cavetta.website',  'Cavetta Website',  '/'),
  ('cavetta.listings', 'Cavetta Listings', '/properties'),
  ('cavetta.robots',   'Cavetta Robots',   '/robots.txt'),
  ('cavetta.sitemap',  'Cavetta Sitemap',  '/sitemap.xml')
) AS v(endpoint_key, display_name, registered_path) ON true
WHERE c.client_key = 'cavetta'
ON CONFLICT (client_id, endpoint_key) DO NOTHING;

-- The Supabase public REST properties endpoint has no operations-domain row;
-- it is registered without a domain.
INSERT INTO operations.endpoints (client_id, environment_id, endpoint_key, display_name, monitor_kind, registered_path, expected_status_class, state)
SELECT c.id, e.id, 'cavetta.public_api', 'Cavetta Public API', 'http', NULL, 2, 'active'
FROM operations.clients c
JOIN operations.environments e ON e.client_id = c.id AND e.environment_key = 'production'
WHERE c.client_key = 'cavetta'
ON CONFLICT (client_id, endpoint_key) DO NOTHING;

-- Publisher (created only when the secret is provisioned) -------------------
-- Secret env var: OPERATIONS_PUBLISHER_SECRET_CAVETTA_PRODUCTION_N8N in the
-- server's gitignored infra/postgres/.env. Stored as
-- '<salt hex>:<sha256 hex>' of 'salt:secret'; the secret is never stored
-- recoverably.

WITH s AS (SELECT encode(gen_random_bytes(8), 'hex') AS salt)
INSERT INTO operations.publishers (client_id, environment_id, publisher_key, display_name, key_hash, allowed_record_types)
SELECT c.id, e.id, 'cavetta-production-n8n', 'Cavetta production n8n publisher',
  s.salt || ':' || encode(public.digest((s.salt || ':' || :'publisher_secret_cavetta')::bytea, 'sha256'), 'hex'),
  ARRAY[
    'workflow_catalog', 'workflow_execution', 'endpoint_observation',
    'provider_connection', 'metric_sample', 'traffic_summary',
    'deployment_summary', 'backup_evidence', 'restore_test_evidence',
    'report_summary', 'report_finding', 'incident', 'audit_event'
  ]
FROM operations.clients c
JOIN operations.environments e ON e.client_id = c.id AND e.environment_key = 'production'
CROSS JOIN s
WHERE c.client_key = 'cavetta'
  AND :'publisher_secret_cavetta' <> ''
ON CONFLICT (publisher_key) DO NOTHING;

-- Workflow catalogue (Phase 0 specification section 3 inventory) ------------
-- Schedule expressions are cron in Europe/Malta as documented; proposed
-- completion windows become completion_sla_seconds until 30 days of live
-- timings are available (Phase 0 section 6 item 3).

INSERT INTO operations.workflow_definitions (
  client_id, environment_id, workflow_key, display_name, trigger_kind,
  schedule_expression, schedule_timezone, enabled, expected_start_rule,
  completion_sla_seconds, criticality
)
SELECT c.id, e.id, v.workflow_key, v.display_name, v.trigger_kind,
  v.schedule_expression, 'Europe/Malta', true, v.expected_start_rule,
  v.completion_sla_seconds, v.criticality
FROM operations.clients c
JOIN operations.environments e ON e.client_id = c.id AND e.environment_key = 'production'
JOIN (VALUES
  ('cavetta.load_maintenance_configuration', 'Cavetta - Load Maintenance Configuration', 'sub_workflow', NULL, 'sub-workflow call; complete within 30 seconds', 30, 'high'),
  ('cavetta.incident_monitor', 'Cavetta - Incident Monitor', 'webhook', NULL, 'webhook event; confirm DOWN within 3 minutes, UP within 1 minute', 180, 'critical'),
  ('cavetta.daily_backup_watchdog', 'Cavetta - Daily Backup Watchdog', 'cron', '15 7 * * *', 'daily 07:15 Europe/Malta; complete by 07:25', 600, 'high'),
  ('cavetta.weekly_health_check', 'Cavetta - Weekly Health Check', 'cron', '0 8 * * 1', 'Monday 08:00 Europe/Malta; complete by 08:15', 900, 'high'),
  ('cavetta.monthly_source_snapshot_capture', 'Cavetta - Monthly Source Snapshot Capture', 'cron', '0 0 1 * *', 'day 1 00:00 Europe/Malta; complete by 00:30', 1800, 'standard'),
  ('cavetta.monthly_maintenance_report_draft', 'Cavetta - Monthly Maintenance Report Draft', 'cron', '0 9 1 * *', 'day 1 09:00 Europe/Malta (first weekday); complete by 09:45', 2700, 'high'),
  ('cavetta.monthly_report_review', 'Cavetta - Monthly Report Review', 'webhook', NULL, 'review form decision; respond within 30 seconds', 30, 'standard'),
  ('cavetta.monthly_report_review_reminder', 'Cavetta - Monthly Report Review Reminder', 'cron', '15 9 * * *', 'daily 09:15 Europe/Malta; complete by 09:25', 600, 'low'),
  ('cavetta.approved_monthly_report_sender', 'Cavetta - Approved Monthly Report Sender', 'cron', '*/5 * * * *', 'every 5 minutes; normal claim within 5 minutes', 300, 'high'),
  ('cavetta.automation_watchdog', 'Cavetta - Automation Watchdog', 'cron', '*/15 * * * *', 'every 15 minutes; heartbeat evidence up to 45 minutes old', 2700, 'critical')
) AS v(workflow_key, display_name, trigger_kind, schedule_expression, expected_start_rule, completion_sla_seconds, criticality) ON true
WHERE c.client_key = 'cavetta'
ON CONFLICT (client_id, environment_id, workflow_key) DO NOTHING;

-- Allowed metric registry (Phase 0 specification section 7.4) ---------------
-- value_type, unit, frequency_seconds, freshness_seconds, retention_class.

INSERT INTO operations.metric_definitions (client_id, metric_key, display_name, value_type, unit, frequency_seconds, freshness_seconds, retention_class)
SELECT c.id, v.metric_key, v.display_name, v.value_type, v.unit, v.frequency_seconds, v.freshness_seconds, v.retention_class
FROM operations.clients c
JOIN (VALUES
  -- Workflow
  ('workflow.duration_ms',            'Workflow duration',            'number', 'ms',      900,  3600,  'detailed_90d'),
  ('workflow.schedule_delay_ms',      'Workflow schedule delay',      'number', 'ms',      900,  3600,  'detailed_90d'),
  ('workflow.success_count',          'Workflow success count',       'number', 'count',   900,  3600,  'detailed_90d'),
  ('workflow.failure_count',          'Workflow failure count',       'number', 'count',   900,  3600,  'detailed_90d'),
  ('workflow.missed_count',           'Workflow missed-run count',    'number', 'count',   900,  3600,  'detailed_90d'),
  ('workflow.success_percent',        'Workflow success percentage',  'number', 'percent', 900,  3600,  'detailed_90d'),
  -- Website
  ('website.availability',            'Website availability',         'boolean', 'up',     300,  1200,  'detailed_90d'),
  ('website.http_status',             'Website HTTP status',          'number', 'status',  300,  1200,  'detailed_90d'),
  ('website.response_time_ms',        'Website response time',        'number', 'ms',      300,  1200,  'detailed_90d'),
  ('website.tls_days_remaining',      'Website TLS days remaining',   'number', 'days',    3600, 86400, 'detailed_90d'),
  -- Supabase/PostgreSQL (15-minute collection per Phase 0 section 6)
  ('postgresql.up',                            'PostgreSQL up',                         'boolean', 'up',      900,  1800, 'detailed_90d'),
  ('postgresql.database_size_bytes',           'PostgreSQL database size',              'number', 'bytes',   900,  1800, 'daily_24m'),
  ('postgresql.connections_direct',            'PostgreSQL direct connections',         'number', 'count',   900,  1800, 'detailed_90d'),
  ('postgresql.connections_supavisor',         'Supavisor connections',                 'number', 'count',   900,  1800, 'detailed_90d'),
  ('postgresql.connections_pgbouncer',         'PgBouncer connections',                 'number', 'count',   900,  1800, 'detailed_90d'),
  ('postgresql.pgbouncer_max_clients',         'PgBouncer configured max clients',      'number', 'count',   900,  1800, 'daily_24m'),
  ('postgresql.pgbouncer_utilization_percent', 'PgBouncer utilization',                 'number', 'percent', 900,  1800, 'detailed_90d'),
  ('postgresql.waiting_connections',           'PostgreSQL waiting connections',        'number', 'count',   900,  1800, 'detailed_90d'),
  ('postgresql.disk_usage_percent',            'PostgreSQL disk usage',                 'number', 'percent', 900,  1800, 'detailed_90d'),
  ('postgresql.memory_usage_percent',          'PostgreSQL memory usage',               'number', 'percent', 900,  1800, 'detailed_90d'),
  ('postgresql.filesystem_read_only',          'PostgreSQL filesystem read-only',       'boolean', 'flag',  900,  1800, 'detailed_90d'),
  ('postgresql.oom_kill_count',                'PostgreSQL OOM kill count',             'number', 'count',   900,  1800, 'detailed_90d'),
  ('postgresql.restart_count',                 'PostgreSQL restart count',              'number', 'count',   900,  1800, 'detailed_90d'),
  -- Vercel
  ('vercel.visitors',                 'Vercel visitors',              'number', 'count',   86400, 86400, 'daily_24m'),
  ('vercel.pageviews',                'Vercel pageviews',             'number', 'count',   86400, 86400, 'daily_24m'),
  -- ImageKit (six-hour provider cache per Phase 0 section 7.4)
  ('imagekit.bandwidth_bytes',              'ImageKit bandwidth',               'number', 'bytes',   21600, 43200, 'daily_24m'),
  ('imagekit.media_library_storage_bytes',  'ImageKit Media Library storage',   'number', 'bytes',   21600, 43200, 'daily_24m'),
  ('imagekit.video_processing_units',       'ImageKit video processing units',  'number', 'units',   21600, 43200, 'daily_24m'),
  ('imagekit.extension_units',              'ImageKit extension units',         'number', 'units',   21600, 43200, 'daily_24m'),
  ('imagekit.original_cache_storage_bytes', 'ImageKit original cache storage',  'number', 'bytes',   21600, 43200, 'daily_24m'),
  ('imagekit.quota_utilization_percent',    'ImageKit quota utilization',       'number', 'percent', 21600, 43200, 'daily_24m'),
  -- Backup / restore
  ('backup.size_bytes',               'Backup encrypted size',        'number', 'bytes',   86400, 86400, 'permanent'),
  ('backup.duration_ms',              'Backup run duration',          'number', 'ms',      86400, 86400, 'permanent'),
  ('backup.age_seconds',              'Backup age',                   'number', 'seconds', 86400, 86400, 'permanent'),
  ('backup.success',                  'Backup success',               'boolean', 'flag',   86400, 86400, 'permanent'),
  ('backup.checksum_verified',        'Backup checksum verified',     'boolean', 'flag',   86400, 86400, 'permanent'),
  ('backup.drive_round_trip_passed',  'Backup Drive round-trip',      'boolean', 'flag',   86400, 86400, 'permanent'),
  ('restore.duration_ms',             'Restore test duration',        'number', 'ms',      86400, 86400, 'permanent'),
  ('restore.success',                 'Restore test success',         'boolean', 'flag',   86400, 86400, 'permanent'),
  -- GA4 (exact-month snapshots)
  ('ga4.total_users',        'GA4 total users',        'number', 'count', 86400, 86400, 'daily_24m'),
  ('ga4.new_users',          'GA4 new users',          'number', 'count', 86400, 86400, 'daily_24m'),
  ('ga4.sessions',           'GA4 sessions',           'number', 'count', 86400, 86400, 'daily_24m'),
  ('ga4.screen_page_views',  'GA4 screen page views',  'number', 'count', 86400, 86400, 'daily_24m')
) AS v(metric_key, display_name, value_type, unit, frequency_seconds, freshness_seconds, retention_class) ON true
WHERE c.client_key = 'cavetta'
ON CONFLICT (client_id, metric_key) DO NOTHING;

COMMIT;
