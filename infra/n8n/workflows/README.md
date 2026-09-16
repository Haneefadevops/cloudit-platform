# n8n Workflows

This folder contains example n8n workflows for CloudIT event-driven automation.

## Workflows

### `booking-notification.json`

Triggered by the CloudIT webhook whenever a `booking.created` event is emitted.

**Flow:**
1. **Webhook node** listens on `POST /webhook/cloudit-events`.
2. **Send Email** node sends a booking confirmation email placeholder.
3. **Google Sheets** node appends a placeholder log row.

**Required environment variables in n8n:**
- `GOOGLE_SHEET_ID` — ID of the Google Sheet to log bookings.

### `checkin-reminder.json`

Runs daily at 9:00 AM to remind guests checking in today.

**Flow:**
1. **Schedule Trigger** fires every day at 9 AM.
2. **HTTP Request** queries the hospitality API for today's confirmed reservations.
3. **HTTP Request** sends a WhatsApp message placeholder for each guest.

**Required environment variables in n8n:**
- `HOSPITALITY_API_URL` — e.g. `https://hospitality.cloudit.lk`
- `WHATSAPP_API_URL` — URL of your WhatsApp Business API gateway
- `WHATSAPP_API_KEY` — API key for the WhatsApp gateway

### `cloudit-publish-operations-evidence.json`

Reusable sub-workflow for the CloudIT Operations Portal (Phase 4). Existing
workflows call it with normalized, sanitized evidence records; it signs and
publishes them to the private operations ingestion endpoint
(`operations-ingest:3020` on the Docker network — no public route).

**Flow:**
1. **When Executed by Another Workflow** receives `records` (array of Phase 0
   section 7 envelopes) and optionally `publisherKey`.
2. **Prepare Request** validates batch limits (500 records / 1 MiB) and
   builds the canonical request pieces (body, timestamp, nonce, SHA-256 body
   digest).
3. **Sign Request** computes the HMAC-SHA256 transport signature
   (`timestamp.nonce.digest`) via n8n's Crypto node. The secret comes from
   the **Operations Publisher Signing** n8n credential — never from `$env`,
   because task-runner sandboxes and workflow expressions cannot reliably
   read container env vars on all n8n builds.
4. **Publish To Operations Ingest** POSTs the raw JSON body (exact bytes —
   the signature covers them) with the signed headers.
5. **Assert Accepted** throws on any rejection so the caller's error handling
   fires.

**Required n8n credential:**
- Create a **Crypto** credential named exactly `Operations Publisher Signing`
  whose **Hmac Secret** equals `OPERATIONS_PUBLISHER_SECRET_CAVETTA_PRODUCTION_N8N`
  from the protected server env file. If the credential field offers
  "Take from environment variable", select that variable so the secret is
  never typed or stored in the workflow; otherwise paste the secret manually
  (never commit or chat it).

**Caller wiring (the Execute Workflow node in the calling workflow):**
- Workflow inputs on the trigger: `records` type **Allow Any Type**,
  `publisherKey` type **String**.
- `records` = `{{ JSON.stringify($json.records) }}` — mustache only, **no
  leading `=`** (a leading `=` becomes literal text in Execute Workflow input
  fields, e.g. `=[object Object]`).
- `publisherKey` = `{{ $json.publisherKey }}` (optional).
- Keep **Attempt To Convert Types** ON.
- The HTTP node must have **no** response-format/file/stream options (a
  "Download"/stream option makes the response unreadable to the Assert code);
  leave Options empty apart from timeout.

**Caller record contract (workflow_execution example, proven 2026-09-11):**
Envelope: `contractVersion` "1.0", `recordType`, `idempotencyKey`,
`environmentKey` (must match the publisher's scope), `sourceSystem`, `observedAt`,
`publishedAt` (within ±5 minutes of ingestion — n8n **Execute step** reuses old
data and goes stale; always test with a full **Execute Workflow** run),
`freshUntil`, `status`, `severity`, optional `correlationKey`, `payload`.
The `workflow_execution` payload allows only: `workflowKey`, `executionKey`,
`triggerKind`, `scheduledFor`, `startedAt`, `finishedAt`, `durationMs`,
`scheduleDelayMs`, `outcome` (**required**: success/failure/cancelled/waiting/missed),
`failureCategory`, `failureCode`, `attempt`, `sourceRevisionKey`. Extra fields
(e.g. finding counts) are rejected with `unknown_field`; the workflow key must
exist in `operations.workflow_definitions` (seeded by migration 0006).

**Idempotent retry behaviour:** re-sending the same record within the freshness
window returns `result: "accepted"` with `duplicates: 1` and writes **no** new
row (verified: row count unchanged after an Execute-step retry).

**Required environment variables in n8n (protected server env file):**
- `OPERATIONS_PUBLISHER_SECRET_CAVETTA_PRODUCTION_N8N` — must equal the value
  provisioned in `infra/postgres/.env` (stored salted-hashed in the
  operations database and used by the operations-ingest service).
- `OPERATIONS_INGEST_URL` — optional; defaults to `http://operations-ingest:3020`.

**Required n8n service configuration:**
- `NODE_FUNCTION_ALLOW_BUILTIN=crypto` — the "Prepare Request" Code node uses
  Node's built-in `crypto` module, which n8n disallows by default.
- `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` was required by the superseded v1
  template; v2 reads the secret from a credential instead, so this is no
  longer needed but is kept set (harmless).
Both are set in `infra/n8n/docker-compose.yml`; after changing them the n8n
container must be recreated (`docker compose up -d` recreates it).

The endpoint never receives secrets in the body; forbidden fields (tokens,
stack traces, request/response bodies, customer data) must be stripped by the
caller before invoking this sub-workflow, per Phase 0 section 7.5.

## Phase 6 — evidence collectors (operations portal)

Two new scheduled workflows publish sanitized evidence through the proven
Phase 4 pipeline above (`CloudIT - Publish Operations Evidence v2` →
`operations-ingest` → `operations` DB). They are new and independent: no
existing workflow is modified. Design:
`cloudit-operations-portal-transfer/docs/cloudit-operations-portal-phase-6-collector-design.md`.

### `cloudit-endpoint-evidence-collector.json` — every 5 minutes

- Schedule `*/5 * * * *` (Europe/Malta, from workflow settings).
- **Fully sequential design (v2, rewritten after the first live test):** a
  single straight line of 20 nodes — Prepare Checks, then five identical
  blocks of `T0 <name>` → `Check <name>` (HTTP) → `Observe <name>` (Code),
  then Build Records → Validate Records → Publish Evidence. There is no Split
  In Batches, no Switch, no Merge, and no references to nodes inside a loop.
  Reason: the first version (batch loop + switch + merge + `$('Mark Start')`
  cross-references) lost all fields except `endpointKey`/`confirmationState`
  in the live run — n8n HTTP nodes do not pass input fields through on either
  output, so anything that depended on passthrough or loop-scoped references
  produced `undefined` and the ingest service rejected the batch with
  `missing_field`.
- Each Observe node therefore: hardcodes its `endpointKey` literal, reads the
  wall-clock start from its own `T0 <name>` node, and re-reads the accumulated
  state (`observations` + timestamps) from the **previous Observe node** —
  never from the HTTP output.
- The four cavetta.mt checks run unauthenticated; `Check Public API` carries
  header auth (see credentials below). All HTTP nodes use **Continue (using
  error output)** so a failed check flows through as an AMBER observation
  instead of stopping the run; a missing status code means `available: false`,
  `httpStatus: null`.
- The collector HTTP nodes deliberately enable the Response option **Include
  Response Data** so the Observe nodes can read `statusCode` (verified to
  import and render correctly on n8n Cloud 2.27.4). This is NOT the forbidden
  file/stream/download option: the body stays readable at `json.body`, and
  the trap above only applies to the ingest POST whose Assert reads the raw
  response body. Without this option n8n discards the status code entirely.
- `responseTimeMs` is wall-clock through the T0 → HTTP → Observe chain, an
  approximate latency, not a socket measurement.
- **Build Records is defensive:** required payload fields are coerced so they
  can never be `undefined` (`available: o.available === true`, null fallbacks
  for status fields, `responseTimeMs` only when an integer) — an uncheckable
  observation degrades to `available:false` / null fields, never to a
  rejected batch.
- **Validate Records fails loudly** (a descriptive Error in the n8n run, no
  secrets) if the batch is not exactly 5 records or any required
  envelope/payload field is missing or an idempotency key is illegal —
  converting a silent ingest 422 into an obvious workflow error.
- `confirmationState` is always `"unconfirmed"`; confirmed outages continue to
  come from the Incident Monitor (Phase 0 §11.2). `tlsDaysRemaining` is omitted
  (follow-up). Failed checks still publish AMBER records; only a
  workflow-level failure ends quietly (stale evidence → portal AMBER, by
  design).

#### Endpoint collector — re-import procedure (owner action, v2)

The first imported version must be **deleted** and the corrected JSON
imported fresh:

1. Delete the imported `CloudIT - Endpoint Evidence Collector` workflow.
2. Import `cloudit-endpoint-evidence-collector.json` (it imports INACTIVE).
3. In **Publish Evidence**, the workflow selector imports EMPTY by design:
   pick `CloudIT - Publish Operations Evidence v2` from the dropdown. After
   selecting, **confirm the two workflow inputs survived** —
   `records` = `{{ JSON.stringify($json.records) }}` (Allow Any Type) and
   `publisherKey` = `{{ $json.publisherKey }}` (String), Attempt To Convert
   Types ON; if the dropdown wiped them, re-enter them (mustache only, no
   leading `=`).
4. Re-link the credential when prompted: `Check Public API` → existing
   **Header Auth account 4**.
5. Test with ONE full **Execute Workflow run** (never step re-runs —
   `publishedAt` goes stale within ±5 minutes).
6. Expect an `accepted` receipt with **5** records in
   `operations.ingestion_receipts`, then activate.

### `cloudit-database-metrics-collector.json` — every 15 minutes

- Schedule `*/15 * * * *` (Europe/Malta).
- Reads `GET https://api.supabase.com/v1/projects/{projectRef}/analytics/endpoints/metrics`
  and normalizes up to 13 `postgresql.*` `metric_sample` records matching the
  seeded metric definitions exactly (units must equal the seed,
  `dimensions: {}`). `periodStart`/`periodEnd` are the current 15-minute
  window; `sampledAt` is the run time.
- **VERIFY-ON-FIRST-RUN series map:** the exact Prometheus series names in the
  Supabase response could not be confirmed from this repository (they live in
  the Weekly Health Check workflow, never exported here). The `Normalize
  Metrics` Code node carries an explicit, commented `SERIES_MAP` from each
  seeded metric key to candidate series names (first match wins). On the first
  run: execute the workflow once (full run, see below), open the ingest
  receipt in `operations.ingestion_receipts`, and compare the node's
  `seriesFound` output against the 13 seeded keys in migration 0006. Fix any
  unmatched names in `SERIES_MAP`. A wrong/absent name simply **omits** that
  metric — it cannot poison the batch (batch acceptance is all-or-nothing, so
  nothing is ever guessed).
- `postgresql.pgbouncer_utilization_percent`, `disk_usage_percent` and
  `memory_usage_percent` are derived from sibling series (see the node
  comments); utilization is omitted when `max_client_conn` cannot be read.
- If the metrics request fails or **zero** metrics resolve, the run ends
  quietly without publishing (the `Has Records` guard); stale evidence →
  portal NO_DATA/AMBER later, by design.
- Envelope status per metric: RED for `up === false`, filesystem read-only, or
  OOM kills; AMBER at the documented warning levels (disk 85%, memory 85%,
  PgBouncer utilization 80%, restart/waiting present); else GREEN.

### Activation procedure (owner action)

**Endpoint collector:** follow the "Endpoint collector — re-import procedure"
steps above (delete old, import v2, pick the sub-workflow from the dropdown,
confirm the two workflow inputs survived, test run, expect `accepted: 5`).

**Metrics collector:**
1. Import `cloudit-database-metrics-collector.json` — it exports with
   `active: false` and stays inactive.
2. Re-link the credential on import if prompted: `Get Supabase Metrics` →
   existing **Supabase Analytics Read Only** OAuth2 credential (same source
   the Weekly Health Check uses). API request counts are NOT attempted — the
   usage endpoint rejects this credential (already verified in the handover).
3. Test with ONE manual **full Execute Workflow run** — never step re-runs:
   `publishedAt` must be within ±5 minutes of ingestion and step re-runs reuse
   stale data (see the caller trap above). Confirm the receipt in
   `operations.ingestion_receipts` (`accepted`, up to 13 records) and check
   `seriesFound` for the VERIFY-ON-FIRST-RUN series names.
4. Activate only after the test receipt is clean.

### Rollback

Deactivate and delete both workflows — this restores the pre-Phase-6 state
exactly. No existing data or workflow is modified.

## Phase 7 — Vercel & ImageKit evidence collectors (operations portal)

Three new scheduled collectors publish Vercel and ImageKit evidence through
the same proven Phase 4 pipeline (`CloudIT - Publish Operations Evidence v2` →
`operations-ingest` → `operations` DB). They are new and independent: no
existing workflow is modified. All three mirror the Phase 6 metrics
collector's shape: a single Schedule Trigger, one straight line of nodes
(Load Config → HTTP node(s) with Continue On Fail → Normalize → Build Records
→ Publish Evidence), Europe/Malta timezone, and they import INACTIVE. Like
Phase 6, the idempotency bucket is computed at run time and every payload key
matches the strict allowlist of migration 0005 — any missing provider value is
omitted, never guessed (absence shows as NO_DATA/stale in the portal, never
as a wrong number, and can never poison the all-or-nothing batch).

### Shared import procedure (owner action)

1. Import the JSON — it exports with `active: false` and stays INACTIVE.
2. Set the plain config constants in **Load Config** (these are NOT secrets):
   - both Vercel collectors: `teamId` (`team_REPLACE_ME`) and `projectId`
     (`project_REPLACE_ME`) — copy them from the Cavetta project's settings
     in the Vercel dashboard.
   - the ImageKit collector: `bandwidthQuotaBytes`, `storageQuotaBytes`,
     `vpuQuota`, `extensionQuota` (all `0` in the template) — fill the real
     plan quotas before activation. Quota metrics are published ONLY when
     the matching constant is > 0, so the placeholders never publish a
     guessed quota.
3. Create the provider credential (below) BEFORE the test run and re-link it
   on import when prompted.
4. In **Publish Evidence**, if the workflow selector imports empty, pick
   `CloudIT - Publish Operations Evidence v2` from the dropdown and confirm
   the two workflow inputs survived — `records` =
   `{{ JSON.stringify($json.records) }}` (Allow Any Type), `publisherKey` =
   `{{ $json.publisherKey }}` (String), Attempt To Convert Types ON
   (mustache only, no leading `=`).
5. Test with ONE full **Execute Workflow run** — never step re-runs:
   `publishedAt` must be within ±5 minutes of ingestion and step re-runs
   reuse stale data.
6. Check the receipt in `operations.ingestion_receipts` against the expected
   record count below, then activate.

Rollback for all three: deactivate and delete — this restores the
pre-Phase-7 state exactly. No existing data or workflow is modified.

### Provider credentials (owner creates; secrets never enter the workflow)

- **Vercel API Read Only** (both Vercel collectors): n8n credential type
  **Header Auth**; Name `Authorization`, Value `Bearer <token>`. Create a
  fine-grained (scoped) Vercel API token with **read-only** access limited to
  the Cavetta project (Web Analytics read + Deployments read + Domains read).
  The token value lives only in the n8n credential — never in the workflow
  JSON or Code nodes.
- **ImageKit API Read Only**: n8n credential type **Header Auth**; Name
  `Authorization`, Value `Basic <base64>` where `<base64>` is the base64 of
  `<privateKey>:` (private key plus a trailing colon, no password) — compute
  it once, e.g. `printf '%s:' '<privateKey>' | base64`. The ImageKit private
  key never appears in the workflow JSON or Code nodes.

### `cloudit-vercel-traffic-collector.json` — daily 00:40

- Schedule `40 0 * * *` (Europe/Malta). freshUntil = observedAt + 48h
  (seeded daily-traffic freshness).
- Two GETs against
  `api.vercel.com/v1/query/web-analytics/visits/aggregate` for YESTERDAY'S
  UTC day: `by=day` (totals) and `by=requestPath&limit=10` (top paths).
  Publishes ONE `traffic_summary` (provider `vercel`, timezone `UTC`,
  boundary `web_analytics_day`) + one `provider_connection`
  (`web-analytics`). Each top-route path is sanitized against the ingest
  regex and the excluded prefixes (`/admin /agent /share /api /_next
  /_vercel`, `/others`) — one bad path is skipped, never fatal; topRoutes is
  capped at 20. visitors AND pageviews both absent → coverage `no_data` with
  both omitted. On any HTTP/provider error only the failure
  `provider_connection` is published (reachable false, authorizationState
  `denied` on 401/403 else `unknown`, failureCategory from the closed
  allowlist, `lastSuccessfulAt` omitted).
- **VERIFY-ON-FIRST-RUN:** confirm the live row shape of both aggregate
  responses (documented `{timestamp, pageviews, visitors}` for by=day;
  `requestPath` + `pageviews` per row for by=requestPath). The Normalize
  node reports `diagnostics` (fields present, routes seen vs kept) — a wrong
  field name simply omits that value, it cannot poison the batch.
- **Expected receipt:** `accepted` with **2** records on success (1
  `traffic_summary` + 1 `provider_connection`) — the ingest expands the
  traffic record server-side into `vercel.traffic.visitors`,
  `vercel.traffic.pageviews` and up to 10 `vercel.traffic.top_route` metric
  rows. Failure run: **1** record.

### `cloudit-vercel-deployments-collector.json` — hourly at :07

- Schedule `7 * * * *` (Europe/Malta). freshUntil = observedAt + 3h (seeded
  hourly freshness). Idempotency base is the current UTC hour, so each run
  upserts fresh rows.
- `GET /v7/deployments?teamId&projectId&limit=20` plus (LIVE-CORRECTED
  2026-09-14: v13 was retired by Vercel with "Invalid API version"; v6/v7 are
  the currently accepted versions. v7 returns epoch-ms `created`/`ready`,
  which the Normalize node converts)
  `GET /v9/projects/{projectId}/domains`. Only deployments whose `target`
  field EXISTS and === `production` are kept. One `deployment_summary` per
  kept deployment: `state` mapped to the ingest enum (ERROR→failed,
  CANCELED→cancelled, READY→ready, BUILDING/INITIALIZING/QUEUED→building,
  else unknown), `durationMs` = readyAt−createdAt only when both are known,
  `publicDomainKey` = first alias matching the domain regex, else omitted,
  `isCurrentProduction` = true only for the NEWEST ready production
  deployment by createdAt, `failureCategory` = `provider_unavailable` only
  on failed. One `vercel.domain.verified` `metric_sample` (unit `flag`,
  dimensions `{domain}`, today's UTC day) per domain whose lowercased name
  matches `^[a-z0-9.-]+\.[a-z]{2,}$`. Plus the `provider_connection`
  (`rest-api`) — on any call error only the failure connection is published.
- **VERIFY-ON-FIRST-RUN:** if the live `/v7/deployments` schema omits the
  `target` field entirely, `diagnostics.deploymentsOmittedNonTarget` counts
  those items — confirm the schema before trusting the deployment counts.
  Also confirm the deployments/domains envelope field names against
  `diagnostics`.
- **Expected receipt:** `accepted` with **2 + kept deployments + domains**
  records (at most 2 + 20 + n). Failure run: **1** record.

### `cloudit-imagekit-usage-collector.json` — every 6 hours at :23

- Schedule `23 */6 * * *` (Europe/Malta). freshUntil = observedAt + 12h
  (matches the seeded 43200s freshness).
- EXACTLY 8 GETs per run against
  `https://api.imagekit.io/v1/accounts/usage` — one month-to-date
  (first of the current UTC month → tomorrow 00:00 UTC) plus one per each of
  the 7 most recent COMPLETED UTC days. The response is provider-cached ~6h
  per account+date-range; do NOT add extra calls. Month-to-date publishes
  the 5 usage metrics, the 4 quota metrics ONLY for quota constants > 0, and
  `imagekit.quota_utilization_percent` (round1 of bandwidth/quota×100) ONLY
  when the bandwidth quota is configured and bandwidthBytes is present; each
  day publishes the usage metrics that response actually contains (absent
  keys omitted, never guessed). Plus the `provider_connection` (`usage-api`)
  — if ANY of the 8 requests fails, only the failure connection is
  published (a partial window next to full ones would mislead).
- **VERIFY-ON-FIRST-RUN:** confirm the live usage field names
  (`bandwidthBytes`, `mediaLibraryStorageBytes`, `videoProcessingUnitsCount`,
  `extensionUnitsCount`, `originalCacheStorageBytes` — snake_case fallbacks
  are built in) via the Normalize node's `diagnostics` (matched keys per
  call).
- **Expected receipt:** `accepted` with **41** records with the placeholder
  quotas (5 month-to-date + 7×5 daily + 1 connection); up to **46** once all
  four quota constants are set (+4 quota, +1 utilization). Failure run:
  **1** record.

## Phase 8 — Backup evidence collector (operations portal)

One new scheduled collector publishes Cloudflare R2 backup evidence and
GitHub Actions restore-test evidence through the same proven Phase 4
pipeline (`CloudIT - Publish Operations Evidence v2` → `operations-ingest` →
`operations` DB). It is new and independent: no existing workflow is
modified. Design:
`cloudit-operations-portal-transfer/docs/cloudit-operations-portal-phase-8-backup-centre.md`.
It mirrors the Phase 7 shape: a single Schedule Trigger, one straight flat
line (Load Config → three GitHub HTTP nodes with Continue On Fail → two
S3 nodes for the R2 listings → Normalize Backups → Build Records → Publish
Evidence), Europe/Malta timezone, and it imports INACTIVE. Metadata only:
the R2 listings list object metadata (key, size, last-modified) and NEVER
download an object. Migration 0008 (adds
`cloudflare_r2` to the envelope sourceSystem allowlist and widens the
provider_connections provider CHECK) must be applied before activation.

### `cloudit-backup-evidence-collector.json` — daily (placeholder 07:00)

- Schedule `0 7 * * *` (Europe/Malta) — PLACEHOLDER pending owner
  confirmation of the real daily backup window (the 14 Sep 2026 run was
  observed ~05:56 UTC, archive `cavetta-db-2026-09-14T075617Z`; the old
  Phase 0 spec documented 02:17 UTC). Move the cron to ~1 hour AFTER the
  confirmed backup completion time before activation.
- `GET api.github.com/repos/Cavetta/Cavetta/actions/workflows` resolves the
  two workflow ids by name (`Database backup`, `Backup restore test`), then
  `runs?per_page=30` / `runs?per_page=10`. The two R2 listings are n8n
  **S3 nodes** (File → Get Many, Return All ON, prefix from Load Config)
  against the bucket, returning one item per object (metadata only).
- One `backup_evidence` per `cavetta-db-YYYY-MM-DDTHHMMSSZ.tar.gz.gpg`
  object, joined to the NEWEST `Database backup` run whose
  `[created_at, updated_at + 10 min]` window contains the filename
  timestamp (backupKey = filename lowercased, extensions stripped;
  unmatched object → record OMITTED and counted in diagnostics —
  omit-never-guess). Run success → `checksumVerified` /
  `driveRoundTripPassed` / `archiveStructureValidated` true; run failure
  with the object present → those three false (status RED); a missing
  `.sha256` sibling also forces RED. `driveObjectKey` is the R2 object key
  (server-only: never selected into any portal API response).
- One `restore_test_evidence` per completed `Backup restore test` run:
  `restoreTestKey` = `restore-<run id>`; `sourceRetentionClass` from
  `display_title` containing daily/monthly (case-insensitive), else
  `event == "schedule"` → monthly, else omitted + diagnostics; `result`
  from conclusion (success → passed, failure → failed); on success the
  eight `*Passed` booleans = true, on failure they are OMITTED. `backupKey`
  links the newest backup of the tested retention class with
  `backup_timestamp` at or before the restore start, from the records this
  run is about to publish — backup records are ordered BEFORE restore
  records in the batch (ingest foreign-key order) and an unlinkable restore
  is omitted rather than risk a whole-batch `unknown_backup` rejection.
- Plus two `provider_connection` records (`github`/`github-actions`,
  `cloudflare_r2`/`r2-list`). On ANY provider failure ONLY the unreachable
  connection record(s) publish (reachable false, authorizationState denied
  on 401/403 else unknown, failureCategory from the closed allowlist
  authentication/authorization/provider_unavailable, `lastSuccessfulAt`
  omitted).
- Envelope: `sourceSystem` `cloudflare_r2` for the evidence records and the
  R2 connectivity record, `github_actions` for the GitHub connectivity
  record; freshUntil observedAt + 28h for backup/connection records and
  + 35 days for restore records; idempotency keys `backup-<backupKey>` /
  `restore-<restoreTestKey>` / `backup-conn-github-<YYYY-MM-DD>` /
  `backup-conn-r2-<YYYY-MM-DD>` upsert on natural keys, so scheduled
  re-runs reconcile changed conclusions instead of duplicating.
- **Pagination:** the S3 node's Return All ON auto-paginates, so a
  truncated listing cannot occur — the max-keys=1000 concern of the
  original design is gone and `truncatedListing` stays 0 in diagnostics
  (kept for contract stability). The owner confirms the object count at
  activation.
- **VERIFY-ON-FIRST-RUN:** the Normalize node outputs `diagnostics`
  (objectsSeen, pairs, recordsBuilt, omittedNoRun, omittedNoBackupLink,
  omittedUnknownClass, truncatedListing, runConclusions) — compare them
  against the bucket listing and the two GitHub workflows before trusting
  the counts. Also confirm the exact daily/monthly prefix strings, the R2
  bucket name, and that the restore-test workflow names/inputs are
  unchanged after the R2 move.
- **Expected receipt:** `accepted` with **matched backup pairs + completed
  restore runs + 2** records on success (≈ daily + monthly archives with a
  matching run, one per completed restore-test run, plus the two
  connections). Failure run: **1** record per unreachable provider.

#### Provider credentials (owner creates; secrets never enter the workflow)

- **GitHub Actions Read Only**: n8n credential type **Header Auth**; Name
  `Authorization`, Value `Bearer <token>`. Create a fine-grained GitHub
  token limited to the Cavetta repository with **Actions: read**. The token
  value lives only in the n8n credential — never in the workflow JSON or
  Code nodes.
- **Cloudflare R2 S3 Read Only**: n8n credential type **S3** (NOT Header
  Auth, NOT AWS). Live lesson 15 Sep 2026: R2's S3 endpoint REJECTS plain
  `Authorization: Bearer` tokens (it demands `x-amz-content-sha256`, then
  responds `InvalidRequest: Please use AWS4-HMAC-SHA256`), so the two list
  nodes are generic S3 nodes that sign every request with AWS SigV4. Create
  an R2 API token scoped to the backup bucket with **Object Read & List**
  only and enter in the credential: **S3 Endpoint**
  `https://676d602d0fd48ae086a188f1ee69b857.r2.cloudflarestorage.com`,
  **Region** `auto`, the token's **Access Key ID** + **Secret Access Key**,
  and **Force Path Style** ON. The keys never appear in the workflow JSON
  or Code nodes; the collector only ever lists object metadata.

#### Load Config placeholders to fill (owner, before activation)

- `r2Bucket` (`bucket_REPLACE_ME`) — from the Cloudflare dashboard. The
  account id lives in the S3 credential's Endpoint field, not here.
- `dailyPrefix` / `monthlyPrefix` (`Cavetta Backups/Daily/` and
  `Cavetta Backups/Monthly/` assumed — RAW form, the S3 SDK URL-encodes
  the space; confirm the exact prefix strings against the bucket layout).
- The **schedule** — replace the placeholder `0 7 * * *` cron with ~1 hour
  after the confirmed daily backup window.
- `repoOwner` / `repoName` / workflow names (`Cavetta`/`Cavetta`,
  `Database backup`, `Backup restore test`) are pre-filled — confirm the
  restore-test workflow names/inputs are unchanged after the R2 move.

#### Import + activation procedure (owner action)

1. Import the JSON — it exports with `active: false` and stays INACTIVE.
2. Fill the Load Config placeholders above; re-link the two credentials on
   import when prompted (`GitHub Actions Read Only` on the three GitHub
   HTTP nodes, `Cloudflare R2 S3 Read Only` on the two S3 list nodes).
3. In **Publish Evidence**, if the workflow selector imports empty, pick
   `CloudIT - Publish Operations Evidence v2` from the dropdown and confirm
   the two workflow inputs survived — `records` =
   `{{ JSON.stringify($json.records) }}` (Allow Any Type), `publisherKey` =
   `{{ $json.publisherKey }}` (String), Attempt To Convert Types ON
   (mustache only, no leading `=`).
4. Test with ONE full **Execute Workflow run** — never step re-runs:
   `publishedAt` must be within ±5 minutes of ingestion and step re-runs
   reuse stale data.
5. Check the `accepted` receipt in `operations.ingestion_receipts` against
   the expected counts above, inspect the Normalize `diagnostics` against
   the VERIFY notes, then replay ONE run and confirm the receipt reports
   `duplicates` with no new rows. Then activate.

Rollback: deactivate and delete — this restores the pre-Phase-8 state
exactly. No existing data or workflow is modified.

## Phase 9 — report evidence and private PDF relay

### `cloudit-monthly-report-evidence-publisher.json`

This inactive scheduled workflow reads the existing monthly-report Data Table,
normalizes `MONTHLY_MAINTENANCE` to the operations contract value, and publishes
sanitized `report_summary` records. It never publishes `pdfDriveFileId`,
`pdfDriveUrl`, report HTML, or PDF bytes. An empty Data Table ends without
calling the publisher. Link its Execute Workflow node to
`CloudIT - Publish Operations Evidence v2` after import.

### `cloudit-private-report-pdf-relay.json`

This inactive webhook is a server-to-server binary relay only. Its straight
read path is: Header Auth webhook → validate HMAC/time window → atomically
claim the one-use nonce in `platform-api` → reload the exact Data Table row →
validate allowed state and private metadata → download through the existing
R2 S3 credential → validate `%PDF-`/25 MiB maximum → return binary. It has no
Data Table update, email, publisher, report command, or action node.

Before activation, the owner must:

1. Apply migration `0010_report_pdf_retrieval_nonces.sql` and deploy the updated
   `platform-api` and `operations-web`.
2. Set the same random value (at least 32 characters) as
   `OPERATIONS_REPORT_PDF_RELAY_SECRET` in the protected environments for n8n,
   `platform-api`, and `operations-web`.
3. Create **CloudIT Report PDF Relay** as an n8n Header Auth credential with
   header name `x-cloudit-pdf-relay-token`; put its random value in
   operations-web as `OPERATIONS_REPORT_PDF_RELAY_TOKEN`.
4. Create/link **CloudIT Operations Internal API** as an n8n Header Auth
   credential with header name `x-operations-internal-token` and the existing
   `OPERATIONS_INTERNAL_API_TOKEN` value.
5. Link **Cavetta R2 Reports** to the download node. Confirm it is object-read
   only for the report bucket, and confirm the Data Table selection remains
   `reportMonth` + `MONTHLY_MAINTENANCE`.
6. Set `OPERATIONS_REPORT_PDF_RELAY_URL` in operations-web to the private
   `http://n8n:5678/webhook/cloudit-report-pdf-relay` Docker-network URL (or
   the HTTPS webhook URL if the internal route is unavailable). Test one controlled DRAFT, then replay the identical signed
   request and confirm denial. Confirm preview and attachment leave the report
   fingerprint unchanged before activation.

The workflow exports inactive. Activation, deployment, and the real-DRAFT gate
remain owner-approved operations. Rollback is to deactivate/delete the relay
and unset its three operations-web variables; report metadata remains readable.

## Phase 10 — Guarded report command

### `cloudit-guarded-report-command.json`

This inactive webhook executes one signed, short-lived report command
(`APPROVE_AND_SEND`, `REJECT`, or `RETRY_SEND`) against exactly one
`MONTHLY_MAINTENANCE` row of the existing `cavetta_monthly_maintenance_reports`
Data Table. `platform-api` signs a canonical 13-line payload
(HMAC-SHA256, secret `OPERATIONS_REPORT_COMMAND_SECRET`) and POSTs it with the
`x-cloudit-report-command-token` header. It has no email node, no S3/PDF
regeneration branch, no schedule trigger, and takes no recipient field from the
request input — the recipient policy is fixed per command type. It is not
connected to the recovery workflow.

Straight path: Header Auth webhook → **Validate Signed Command** (Code node,
strict per-field checks + `timingSafeEqual` HMAC; every failure throws the one
generic `Report command denied`) → **Claim Command** (POSTs
`{ commandKey, clientKey, nonce }` — the wire nonce, echoed by the validation
node because n8n HTTP nodes do not pass input fields through) → **Claim
Accepted** → **Load Authoritative Report** (Data Table get,
`reportMonth` + `MONTHLY_MAINTENANCE`, limit 2) → **Guard Authoritative Row**
(requires exactly one row in the expected state; APPROVE additionally requires
a valid private `pdfDriveFileId`/`pdfFileName` pair and empty `sentAt`) →
**Guards Passed** → **Apply Command** (Data Table update; the update filter
includes `documentStatus = expectedState`, which IS the compare-and-set guard)
→ **CAS Applied** → **Acknowledge** (`resultCode: acknowledged`) → respond
`{ commandKey, status, resultCode }`. Every denial path acknowledges the same
`resultCode` to platform-api and responds with only
`{ commandKey, status: 'denied', resultCode }`.

Structural decisions (verified against the n8n source, not assumed):

- **CAS-applied detection** uses `={{ Number($json.id) }} > 0`, not
  `$json.length`: the Data Table update operation emits ONE item per updated
  row and ZERO items when no row matched the filter, so the update output is
  never an array. `alwaysOutputData` is set on **Apply Command** so the
  CAS-false branch always runs (on a filler `{}` item with no `id`); a real
  updated row always carries the numeric system column `id`.
- **Null columns are never sent as NULL**: n8n's Data Table update sends
  `null` mapping values as SQL `SET col = NULL` (it does not skip them), which
  would wipe e.g. `approvedAt` on REJECT/RETRY_SEND. **Apply Command**
  therefore maps `approvedAt` / `rejectedAt` / `rejectedReason` as
  `guard value ?? current row value (Load Authoritative Report) ?? null` —
  a "write back the same value" no-op — touching only `documentStatus` and the
  timestamp/reason the command actually sets. `sentAt`, `sendAttemptCount`,
  the pdf fields and every other column are never mapped.
- **Object-key regex** allows spaces (`^[A-Za-z0-9 !/._-]+$`): the real private
  R2 keys are `Cavetta Maintenance Reports/YYYY/<file>.pdf` (see the relay
  and recovery workflows), and `..` is still rejected separately.
- Cross-branch references always use explicit `{{ $('Node Name').first().json.field }}`
  because n8n HTTP nodes do not pass input fields through on either output.

**Internal callback contract** (both POST, always 200, credential
`CloudIT Operations Internal API`):
- `http://platform-api:3001/api/operations/internal/report-commands/claim` —
  body `{ commandKey, clientKey, nonce }`; response
  `{ generatedAt, result, denialCode?, command? }`.
- `http://platform-api:3001/api/operations/internal/report-commands/acknowledge` —
  body `{ commandKey, clientKey, resultCode }` with `resultCode` one of
  `acknowledged | rejected_state | rejected_stale_version |
  rejected_pdf_unavailable | rejected_recipient_policy | failed_safe`.

**Required environment variables in n8n (protected server env file):**
- `OPERATIONS_REPORT_COMMAND_SECRET` — at least 32 characters, no `$`; must
  equal the `platform-api` value (used to HMAC-sign the canonical payload).
- `OPERATIONS_REPORT_COMMAND_URL` — set in `platform-api` to
  `http://n8n:5678/webhook/cloudit-report-command`.

**Required n8n credentials (owner creates; secrets never enter the workflow):**
- **CloudIT Report Command** (webhook): n8n credential type **Header Auth**;
  header name `x-cloudit-report-command-token`, value =
  `OPERATIONS_REPORT_COMMAND_TOKEN` (at least 32 characters, no `$`). Dedicated
  to this workflow — never reuse the relay or ingest secrets.
- **CloudIT Operations Internal API** (claim/acknowledge HTTP nodes): the
  existing Header Auth credential with header `x-operations-internal-token`
  and the existing `OPERATIONS_INTERNAL_API_TOKEN` value (same as Phase 9).

**Semantic harness (no n8n required):**
`node infra/n8n/workflows/tests/report-command-harness.mjs` extracts both Code
nodes from the export and runs them with n8n-mimicking `$env` / `$json` /
`$input` / `$` stubs: valid and tampered signatures, expiry, every per-field
rejection, REJECT reason normalization, and all guard outcomes
(state drift, pdf unavailable, `..` key, already-sent, zero/two rows), plus
structural invariants (inactive, no email/S3/schedule nodes, webhook path,
credential name, no pinData). Exit code is non-zero on any failure.

**Import rule:** the workflow exports `active: false` and must be imported
INACTIVE and stay inactive until the checklist below is complete.

**Pre-activation checklist (owner action):**
1. Apply the fresh + idempotent migration
   `infra/postgres/operations/migrations/0011_report_command_lifecycle.sql`
   and deploy the matching `platform-api`.
2. Set the same random `OPERATIONS_REPORT_COMMAND_SECRET` (>= 32 chars, no `$`)
   in the protected environments for n8n and `platform-api`.
3. Create the **CloudIT Report Command** Header Auth credential (recipe above)
   and set `OPERATIONS_REPORT_COMMAND_TOKEN` in `platform-api`.
4. Create/link the **CloudIT Operations Internal API** credential on the claim
   and acknowledge HTTP nodes.
5. Confirm the Data Table still carries the `reportMonth` / `reportType` /
   `documentStatus` / `approvedAt` / `rejectedAt` / `rejectedReason` /
   `pdfDriveFileId` / `pdfFileName` / `sentAt` columns — **Apply Command**
   writes `rejectedReason`, and n8n fails closed with `unknown column name` if
   it is missing.
6. Run the semantic harness — all cases must be green.
7. Owner live-comparison of the report review/sender workflows against the
   Data Table row state before activation; the sender owns `sentAt`,
   `sendAttemptCount` and `pdfGeneratedAt`, this workflow never writes them.
8. Activate only after the above. Rollback is to deactivate/delete the
   workflow; the Data Table and report metadata are unchanged by denials.

**Hard rule:** during construction and testing this workflow must never
perform a real report action — no activation and no live commands against real
report rows until the owner explicitly approves. Deny-only tests against
non-existent or DRAFT-only fixture months are permitted.

## Importing into n8n

1. Open your n8n instance.
2. Go to **Workflows** → **Import from File** (or **Import from URL**).
3. Select the `.json` file you want to import.
4. Configure credentials for the email, Google Sheets, and HTTP Request nodes.
5. Activate the workflow and copy the webhook URL into `N8N_WEBHOOK_URL` in CloudIT.

## Webhook Security

CloudIT signs outbound webhooks with HMAC-SHA256 using `N8N_WEBHOOK_SECRET`. You can verify the signature in n8n using the `X-CloudIT-Signature` header.
