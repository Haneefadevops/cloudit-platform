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

## Importing into n8n

1. Open your n8n instance.
2. Go to **Workflows** → **Import from File** (or **Import from URL**).
3. Select the `.json` file you want to import.
4. Configure credentials for the email, Google Sheets, and HTTP Request nodes.
5. Activate the workflow and copy the webhook URL into `N8N_WEBHOOK_URL` in CloudIT.

## Webhook Security

CloudIT signs outbound webhooks with HMAC-SHA256 using `N8N_WEBHOOK_SECRET`. You can verify the signature in n8n using the `X-CloudIT-Signature` header.
