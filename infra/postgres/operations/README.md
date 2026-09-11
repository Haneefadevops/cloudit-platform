# CloudIT Operations Database

Dedicated multi-client operational database for the CloudIT Operations Portal
(`operations.cloudit.lk`). It runs inside the existing private PostgreSQL
Docker service (`infra/postgres/docker-compose.yml`, image
`pgvector/pgvector:pg16`) on the internal `cloudit` network only — no public
port. The n8n database and every other application database are never used.

## Layout

- `migrations/0001_roles.sql` — dedicated cluster roles:
  - `operations_anon` — anonymous identity: no grants, NOLOGIN.
  - `operations_owner` — portal application login (`cloud_owner` row scope is
    enforced by RLS plus per-transaction `operations.global_role` /
    `operations.user_id` settings; fail-closed when unset).
  - `operations_ingest` — ingestion login with zero table privileges; it can
    only `EXECUTE operations_ingest.submit_batch(...)`.
  - `operations_maintenance` — future, separately approved retention role;
    the only role append-only triggers accept.
- `migrations/0002_schema.sql` — the Phase 0 section 8.1 data model: clients,
  environments, domains, endpoints, user profiles/memberships, publishers,
  ingestion receipts, workflow catalogue/steps/executions, metric
  definitions/samples, endpoint observations, provider connections,
  deployments, backup/restore evidence, reports/findings/events/commands,
  incidents/incident events, audit events. Every tenant table has a non-null
  `client_id`; children use composite foreign keys `(client_id, parent_id)`;
  ingested tables carry a unique `(publisher_id, source_record_type,
  idempotency_key)` constraint; all times are `timestamptz`.
- `migrations/0003_security.sql` — explicit grants, row-level security with
  active-membership policies, private security-definer helpers (empty
  `search_path`, no PUBLIC execute), append-only triggers, audit/command entry
  functions.
- `migrations/0004_ingest.sql` / `0005_ingest_records.sql` — strict envelope
  and payload validation plus the per-record writers for the Phase 0 section
  7 publishing contract. Tenant identity always comes from the authenticated
  publisher, never from the request body.
- `migrations/0006_seed_cavetta.sql` — Phase 4 owner-visible catalogue seed:
  the Cavetta client, production environment and `cavetta.mt` domain, the
  five registered public endpoints, the ten documented n8n workflow catalogue
  entries and the Phase 0 section 7.4 metric registry. The Cavetta publisher
  row is created only when `OPERATIONS_PUBLISHER_SECRET_CAVETTA_PRODUCTION_N8N`
  is provisioned in the protected server env (stored as a salted hash).

## Provisioning

`infra/scripts/ensure-operations-database.sh` (invoked by
`infra/scripts/deploy.sh` after `ensure-databases.sh`) creates the
`operations` database if needed, applies every migration idempotently and
applies role passwords when the protected environment values exist. It warns
instead of failing when passwords are absent.

Protected values (server-side `infra/postgres/.env`, gitignored, never
committed, no `$` characters):

- `OPERATIONS_DB_OWNER_PASSWORD` — portal application login password.
- `OPERATIONS_DB_INGEST_PASSWORD` — ingestion login password (needed by the
  Phase 4 publishing endpoint).

## Gate tests

`tests/isolation-tests.sh` runs the Phase 3 gate suite
(`tests/isolation-tests.sql`): anonymous denial, owner access, viewer
isolation (assigned/unassigned/disabled), composite-tenant foreign key
negative tests, ingestion authentication/scope/replay/idempotency, report
SENT regression guard, append-only enforcement and secret hygiene. The suite
runs in a single transaction and rolls back — it never leaves rows behind.
