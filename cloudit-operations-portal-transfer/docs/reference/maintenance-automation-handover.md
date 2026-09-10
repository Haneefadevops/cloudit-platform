# Cavetta Maintenance Automation Handover

## Start here

This is the master continuation document for Cavetta's n8n maintenance automation. It records what is already running, what must not be recreated, and the approved order for the next improvements.

Read these documents before changing a workflow:

1. `docs/maintenance-automation-handover.md` - current state and next action.
2. `docs/n8n-maintenance-automation-plan.md` - architecture, safety boundaries, implementation history, and roadmap.
3. `docs/monthly-maintenance-report-delivery-runbook.md` - PDF, Google Drive, approval, and Zoho delivery operation.
4. `docs/database-backup-restore.md` - backup verification and manually authorized disaster recovery.
5. `docs/client-maintenance-plan.md` - client-facing scope and exclusions.

Do not start the automation again from Phase 1. Phases 1-4 and the approval-controlled PDF sender already exist.

## Working method for a new session

The owner is implementing n8n through the visual editor. Give instructions in the same guided format used during the original build:

1. Give only one node or one small configuration step at a time.
2. State the exact node name and node type.
3. List the exact fields, values, expressions, branch, and connection to use.
4. Provide complete JavaScript when a Code node is required; do not provide partial snippets.
5. Ask the owner to execute that node and share its output before moving on.
6. Explain whether an empty output or an unexecuted conditional branch is expected.
7. Do not publish a workflow until the controlled test passes.
8. Never ask the owner to paste a token, password, private key, webhook secret, database URL, or OAuth secret into chat.
9. Store credentials only in n8n Credentials and restrict them to the required domain and permission.
10. Update this handover and the relevant runbook after each completed phase.

When a screenshot is supplied, verify the visible node input, output, branch, status, and field types before giving the next step.

## Current implementation state

Status confirmed through 9 September 2026.

### Published workflows

| Workflow | Schedule/trigger | State | Purpose |
|---|---|---|---|
| `Cavetta - Incident Monitor` | Uptime Kuma webhook | Published | Validate, confirm, classify, and record DOWN/UP events |
| `Cavetta - Daily Backup Watchdog` | Daily at 07:15 Europe/Malta | Published | Verify GitHub database-backup and isolated restore-test workflow results |
| `Cavetta - Weekly Health Check` | Monday at 08:00 Europe/Malta | Published | Check public endpoints, Vercel deployment/analytics, Supabase public API/infrastructure, ImageKit health asset, and backup evidence |
| `Cavetta - Monthly Maintenance Report Draft` | First day at 09:00 Europe/Malta, waiting until Monday on a weekend | Published | Aggregate the previous calendar month, create the branded PDF, upload it privately, and store a `DRAFT` row |
| `Cavetta - Approved Monthly Report Sender` | Every five minutes Europe/Malta | Published | Claim an approved report, download its PDF, send through Zoho, and record the final status |

### Data Tables

| Data Table | Purpose |
|---|---|
| `cavetta_maintenance_events` | Confirmed incidents, recoveries, temporary recoveries, connection failures, and rejected monitor events |
| `cavetta_maintenance_checks` | Daily database-backup and monthly restore-test verification results |
| `cavetta_weekly_health_checks` | Individual weekly checks and the consolidated `WEEKLY_SUMMARY` record |
| `cavetta_monthly_maintenance_reports` | One report row per month, aggregate metrics, PDF metadata, approval state, and delivery state |

### Confirmed integrations

- Uptime Kuma sends authenticated events to the incident workflow.
- GitHub Actions is read through a fine-grained, repository-restricted credential.
- The public website, listings, contact, robots.txt, and sitemap checks work.
- The latest Vercel production deployment check works with a read-only credential.
- The Supabase `public_properties` REST check works with the publishable key.
- Restricted Supabase OAuth reads aggregate Prometheus infrastructure metrics
  without exposing database rows, secrets, raw labels, or internal identifiers.
- The stable ImageKit asset `monitoring/cavetta-healthcheck.png` is checked without authentication.
- GA4 property `550378738` is read through a dedicated Viewer account and OAuth credential.
- Monthly GA4 fields are `totalUsers`, `sessions`, `newUsers`, and `screenPageViews`.
- Gotenberg `8.34.0-chromium` runs privately beside n8n on the Docker network `cloudit` with no published host port.
- Branded A4 PDFs are generated successfully.
- PDFs are uploaded privately to `Cavetta Maintenance Reports/<year>` in the dedicated Google Drive account.
- Zoho Europe SMTP works through `smtppro.zoho.eu:587` with STARTTLS.
- A controlled report email was accepted and arrived with the correct PDF attachment.

### Important retained test evidence

- The July 2026 report is intentionally `AMBER`/`NO_DATA` for sources whose monitoring did not exist during July. This does not represent a production failure.
- Historical July acceptance artifacts must not be resent or used as evidence of
  current sender behavior. The 9 September safety acceptance began and ended
  with the same real-row states: one `SENT` and two `DRAFT`.
- The Phase 5C weekly acceptance run produced `12/12` GREEN, including separate
  Supabase public-API availability and infrastructure-analytics checks.
- The August 2026 monthly row is non-authoritative DRAFT test data. It was never
  approved or sent and must not be used as client-report evidence. Manual PDF
  testing created duplicate Drive files and temporarily zeroed some stored August
  numeric values; client reporting begins with the October run.

## Existing report lifecycle

```text
DRAFT -> APPROVED -> SENDING -> SENT
   |                       |
   +-> REJECTED            +-> SEND_FAILED
```

At present, the maintainer reviews `pdfDriveUrl` and manually changes `documentStatus` from `DRAFT` to `APPROVED`. The sender must never select a row with a non-empty `sentAt`.

Production database recovery remains manual. No n8n workflow may restore the live database, change DNS, alter production environment variables, redeploy, or rotate credentials.

## Next programme: easier maintenance and infrastructure analytics

Implement the following phases in order. Finish and test one phase before beginning the next.

### Phase 5A - Stabilize and centralize configuration

Status: **Complete**

Completed on 29 August 2026:

- Added the `sendingStartedAt` string column to `cavetta_monthly_maintenance_reports`.
- Updated `Claim Report for Sending` so `documentStatus: SENDING` and the UTC claim timestamp are written together.
- Added the recovery branch `Get Sending Reports for Recovery` -> `Identify Stale Sending Reports` -> `Mark Stale Sending Report Failed`.
- Confirmed with an isolated `RECOVERY_TEST` row that a claim older than 30 minutes becomes `SEND_FAILED`, receives a sanitized `lastSendError`, and sends no email.
- Deleted the isolated acceptance-test row after verification.

Completed on 30-31 August 2026:

- Created and populated `cavetta_maintenance_config` with 13 active, non-secret settings.
- Published the reusable `Cavetta - Load Maintenance Configuration` workflow with required-key validation and typed normalization.
- Integrated centralized configuration into the weekly health workflow, monthly report workflow, and approved-report sender.
- Corrected and centralized the Supabase public API URL.
- Centralized the public ImageKit health-asset URL.
- Centralized the GA4 property ID and verified that `Get GA4 Monthly Analytics` resolves property `550378738` from configuration.
- Confirmed the sender retrieves only `documentStatus = APPROVED` rows.
- Confirmed `Has Report Already Been Sent?` permits claiming only when `sentAt` is empty, so a `SENT` row cannot be selected again.
- Published the configuration loader and monthly report workflow after verification.

The tested sender revision, including stale-claim recovery, was published on 29 August 2026.

Create `cavetta_maintenance_config` with non-secret settings such as:

- Client identity and public URL
- Internal approval email, client email, BCC, and Reply-To
- Vercel Project ID and optional Team ID
- Supabase project reference
- ImageKit public endpoint
- GA4 property ID
- Schedules, warning thresholds, reminder period, and ticketing feature flag

Tokens, passwords, API keys, OAuth secrets, database URLs, and webhook secrets must remain in n8n Credentials.

Also stabilize report delivery:

- Add `sendingStartedAt` to the monthly report table.
- When a report is claimed, set `SENDING` and `sendingStartedAt` together.
- Detect a row stuck in `SENDING` for more than 30 minutes and change it to `SEND_FAILED` with a sanitized reason.
- Preserve `sentAt` as the duplicate-send guard.

Acceptance:

- Existing workflows read non-secret constants from the config table.
- A simulated stale `SENDING` row becomes `SEND_FAILED` without sending an email.
- A `SENT` row is never selected again.

### Phase 5B - Vercel Web Analytics

Status: **In progress**

Completed on 30 August 2026:

- Added the documented read-only Vercel Web Analytics visits-count endpoint to the weekly workflow.
- Added a rolling seven-day UTC query using the centralized Vercel Project ID.
- Added separate success and error branches.
- Added `VERCEL_ANALYTICS` as the eleventh required weekly check.
- Added and verified structured `visitorCount`, `pageviewCount`, `periodStart`, and `periodEnd` fields in `cavetta_weekly_health_checks`.
- Added a second read-only aggregate request grouped by `requestPath` with a 100-row limit.
- Filtered out `Others` plus `/admin`, `/agent`, `/share`, `/api`, `/_next`, and `/_vercel` routes before selecting the five highest-traffic public routes.
- Added nullable `topRoutesJson` storage and merged the totals and filtered routes into one `VERCEL_WEB_ANALYTICS` record.
- Changed analytics transport failures to `AMBER`/`warning`; a top-routes-only failure preserves the totals and stores an empty route list.
- Published the weekly workflow after an 11/11 GREEN end-to-end run.
- Added independent exact-report-month Vercel totals and top-routes requests to `Cavetta - Monthly Maintenance Report Draft`.
- Added success, full-error and routes-only error normalization. Full analytics unavailability becomes `NO_DATA`/warning; a routes-only failure preserves totals as `AMBER`.
- Added nullable monthly fields `vercelAnalyticsResult`, `vercelVisitorCount`, `vercelPageviewCount`, `vercelPeriodStart`, `vercelPeriodEnd`, and `vercelTopRoutesJson` to `cavetta_monthly_maintenance_reports`.
- Extended `Compose Monthly Maintenance Report` and `Build Monthly Report HTML` with a separate branded Vercel Web Analytics section and public-route table.
- Verified the HTML builder independently without running PDF conversion, Drive upload, approval, or email delivery, then published the monthly draft workflow.
- A historical July 2026 acceptance query on 30 August returned the expected Vercel Hobby-plan error because the plan exposes only the latest 31 days. The error was normalized to `NO_DATA` and did not stop the monthly workflow.

Remaining in Phase 5B:

- Compare the results with the Vercel dashboard for the identical period.
- Validate the generated Vercel PDF section against a successful stored capture.
- Do not solve the Hobby-plan retention constraint inside Phase 5B. Cross-provider
  capture timing, period completeness, and snapshot evidence are governed by
  Phase 5E for every monthly-report source.

Keep the current deployment-health check and add the documented Vercel Web Analytics API as a separate data source.

Weekly metrics:

- Visitors
- Page views
- Top five public routes
- Reporting start and end
- Safe API/data status

Monthly metrics must be queried for the exact previous calendar month rather than summed from partial weeks.

Rules:

- API success with data: `GREEN`.
- No analytics data or analytics API failure while the site remains available: `AMBER` or `NO_DATA`, never website-down `RED`.
- GA4 remains a separate source because Vercel visitors and GA4 users use different measurement models.

Official references:

- `https://vercel.com/changelog/web-analytics-api`
- `https://vercel.com/docs/rest-api`

Acceptance:

- The weekly table contains one normalized Vercel analytics result.
- The monthly workflow retrieves an exact month independently.
- Counts reasonably agree with the Vercel dashboard for the same period.
- The PDF contains a separate Vercel analytics section.

### Phase 5C - Supabase infrastructure analytics

Status: **Implementation complete; October scheduled acceptance pending**

Completed on 1 September 2026:

- Retained the safe public REST availability check as an independent signal.
- Created the restricted OAuth credential `Supabase Analytics Read Only` in n8n.
- Confirmed the documented `usage.api-counts` endpoint does not support OAuth;
  exact-period request totals therefore remain explicit `NO_DATA` rather than
  using a broader secret.
- Added the OAuth-compatible endpoint
  `GET /v1/projects/{project_ref}/analytics/endpoints/metrics`.
- Parsed the Prometheus response into safe aggregate weekly metrics and removed
  raw labels and identifiers before storage.
- Added separate success/error normalization. Analytics failure is
  `AMBER`/`NO_DATA` and cannot override a successful public availability check.
- Added central config keys `supabase_project_ref`,
  `supabase_disk_warning_percent`, `supabase_memory_warning_percent`, and
  `supabase_connection_warning_percent`; the configuration loader now returns
  17 required active settings.
- Added database size, PostgreSQL health, direct/Supavisor/PgBouncer connection
  values, PgBouncer maximum-client utilization, waiting connections, disk and
  memory use, filesystem read-only state, OOM kills and restart counts.
- Added `SUPABASE_INFRASTRUCTURE` as required weekly target 12 and verified a
  complete `12/12` GREEN run.
- Added monthly sample deduplication, size growth, peak connection/utilization,
  disk/memory peaks, warning/no-data counts, Data Table fields, composer output,
  and a branded PDF section.
- Verified the generated three-page PDF visually. August correctly renders
  `NO DATA`/`N/A` because infrastructure collection started in September.
- Hardened PDF metadata replacement so only an unapproved and unsent `DRAFT`
  can be updated. The Data Table metadata update uses automatic mapping and
  matches report month, report type, and fixed DRAFT status using all conditions.
- Removed all temporary false-branch connections and pinned test data after the
  controlled test. Both weekly and monthly workflows were saved and published.

Scheduled acceptance for the October run:

- Confirm the previous month resolves to September 2026.
- Verify non-zero Supabase sample count and sensible database growth/peak values.
- Review the DRAFT PDF section without approving or sending it.

Implemented metric scope:

Weekly/internal metrics:

- PostgreSQL up/down metric
- Database size
- Direct, Supavisor and PgBouncer connections
- PgBouncer configured maximum clients and utilization percentage
- Waiting connections
- Disk and memory utilization
- Filesystem read-only, OOM-kill and PostgreSQL-restart indicators
- Explicit API-request-count availability flag; currently false for the
  restricted OAuth path

Monthly/client metrics:

- Daily sample count and warning/no-data count
- Database-size start, end and growth
- Highest safe connection, disk and memory utilization observations
- Exact-period API request result and detail, currently `NO_DATA`

Use a fine-grained Supabase token with only the required analytics-read permission or the official metrics endpoint. Do not use the service-role key for general monitoring when a narrower credential is available.

Official references:

- `https://supabase.com/docs/reference/api/v1-get-project-usage-api-count`
- `https://supabase.com/docs/guides/monitoring-and-debugging/metrics`

Acceptance rules:

- Raw database rows and personal data never enter the workflow.
- An analytics failure becomes `NO_DATA`/`AMBER` and does not override a successful availability check.
- Warning thresholds are configurable rather than hard-coded across nodes.

The implementation satisfies these rules. The successful exact-month monthly
sample branch remains pending until the October report can use September data.

### Phase 5D - ImageKit usage analytics

Status: **Implementation complete and published on 2 September 2026**

The existing public stable-asset delivery check remains an independent
availability signal. ImageKit account usage is collected through separate
restricted read-only analytics branches.

Completed:

- Created the restricted credential `ImageKit Usage Read Only`, limited to
  read-only Media Management access and requests to `api.imagekit.io`; Account
  Management remains disabled.
- Added centralized free-plan quota settings for 20 GB bandwidth, 3 GB Media
  Library storage, 500 video-processing units, 650 extension units and an 80%
  warning threshold. The configuration loader validates 22 active settings and
  `ticketing_enabled` remains false.
- Preserved `Check ImageKit Health Asset` without changing or coupling it to the
  authenticated analytics request.
- Added month-to-date ImageKit usage to the weekly workflow with safe success and
  error normalization, raw numeric values, quota percentages and `AMBER` warning
  behavior. The consolidated weekly run completed `13/13` GREEN and was
  published.
- Added exact previous-calendar-month usage to the monthly draft workflow using
  `startDate` inclusive and next-month `endDate` exclusive.
- Added success and sanitized error normalizers, merged them with the existing
  Vercel analytics outcomes, and stored nullable structured ImageKit fields in
  `cavetta_monthly_maintenance_reports`.
- Extended `Compose Monthly Maintenance Report` and `Build Monthly Report HTML`
  with bandwidth, Media Library storage, video-processing, extension and original
  cache values plus quota utilization and reporting dates.
- Verified the August request (`2026-08-01` through `2026-09-01` exclusive),
  structured DRAFT storage, HTML output and local PDF rendering. The displayed
  sample was 610.59 MB bandwidth and 22.64 MB Media Library storage with GREEN
  quota status.
- Restored the DRAFT-only upsert guard and PDF-generation branch after testing;
  no temporary connection, pinned/mock data, upload, approval or client delivery
  remains. The August report remains DRAFT and non-authoritative.

Retain the existing stable-asset delivery check and add the official account-usage API.

Collect:

- Bandwidth bytes for the exact period
- Media Library storage bytes
- Video processing units
- Extension units
- Original cache storage where returned

Use an ImageKit restricted read-only key where supported. Store it only in n8n Credentials and restrict requests to `api.imagekit.io`.

Official references:

- `https://imagekit.io/docs/api-reference/account-management-api/get-usage`
- `https://imagekit.io/docs/usage-analytics`

Acceptance:

- Weekly and exact-month usage values are normalized.
- Human-readable MB/GB values are produced without losing the original byte values.
- Approaching a configured quota becomes `AMBER`; an analytics failure alone does not become a delivery outage.

### Phase 5E - Cross-provider monthly data-window assurance

Status: **Implementation completed and published on 7 September 2026; first
scheduled acceptance remains the October DRAFT using September evidence**

Create a provider-independent collection and verification layer for every data
source used by the monthly report. This is a separate phase from Vercel Web
Analytics because retention, timezone, aggregation and completeness risks apply
to all providers and to stored operational evidence.

Required source inventory:

- Weekly health and availability records
- Confirmed incident and recovery records
- Database-backup and isolated restore-test evidence
- GA4 monthly analytics
- Vercel Web Analytics
- Supabase infrastructure samples and exact-period fields where available
- ImageKit account-usage analytics

For each source, document and enforce:

- Requested calendar-month start and end, using one explicit timezone
- Provider date semantics, including inclusive and exclusive boundaries
- Retention/lookback limit and the latest safe collection time
- Whether the source is queried exactly, aggregated from stored samples, or read
  from an immutable month-end snapshot
- Actual returned period, capture timestamp and source-as-of timestamp
- `FULL`, `PARTIAL`, or `NO_DATA` coverage without silently substituting a
  rolling period for an exact calendar month

Retention-sensitive sources must be collected by a separate month-boundary
workflow before their data can expire. Store one idempotent snapshot per
`sourceKey` and `reportMonth`; the first-weekday report workflow reads the
stored snapshot instead of depending on a later provider query. Report drafting,
review, approval and delivery remain on their existing schedule and must not be
triggered by the capture workflow.

The capture workflow must remain read-only, store only aggregate non-sensitive
data, sanitize provider failures, and never store credentials or raw error
payloads. A missing or partial source may produce an explicit DRAFT warning but
must never be presented as complete data.

Implemented on 6 September 2026:

- Created and published the separate `Cavetta - Monthly Source Snapshot Capture`
  workflow. It runs at `00:00` on day 1 of each month with workflow timezone
  `Europe/Malta`; its next scheduled run is 1 October 2026 for September 2026.
- Created `cavetta_monthly_source_snapshots`. Rows are idempotently upserted by
  `snapshotKey` (`reportMonth:sourceKey`) and contain requested/actual periods,
  timezone and boundary semantics, retention and latest-safe-collection notes,
  capture/source-as-of timestamps, coverage, freshness, evidence counts,
  sanitized action text and aggregate `metricsJson`.
- Added contracts and normalization for all seven sources: weekly health,
  incidents/recoveries, backup/restore evidence, GA4, Vercel Web Analytics,
  Supabase infrastructure and ImageKit usage.
- The Vercel contract records the Hobby-plan latest-31-days limit and requires a
  month-boundary snapshot. An exact August request made after that boundary
  returned the expected retention error and was normalized to `NO_DATA`; no
  rolling period was substituted.
- ImageKit uses inclusive `startDate` and exclusive `endDate`, records its
  provider boundary timezone and source-as-of timestamp as undocumented, and
  conservatively requires a month-boundary snapshot. A successful August sample
  returned all five safe aggregate usage fields and was classified `PARTIAL`
  until the provider boundary timezone is verified.
- GA4 uses the verified property timezone `Europe/Malta`, inclusive start/end
  dates and a processing-delay disclaimer. Stored operational sources are
  filtered with the canonical Malta month expressed as UTC start-inclusive and
  end-exclusive timestamps.
- Manual validation produced seven normalized source results. The shared
  `Allow Scheduled Monthly Snapshot Storage` guard discarded all seven because
  the test was not run on day 1, and the upsert node received no input. No report
  was rendered, uploaded, approved or sent, and no mock or pinned data remains.

Implemented and published on 7 September 2026:

- Added `Load Monthly Source Snapshots` and `Validate Monthly Source Snapshots`
  to the first-weekday monthly DRAFT workflow. The path requires exactly one
  matching row for each of the seven source keys and reports missing, duplicate
  or unexpected rows explicitly.
- Made stored snapshots authoritative for monthly composition and branded HTML.
  Requested/actual periods, boundaries, capture/source-as-of timestamps,
  freshness, retention, evidence counts and coverage are preserved, and every
  `PARTIAL`/`NO_DATA` source is visibly labelled.
- Added `sourceSnapshotsJson` to `cavetta_monthly_maintenance_reports` and a
  storage-row compatibility node. Removed the old monthly provider and stored-
  evidence query branches so report generation cannot silently fall back to a
  later query or rolling interval.
- Verified 28-, 29-, 30- and 31-day months and delayed report-run timestamps:
  six of six cases passed with `storageGuardChanged=false`. These tests verified
  reporting-period stability; production scheduling delays weekends only and
  does not model public holidays. Temporary test nodes and connections were
  removed before publication.
- Confirmed the DRAFT schedule is 09:00 on day 1 in `Europe/Malta`, after the
  separate 00:00 snapshot capture. The PDF guard remains active and
  `ticketing_enabled=false`.
- A schema-validation execution upserted the existing August row with explicit
  seven-source `NO_DATA` evidence. It remains non-authoritative `DRAFT`; its
  older PDF metadata was not regenerated, approved or sent and is not acceptance
  evidence.

Remaining scheduled Phase 5E acceptance (does not block Phase 5F):

- On 1 October, verify exactly one idempotent September snapshot per source. In
  the October DRAFT, compare identical-period Vercel data with its dashboard and
  complete the scheduled September Supabase and ImageKit acceptance checks.

Acceptance:

- Every report source has a documented and tested period/retention contract.
- A 28-, 29-, 30- or 31-day month, plus a weekend-delayed or otherwise later
  report run, cannot shift or silently truncate the requested reporting month.
- Retention-sensitive snapshots are captured before expiry and are idempotent on
  retry.
- The report records requested and actual coverage and visibly labels
  `PARTIAL`/`NO_DATA` sources.
- Counts and periods are compared with each provider dashboard or authoritative
  stored evidence for the identical interval.
- The August 2026 DRAFT is not used as acceptance evidence. The first acceptance
  target is the October draft using September source data.

### Phase 5F - Consolidated weekly and monthly reporting

Status: **Implemented, verified and published on 7 September 2026**

Update the weekly summary and monthly PDF with a concise infrastructure overview:

| Service | Health | Usage/analytics |
|---|---|---|
| Uptime Kuma | Availability, response time, SSL | Uptime evidence where available |
| Vercel | Production deployment | Visitors, page views, top routes |
| Supabase | Public API and database health | Requests, size, utilization |
| ImageKit | Stable asset delivery | Bandwidth and storage |
| Backups | Backup and restore verification | Pass rate and safe run links |

Client PDF content remains aggregate and non-sensitive. Raw API errors, credential details, IDs used only for integration, and internal diagnostics stay in n8n.

Acceptance:

- The weekly workflow completes even when one analytics provider returns no data.
- The PDF distinguishes `RED`, `AMBER`, `GREEN`, and `NO_DATA` clearly.
- Analytics unavailability cannot incorrectly claim that the live application is unavailable.

Implemented evidence:

- Added the String column `infrastructureOverviewJson` to
  `cavetta_weekly_health_checks` and `cavetta_monthly_maintenance_reports`.
- Updated `Create Weekly Health Summary` to keep the 13 required checks while
  separating live service health from analytics availability. Missing or stale
  analytics becomes `NO_DATA` and explicitly does not imply application
  downtime; missing or stale live-health evidence still affects health status.
- The published weekly acceptance run stored row `id 386` with `13/13` checks
  GREEN and a five-service overview for Uptime Kuma, Vercel, Supabase, ImageKit
  and Backups. It reused only aggregate non-sensitive metrics and safe run links.
- Updated `Compose Monthly Maintenance Report` and `Build Monthly Report HTML`
  to create the same five-service overview and render separate Health and
  Usage/analytics columns. The HTML includes the explicit statement that missing
  analytics does not mean the live application was unavailable.
- Verified the updated HTML structure locally: exactly five overview service
  rows, all seven source-evidence cards retained, and visible status badges for
  `RED`, `AMBER`, `GREEN` and `NO_DATA`. The existing August PDF was not
  regenerated and is not Phase 5F acceptance evidence.
- `Store Monthly Maintenance Report` remains an all-condition DRAFT-only upsert
  on `reportMonth`, `reportType` and `documentStatus = DRAFT`. The existing
  August row `id 4` remains non-authoritative `AMBER`/`DRAFT`, retains its private
  PDF metadata, and has empty `approvedAt` and `sentAt`.
- Confirmed the PDF-generation, approval and delivery guards remain active,
  `ticketing_enabled=false`, and no report was approved or sent. Both affected
  workflows were published after verification.

### Phase 5G - Protected one-click approval

Status: **Completed and published on 8 September 2026**

Replace routine manual Data Table approval with a protected n8n review form while keeping manual editing as an emergency fallback.

Flow:

1. Draft generator sends an internal review email only.
2. Email includes report month, overall status, private Drive review link, and protected review-form link.
3. The form displays the report identity and allows `Approve and send` or `Reject`.
4. Approval changes `DRAFT` to `APPROVED` and records `approvedAt`.
5. Rejection changes `DRAFT` to `REJECTED`, records `rejectedAt`, and may store a short non-sensitive reason.
6. Existing approved-report sender remains responsible for SMTP delivery.

Safety requirements:

- A GET request must never approve or send a report; the decision requires a POST submission.
- The form must be protected by an n8n-supported authentication method and must not expose Data Table administration publicly.
- Only `DRAFT` and unsent rows may be approved.
- Repeated submissions must be idempotent.
- Reports remaining in `DRAFT` for more than 48 hours produce one internal reminder, not a client message.

Implemented:

- Published `Cavetta - Monthly Report Review` with an n8n Form Trigger using
  `n8n User Auth`. The public GET displays only the non-sensitive form shell;
  submitting the form without credentials prompts for authentication.
- The form accepts `reportMonth`, `Approve and send` or `Reject`, and an optional
  sanitized rejection reason limited to 300 characters.
- The workflow reloads the matching report, rejects missing or duplicate rows,
  and allows mutation only when the row is an unsent `DRAFT`. Approval requires
  complete private PDF metadata.
- Approval records `documentStatus = APPROVED` and `approvedAt`; rejection records
  `documentStatus = REJECTED`, `rejectedAt`, and the optional non-sensitive reason.
  Repeated submissions return an idempotent no-change result.
- The existing `Cavetta - Approved Monthly Report Sender` remains the only
  workflow responsible for client SMTP delivery.
- Added `rejectedAt`, `rejectionReason`, `reviewNotificationSentAt`, and
  `reviewReminderSentAt` to `cavetta_monthly_maintenance_reports`.
- Added active non-secret configuration key `monthly_report_review_form_url`.
- Extended `Cavetta - Monthly Maintenance Report Draft` to send one internal
  review message after private PDF metadata is saved, then record
  `reviewNotificationSentAt` only after successful SMTP delivery.
- Published `Cavetta - Monthly Report Review Reminder`, scheduled daily at 09:15
  `Europe/Malta`. It sends one internal reminder only when the initial notice is
  at least 48 hours old and the row remains unsent `DRAFT`, then records
  `reviewReminderSentAt`.

Verification:

- A nonexistent report month returned `REPORT_NOT_FOUND` with `changed: false`.
- A temporary non-real DRAFT row was rejected successfully, and a repeated
  submission returned `ALREADY_REJECTED` with `changed: false`; the test row was
  then deleted and the table returned to its original three rows.
- The reminder workflow returned zero eligible rows during its safe test, so no
  reminder email or table mutation occurred.
- No real report was approved, rejected, regenerated, or sent during construction.

### Phase 5H - Automation watchdog

Status: **Implemented and internally accepted on 9 September 2026; independent
external probe deferred to the planned Grafana Cloud rollout**

Published `Cavetta - Automation Watchdog` now detects:

- Missing weekly workflow success
- Missing daily backup-watchdog success
- Monthly workflow overdue after its scheduled window
- Reports stuck in `SENDING`
- Repeated n8n execution failures
- Google Drive, OAuth, SMTP, or credential failures

Implementation and acceptance evidence:

- Runs every 15 minutes in `Europe/Malta`, reads the existing weekly, daily,
  monthly, sending-state and failure-bucket Data Tables, and stores one aggregate
  `WATCHDOG_SUMMARY` row per interval in
  `cavetta_automation_watchdog_evidence`.
- The first scheduled production run completed successfully and stored a `GREEN`
  summary with zero findings, `ticketingEnabled=false`, and
  `heartbeatEligible=true`.
- A minimal read-only health webhook returns only `status`, `service`, and
  `checkedAt`. It returned `503 stale` before the first stored summary and
  `200 ok` after the successful scheduled run.
- Automatic execution failures are normalized without raw errors, stacks,
  credentials, request data, or execution URLs. Failures are aggregated into an
  hourly workflow/category bucket; one transient failure is `AMBER`, the third
  repeated failure is `RED`, and credential failures are immediately `RED`.
- A temporary isolated webhook workflow proved the production Error Trigger path.
  It stored one sanitized `AMBER` bucket with occurrence count `1`; the test row,
  public probe endpoint, and temporary workflow were then removed.
- The watchdog is configured as the Error Workflow for Daily Backup Watchdog,
  Weekly Health Check, Monthly Source Snapshot Capture, Monthly Maintenance
  Report Draft, Approved Monthly Report Sender, Monthly Report Review Reminder,
  Monthly Report Review, and Incident Monitor.
- `Cavetta - Load Maintenance Configuration` is intentionally excluded to avoid
  duplicate parent/sub-workflow failures. The watchdog itself is intentionally
  excluded to prevent recursion.
- No notification or ticket node is connected, and `ticketing_enabled` remains
  `false`.

The existing Uptime Kuma instance shares the same Hetzner/n8n server and therefore
cannot detect loss of that server. Add an external Grafana Cloud Synthetic
Monitoring HTTP check using public probes when the planned multi-domain Grafana
rollout is performed. Until then, Phase 5H's internal watchdog is accepted but the
independent total-outage monitor remains an explicit open acceptance item.

### Production safety correction accepted on 9 September 2026

The approved correction plan in
`docs/n8n-production-safety-correction-plan-2026-09-09.md` was completed through
controlled publication. Only `Cavetta - Approved Monthly Report Sender`,
`Cavetta - Automation Watchdog`, and
`Cavetta - Load Maintenance Configuration` were changed and republished.

- The sender now claims a report atomically by `reportMonth`, row `id`,
  `documentStatus = APPROVED`, and `sentAt` equal to the Data Table's blank
  string. The claim updates only `documentStatus`, `sendingStartedAt`, and the
  string `sendAttemptCount`.
- Success updates only `documentStatus` and `sentAt`. Failure and stale-recovery
  updates change only `documentStatus` and a fixed sanitized `lastSendError`.
  Raw SMTP, Drive, credential, request, and execution diagnostics are not stored.
- Stale recovery validates the centralized positive
  `stale_sending_minutes` value, selects only genuinely old `SENDING` rows with a
  valid timestamp, and is idempotent on a repeated run.
- The watchdog's monthly snapshot contract uses exactly
  `WEEKLY_HEALTH`, `INCIDENTS_RECOVERIES`, `BACKUP_RESTORE`, `GA4_ANALYTICS`,
  `VERCEL_WEB_ANALYTICS`, `SUPABASE_INFRASTRUCTURE`, and `IMAGEKIT_USAGE`.
  The same seven keys are used by snapshot capture and monthly DRAFT validation.
- The configuration loader now fails closed when
  `monthly_report_review_form_url` is absent, without exposing its value.
- Six isolated sender rows proved selection, idempotency, fixed error
  classification, and full unrelated-field preservation: six rows compared,
  zero mismatches. Watchdog pinned-data tests proved that all seven keys produce
  no missing-snapshot finding and removing one key produces exactly the overdue
  contract finding.
- Cleanup removed every temporary node, connection, pin, mock, fixed clock, and
  far-future row. The three real report rows retained their prior states. No
  report was approved, regenerated, downloaded, uploaded, emailed, or resent.
- Post-publication observation confirmed the configuration loader, an idle
  sender schedule with no eligible `APPROVED`/`SENDING` row, and a normal
  watchdog summary upsert. `ticketing_enabled=false`; no notification or ticket
  path ran.
- Final export scanning parsed all ten workflow JSON files and syntax-checked all
  54 Code nodes. The canonical exports contain no pin data, disabled node,
  temporary/test marker, mock endpoint, fixed acceptance clock, or embedded
  credential value.

Monthly report drafting still means the first weekday under the implemented
weekend-only rule: day 1 runs normally, while Saturday or Sunday waits until
Monday. Public holidays are not modelled. The scheduled 1 October 2026 Phase 5E
acceptance remains pending and its real report must remain `DRAFT` during review.

### Phase 5I - Ticketing and retention

Status: **Deferred until the ticketing intake is confirmed**

- Create tickets only for confirmed/actionable conditions.
- Use a stable incident key to suppress duplicates.
- Keep detection and Data Table logging independent from ticket delivery.
- Add recovery to the existing ticket where the selected system safely supports it.
- Retain detailed endpoint records for 90 days, weekly summaries and incidents for 24 months, backup evidence for 12 months, and monthly reports permanently.
- Cleanup must never delete monthly reports, sent evidence, encrypted backups, or disaster-recovery records.

## Notification policy

- One transient check failure: record it; do not create noise.
- Confirmed or repeated availability failure: critical internal notification/ticket.
- Recovery: record and close or update the incident.
- Analytics API unavailable: `AMBER`/`NO_DATA`, not an outage.
- Usage above the configured warning threshold: internal warning.
- Duplicate unresolved condition: update existing evidence instead of creating repeated tickets.

## Manual work after completion

Expected routine involvement:

- Weekly: review only warnings or exceptions, normally 5-10 minutes.
- Monthly: review the generated PDF and approve or reject it, normally 5-10 minutes.
- Incident: investigate and correct only a confirmed real problem.
- Disaster recovery: always separately authorized and manually controlled.

## New-session continuation prompt

Copy this prompt into a new session:

> Continue the Cavetta n8n maintenance automation after the internally accepted **Phase 5H - Automation watchdog**. First read `AGENTS.md`, `docs/n8n-maintenance-automation-handover-2026-08-29.md`, `docs/maintenance-automation-handover.md`, `docs/n8n-maintenance-automation-plan.md`, `docs/monthly-maintenance-report-delivery-runbook.md`, and `docs/database-backup-restore.md` completely. Do not recreate the published watchdog, protected review form, internal review notification, one-time 48-hour reminder, monthly DRAFT workflow, or approved-report sender. The scheduled Phase 5E acceptance remains due on 1 October 2026 using September evidence. The independent external heartbeat is deferred to the planned Grafana Cloud Synthetic Monitoring rollout; self-hosted Uptime Kuma on the n8n server does not satisfy that requirement. Keep `ticketing_enabled=false`, preserve all DRAFT/PDF/status/idempotency guards, and never approve, reject, regenerate, or send a real report during construction. Leave no temporary connections, disabled guards, mock data, pinned data, test endpoints, or test rows in production.

If the owner says a listed phase was completed after this handover date, inspect the relevant workflow screenshot/output, update this document, and continue from the next incomplete phase.
