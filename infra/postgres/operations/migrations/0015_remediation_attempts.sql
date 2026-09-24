-- Phase H: durable remediation-attempt ledger for Tier A executions.
--
-- operations.remediation_attempts is the ONLY durable exactly-once mechanism
-- for real remediation executions: exactly-once semantics rely on the
-- idempotency_key unique constraint, so replays, concurrent claims and
-- container restarts can never produce a second attempt for the same logical
-- repair. Rows are append-only audit evidence: they are claimed and then
-- finalized exactly once, never removed (no DELETE by design) — the only
-- mutation path is the RUNNING -> SUCCEEDED/FAILED transition.
--
-- The operations-agent connects with the operations_reader role established
-- in migration 0012. That role stays read-only on every evidence table; the
-- single exception is this ledger, scoped to this table only, with
-- SELECT, INSERT, UPDATE and never DELETE.
--
-- Only migration 0015 objects are defined here; older migrations are not
-- edited. Everything is idempotent (IF NOT EXISTS; no drops, no deletes).

BEGIN;

CREATE TABLE IF NOT EXISTS operations.remediation_attempts (
  attempt_id       text PRIMARY KEY,
  runbook_key      text NOT NULL,
  runbook_version  text NOT NULL,
  target_key       text NOT NULL,
  issue_code       text NOT NULL,
  idempotency_key  text NOT NULL,
  status           text NOT NULL,
  result_code      text NULL,
  claimed_at       timestamptz NOT NULL,
  finished_at      timestamptz NULL,
  summary          text NOT NULL,
  client_key       text NOT NULL,
  environment_key  text NOT NULL,
  CONSTRAINT uq_remediation_attempts_idempotency_key UNIQUE (idempotency_key),
  CONSTRAINT remediation_attempts_status_check CHECK (
    status IN ('RUNNING', 'SUCCEEDED', 'FAILED')
  ),
  CONSTRAINT remediation_attempts_result_code_check CHECK (
    result_code IS NULL OR result_code IN (
      'RECOVERED',
      'CONFIRMED_STALE',
      'SOURCE_FAILED',
      'PRECONDITION_FAILED',
      'BLOCKED_KILL_SWITCH',
      'TIMED_OUT',
      'INTERNAL_ERROR'
    )
  ),
  -- Lifecycle invariant: an attempt is RUNNING exactly while it is
  -- unfinished; finalized rows always carry their finish timestamp.
  CONSTRAINT remediation_attempts_lifecycle_check CHECK (
    (status = 'RUNNING') = (finished_at IS NULL)
  )
);

-- Boot-recovery sweep (finalizeStaleRunning) scans RUNNING rows by claim age.
CREATE INDEX IF NOT EXISTS ix_remediation_attempts_status_claimed
  ON operations.remediation_attempts (status, claimed_at);

REVOKE ALL ON operations.remediation_attempts FROM PUBLIC;
REVOKE ALL ON operations.remediation_attempts FROM operations_ingest, operations_anon;

-- Scoped to this table only: no DELETE, no broader privileges. Together with
-- the append-only table design (no delete path in code or schema) this makes
-- the ledger tamper-evident audit evidence.
GRANT SELECT, INSERT, UPDATE ON operations.remediation_attempts TO operations_reader;

COMMIT;
