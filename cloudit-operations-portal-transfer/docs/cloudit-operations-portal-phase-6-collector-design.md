# CloudIT Operations Portal — Phase 6 design: evidence collectors (n8n)

Date: 12 September 2026
Status: **PROPOSED — awaiting owner review before any n8n change**

## Purpose

Phase 6 (infrastructure analytics) needs two evidence streams that do not
exist yet. This design adds two small scheduled n8n workflows that collect
and publish sanitized records through the **existing, proven** Phase 4/5
pipeline (`CloudIT - Publish Operations Evidence v2` → `operations-ingest` →
`operations` DB). No new ingestion code, no new database objects, no changes
to existing workflows.

## What gets built

### 1. `CloudIT - Endpoint Evidence Collector` — every 5 minutes

- Schedule `*/5 * * * *` (Europe/Malta).
- Checks the five registered production endpoints (from the seeded catalogue):
  - `https://cavetta.mt/` → `cavetta.website`
  - `https://cavetta.mt/properties` → `cavetta.listings`
  - `https://cavetta.mt/robots.txt` → `cavetta.robots`
  - `https://cavetta.mt/sitemap.xml` → `cavetta.sitemap`
  - Supabase public REST probe (`GET …/rest/v1/public_properties?select=id&limit=1`,
    same as the existing weekly check) → `cavetta.public_api`
- Builds **one batch** of 5 `endpoint_observation` records and calls the
  publish sub-workflow once.
- Payload per record: `endpointKey`, `checkedAt`, `available`,
  `httpStatusClass`, `httpStatus`, `responseTimeMs`, `confirmationState`.
  - `confirmationState: "unconfirmed"` — this collector does not do the
    two-minute recheck; confirmed outages continue to come from the Incident
    Monitor (Kuma webhook), per Phase 0 §11.2.
  - `tlsDaysRemaining` omitted in v1 (certificate-expiry inspection needs a
    separate mechanism; follow-up, not blocking).
- Envelope: `status` GREEN when available, AMBER when not (first unconfirmed
  failure, per Phase 0 §11.2); `sourceSystem: "n8n"`; `freshUntil =
  checkedAt + 1200s` (the seeded 20-minute freshness).
- Idempotency key: `endpoint-<endpointKey>-<YYYY-MM-DDTHHMM>` (five-minute
  bucket) — a retry of the same run dedupes, each scheduled run is a new key.

### 2. `CloudIT - Database Metrics Collector` — every 15 minutes

- Schedule `*/15 * * * *` (Europe/Malta).
- Reads `GET https://api.supabase.com/v1/projects/{supabase_project_ref}/analytics/endpoints/metrics`
  with the existing read-only OAuth credential **Supabase Analytics Read
  Only** — the same source the Weekly Health Check already uses.
- Normalizes into up to 13 `metric_sample` records matching the seeded
  metric definitions exactly (`unit` must equal the seed, `dimensions: {}`):
  `postgresql.up`, `postgresql.database_size_bytes`, `postgresql.connections_direct`,
  `postgresql.connections_supavisor`, `postgresql.connections_pgbouncer`,
  `postgresql.pgbouncer_max_clients`, `postgresql.pgbouncer_utilization_percent`,
  `postgresql.waiting_connections`, `postgresql.disk_usage_percent`,
  `postgresql.memory_usage_percent`, `postgresql.filesystem_read_only`,
  `postgresql.oom_kill_count`, `postgresql.restart_count`.
- `periodStart`/`periodEnd` = the 15-minute window being sampled;
  `periodEnd >= periodStart` enforced by the DB.
- **Partial-failure rule:** batch acceptance is all-or-nothing, so a single
  bad record must not poison the run. Any metric that cannot be derived from
  the response is either omitted or published with `coverage: "no_data"` —
  decided per metric at template time. A whole-endpoint failure publishes a
  minimal `no_data` set (or skips the run), never a guessed value.
- Envelope `status`: RED if PostgreSQL down, filesystem read-only, or any
  OOM kill; AMBER at the documented warning levels (disk 85%, memory 85%,
  PgBouncer utilization 80%, restart/waiting present); else GREEN.
  `sourceSystem: "supabase"`; `freshUntil = observedAt + 1800s`.
- Idempotency key: `db-<metricKey>-<window bucket>`.
- API request counts remain `NO_DATA` — the usage endpoint does not accept
  this OAuth credential (already verified in the handover). Not attempted.

### Caller wiring (identical for both, per the proven pattern)

Execute Workflow node → `CloudIT - Publish Operations Evidence v2`:
- `records` = `{{ JSON.stringify($json.records) }}`, type **Allow Any Type**
- `publisherKey` = String `cavetta-production-n8n`
- **Attempt To Convert Types: ON**
- Mustache only — never a leading `=`
- One call per run = one batch = one receipt

## What this design deliberately does NOT do

- No changes to any existing workflow (watchdog, weekly check, incident
  monitor stay exactly as they are).
- No raw provider responses, labels, or identifiers in payloads — only the
  allowlisted contract fields.
- No endpoint confirmation logic, no TLS inspection, no API-request metrics.
- No client notifications, no ticketing.

## Open items to pin down before the import template is final

1. **Exact Supabase metrics series names/labels.** The seeded metric keys
   are fixed, but the Prometheus series names in the API response are not
   recorded in this repository — they live inside the Weekly Health Check
   workflow, which was never exported here. Needed once: either a live
   sample of the endpoint response (owner pastes a redacted snapshot into
   n8n test output, or runs the existing `Get Weekly Supabase Infrastructure
   Analytics` node once) or the Weekly Health Check JSON export from the
   Cavetta repository. Then the Normalize code node is written against real
   field names.
2. **PgBouncer `max_client_conn` provenance** (utilization = connections /
   max). Likely a config-table value or a series; confirmed at the same time.
3. **HTTP timeout/retry values** for the endpoint checks (mirror whatever
   the weekly check uses — to be read from its export).

## Verification plan (gate evidence)

1. Owner imports both workflows **inactive**, runs each manually once
   (full Execute Workflow run, not step re-run — the publishedAt ±5 min
   rule), confirms receipts in `operations.ingestion_receipts` with
   `accepted` and expected counts (5 and ≤13).
2. Owner activates both; portal `/infrastructure` (built next, consuming
   `endpoint_observation` + `metric_sample` read-only) shows live cards and
   charts; identical-period comparison against the Supabase dashboard and
   direct endpoint probes is the Phase 6 gate.
3. Idempotency: manual re-run of the same window returns `duplicates` with
   no new rows.

## Rollback

Both workflows are new and independent: deactivate + delete restores the
pre-Phase-6 state exactly. No existing data or workflow is modified.


---

## As built and live-verified (14 September 2026)

Supersedes the "Open items" and parts of the "Verification plan" above for
the parts that were resolved in live n8n. Canonical workflow files:
`infra/n8n/workflows/cloudit-endpoint-metrics-collector.json` and
`infra/n8n/workflows/cloudit-database-metrics-collector.json`.

### What changed versus this design during live build

1. **Endpoint collector rewritten as a sequential chain.** The original
   SplitInBatches / Switch / Merge loop design with `$('Node Name')`
   back-references silently dropped payload fields in live n8n (IF
   evaluated false despite a correct preview; fields went missing between
   nodes). The shipped workflow is a flat ~20-node chain — one Set/HTTP
   pair per monitored endpoint plus aggregate/summary nodes, no loop nodes.
   All contract fields are populated explicitly per node.
2. **DB collector Normalize parses Prometheus text exposition**, not JSON.
   Three iterations in live n8n: v1 tried to parse the response as a JSON
   metric structure (wrong — the Supabase analytics endpoint returns
   Prometheus text format); v2 parsed the text with a candidate-name map
   (10 of 13 matched); v3 (current) adds restart detection.
3. **Restart detection derived, not read.** `postgresql.restart_count` is
   computed in the Normalize code node from `node_boot_time_seconds`
   changes between consecutive windows, persisted via
   `$getWorkflowStaticData('global')`. boot time unchanged → 0; changed →
   increments a counter. Verified in a harness: 0 → 1 → 0 across simulated
   reboots.
4. **`pgbouncer_max_clients` and `pgbouncer_utilization_percent` dropped**
   (were "open item 2"). The Supabase analytics API does not expose
   `max_client_conn` anywhere; utilization cannot be computed without it.
   These two seeded metric definitions stay at NO_DATA in the portal until
   a config source is wired. Provenance gap flagged in Phase 0 remains open
   for these two keys only.
5. **`Has Records` IF + `End Quietly` guard removed from both collectors.**
   The IF evaluated false in live runs despite a correct step preview
   (likely an unsaved-edit state); the owner bypassed it. Shipped chain is
   `Build Records` → `Publish Evidence` directly. Empty-record windows now
   publish an empty batch (accepted 0), which is auditable.
6. **Owner-side live n8n edits preserved** (templates reflect these):
   Publish Evidence sub-workflow re-selected "From list" (name-based
   selector failed with "Workflow does not exist"), credentials re-linked
   ("Header Auth account 4" on the endpoint Check Public API node,
   "Supabase Analytics Read Only" on Get Supabase Metrics).

### Live receipts (chronological)

- Endpoint collector: `76047db0…` — accepted 5 (one per monitored
  endpoint), rejected 0.
- DB collector first publish: `e964e64d-cf5c-4d54-876a-468de534c3c1` —
  accepted 10, rejected 0 (pre-restart-detection metric set, window
  06:45Z).
- DB collector re-run of the same 09:15 window after adding restart
  detection: `a94602bb-bb5b-425c-9997-fb405c66ffc2` — **accepted 1,
  duplicates 10, rejected 0**: the 10 previously-published idempotency
  keys replayed as duplicates with no new rows (Phase 4 idempotency guard
  proven again live); only the new `postgresql.restart_count` key was
  accepted.
- Earlier rejection-path receipts still on record from the live debugging
  session: `bf8d2dbe…` (stale_timestamp) and `6f8b9322…` (missing_field) —
  safe codes only.
- Final normalize output: 11/11 matched (`postgresql.up`,
  `database_size_bytes`, `connections_direct`, `connections_supavisor`,
  `connections_pgbouncer`, `waiting_connections`, `filesystem_read_only`,
  `oom_kill_count`, `memory_usage_percent`, `disk_usage_percent`,
  `restart_count`), `unmatched` empty, rollup GREEN.

### Collector status

Both collectors built, manually verified, and active. Remaining Phase 6
work is portal-side: `/infrastructure` page consuming
`endpoint_observation` + `metric_sample` read-only, then the
identical-period gate comparison (portal values vs Supabase dashboard and
direct endpoint probes for the same windows).
