# CloudIT Operations Portal — Phase 5 acceptance: overview and workflow visualization

Date: 12 September 2026
Status: deployed to production (master `b3905df`, deploy run 34691767576
green 12 Sep 2026 ~12:02 UTC); live verification passed; awaiting owner
sign-off at the Phase 5 gate

## Scope delivered (approved plan, Phase 5)

Read-only operational read path from the operations database to the portal UI:

- `apps/platform-api/src/operations/` — new `OperationsModule` (NestJS):
  - `operations-data.service.ts` — dedicated `pg` Pool as `operations_owner`
    (`search_path=operations`, 15 s statement timeout). Every query runs in a
    transaction that first executes `SET LOCAL operations.global_role =
    'cloud_owner'`, so Row Level Security (`operations_private.has_client_access`)
    is enforced by the database and fails closed when the GUC is absent. SELECT
    only; no insert/update/delete path exists in the module, matching the
    role's least-privilege grants.
  - `operations-internal-auth.guard.ts` — every endpoint requires header
    `x-operations-internal-token` matching `OPERATIONS_INTERNAL_API_TOKEN`
    (constant-time). No token / wrong token → 401 with the safe body
    `{"statusCode":401,"message":"Unauthorized"}`.
  - `operations-exception.filter.ts` — module-scoped safe error bodies (no
    stack, no SQL); unknown workflows → 404 `{"statusCode":404,"message":"Not found"}`;
    invalid window → 400.
  - Endpoints (global prefix `api`, private `cloudit` network only — no Traefik
    route, no public exposure):
    - `GET /api/operations/overview` — per client/environment: domains,
      per-workflow health (latest outcome, status, duration, schedule delay,
      failure category, success % 24 h/7 d), evidence freshness per
      source_system, and a computed GREEN/AMBER/RED/NO_DATA environment rollup
      per the Phase 0 §11.1/§11.2 rules.
    - `GET /api/operations/workflows?window=24h|7d|30d` — catalogue with
      schedule (cron + Europe/Malta timezone), SLA, criticality, latest
      execution, last success, computed `nextExpectedRun` (dependency-free
      5-field cron parser, 26 unit tests), overdue state, window success %.
    - `GET /api/operations/workflows/:workflowKey` — definition summary,
      success % for 24 h/7 d/30 d, and the most recent 50 executions
      (newest first).
  - Responses expose only contract-safe fields: no database uuids, publisher
    ids, ingestion receipt ids, key hashes, idempotency keys, or `failure_code`.
- `apps/operations-web` — real pages replace the Phase 2 placeholders via the
  existing protected catch-all route:
  - `/overview` — client/environment health cards with status pills (text +
    colour, never colour alone), per-workflow health table, evidence freshness
    with age, explicit Europe/Malta timezone labels, last-updated line, and
    loading skeleton + safe error states.
  - `/workflows` — catalogue table with schedule vs actual, outcomes, SLA /
    overdue pills, success %, and a link-based (`?window=`) range selector so
    it stays server-rendered.
  - `/workflows/[key]` — definition summary, success-% cards, recent execution
    timeline, and the workflow-diagram section in its approved empty state
    ("Curated step diagram is not available for this workflow yet.") — no
    `workflow_steps` rows are seeded yet and none were fabricated.
  - Data fetching is server-only (`lib/operations-api.ts`, `no-store`, 5 s
    timeout); the internal token never reaches the browser; raw transport
    errors never reach the page.
- Infra: `infra/platform-api/docker-compose.yml` receives the operations env
  from the protected `../postgres/.env` (same pattern as `operations-ingest`,
  which already sources its credentials there); literal `OPERATIONS_DB_HOST/
  PORT/NAME/USER` entries; no published ports; no `$` in any value.
  `apps/platform-api/.env.example` and `apps/operations-web/.env.example` list
  the new variable names as commented placeholders only.
- No migrations, no schema changes, no writes anywhere; `operations_ingest`,
  the n8n workflows, and every other database untouched.

## Gate evidence — 12 September 2026

### Anonymous denial: PASS

- Portal: unauthenticated `GET /overview` → 307 to `/login?returnTo=%2Foverview`,
  response body is the login page; zero occurrences of workflow/execution data.
  Wrong password → 303 to the generic `error=invalid` login state.
- API: no token and wrong token → 401 `{"statusCode":401,"message":"Unauthorized"}`.

### Owner sees all: PASS

Throwaway `pgvector/pgvector:pg16` container, migrations 0001–0006 applied,
catalogue seed verified (1 client, 1 environment, 5 endpoints, 10 workflows,
43 metrics, 1 publisher). A second throwaway client `testclient-b` (own
environment, domain, workflow, executions, publisher) plus two `client_viewer`
user profiles with per-client memberships were inserted locally.

- `GET /api/operations/overview` → 200, both `cavetta` and `testclient-b`
  present with their per-workflow health.
- Response-key audit over full bodies: 0 matches for `id`, `publisher`,
  `keyHash`, `idempotency`, `secret`, `password` — only the safe allowlisted
  keys are returned.

### Cross-tenant isolation: PASS

SQL-level proof as `operations_owner` against the throwaway DB:

- `cloud_owner` GUC → `workflow_executions` count 4 (both clients).
- `client_viewer` GUC + viewer-A membership → only `cavetta | 2`.
- `client_viewer` GUC + viewer-B membership → only `testclient-b | 2`
  (verbatim: cross-tenant rows are invisible; changing tenant context cannot
  expose another client).
- No GUCs set → count 0 (fail closed; the API always sets the owner GUC, and
  future client sessions will set their own user GUC through the same path).

### Field-by-field comparison with the Phase 4 production evidence: PASS

The throwaway DB was seeded with the two production watchdog records documented
on 11 September 2026 (runs ~21:29 and ~21:42 UTC; `watchdog-exec-9091` accepted
under receipt `ff7a1a28-e607-4f3f-8910-f4f29e11f7da`; the idempotent retry added
no row — count stayed 2).

| Field | Phase 4 doc (production) | API / UI (local) |
| --- | --- | --- |
| workflowKey | cavetta.automation_watchdog | matches |
| executionKey 9091 / 9090 | watchdog-exec-9091; earlier run confirmed | both present, newest first |
| outcome | success (both) | success / success, status GREEN |
| startedAt | ~21:29 / ~21:42 UTC 11 Sep 2026 | 23:29 / 23:42 Europe/Malta (correct +2 conversion) |
| counts | exactly 2; retry wrote no row | executionCount 2; DB count 2 |

Locally reconstructed (not in the doc, marked as such): `durationMs=12000`,
`scheduleDelayMs=30000`, and the exact `scheduledFor`/`finishedAt` seconds.
Because the seeded timestamps are from 11 September while the check ran on
12 September, the environment rollup correctly renders **AMBER — stale
evidence** and the watchdog row **OVERDUE**, demonstrating the freshness logic
rather than hiding it.

### Screenshots (desktop 1440 px + 390 px)

`.worktrees/master-portal/.scratch/phase5-ui/` (gitignored, not committed):

- `overview-1440.png`, `overview-390.png`
- `workflows-1440.png`
- `workflow-detail-1440.png`, `workflow-detail-390.png`
- `workflow-diagram-empty-state.png`
- `anonymous-redirect-to-login.png`

### Build / test verification (worktree)

- `platform-api`: `nest build` green; jest 4 suites / 37 tests pass (26 new
  cron + health-rollup tests).
- `operations-web`: `tsc --noEmit` clean, `next lint` clean, production build
  green (standalone output; new routes server-rendered dynamic).
- `operations-ingest` and `packages/ui` builds still green.
- The pre-existing repo-wide lint debt in `platform-api` (~287 errors in
  auth/users/organizations etc.) is untouched and unrelated; all new files are
  lint-clean.

## Live production verification — 12 September 2026 (Europe/Malta)

- Deploy run 34691767576 green; `operations-web` and `platform-api`
  recreated with the new build; all health checks passed; anonymous `/`
  still redirects to `/login`; `/api/health` 200.
- Root cause of the initial stale view: both n8n workflows (`Cavetta -
  Automation Watchdog` and the `CloudIT - Publish Operations Evidence v2`
  sub-workflow) were unpublished, so no evidence had flowed since the
  11 Sep gate tests. The portal correctly rendered that as AMBER
  "Stale evidence" and OVERDUE — the freshness logic was proven against
  reality, not against a mock.
- After the owner published both workflows, the next scheduled run
  published end-to-end: new execution row 12 Sep 2026 14:15:17
  Europe/Malta (12:15:17 UTC), outcome success, 1.5 s duration, count
  2 → 3, success 24 h/7 d/30 d 100 %, environment health GREEN,
  OVERDUE → ON TIME, next expected run 14:30 (exactly one `*/15` step).
  Owner screenshots captured: overview (GREEN), workflow catalogue
  (ON TIME), and watchdog detail (3 execution rows, idempotent retry
  from 11 Sep still absent — no duplicate row).

## Notes for the owner

- Production publishing note: the other nine catalogue workflows show
  NO DATA until each gains its success-publication point in n8n (Phase 0
  §6 item 4 — part of the later evidence rollout, not Phase 5).
- After deploy, the final live check repeats the comparison above against the
  real two watchdog rows now in production (and any rows published since).
- `OPERATIONS_MFA_REQUIRED` remains `false`; TOTP must be enabled no later
  than before Phase 10 report actions. Ticketing and client notifications
  remain disabled. No report action of any kind was performed.
- No temporary workflows, endpoints, rows, mocks, pins or fixed clocks were
  left anywhere; all throwaway containers and processes were torn down.

## Gate

Per the approved plan, Phase 5 stops here. Phase 6 (infrastructure analytics)
begins only after the owner explicitly approves this gate.
