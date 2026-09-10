# CloudIT Operations Portal — Phase 0 Specification

Status: **PROPOSED — safety findings resolved; awaiting owner decisions and approval**  
Date: 10 September 2026  
Scope: planning and read-only inspection only

No portal code, operations database, n8n workflow, credential, DNS record,
deployment, report state, backup, or production system was changed during this
phase.

## 1. Purpose and non-negotiable boundary

Build a separate, private, multi-client operations portal at
`operations.cloudit.lk`. n8n remains the only provider-integration and
automation layer. It publishes normalized, sanitized evidence to a separate
operations database. The browser never receives provider credentials, database
credentials, n8n credentials, SMTP credentials, raw errors, stack traces,
unrestricted execution payloads, request bodies, email bodies, customer data,
landlord data, booking data, inquiry data, or backup contents.

The Cavetta application repository and Supabase database are not the portal
repository or operations database. Cross-client operations data must never be
stored in the Cavetta application database.

## 2. Inspection sources and confidence

### Read completely

- `AGENTS.md`
- `docs/cloudit-operations-portal-plan.md`
- `docs/maintenance-automation-handover.md`
- `docs/n8n-maintenance-automation-handover-2026-08-29.md`
- `docs/n8n-maintenance-automation-plan.md`
- `docs/monthly-maintenance-report-delivery-runbook.md`
- `docs/database-backup-restore.md`
- `.github/workflows/database-backup.yml`
- `.github/workflows/backup-restore-test.yml`
- `scripts/backup/run-backup.sh`
- `scripts/backup/test-restore.sh`
- All ten JSON workflow exports under `n8n/`

### Confidence labels

- **Verified in repository**: directly confirmed in tracked workflow/script
  files.
- **Documented current**: stated in the handover dated through 9 September 2026,
  but not independently read from the live n8n instance.
- **Unverified**: exact live definition, field name, workflow ID, execution
  window, or table schema is absent from repository artifacts.

Ten n8n workflow JSON exports were supplied under `n8n/` and inspected in full.
All parse as JSON, all identify themselves as active, none contains pinned data
or disabled nodes, and the expected eight operational workflows reference the
watchdog as their Error Workflow. The exports contain saved workflow definitions
but no execution history or proof that the exported saved revision is identical
to the currently published live revision. Live execution-history verification
in section 14 therefore remains mandatory before Phase 1 can be approved.

## 3. Existing workflow inventory

All times are in `Europe/Malta` unless explicitly UTC. Completion windows marked
“proposed” are portal expectations and must be compared with live execution
history before implementation.

| Workflow | Trigger and schedule | Expected completion | Current evidence and safety |
| --- | --- | --- | --- |
| `Cavetta - Load Maintenance Configuration` | Called as a sub-workflow | Proposed: under 30 seconds | Loads typed active non-secret settings; fails on missing required keys. No provider secret is stored in the table. Documented current. |
| `Cavetta - Incident Monitor` | Authenticated Uptime Kuma webhook; event-driven | DOWN: after two-minute confirmation, proposed within 3 minutes. UP/rejected: proposed within 1 minute | Fixed allowlist of five production monitor IDs; never trusts the inbound URL for recheck; records confirmed/recovered/temporary/rejected safe events. Email/ticket output is disabled. Documented current. |
| `Cavetta - Daily Backup Watchdog` | Daily 07:15 | Proposed by 07:25 | Read-only GitHub Actions checks. Backup success becomes overdue after 28 hours; restore test after 35 days. Stores safe evidence only. Documented current. |
| `Cavetta - Weekly Health Check` | Monday 08:00 | Two-minute branch wait exists; proposed by 08:15 | Thirteen current checks: five public endpoints, Vercel deployment, Supabase public API, ImageKit stable asset, backup, restore test, Vercel analytics, Supabase infrastructure, ImageKit usage. Analytics failure is AMBER/NO_DATA, not an outage. Documented current. |
| `Cavetta - Monthly Source Snapshot Capture` | Cron `0 0 1 * *`, day 1 at 00:00 | Proposed by 00:30 | Captures seven exact-month sources and idempotently upserts `reportMonth:sourceKey`. It cannot render, upload, approve, send, ticket, back up, or restore. Documented current. |
| `Cavetta - Monthly Maintenance Report Draft` | Day 1 at 09:00; waits until the first weekday when necessary (weekends only; public holidays are not modelled) | Proposed by 09:45 on the effective weekday | Consumes the seven stored snapshots, creates a DRAFT, renders PDF privately, uploads to Drive, saves metadata, and sends one internal review message. DRAFT-only replacement guards remain authoritative. Documented current. |
| `Cavetta - Monthly Report Review` | Authenticated n8n Form Trigger; POST decision | Proposed response under 30 seconds | `n8n User Auth`; only an unsent DRAFT changes. Approve records APPROVED/approvedAt; reject records REJECTED/rejectedAt and a bounded safe reason. Replays cause no change. Documented current. |
| `Cavetta - Monthly Report Review Reminder` | Daily 09:15 | Proposed by 09:25 | Sends one internal reminder only after 48 hours while still unsent DRAFT, then records the timestamp. Documented current. |
| `Cavetta - Approved Monthly Report Sender` | Every five minutes | Normal claim attempt within five minutes; SENDING is stale after 30 minutes | Selects APPROVED only, separately requires empty `sentAt`, atomically claims SENDING with `sendingStartedAt`, then records SENT or sanitized SEND_FAILED. A retry requires manual review and return to APPROVED. Documented current. |
| `Cavetta - Automation Watchdog` | Every 15 minutes; also receives configured n8n Error Workflow events; exposes a minimal read-only health webhook | Heartbeat endpoint accepts evidence up to 45 minutes old | Stores one aggregate WATCHDOG_SUMMARY per interval. Error events are normalized into hourly workflow/category buckets; 1 transient failure AMBER, third repeated failure RED, credential failure immediately RED. Health response exposes only `status`, `service`, `checkedAt`. No notification/ticket node is connected. Verified in export. |
| `Database backup` (GitHub Actions, not n8n) | `17 2 * * *`, daily 02:17 UTC; manual dispatch available | Job timeout 30 minutes; expected by 02:47 UTC | Creates encrypted logical backup, uploads archive/checksum, downloads Drive copy, verifies checksum, decrypts/extracts in temporary storage, validates required files, cleans temporary data, applies retention. Verified in repository. |
| `Backup restore test` (GitHub Actions, not n8n) | `37 3 2 * *`, day 2 at 03:37 UTC; manual Daily/Monthly dispatch | Job timeout 45 minutes; expected by 04:22 UTC | Restores to an ephemeral local Supabase database and validates schema, data presence, RLS, anonymous denial, whitelist privacy, and cleanup. It receives no production DB, service-role, or Vercel credential. Verified in repository. |

### Trigger dependencies

- Uptime Kuma is on the same server as n8n and cannot prove whole-server
  availability.
- Eight Cavetta workflows use `Cavetta - Automation Watchdog` as their n8n Error
  Workflow: Daily Backup Watchdog, Weekly Health Check, Monthly Source Snapshot
  Capture, Monthly Maintenance Report Draft, Approved Monthly Report Sender,
  Monthly Report Review Reminder, Monthly Report Review, and Incident Monitor.
- The configuration loader is intentionally excluded to avoid duplicate parent
  and child failures. The watchdog excludes itself to prevent recursion.
- Ticketing and client incident notification remain disabled.

## 4. Existing n8n Data Tables and safe fields

The table list is complete to the extent documented. Exact live schemas must be
exported read-only before Phase 1. Fields shown as “semantic” are documented
outputs whose precise live column names were not available.

| Data Table | Confirmed/safe fields relevant to the portal | Do not publish |
| --- | --- | --- |
| `cavetta_maintenance_config` | Exact columns: `configKey`, `configValue`, `valueType`, `description`, `isActive`. Safe settings include client/public identity, report routing configuration, provider project/public endpoint references, thresholds, quotas, review-form URL, schedule/reminder values, and `ticketing_enabled=false`. | Any secret, token, key, connection string, OAuth material, password, webhook secret; report email addresses should not be copied into client-visible operational records. |
| `cavetta_maintenance_events` | Semantic: approved monitor key/name, public endpoint key, event type, confirmation/recovery timestamps, status/severity, safe HTTP/failure category, outage duration where known, rejected-monitor marker. | Webhook payload, supplied URL, raw response/error, stack, headers, private/contact data. |
| `cavetta_maintenance_checks` | Semantic: check type (backup/restore), workflow identity, run state/conclusion, run/start/end timestamps, age, status/severity, safe GitHub run URL, safe action. | GitHub token, logs, job payloads, secret names/values, backup contents. |
| `cavetta_weekly_health_checks` | Confirmed: individual check rows and `WEEKLY_SUMMARY`; `visitorCount`, `pageviewCount`, `periodStart`, `periodEnd`, `topRoutesJson`, `infrastructureOverviewJson`. Semantic: check/target keys, status/severity, timestamps, HTTP/latency, deployment state, backup/restore evidence, Supabase aggregate infrastructure fields, ImageKit aggregate usage/quota fields, counts of GREEN/AMBER/RED/MISSING. | Public API response rows, raw Prometheus labels/identifiers, provider errors, query strings, private paths, credentials. |
| `cavetta_monthly_source_snapshots` | Confirmed: `snapshotKey`, `reportMonth`, `sourceKey`, requested/actual period, timezone, boundary semantics, retention/latest-safe-collection notes, capture/source-as-of timestamps, freshness, evidence counts, `FULL`/`PARTIAL`/`NO_DATA`, safe action/detail, aggregate `metricsJson`. Seven source keys: weekly health, incidents/recoveries, backup/restore, GA4, Vercel analytics, Supabase infrastructure, ImageKit usage. | Raw provider response, raw error, tokens, request headers, personal data. |
| `cavetta_monthly_maintenance_reports` | Confirmed: `reportMonth`, report/overall result, aggregate report fields, `sourceSnapshotsJson`, `infrastructureOverviewJson`, Vercel fields, ImageKit fields, Supabase aggregate fields, `documentStatus`, `pdfFileName`, `pdfDriveFileId`, `pdfDriveUrl`, `pdfGeneratedAt`, `approvedAt`, `rejectedAt`, `rejectionReason`, `reviewNotificationSentAt`, `reviewReminderSentAt`, `sendingStartedAt`, `sentAt`, `sendAttemptCount`, `lastSendError`. | PDF bytes in the operations DB, email body, recipients in browser payloads, Drive credential, unrestricted Drive URL/ID in browser responses, raw SMTP error. |
| `cavetta_automation_watchdog_evidence` | Semantic: interval/bucket key, WATCHDOG_SUMMARY, status/severity, checked timestamp, finding counts/categories, ticketing flag, heartbeat eligibility, freshness/overdue summaries. | Raw n8n error, stack, execution payload, execution URL, credential/provider response. |
The watchdog summary and failure buckets share
`cavetta_automation_watchdog_evidence`; there is no separate failure-bucket
table in the supplied export. The exported schemas expose seven Data Tables in
total: maintenance configuration, events, checks, weekly health, monthly source
snapshots, monthly reports, and automation-watchdog evidence. The configuration
table's exact live schema is not embedded in its read node, although its five
documented columns and 22 required configuration keys are visible in the loader.

### 4.1 Production-safety correction outcome

The seven findings from the original read-only inspection were handled in the
separately authorized production-safety correction completed on 9 September
2026. The accepted correction and controlled publication are recorded in
`docs/n8n-production-safety-correction-plan-2026-09-09.md` and
`docs/maintenance-automation-handover.md`.

- The sender recovery syntax, narrow status mappings, fixed sanitized failure
  categories, string `sendAttemptCount`, seven snapshot keys, documented
  weekend-only scheduling rule, and required review-form configuration were
  corrected or reconciled.
- Six isolated sender rows produced zero unrelated-field mismatches.
- Temporary nodes, rows, pins, mocks and fixed clocks were removed.
- The real report table retained one `SENT` and two `DRAFT` rows.
- Post-publication loader, idle-sender and watchdog observations passed with
  `ticketing_enabled=false` and no real report action.
- All ten canonical exports parse and all 54 Code nodes pass syntax validation.
- The three corrected canonical file hashes were independently matched in the
  repository on 10 September 2026.

The scheduled 1 October 2026 Phase 5E acceptance remains pending. Its real
report must stay `DRAFT` during review. The implemented working-day behavior is
weekend-only; public holidays are not modelled.

No obvious literal GitHub token, JWT, private key, database URL with credentials,
Bearer token, or long embedded secret was detected. Credential references are
present by type, as expected, but credential values are not exported.

Known historical exceptions must remain clearly labelled and must not seed portal
health: the July pre-guard SENDING acceptance row and the non-authoritative August
DRAFT/test PDF evidence.

## 5. Current evidence-source map

| Portal area | Current source and path | Present coverage | Missing for portal |
| --- | --- | --- | --- |
| n8n workflows/executions | n8n schedules, execution records, Error Workflow events, existing Data Tables | Failure buckets and several workflow-specific success rows | A canonical catalogue; success/run summary for every workflow; live enabled/published revision; next run; schedule delay; duration; safe execution correlation; missed-run detection for all workflows. |
| Website health | Uptime Kuma webhooks; weekly n8n HTTP checks | Five production public monitors; delayed confirmation and recovery | Five-minute independent time series; full-period uptime from Kuma; TLS metadata ingestion; external whole-server probe. |
| Infrastructure | Supabase public REST check and official Prometheus metrics read by n8n | PostgreSQL up, DB size, direct/Supavisor/PgBouncer connections, max/utilization, waiting, disk/memory, read-only, OOM/restarts | Required 15-minute collection; exact live metric names/units; connection-limit provenance; provider missing-series rules; OS/server CPU/disk/network/container evidence if wanted. |
| Vercel | Read-only latest production deployment; Web Analytics count and route aggregates | Latest deployment plus weekly seven-day and exact-month snapshot visitors/pageviews/top-five public routes | Deployment history/duration collector; daily traffic series; documented plan-supported invocation/error/edge/usage endpoints; quota/limit values; domain health definition. Never scrape dashboard. |
| ImageKit | Public stable asset plus restricted account usage API | Delivery health; bandwidth, Media Library storage, video/extension units, original-cache bytes; quota percentages; exact-month snapshot | Six-hour time series; confirmed provider boundary timezone; per-plan quota source/effective dates; request counts are dashboard-only unless a supported API is confirmed. |
| Backups | GitHub Actions workflow runs; backup/restore scripts; Google Drive encrypted files | Run result/age and safe run link; workflow run proves round-trip steps when successful | Drive metadata reconciliation; explicit archive/checksum pairing; file size bytes; retention class; missing-day calendar; run duration; immutable evidence link; monthly-copy evidence. |
| Reports/PDF | Monthly report Data Table, Gotenberg, private Drive, Zoho sender | DRAFT generation, protected n8n review, sender lifecycle and audit timestamps | Sanitized report publication to operations DB; server-mediated PDF stream; portal command protocol; report row version; command audit/replay protection. |
| Incidents/audit | Maintenance events and watchdog evidence | Confirmed/recovered events and safe failure buckets | Stable cross-source incident key, acknowledgement/assignment fields, incident event history, portal administrative/action audit, external-monitor incidents. |

## 6. Missing data required before corresponding portal phases

1. Read-only live export of every Cavetta n8n workflow: workflow ID mapped to a
   portal-safe key, active/published state, trigger nodes, timezone, cron, Error
   Workflow setting, and node names/types with parameters and credentials
   redacted.
2. Read-only confirmation of the configuration Data Table's exact live schema.
3. At least 30 days of safe execution timings, or an agreed provisional SLA, for
   each scheduled workflow.
4. A success publication point in every workflow. Error Workflow evidence alone
   cannot distinguish “did not run” from “ran successfully.”
5. Fifteen-minute database/connection samples. Current documentation confirms
   weekly collection, but not the planned 15-minute history.
6. Five-minute public endpoint samples and an external probe. Existing Uptime
   Kuma is not independent and the weekly check is too sparse for portal trends.
7. Vercel deployment history/duration and plan-supported usage/quota fields.
8. ImageKit six-hour snapshots and authoritative quota metadata; verify date
   boundary timezone.
9. Read-only Drive file metadata reconciliation for Daily, Monthly, and Restore
   Tests folders.
10. A safe GitHub run-to-backup-file correlation. The current summary exposes a
    filename and human-readable size, but not a normalized byte count/event
    record.
11. Report `rowVersion` (or equivalent compare-and-set version), safe report
    identifier independent of Data Table row ID, and explicit command outcome.
12. Client membership/role data, ingestion publisher identity, and portal audit
    events, none of which belong in the Cavetta database.
13. Full-period Uptime Kuma availability numbers if percentage uptime is to be
    displayed. Never derive or claim this from incident rows alone.
14. Server/host/container metrics are not currently documented. They require an
    explicit scope decision and safe collector if “infrastructure” includes the
    Hetzner host rather than Supabase/database connectivity only.

## 7. Sanitized n8n publishing contract

### 7.1 Transport and trust

- n8n sends HTTPS POST requests to a private ingestion endpoint owned by the
  operations service. The browser cannot call this endpoint.
- Use a separate publisher credential per client/environment, stored only in n8n
  Credentials. Sign `timestamp + nonce + SHA-256(body)` with HMAC-SHA-256, or use
  mutually authenticated TLS if operationally supported.
- Reject timestamps outside five minutes, reused nonces, invalid signatures,
  unknown publishers, disabled clients, oversized bodies, unknown fields, and
  invalid enum/units.
- Publisher identity determines `client_id` and allowed environments/record
  types. Never trust a body-supplied tenant identity by itself.
- Maximum batch: proposed 500 records or 1 MiB. Partial acceptance is forbidden;
  validate the complete batch transactionally.
- An idempotency key is unique for publisher, record type, and source record.
  Retries return the original receipt and create no duplicate evidence.
- The endpoint returns only receipt ID, accepted count, duplicate count, and safe
  validation codes; it never reflects the submitted payload or a stack trace.

### 7.2 Common envelope

| Field | Type | Rule |
| --- | --- | --- |
| `contractVersion` | string | Fixed supported version, initially `1.0`. |
| `recordType` | enum | One of the record types below. |
| `idempotencyKey` | string, max 160 | Stable and opaque; no email, URL query, name, or secret. |
| `environmentKey` | enum/string | Registered value such as `production`; publisher must be scoped to it. |
| `sourceSystem` | enum | `n8n`, `uptime_kuma`, `github_actions`, `vercel`, `supabase`, `imagekit`, `google_drive`, `ga4`, `smtp`. |
| `observedAt` | RFC 3339 UTC | When the source state was observed. |
| `publishedAt` | RFC 3339 UTC | When n8n sent the record. |
| `freshUntil` | RFC 3339 UTC | Source-specific deadline; never extended by a portal refresh. |
| `status` | enum | `GREEN`, `AMBER`, `RED`, `NO_DATA`, or `UNKNOWN`. |
| `severity` | enum | `info`, `warning`, `critical`, or `none`. |
| `correlationKey` | string, nullable | Stable safe key linking related evidence. |
| `payload` | typed object | Strict schema by record type; additional fields rejected. |

### 7.3 Record types and allowed payloads

| Record type | Allowed payload fields |
| --- | --- |
| `workflow_catalog` | `workflowKey`, `displayName`, `triggerKind`, `scheduleExpression`, `scheduleTimezone`, `enabled`, `expectedStartRule`, `completionSlaSeconds`, `criticality`, `safeStepKeys[]` |
| `workflow_execution` | `workflowKey`, `executionKey` (opaque), `triggerKind`, `scheduledFor`, `startedAt`, `finishedAt`, `durationMs`, `scheduleDelayMs`, `outcome` (`success`, `failure`, `cancelled`, `waiting`, `missed`), `failureCategory`, `failureCode`, `attempt`, `sourceRevisionKey` (opaque) |
| `endpoint_observation` | `endpointKey` (registered), `checkedAt`, `available`, `httpStatusClass`, `httpStatus`, `responseTimeMs`, `tlsDaysRemaining`, `confirmationState`, `monitorKey` |
| `provider_connection` | `provider`, `connectionKey`, `reachable`, `authorizationState` (`ok`, `denied`, `unknown`), `lastSuccessfulAt`, `failureCategory` |
| `metric_sample` | `metricKey`, `sampledAt`, `valueNumber` or `valueBoolean`, `unit`, `periodStart`, `periodEnd`, `coverage`, `dimensions` from a per-metric allowlist |
| `traffic_summary` | `provider`, `periodStart`, `periodEnd`, `timezone`, `boundary`, `coverage`, `visitors`, `pageviews`, `topRoutes[]` containing only allowlisted public path and aggregate counts |
| `deployment_summary` | `deploymentKey` (opaque), `environment`, `state`, `createdAt`, `readyAt`, `durationMs`, `publicDomainKey`, `isCurrentProduction`, `failureCategory` |
| `backup_evidence` | `backupKey`, `backupTimestamp`, `retentionClass` (`daily`, `monthly`), `sanitizedFileName`, `encryptedArchivePresent`, `checksumFilePresent`, `checksumVerified`, `driveRoundTripPassed`, `archiveStructureValidated`, `sizeBytes`, `runStartedAt`, `runCompletedAt`, `durationMs`, `githubRunKey`, `githubRunUrl`, `driveObjectKey` (server-only) |
| `restore_test_evidence` | `restoreTestKey`, `backupKey`, `sourceRetentionClass`, `startedAt`, `completedAt`, `durationMs`, `result`, `checksumPassed`, `decryptPassed`, `isolatedRestorePassed`, `requiredObjectsPassed`, `rlsPassed`, `anonymousDenialPassed`, `publicWhitelistPassed`, `cleanupPassed`, `githubRunKey`, `githubRunUrl` |
| `report_summary` | `reportKey`, `reportMonth`, `reportType`, `overallStatus`, `documentStatus`, `generatedAt`, `coverage`, `findingCountsBySeverity`, `pdfAvailable`, `approvedAt`, `rejectedAt`, `sendingStartedAt`, `sentAt`, `sendAttemptCount`, `deliveryFailureCategory`, `rowVersion` |
| `report_finding` | `reportKey`, `findingKey`, `category`, `severity`, `status`, `safeTitle`, `safeSummary`, `safeAction`, `firstObservedAt`, `lastObservedAt` |
| `incident` | `incidentKey`, `serviceKey`, `endpointKey`, `state` (`open`, `recovered`, `resolved`), `severity`, `failureCategory`, `startedAt`, `confirmedAt`, `recoveredAt`, `resolvedAt`, `occurrenceCount`, `safeSummary`, `safeAction` |
| `audit_event` | `eventKey`, `actorType`, `actorKey` (opaque), `action`, `targetType`, `targetKey`, `result`, `occurredAt`, `commandKey`, `safeReasonCode` |

### 7.4 Allowed metric registry

- Workflow: duration ms, schedule delay ms, success/failure/missed counts and
  success percentage.
- Website: availability boolean, HTTP status, response time ms, TLS days
  remaining. Only registered public endpoints may appear.
- Supabase/PostgreSQL: PostgreSQL up boolean, database size bytes, direct,
  Supavisor and PgBouncer connection counts, PgBouncer configured max clients
  and utilization percent, waiting connections, disk/memory percent, filesystem
  read-only boolean, OOM-kill count, PostgreSQL restart count. API request count
  remains NO_DATA until a least-privilege supported endpoint is verified.
- Vercel: visitors, pageviews, allowlisted top public routes, deployment state
  and duration. Invocation/error/edge-request/usage/quota metrics are excluded
  until supported endpoints and current-plan access are verified.
- ImageKit: bandwidth bytes, Media Library storage bytes, video-processing units,
  extension units, original-cache storage bytes, configured quota and utilization
  percent. Provider usage calls must be at least six hours apart for an identical
  account/date/metric request because the response is provider-cached.
- Backup: encrypted size bytes, backup/restore duration, age, success/failure,
  checksum/round-trip/isolated-restore booleans.
- GA4: total users, new users, sessions, screen page views, exact requested and
  actual period only.

### 7.5 Forbidden fields and transformations

- Reject arbitrary `message`, `error`, `stack`, `payload`, `request`, `response`,
  `headers`, `query`, `sql`, `body`, `email`, `phone`, `name`, `address`,
  `connectionString`, `token`, `secret`, `password`, `credential`, and binary
  fields.
- Failure categories use a closed allowlist: `timeout`, `dns`, `tls`, `http_4xx`,
  `http_5xx`, `authentication`, `authorization`, `rate_limit`, `quota`,
  `provider_unavailable`, `invalid_response`, `missing_evidence`, `overdue`,
  `stuck_send`, and `unknown_sanitized`.
- `safeTitle`, `safeSummary`, `safeAction`, and rejection reasons are plain text,
  length-limited, stripped of URLs except registered safe links, control
  characters, email addresses, long numeric/token-like strings, and HTML.
- Public route aggregation removes query strings/fragments and excludes
  `/admin`, `/agent`, `/share`, `/api`, `/_next`, `/_vercel`, and `Others`.
- n8n execution URLs and Data Table row IDs are server-only; the browser receives
  portal identifiers.

## 8. Proposed multi-client operations database

### 8.1 Core schema

| Table | Purpose and key constraints |
| --- | --- |
| `clients` | CloudIT tenant; unique immutable `client_key`, display name, lifecycle state. |
| `environments` | Belongs to client; unique `(client_id, environment_key)`. |
| `domains` | Registered public domain per environment; never accepts arbitrary probe URLs. |
| `endpoints` | Registered path/monitor definition; belongs to client/environment/domain. |
| `user_profiles` | Portal user identity and global role; no provider identity data. |
| `client_memberships` | `(user_id, client_id)` with client role; future isolation boundary. |
| `publishers` | Ingestion identity, client/environment scope, allowed record types, key version/hash, disabled/last-used timestamps. Secret value is never stored recoverably. |
| `ingestion_receipts` | Batch digest, publisher, nonce, accepted/duplicate counts, timestamp and safe result; unique replay/idempotency constraints. |
| `workflow_definitions` | Curated catalogue, trigger/schedule/SLA/criticality and version. |
| `workflow_steps` | Curated safe diagram nodes/edges, never editable n8n canvas or node parameters. |
| `workflow_executions` | Sanitized run summaries with unique source key. |
| `metric_definitions` | Metric key, type, unit, allowed dimensions, frequency, freshness, thresholds, retention class. |
| `metric_samples` | Typed value and period; partitionable; unique source/idempotency key. |
| `endpoint_observations` | Availability/latency/TLS samples for registered endpoints. |
| `deployments` | Sanitized deployment history and current-production marker. |
| `backup_evidence` | One row per encrypted backup/retention copy; server-only Drive object key. |
| `restore_tests` | One row per isolated test linked to backup evidence. |
| `reports` | Sanitized report metadata/state/version; no PDF body. |
| `report_findings` | Sanitized structured findings linked to report/client. |
| `report_events` | Append-only mirror of authoritative n8n report state transitions. |
| `report_commands` | Signed-command request/result, expected version/state, nonce, expiry, actor, status. Never marks a report sent by itself. |
| `incidents` | Stable deduplicated incident with client/service/severity/state. |
| `incident_events` | Append-only detection, confirmation, recovery and resolution events. |
| `audit_events` | Append-only portal and command audit; no personal payload or before/after values. |

Every tenant table has non-null `client_id`. Child tables use composite foreign
keys including `client_id` so a row cannot link to another client's parent.
Source identities have unique `(publisher_id, record_type, idempotency_key)`
constraints. Times are `timestamptz` in UTC; display conversion is explicit.
Semi-structured JSON is permitted only for versioned, validated aggregate
metrics/dimensions, not as an unrestricted payload escape hatch.

### 8.2 Roles and RLS/security

- `anon`: no grants on portal schemas, storage, functions, or views.
- `authenticated`: only explicit SELECT grants required by the portal and RLS
  policies requiring an active membership. No direct INSERT/UPDATE/DELETE on
  evidence, commands, reports, incidents, or audit tables.
- `cloud_owner`: application role; sees all clients and may perform separately
  authorized administrative/report actions.
- `cloud_operator` (future): sees assigned clients and may acknowledge incidents
  or request report actions when permissioned.
- `client_viewer` (future): read-only access to assigned client-safe evidence and
  reports; never internal failure/audit/command details unless explicitly mapped.
- `client_report_approver` (future, optional): assigned-client report actions
  only; no provider or n8n access.
- Ingestion is not performed with a browser session. A private server endpoint
  maps an authenticated publisher to its tenant and writes through a dedicated
  least-privilege DB role or narrowly scoped stored procedures.
- If Supabase is chosen, enable RLS on every exposed table, revoke default
  privileges, explicitly grant operations, keep secret/service credentials
  server-side, and place security-definer helpers in an unexposed private schema
  with an empty `search_path` and revoked public execution.
- Views must use invoker/RLS-safe behavior; never expose a default
  security-definer view over tenant tables.
- Report PDF and backup links are server routes requiring a current session and
  client membership on every request. Do not rely on an unguessable URL.
- Audit rows are append-only. Updates/deletes are denied to portal users and
  ingestion publishers. Retention deletion, if later approved, uses a distinct
  maintenance role and records an aggregate audit event.

### 8.3 Required isolation tests

Test `anon`, owner, assigned viewer, unassigned viewer, disabled membership,
ingestion publisher A/B, and server action roles across SELECT/INSERT/UPDATE/
DELETE for every table/view/function. Specifically prove that changing a URL or
body `client_id` cannot cross tenants and that service/secret keys never appear
in browser bundles, responses, logs, or error pages.

## 9. Report viewing and action security boundaries

### Read-only viewing (Phase 9)

1. Browser requests `/reports/{portalReportKey}/pdf` with an authenticated
   portal session.
2. Portal server reloads membership and report/client association; it does not
   trust client state or a supplied Drive ID.
3. Portal server sends a short-lived, signed, one-use retrieval request to n8n
   containing only report key, timestamp, nonce, and correlation ID.
4. n8n reloads the authoritative report row, requires private PDF metadata and
   an allowed report state, downloads from Drive using its credential, and
   streams the PDF with a fixed MIME type and safe filename.
5. Portal returns `Cache-Control: private, no-store`, clickjacking protection,
   strict CSP, and an audit event. It never exposes the Drive ID, Drive URL,
   OAuth token, or n8n URL to browser code.
6. GET/view/download paths are structurally incapable of changing report state.

The proposed “Open in Drive” control should therefore be owner-only and
server-mediated, or omitted. A raw private `webViewLink` can disclose a provider
identifier and depends on the viewer's separate Google authorization.

### Future actions (Phase 10 only)

- Browser POSTs to the portal server with CSRF protection, step-up/recent
  authentication, explicit report month/client/status confirmation, and a
  single-use idempotency key.
- Portal checks role, membership, current report state/version and rate limit,
  records a pending command, then signs a short-lived command to n8n.
- n8n is authoritative: it reloads the report and applies compare-and-set guards.
  The portal cannot write report state directly.
- Allowed commands proposed: `APPROVE_AND_SEND` for an unsent DRAFT with valid
  private PDF metadata; `REJECT` for an unsent DRAFT with an optional sanitized
  300-character reason; `RETRY_SEND` for SEND_FAILED only after an explicit
  owner confirmation. No `REGENERATE`, force-send, SENT reset, or arbitrary state
  edit is exposed.
- Approval changes DRAFT to APPROVED only. The existing sender alone claims
  APPROVED to SENDING and performs SMTP delivery. SENT requires `sentAt` and can
  never be replayed. Stale SENDING recovery remains unchanged.
- Command retries return the existing result. Expired, replayed, stale-version,
  wrong-state, already-sent, or tenant-mismatched commands make no change and are
  audited with a safe result code.
- No real report action is permitted in construction acceptance. Phase 10 uses a
  separately approved non-real report and removes all test evidence afterward.

## 10. Displayable Google Drive backup metadata

### Allowed in owner portal

- Portal backup key and sanitized filename matching the fixed
  `cavetta-db-YYYY-MM-DDTHHMMSSZ.tar.gz.gpg` pattern.
- Created/modified timestamp, size in bytes, Daily/Monthly retention class,
  archive-present and matching-checksum-present booleans.
- SHA-256 verification result, encryption-present result, Drive round-trip
  result, archive-structure validation result, and corresponding GitHub run
  state/duration/link.
- Expected next run, age/overdue state, retention expiry date derived from policy,
  and whether a matching monthly copy exists.
- Latest isolated restore-test timestamp/result and individual pass/fail booleans
  for checksum, decryption, restore, required objects, RLS, anonymous denial,
  public whitelist and cleanup.
- A server-only Drive object key for reconciliation/retrieval.

### Never display or retrieve

- Backup bytes, decrypted archive, SQL files, manifest contents, checksum file
  contents, encryption password, rclone configuration, Drive OAuth data, owners/
  permissions, thumbnails, download links, or arbitrary Drive metadata.
- Do not expose raw Drive file IDs/links to future client viewers. If an owner-only
  “Open in Drive” action is approved, generate it server-side after authorization
  and never include it in list API payloads.
- Phase 8 reconciliation may list metadata only in the dedicated Daily, Monthly,
  and Restore Tests folders. It must never download or decrypt a backup.

## 11. Frequencies, freshness, thresholds, and retention

### 11.1 Collection and freshness

| Evidence | Collection | Fresh/AMBER stale/RED overdue |
| --- | --- | --- |
| Public endpoint | Every 5 minutes; keep Uptime Kuma 60-second monitor separate | Fresh 10m; AMBER >10m; RED >20m without evidence. A confirmed outage is RED immediately. |
| Incident webhook | Event-driven with two-minute DOWN confirmation | Event fresh immediately; open until recovery/resolution. |
| Automation watchdog | Every 15 minutes | Production health webhook currently treats the latest heartbeat as fresh through 45m, then returns stale/503. The portal may show AMBER after 20m while respecting that 45m source boundary. |
| Database/connection metrics | Every 15 minutes (new cadence required) | Fresh 30m; AMBER >30m; RED >60m for missing critical DB evidence. |
| Vercel deployment | Proposed every 15 minutes and event-driven if a supported webhook is selected | Fresh 30m; AMBER >30m; RED only for confirmed current production deployment failure, not missing analytics. |
| Vercel traffic | Hourly daily buckets plus exact month-boundary snapshot | Fresh 2h; AMBER stale/NO_DATA; never RED solely for analytics. |
| ImageKit usage | Every 6 hours; exact month-boundary snapshot | Fresh 12h; AMBER stale/NO_DATA; never RED solely for analytics. |
| Backup GitHub run | Daily 02:17 UTC, 30m job timeout; n8n reconciliation after completion and watchdog 07:15 | AMBER while running beyond 30m; RED failed/missing or no successful backup within 28h. |
| Drive inventory | Daily after backup plus day-1 monthly reconciliation | Fresh 28h; missing archive/checksum or failed round trip RED. |
| Restore test | Day 2 03:37 UTC, 45m timeout | AMBER after 32d; RED failed or older than 35d. |
| Monthly snapshots | Day 1 00:00 | AMBER if incomplete after 00:30; report remains visibly PARTIAL/NO_DATA. |
| Monthly report DRAFT | First weekday 09:00 (weekends only; public holidays are not modelled) | AMBER if absent after 09:45; never auto-approve/send. |
| Report state | Event-driven plus proposed 5-minute reconciliation | Fresh 10m. SENDING older than 30m becomes SEND_FAILED under existing n8n recovery. |
| Portal view refresh | 30–60 seconds | Refresh never changes source freshness or converts stale evidence to healthy. |

### 11.2 Initial status thresholds

- Endpoint: first unconfirmed failure AMBER; confirmed failure after the existing
  two-minute recheck RED. HTTP 4xx/5xx on an expected-success endpoint is a
  failure. Response time over 2,000 ms for three samples AMBER; over 5,000 ms for
  three samples RED. These latency thresholds require owner approval/baseline.
- TLS: AMBER at 30 days remaining; RED at 7 days or invalid/expired.
- Database: current configured warnings remain 80% PgBouncer clients, 85% disk,
  and 85% memory. Proposed RED is 95%. PostgreSQL down or filesystem read-only is
  RED; any OOM kill is RED; a restart or waiting connections are AMBER on one
  sample and RED when repeated for three samples. Database growth above 20% in
  seven days is AMBER only pending capacity review.
- Workflow: a failed critical workflow is RED; one transient optional-provider
  failure is AMBER; third same workflow/category failure in an hourly bucket is
  RED; missed completion deadline is AMBER, becoming RED after two expected
  intervals or immediately for backup/report-delivery safety workflows.
- Vercel: current production deployment `READY` is GREEN; failed/cancelled is
  RED; building longer than 15 minutes is AMBER. Analytics NO_DATA is AMBER.
- ImageKit: stable-asset delivery failure follows endpoint rules. Usage is AMBER
  at 80% quota and RED at 95%; analytics/API failure alone is AMBER/NO_DATA.
- Backup: failed/missing/overdue run, absent pair, checksum failure, round-trip
  failure, or archive validation failure is RED. Monthly-copy absence is AMBER
  if the daily backup passed, then RED after reconciliation grace.
- Restore test: any validation failure or age over 35 days is RED.
- Overall client status: RED if any current critical live-service, backup,
  restore, or critical automation signal is RED. Otherwise AMBER for warnings,
  stale critical evidence, PARTIAL/NO_DATA, or approaching quota. Analytics
  unavailability alone can never claim a live outage.

### 11.3 Retention

- Detailed workflow executions, endpoint observations, metric samples and safe
  failure buckets: 90 days.
- Daily aggregates: 24 months.
- Weekly summaries, incidents and incident events: 24 months after resolution.
- Backup and restore-test evidence: minimum 13 months (covers the existing
  366-day monthly retention plus reconciliation grace).
- Monthly reports, report findings/events, report commands and action audits:
  permanent until a later approved legal/data-retention policy.
- Authentication/security audit: proposed 24 months; security-critical report
  actions remain permanent.
- Ingestion nonces: 24 hours; compact ingestion receipts/digests: 90 days.
- Portal retention never deletes Google Drive backups, PDFs, encrypted archives,
  GitHub evidence, disaster-recovery evidence, or n8n Data Table rows. Any source
  cleanup is a separate approved automation.

## 12. Screen requirements

Every screen requires desktop and 390 px mobile designs in Phase 1, keyboard
operation, visible focus, 44 px touch targets, accessible status text plus icon
(never colour alone), explicit timezone, last-observed/freshness labels, and
loading/empty/no-data/stale/partial/permission/error states. Charts require units,
period, timezone, sampling interval, gaps, and threshold legend.

1. **Login** — owner-only initially; MFA/recovery/session-expiry messaging; no
   client data before authentication.
2. **Multi-client overview** — client/domain GREEN/AMBER/RED/NO_DATA, freshness,
   open incidents, backup and latest report state; no cross-client aggregate for
   client viewers.
3. **Client dashboard** — live-service vs analytics status separated; public
   endpoints, workflows, DB, Vercel, ImageKit, backup, report and active findings.
4. **Clients** — owner-only catalogue, environments/domains, onboarding state,
   assigned users, publishers and last evidence; secrets never viewable.
5. **Workflows** — catalogue with schedule, expected/next run, last success,
   overdue state, safe failure category, duration/schedule-delay trends, success
   percentage and recent execution timeline; curated diagram only.
6. **Infrastructure** — website response/availability, DB health/size,
   direct/Supavisor/PgBouncer counts, limits/utilization, waiting, disk/memory,
   read-only/OOM/restart evidence, watchdog freshness; range selectors only where
   sample density supports them.
7. **Vercel analytics** — visitors/pageviews daily trend, top allowlisted public
   routes, deployment timeline/duration/current production state, domain health,
   and only verified current-plan usage metrics.
8. **ImageKit analytics** — delivery health; bandwidth/storage/current quotas and
   remaining percentage; video/extension/original-cache values; trend and provider
   cache/as-of label.
9. **Backups** — daily calendar with success/failure/missing, archive/checksum/
   round-trip badges, size trend, Daily/Monthly class, run link, expected next
   run, restore-test evidence; no backup download/decrypt control.
10. **Reports** — report month/state/status/coverage/findings, private server-
    mediated PDF viewer/download, immutable event timeline. Read-only in Phase 9.
    Action controls appear only in Phase 10 with confirmations and permission.
11. **Incidents** — active/resolved list, severity/client/domain/provider filters,
    repeated failure bucket, confirmation/recovery timeline and safe links.
12. **Audit log** — actor/action/target/result/time/correlation, filters and
    append-only presentation; no values, message bodies, emails or raw payloads.
13. **Settings** — owner-only client memberships, schedules/thresholds/retention
    display, publisher rotation/revocation status, external monitor state. Never
    render secret values.

## 13. Acceptance evidence required by later phases

- Phase 1: approved desktop/mobile designs for all screens and all non-happy
  states; no implementation.
- Phase 2: DNS/HTTPS, login/logout/session expiry/MFA decision, unauthorized route
  denial, no secrets in browser, responsive shell.
- Phase 3: grants/RLS/function tests for every role and cross-client negative case;
  ingestion replay/idempotency/tenant-scope tests; append-only audit tests.
- Phase 4: field-by-field comparison of every published Cavetta record to n8n;
  retry without duplicate; forbidden-field scanning; raw-error failure test.
- Phase 5: all workflow schedules, latest states, durations and next-run values
  compared to n8n for an identical time window.
- Phase 6: endpoint/database/connection values compared with source evidence for
  identical timestamps and units; visible stale/gap behavior.
- Phase 7: Vercel and ImageKit identical-period dashboard comparison with plan,
  timezone, boundary and cache differences documented.
- Phase 8: one displayed backup matched to encrypted Drive archive/checksum and
  GitHub run without download/decryption; missing-day and restore-test cases.
- Phase 9: view a real DRAFT PDF; prove report state/version/timestamps unchanged;
  prove cross-client and raw Drive access denied.
- Phase 10: separately approved non-real report lifecycle, CSRF/replay/stale-version/
  duplicate tests, exactly one send, then complete test cleanup. No real report.
- Phase 11: controlled sanitized incident detection-to-recovery with deduplication
  and append-only audit; complete cleanup.
- Phase 12: security review, rate limits, headers, backup/recovery of operations
  DB, external whole-server probe, desktop/mobile failure testing and payload scan.
- Phase 13: second client onboarding with explicit isolation proof; no bulk enable.

## 14. Phase 0 acceptance checklist

- [x] Required handover and backup documents read completely.
- [x] Repository backup schedules, timeouts, encryption/round-trip and restore
  validation behavior inspected read-only.
- [x] All ten supplied n8n workflow JSON files parsed and inspected; active
  state, triggers, schedules, nodes, connections, Data Table references, Error
  Workflow assignments, credential-reference types and Code-node syntax checked.
- [x] Seven referenced Data Tables inventoried with embedded field names/types,
  except that the configuration read node does not embed its live table schema.
- [x] Source map, missing data, publishing contract, database/RLS model, report
  security, Drive metadata policy, frequencies, thresholds, retention and screen
  requirements proposed.
- [x] No workflow, Data Table, report, credential, backup, deployment, DNS, schema,
  application code, mock/pinned data, ticket or notification was changed.
- [x] Owner confirms these exports are the latest published live revisions; the
  three corrected canonical hashes match the recorded acceptance hashes.
- [ ] Owner supplies or reviews the configuration Data Table column definitions;
  no Data Table rows or values are required.
- [x] The seven export findings in section 4.1 were resolved by the separately
  authorized and accepted production-safety correction.
- [x] Post-publication configuration-loader, idle-sender and watchdog execution
  observations passed. Scheduled completion-window validation continues with
  the 1 October 2026 Phase 5E acceptance.
- [ ] Owner decides and approves the open decisions below.
- [ ] Owner explicitly approves Phase 0. Phase 1 must not begin before this box is
  complete.

## 15. Assumptions, risks, and approval decisions

### Assumptions requiring confirmation

1. The handover dated through 9 September 2026 accurately reflects every active
   Cavetta workflow and Data Table.
2. “Infrastructure” initially means public endpoints, n8n automation, and
   Supabase/PostgreSQL connectivity/metrics; Hetzner host/container metrics are
   not yet in scope.
3. Operations timestamps are stored UTC and displayed in each client's configured
   timezone, initially Europe/Malta.
4. The existing ImageKit quotas are plan configuration, not provider-returned
   quota fields, and require an effective-date/source record.
5. Client access is future read-only by default; report approval is a separately
   assigned capability.

### Principal risks

- Future export/live drift remains possible after later workflow edits; canonical
  hashes and publication evidence must be updated together.
- The first real seven-source month-boundary acceptance remains due on 1 October
  2026 and must be reviewed while its report remains `DRAFT`.
- Same-server portal, n8n and Uptime Kuma share a failure domain.
- A broad Supabase service/secret key would bypass RLS; ingestion must be narrowed
  and never exposed to a browser.
- Vercel Hobby retention and plan/API limits can create gaps; rolling data must
  never be presented as an exact calendar month.
- ImageKit responses are cached for six hours and provider timezone semantics are
  not yet accepted.
- Drive metadata can leak provider identifiers or sharing details if fields are
  not explicitly selected.
- Report action races/replays could duplicate delivery unless n8n remains the
  compare-and-set authority and `sentAt` remains immutable.
- Aggregated counts can still reveal client business scale; future client viewers
  must see only their assigned tenant and approved metric set.
- Permanent audit/report retention needs a later legal and storage-cost decision.

### Decisions requested from the owner

1. Approve the proposed scope boundary: no Hetzner host/container metrics in the
   initial portal, or add a safe host-metrics source.
2. Confirm the selected deployment: a dedicated Docker PostgreSQL operations
   database on the CloudIT server plus a separately selected identity/authentication
   layer; never Cavetta Supabase and never the n8n database.
3. Approve owner MFA and session policy before Phase 2.
4. Approve the role set and whether future client users may ever approve reports.
5. Approve HMAC-signed per-client publishers and the proposed ingestion limits,
   or require mTLS.
6. Approve server-mediated PDF viewing and whether the owner-only “Open in Drive”
   action should exist at all.
7. Approve the command set: `APPROVE_AND_SEND`, `REJECT`, and explicit
   `RETRY_SEND`; no regenerate/force-send.
8. Approve the frequencies, freshness windows and initial thresholds, especially
   response-time, DB red thresholds and restore-test overdue status.
9. Approve retention, including permanent report/action audit evidence.
10. Confirm Grafana Cloud Synthetic Monitoring as the later independent
    whole-server monitor. Same-server Uptime Kuma is explicitly insufficient.
11. Confirm ticketing and client incident notifications remain disabled.
12. Review the documented configuration Data Table column names/types; no values
    or secrets are required.
13. The section 4.1 production-safety batch is complete and requires no further
    portal decision unless a new defect is discovered.

## 16. Phase gate

Phase 0 remains **open for discussion** until the unchecked items in section 14
and the owner decisions in section 15 are resolved. No Phase 1 design or later
implementation is authorized by this document.
