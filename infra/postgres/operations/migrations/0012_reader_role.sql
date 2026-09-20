-- 0012_reader_role.sql — least-privilege read-only role for the operations-agent
-- soak driver (Phase F soak). SELECT-only on the evidence tables the
-- deterministic supervisor needs; no catalogue DML, no operations_ingest
-- schema, no audit/command tables. The LOGIN password is set separately by
-- infra/scripts/deploy.sh from the agent's protected env — never in Git.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'operations_reader') THEN
    CREATE ROLE operations_reader LOGIN;
  END IF;
END
$$;

GRANT CONNECT ON DATABASE operations TO operations_reader;
GRANT USAGE ON SCHEMA operations TO operations_reader;

GRANT SELECT ON
  operations.workflow_definitions,
  operations.workflow_executions,
  operations.metric_definitions,
  operations.metric_samples,
  operations.endpoint_observations,
  operations.provider_connections,
  operations.deployments,
  operations.backup_evidence,
  operations.restore_tests,
  operations.reports,
  operations.report_findings,
  operations.incidents,
  operations.incident_events
TO operations_reader;
