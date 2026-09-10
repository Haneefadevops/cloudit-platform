# CloudIT Operations Portal — Phase 3 Operations Database

Status: **IMPLEMENTED — awaiting owner approval at the Phase 3 gate**
Date: 12 September 2026
Scope: operations database only. No n8n connection, no provider
integration, no real evidence ingestion (Phase 4), no report action, no
ticketing, no client notifications.

## Delivered

- Dedicated `operations` database inside the existing private PostgreSQL
  Docker service (`infra/postgres/docker-compose.yml`, `pgvector/pgvector:pg16`).
  The service still publishes no port and stays on the private `cloudit`
  network. The n8n database, the Cavetta Supabase project and every other
  application database were not touched by any migration.
- The Phase 0 specification section 8.1 data model as idempotent migrations
  under `infra/postgres/operations/migrations/`:
  - `clients`, `environments`, `domains`, `endpoints`;
  - `user_profiles`, `client_memberships`;
  - `publishers`, `ingestion_receipts`;
  - `workflow_definitions`, `workflow_steps`, `workflow_executions`;
  - `metric_definitions`, `metric_samples`, `endpoint_observations`,
    `provider_connections`, `deployments`;
  - `backup_evidence`, `restore_tests`;
  - `reports`, `report_findings`, `report_events`, `report_commands`;
  - `incidents`, `incident_events`, `audit_events` (25 tables).
- Data-model guarantees implemented and tested:
  - every tenant table has a non-null `client_id`;
  - child tables use composite foreign keys `(client_id, parent_id)` so a row
    can never link to another client's parent (proven by negative tests);
  - ingested evidence tables carry a unique
    `(publisher_id, source_record_type, idempotency_key)` constraint so
    retries create no duplicates;
  - `audit_events`, `report_events`, `incident_events` and
    `ingestion_receipts` are append-only for portal users, ingestion
    publishers and the provisioning admin (trigger-enforced; only the future,
    separately approved `operations_maintenance` role is accepted);
  - all timestamps are `timestamptz` (UTC); display conversion stays explicit;
  - `clients.client_key` is immutable (trigger-enforced).
- Least-privilege role model (migration 0001):
  - `operations_anon` — NOLOGIN, zero grants (anonymous identity);
  - `operations_owner` — the portal application login; catalogue/config DML
    and evidence SELECT only; row scope enforced by RLS policies that read
    per-transaction `operations.global_role` / `operations.user_id` settings
    and are fail-closed when unset; viewer contexts are structurally
    read-only even though the connection role holds table grants;
  - `operations_ingest` — the Phase 4 ingestion login; zero table privileges,
    `EXECUTE` on `operations_ingest.submit_batch` only;
  - `operations_maintenance` — NOLOGIN placeholder for later approved
    retention work.
- Private security-definer helpers in `operations_private` with an empty
  `search_path` and no PUBLIC execute: `has_client_access`, `is_owner_context`,
  `record_audit_event`, `create_report_command` (role-checked,
  compare-and-set stale-version and nonce-replay guarded).
- `operations_ingest.submit_batch` — the private, server-side ingestion entry
  point for the Phase 4 publishing endpoint: publisher key + salted SHA-256
  secret verification (the secret is never stored recoverably), tenant
  identity strictly from the authenticated publisher row, full envelope and
  strict per-record payload validation (contract version, record-type scope,
  environment scope, closed enums, safe failure categories, safe text without
  URLs, 500-record / 1 MiB limits, ±5-minute publishedAt freshness), complete
  transactional validation (partial acceptance is forbidden), per-record
  idempotent replay counting, append-only receipts, denied-attempt audit
  events, and responses limited to receipt id, safe counts and safe codes.
- Report-state mirror guards: `document_status` can never regress from
  `SENT`, `sent_at` is preserved once set, and state transitions append
  `report_events` rows.
- Provisioning: `infra/scripts/ensure-operations-database.sh` (idempotent,
  wired into `infra/scripts/deploy.sh` after `ensure-databases.sh`; the
  `operations` database is also in the `DATABASES` list of
  `infra/scripts/ensure-databases.sh`). Role passwords are applied from the
  protected, gitignored server `infra/postgres/.env`
  (`OPERATIONS_DB_OWNER_PASSWORD`, `OPERATIONS_DB_INGEST_PASSWORD`; the
  placeholders were added to `.env.example`); when absent the script warns
  instead of failing the deployment, leaving the logins without passwords.
- Gate suite: `infra/postgres/operations/tests/isolation-tests.sh` driving
  `isolation-tests.sql` — a single-transaction suite (everything rolls back;
  verified zero rows remain) covering the Phase 3 gate below.

## Explicitly not delivered in Phase 3

- No n8n workflow, credential, webhook or data change; no provider
  integration; no real evidence ingested anywhere.
- No portal application database connection (the app is not wired to
  PostgreSQL yet; that arrives with the Phase 4/5 read paths).
- No report viewing or action; no approve/reject/send; `sentAt` guards
  untouched. Ticketing and client notifications remain disabled.
- No retention automation (retention classes are defined on
  `metric_definitions`; deletion remains a separately approved future phase
  using `operations_maintenance`).

## Local verification evidence (12 September 2026)

Environment: throwaway Docker container `operations-phase3-test` running the
identical server image `pgvector/pgvector:pg16`, isolated from every other
database; migrations applied by the same script that runs in deploys.

- Fresh database, first provisioning run: `OK: 4 roles, 25 tables,
  migrations applied`.
- Provisioning re-run on an already-provisioned database (idempotency): same
  OK result.
- Password provisioning path: with both protected values present, both login
  roles received passwords (verified via `pg_authid`); with them absent the
  script printed its warnings and exited 0.
- Phase 3 gate suite: **89 assertions, 89 passed, 0 failed**
  (`ALL TESTS PASSED`, exit 0), covering:
  - anonymous denial: `operations_anon` denied on SELECT/INSERT/calls across
    schemas (5 assertions);
  - fail-closed default: `operations_owner` without an identity GUC sees zero
    rows;
  - owner access: full client visibility, identity management,
    catalogue/config DML allowed, direct evidence/audit writes denied,
    audit entry through the guarded function;
  - client isolation: assigned viewer A/B see only their client across
    clients, environments, publishers and reports; unassigned viewer,
    disabled membership and disabled user see nothing; viewer write attempts
    (INSERT/UPDATE) denied;
  - composite tenant foreign keys: cross-client domain, execution↔publisher,
    finding↔report pairings all rejected with foreign-key violations;
  - ingestion authentication: unknown publisher, wrong secret, disabled
    publisher all rejected with safe codes and no receipt; each failure
    produced exactly one denied audit event;
  - ingestion scope/validation: cross-tenant endpoint key, unallowed record
    type, unknown field, forbidden field (`stack`/`token`), invalid enum,
    stale `publishedAt`, malformed timestamp, wrong `environmentKey`,
    oversize batch (501 records), invalid dimensions, metric value-type
    mismatch, unknown metric and unsafe public route (`/admin/...`) all
    rejected; a mixed valid+invalid batch was rejected atomically with zero
    rows written;
  - idempotency: nonce replay returned the original receipt
    (`duplicate_batch`), record replay counted duplicates without new rows;
  - report mirror: DRAFT → APPROVED → SENT transitions appended one
    `report_events` row each; a later DRAFT re-ingest did not regress SENT
    and preserved `sent_at`;
  - incident dedupe: occurrence counts incremented, recovery appended an
    `incident_events` row;
  - report commands: owner creation accepted; stale expected-version and
    nonce replay rejected with `rejected_stale_version`/`rejected_replay`;
    a viewer acting identity was rejected with `denied_role`;
  - append-only: UPDATE/DELETE on `audit_events`, `report_events`,
    `incident_events` and `ingestion_receipts` denied even to the
    provisioning admin (`append_only_table`);
  - secret hygiene: publisher hash never contains the secret, ingestion
    responses expose only the fixed safe-key set, receipts carry no secrets.
- Post-suite check: `clients + audit_events + ingestion_receipts +
  workflow_executions` row counts all 0 — nothing left behind.
- All publisher secrets used in the suite are throwaway test-only values that
  existed solely inside the rolled-back transaction.

## Production acceptance (server) — pending

- [ ] Owner provisions `OPERATIONS_DB_OWNER_PASSWORD` and
      `OPERATIONS_DB_INGEST_PASSWORD` in the server's gitignored
      `infra/postgres/.env` (long random values, no `$`).
- [ ] Portal-only Phase 3 commit pushed to master; deploy workflow green
      (the deploy log shows `Database 'operations' created` on first run and
      `ensure-operations-database ... OK` on every later run).
- [ ] Owner (or operator on the server) runs
      `bash infra/postgres/operations/tests/isolation-tests.sh` against the
      production `operations` database; result `ALL TESTS PASSED`.
- [ ] Confirm no other database was modified: only `operations` appears as
      new; the n8n database and all application databases are untouched.
- [ ] Owner explicitly approves Phase 3.

## Notes for Phase 4

- The ingestion HTTP endpoint must connect as `operations_ingest` and call
  `operations_ingest.submit_batch`; HMAC request signing and replay checks
  from Phase 0 section 7.1 belong to that endpoint, which stays private
  (no public route, no browser access).
- First real evidence requires seeded rows: the Cavetta client, its
  production environment, endpoints, workflow catalogue entries, metric
  definitions and at least one publisher — all owner-visible catalogue data,
  never secrets.
- `OPERATIONS_MFA_REQUIRED` remains `false`; TOTP must be enabled no later
  than before Phase 10 report actions.

## Gate

Per the approved plan, Phase 3 stops here. Phase 4 (sanitized n8n
publishing) begins only after the owner explicitly approves this gate.
