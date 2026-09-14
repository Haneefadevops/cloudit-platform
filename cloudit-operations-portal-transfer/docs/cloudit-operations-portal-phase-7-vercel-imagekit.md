# CloudIT Operations Portal — Phase 7 design: Vercel and ImageKit analytics

Date: 14 September 2026
Status: **BUILT AND LOCALLY VERIFIED — awaiting owner import/testing and the Phase 7 gate**

## Purpose

Phase 7 adds the two provider-analytics areas from the approved plan
(Vercel analytics, ImageKit analytics). Evidence flows through the proven
Phase 4–6 pipeline only: three new scheduled n8n collector workflows call
supported provider APIs (credentials kept inside n8n), normalize to the
Phase 0 section 7 contract, publish through the existing
`CloudIT - Publish Operations Evidence v2` sub-workflow → `operations-ingest`
→ `operations` database, and two new read-only portal pages consume the
evidence. No dashboard scraping anywhere. No existing workflow, table,
migration or ingest code is modified (only additive migration 0007).

## Defect found and fixed during planning

`0006_seed_cavetta.sql` seeded `vercel.visitors` / `vercel.pageviews`, but
the production `operations_ingest.insert_traffic_summary` writer (migration
0005) resolves metric definitions as `<provider>.traffic.visitors`,
`<provider>.traffic.pageviews` and `<provider>.traffic.top_route`. A
traffic batch would have failed with `unknown_metric`. Nothing had ever
hit the path. Migration 0007 adds the correct keys and removes the two
dead definitions (defensively: only while no samples reference them).

## Provider APIs and constraints (verified against current documentation)

### Vercel

- Web Analytics API (public since May 2026, same aggregated data model
  as the dashboard):
  - `GET /v1/query/web-analytics/visits/aggregate?since&until&by=day` —
    daily visitors/pageviews for a UTC day.
  - `GET /v1/query/web-analytics/visits/aggregate?by=requestPath&limit=10`
    — top paths for a day.
  - Constraints: Web Analytics must be enabled on the project; team
    projects need `teamId`; aggregate queries are bounded by the plan's
    reporting/retention window (plan-dependent — confirmed at the gate);
    production data only.
- Deployments: `GET /v7/deployments?teamId&projectId&limit=20` — v13 was
  retired by Vercel ("Invalid API version", live-discovered 2026-09-14);
  v6/v7 are the accepted versions. v7 returns epoch-ms `created`/`ready`,
  normalized to ISO by the collector (token
  permission: read deployments). State mapped to the contract enum
  (ERROR→failed, CANCELED→cancelled, READY→ready,
  BUILDING/INITIALIZING/QUEUED→building, else unknown). Only
  `target: "production"` deployments are published.
- Domain health: `GET /v9/projects/{projectId}/domains` (token
  permission: read domains) → published as boolean metric samples on
  `vercel.domain.verified` (dimension `domain`), because the ingest
  contract has no domain record type.
- Invocations/errors/edge-requests/usage: no documented public endpoint
  could be confirmed for the current plan. **Probe during owner testing**
  with the fine-grained token; whatever returns 200 within plan limits
  may be wired later under new metric keys; otherwise documented as a
  NO_DATA provider-boundary gap.

### ImageKit

- `GET https://api.imagekit.io/v1/accounts/usage?startDate&endDate`
  returns `bandwidthBytes`, `mediaLibraryStorageBytes`,
  `originalCacheStorageBytes`, `videoProcessingUnitsCount`,
  `extensionUnitsCount`.
- Constraints (per ImageKit API reference): response cached 6 hours per
  account + date range + metrics (matches Phase 0 section 7.4 ≥6h rule —
  collector runs every 6 hours); range must be < 90 days; the period is
  half-open (startDate inclusive, endDate exclusive) — a documented
  boundary/timezone item for the gate.
- Quota is **not** returned by the API. Quotas are configured as plain
  (non-secret) constants in the collector and published as metric samples
  so the portal can show used/quota/remaining; utilization % is computed
  from the same constants. Verified visually against the dashboard at the
  gate.
- Warning-threshold history has no documented API (dashboard/email only)
  → portal shows NO_DATA with a provider-gap note.

## Migration 0007 (additive, idempotent)

`infra/postgres/operations/migrations/0007_seed_phase7_metrics.sql` — for
client `cavetta`, ON CONFLICT DO NOTHING, mirroring the 0006 VALUES seed
pattern:

- `vercel.traffic.visitors` / `vercel.traffic.pageviews` (number, count,
  daily, `daily_24m`)
- `vercel.traffic.top_route` (number, count, dimensions `["path"]`)
- `vercel.domain.verified` (boolean, flag, dimensions `["domain"]`)
- `imagekit.bandwidth_quota_bytes`, `imagekit.media_library_storage_quota_bytes`
  (bytes), `imagekit.video_processing_units_quota`,
  `imagekit.extension_units_quota` (units) — 6-hourly, `daily_24m`
- Removes `vercel.visitors` / `vercel.pageviews` when unreferenced.

The ensure script applies `migrations/*.sql` in sorted order, so 0007 is
picked up automatically. Metric definitions after 0007: 49 (43 − 2 + 8).

## Collector workflows (templates in `infra/n8n/workflows/`)

All three: single schedule trigger, flat sequential chain (Phase 6 v2
lessons — no loop/switch/merge nodes), HTTP nodes with `onError:
continueRegularOutput` and timeout-only options, Normalize with the
omit-never-guess rule and a diagnostics output for first-run VERIFY,
Build Records with strict payload allowlists, Publish Evidence wired
exactly like Phase 6 (mustache inputs, Attempt To Convert Types ON,
name-mode selector `CloudIT - Publish Operations Evidence v2`), envelope
timestamps computed at run time, `publisherKey: cavetta-production-n8n`.
Every successful run also publishes a `provider_connection` record
(reachability, authorization state, `lastSuccessfulAt`) — the plan's
API/credential-connectivity requirement.

1. **`cloudit-vercel-traffic-collector.json`** — "CloudIT - Vercel Traffic
   Collector", daily 00:40 Europe/Malta. Collects **yesterday's UTC day**
   (fixed boundaries, documented at the gate): one `traffic_summary`
   record (visitors, pageviews, ≤10 sanitized top routes — paths failing
   the ingest route regex or excluded prefixes are omitted) plus a
   `provider_connection`. On provider failure publishes only the
   unreachable `provider_connection` with a closed-allowlist failure
   category. Idempotency: `vercel-traffic-<UTC day>` (+ `:conn`).
   Expected receipt: 2 records (1 on failure).
2. **`cloudit-vercel-deployments-collector.json`** — "CloudIT - Vercel
   Deployments Collector", hourly at :07. Publishes recent production
   `deployment_summary` records (uid key → replays dedupe, state changes
   update), one `vercel.domain.verified` metric sample per project domain
   per UTC day, and a `provider_connection`. Deployments without a
   `target` field are omitted and counted in `diagnostics` (VERIFY on
   first run). Idempotency: `vercel-deploy-<YYYY-MM-DDTHH>:dep:<uid>` /
   `:domain:<name>` / `:conn`. Expected receipt: 2 + kept deployments +
   domains.
3. **`cloudit-imagekit-usage-collector.json`** — "CloudIT - ImageKit Usage
   Collector", every 6 hours at :23. Eight `usage` requests per run
   (month-to-date + the 7 completed UTC days), publishing the five usage
   metrics for each window, the four quota keys (only when the configured
   quota > 0 — never a guessed quota), `imagekit.quota_utilization_percent`
   (bandwidth/quota, only when quota configured), and a
   `provider_connection`. Auth: `Authorization: Basic base64(privateKey:)`
   via an n8n Header Auth credential (`ImageKit API Read Only`); the key
   never enters workflow data or Code nodes. Expected receipt: 41 with
   placeholder quotas, up to 46 with all quotas set (1 on failure).

Import/test/rollback instructions: see the "Phase 7" section of
`infra/n8n/workflows/README.md`. Rollback for all three: deactivate +
delete; no existing data or workflow is modified.

## Portal read path (additive, mirrors Phase 6 conventions)

- `apps/platform-api` (NestJS operations module, read-only,
  `operations_owner`, RLS `cloud_owner`):
  - `GET /api/operations/vercel` → `VercelAnalyticsResponse`: 31-day
    daily traffic (visitors/pageviews independently nullable, sum-of-daily
    totals, latest-day top routes), deployments (current production +
    latest 15 with state/duration), per-domain latest verification, Vercel
    connectivity, rollup status.
  - `GET /api/operations/imagekit` → `ImagekitAnalyticsResponse`: exactly
    five usage-vs-quota entries (used, quota, remaining %, 31-day daily
    trend, freshness), account utilization %, connectivity, and
    `warningThresholds: NO_DATA` with the provider-gap note.
  - New `computeVercelRollupStatus` / `computeImagekitRollupStatus` in
    `health.util.ts` (RED: unreachable provider or failed current
    production deployment; AMBER: unverified domain, stale traffic,
    utilization ≥ 80 % or evidence older than 24 h; NO_DATA: no
    evidence; else GREEN) with 19 new unit tests (62/62 pass).
- `apps/operations-web`: `getOperationsVercel()` /
  `getOperationsImagekit()` in `lib/operations-api.ts`;
  `components/vercel-page.tsx` and `components/imagekit-page.tsx`
  (server-rendered, Phase 6 page template: rollup pill, freshness,
  hand-rolled SVG sparklines, top-routes/deployments/domains tables,
  quota cards with remaining-% bars, connectivity cards, NO_DATA
  empty states); shared `ops-sparkline.tsx` and `ops-connectivity.tsx`
  extracted (infrastructure page now imports the shared sparkline);
  dispatcher routes `vercel`/`imagekit` (nav entries already existed;
  placeholders removed).

## Local verification completed (14 September 2026)

- Migration 0007: fresh apply 0001→0007 and idempotent re-run against a
  throwaway `pgvector/pgvector:pg16` container; 49 definitions; new keys'
  units/dimensions exact; dead keys gone; `traffic_summary` ingest into
  the new keys proven inside a rolled-back transaction (would previously
  have failed `unknown_metric`). Isolation suite 88/89 — the single
  failure (`owner_sees_all_clients` expecting 2 clients, found 3) is
  **pre-existing** on a 0001–0006 baseline container, unrelated to 0007.
- platform-api: `tsc` clean; eslint clean; jest operations 62/62.
- operations-web: typecheck clean; eslint clean; production build green.
- Collector templates: valid JSON; no Phase 6 UUID reuse; every Code node
  harness-executed against mocked provider responses (success, 401/403,
  500, timeout, missing fields, absent `target`, zero quotas) asserting
  envelope/payload allowlists, idempotency uniqueness, units, freshUntil
  deltas, route sanitization, state mapping, current-production picking,
  and omit-never-guess — all checks passed.
- End-to-end read-path test against a throwaway database with synthetic
  Phase 7 evidence: see "Gate verification" below.

## Gate verification (pending owner)

1. Owner provisions credentials in n8n: fine-grained **Vercel** token
   (Cavetta project only; permissions: Web Analytics read, deployments
   read, domains read) as `Vercel API Read Only` Header Auth
   (`Authorization: Bearer <token>`), and **ImageKit** private key as
   `ImageKit API Read Only` Header Auth (`Authorization: Basic
   <base64(privateKey:)>`). Fills `teamId`/`projectId` and the four
   ImageKit quota constants in each collector's Load Config.
2. Owner imports the three workflows **inactive**, runs each manually
   once (full Execute Workflow runs, never step re-runs), checks the
   Normalize diagnostics outputs against the VERIFY notes, confirms
   `accepted` receipts in `operations.ingestion_receipts` with the
   expected counts, then replays one run to confirm `duplicates` with no
   new rows. Then activate.
3. Probe note: if the owner wants invocation/error/edge-request usage
   metrics, test the candidate endpoint with the same token and report
   the result; only then decide on a follow-up wiring migration.
4. Let the collectors run ≥ 48 h. Then compare an **identical date
   range** (last full UTC day, last 7 days, last 30 days) between the
   portal (`/vercel`, `/imagekit`) and the Vercel Web Analytics /
   Deployments dashboards and the ImageKit Usage dashboard
   (screenshots both sides). Document every difference: UTC vs local day
   boundaries, the 6-hour ImageKit cache, the half-open date range,
   dashboard counting boundaries, plan retention windows, quota source.
5. Record results in this document and stop for explicit owner approval.
   No Phase 8 until approved.

## Explicitly not done in Phase 7

- No scraping of either provider dashboard; no provider credential leaves
  n8n; no raw provider responses in payloads (allowlisted fields only).
- No invocation/error/edge-request usage metrics until a supported,
  plan-available endpoint is verified.
- No report actions; ticketing and client notifications remain disabled;
  `ticketing_enabled` unchanged.
- No changes to existing migrations, workflows, databases or the n8n
  database.
