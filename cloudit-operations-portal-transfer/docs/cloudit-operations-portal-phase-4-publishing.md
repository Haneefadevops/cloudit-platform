# CloudIT Operations Portal — Phase 4 acceptance: sanitized n8n publishing

Date: 11 September 2026
Status: implemented; awaiting owner acceptance at the Phase 4 gate

## Scope delivered (approved plan, Phase 4)

Private ingestion path for sanitized n8n evidence per Phase 0 section 7:

- `apps/operations-ingest` — the private ingestion endpoint service
  (`@cloudit/operations-ingest`). Plain Node/TypeScript HTTP service; no
  published port, no reverse-proxy route; reachable only on the private
  `cloudit` Docker network (n8n). Endpoints: `GET /health` and
  `POST /v1/batches`.
- Transport trust per Phase 0 section 7.1: per-publisher secret,
  `x-signature = HMAC-SHA256(secret, "timestamp.nonce.sha256(body)")`,
  timestamp tolerance ±5 minutes, body limit 1 MiB, known-publisher check,
  constant-time signature comparison. All authentication, nonce-replay,
  validation, idempotency and tenant scoping are enforced inside the database
  by `operations_ingest.submit_batch`; the service adds no second source of
  truth. Reused batch nonces return the original receipt (idempotent retry is
  a success, never an error); record-level `idempotencyKey` replays count as
  duplicates without new rows.
- Responses and logs carry only receipt ids, safe machine codes and counts —
  never payloads, secrets or stack traces.
- `infra/postgres/operations/migrations/0006_seed_cavetta.sql` — idempotent
  owner-visible catalogue seed: Cavetta client, production environment,
  `cavetta.mt` domain, the five registered public endpoints, the ten
  documented n8n workflow catalogue entries (schedules and proposed SLAs from
  Phase 0 section 3), and the Phase 0 section 7.4 metric registry (43 metric
  definitions). The `cavetta-production-n8n` publisher row is created only
  when `OPERATIONS_PUBLISHER_SECRET_CAVETTA_PRODUCTION_N8N` is provisioned in
  the protected server env (stored as `<salt>:<sha256>`; the secret is never
  stored recoverably).
- `infra/scripts/ensure-operations-database.sh` — passes the publisher secret
  into migration 0006 and warns while it is unprovisioned.
- `infra/operations-ingest/` — Dockerfile and Compose for the new container
  (private network only, health check, read-only rootfs, resource limits);
  `infra/scripts/deploy.sh` builds and starts it after the operations database
  ensure step.
- `infra/n8n/workflows/cloudit-publish-operations-evidence.json` — the
  reusable sub-workflow template `CloudIT - Publish Operations Evidence`
  (sign → POST → assert), plus README wiring notes. The publisher secret is
  read by the sub-workflow from the n8n container environment
  (`OPERATIONS_PUBLISHER_SECRET_<KEY>`); the same value lives in
  `infra/postgres/.env` for the service and (hashed) in the database.

## Local verification evidence

- Worktree `npm ci` clean; `@cloudit/operations-ingest` typecheck and build
  green; `@cloudit/operations-web` typecheck, lint and build still green;
  `@cloudit/ui` build green.
- Fresh throwaway `pgvector/pgvector:pg16` container: migrations `0001`–
  `0006` applied in order, idempotent re-run clean
  (`OK: 4 roles, 25 tables, Cavetta catalogue seeded`); seed verified
  (1 client, 1 environment, 1 domain, 5 endpoints, 10 workflows,
  43 metrics, 1 publisher with a well-formed salted hash).
- `infra/operations-ingest/tests/smoke.mjs` against the service and the
  throwaway database — 12/12 PASS:
  health; signed batch accepted; same-request retry returns the original
  receipt (`duplicate_batch`, identical receipt id); record replay counted
  duplicate with no extra row (verified in the database); invalid signature,
  stale timestamp and unknown publisher rejected (401); reused nonce with a
  different body returns the original receipt and writes nothing; forbidden
  payload field rejected (422); mixed valid+invalid batch rejected
  atomically with zero rows written; oversized body rejected (413).

## Production acceptance (server) — pending owner

Deploy evidence (GitHub Actions "Deploy to Hetzner" on master):

- Run 34570520650 (first Phase 4 deploy) failed: the runtime image copied
  only `dist/`, so the container crash-looped with `Cannot find module 'pg'`.
  Fixed in `4e00c1d` by copying the hoisted workspace `node_modules` into the
  runner image. Verified locally: the built image passes the full 12-check
  smoke suite against throwaway containers.
- Run 34571069458 green: deploy log shows
  `ensure-operations-database OK: 4 roles, 25 tables, Cavetta catalogue
  seeded`, `operations-ingest is healthy` and all health checks passed. The
  publisher-secret warning is expected until the owner provisions the secret
  below. `https://operations.cloudit.lk` remains HTTP 200.

Checklist:

- [x] Portal-only Phase 4 commits pushed to master; deploy workflow green
      with the private ingest service healthy.
- [ ] Owner generates one long random publisher secret (no `$`) and adds it
      to `infra/postgres/.env` as
      `OPERATIONS_PUBLISHER_SECRET_CAVETTA_PRODUCTION_N8N`. The ingest
      service and the n8n container both read that file (n8n's Compose has an
      explicit `env_file` for it); the n8n container must be recreated after
      adding it (`docker compose -f infra/n8n/docker-compose.yml up -d`).
- [ ] Deploy workflow green; the deploy log shows
      `operations-ingest is healthy` and the ensure step reporting the
      Cavetta catalogue seeded.
- [ ] Owner imports `infra/n8n/workflows/cloudit-publish-operations-evidence.json`
      into n8n and wires ONE existing workflow to call it (the Automation
      Watchdog summary or workflow executions are the suggested first
      publisher), per the README in `infra/n8n/workflows/`.
- [ ] Gate (approved plan): compare every published Cavetta record with its
      n8n source, retry the ingestion and prove no duplicate record is
      created (receipt replay returns the original receipt; row counts do not
      grow on retry).
- [ ] Confirm the operations database remains the only new/changed database;
      the n8n database is untouched by the portal.
- [ ] Owner explicitly approves Phase 4.

## Notes for Phase 5

- Read paths from the operations database to the portal UI (overview,
  workflow visualization) begin in Phase 5, connecting as `operations_owner`.
- First real evidence should flow through the seeded catalogue keys; the
  workflow catalogue upsert via `workflow_catalog` records will attach live
  publisher metadata to the seeded rows.
- `OPERATIONS_MFA_REQUIRED` remains `false`; TOTP must be enabled no later
  than before Phase 10 report actions. Ticketing and client notifications
  remain disabled.

## Gate

Per the approved plan, Phase 4 stops here. Phase 5 (overview and workflow
visualization) begins only after the owner explicitly approves this gate.
