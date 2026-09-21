-- 0014_reader_rls_select.sql — make operations_reader rows visible under
-- row-level security. The operations tables carry tenant_isolation RLS
-- policies scoped to operations_owner only, so a role with plain SELECT
-- grants still sees zero rows (RLS default-deny). The soak driver's
-- observer (client 'cavetta', single-tenant MVP) needs full visibility of
-- the evidence tables; the role remains SELECT-only at the privilege
-- level, so these policies grant visibility, not write power.
-- Idempotent: each policy is created only if a policy of that name does
-- not already exist on the table.

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'workflow_definitions',
    'workflow_executions',
    'metric_definitions',
    'metric_samples',
    'endpoint_observations',
    'provider_connections',
    'deployments',
    'backup_evidence',
    'restore_tests',
    'reports',
    'report_findings',
    'incidents',
    'incident_events',
    'clients',
    'environments',
    'endpoints'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'operations' AND tablename = t AND policyname = 'reader_select'
    ) THEN
      EXECUTE format(
        'CREATE POLICY reader_select ON operations.%I FOR SELECT TO operations_reader USING (true)',
        t
      );
    END IF;
  END LOOP;
END
$$;
