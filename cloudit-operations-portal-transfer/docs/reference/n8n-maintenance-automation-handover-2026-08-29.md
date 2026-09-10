# Cavetta Maintenance Automation — Handover

Last updated: 1 September 2026

This document is the restart point for the Cavetta maintenance automation work. It records what is already operational, what remains intentionally manual, and the exact unresolved issue to continue with in a new session.

## Safety rules

- Do not interrupt or deliberately break the live Cavetta website to test monitoring.
- Do not run a restore against the production database during verification.
- Disaster recovery remains a manually approved procedure.
- Monthly client reports require manual approval before sending.
- Never put API keys, database passwords, OAuth secrets, SMTP passwords, or tokens in this repository or an n8n data table. Keep them in n8n credentials, GitHub secrets, or the relevant provider.
- Use test monitors, mocked input, or read-only provider APIs for validation.

## Completed automation

### 1. Database backup and restore validation

- Supabase database backups run through GitHub Actions.
- Backups are stored in the dedicated Google Drive structure:
  - `Daily`
  - `Monthly`
  - `Restore Tests`
- The observed database backup size was approximately 67 MB.
- n8n checks the latest runs of these GitHub workflows:
  - `Database backup`
  - `Backup restore test`
- Results are stored in the n8n data table `cavetta_maintenance_checks`.
- Restore validation is automated and non-destructive.
- A real disaster recovery restore remains manual so that production cannot be overwritten automatically.

### 2. Uptime Kuma incident pipeline

- Uptime Kuma and n8n are self-hosted on Hetzner.
- Uptime Kuma sends authenticated webhook events to n8n.
- The incident workflow validates the event, accepts only approved production monitors, waits before confirmation, rechecks the public URL, and records confirmed failures or recoveries.
- Incident history is stored in `cavetta_maintenance_events`.
- Production Uptime Kuma monitor IDs:

| Monitor | ID |
| --- | ---: |
| Cavetta Home | 1 |
| Cavetta Home Properties | 2 |
| Cavetta Home Sitemap | 3 |
| Cavetta Home Contacts | 4 |
| Cavetta Home Robot | 5 |

- Test monitor ID `6` was removed from the approved monitor map.
- Email incident alerts were deferred. A future ticketing system can receive these events instead.

### 3. Weekly health workflow

The weekly workflow checks twelve required targets:

1. Home page
2. Properties page
3. Contact page
4. `robots.txt`
5. `sitemap.xml`
6. Latest Vercel production deployment
7. Supabase public API
8. ImageKit health asset
9. Database backup workflow
10. Backup restore-test workflow
11. Vercel Web Analytics (rolling seven-day visitors and pageviews)
12. Supabase infrastructure analytics (safe aggregate database metrics)

Individual results and the generated weekly summary are stored in `cavetta_weekly_health_checks`.

A complete successful test after the Phase 5C integration produced:

```text
12/12 checks GREEN; 0 AMBER; 0 RED; 0 MISSING
```

The current workflow structure is:

```text
Schedule Trigger
  -> Load Maintenance Configuration
  -> parallel public/provider/backup checks
  -> wait for checks
  -> collect results
  -> create weekly summary
  -> store rows in cavetta_weekly_health_checks
```

The Vercel Web Analytics branch uses the read-only endpoint:

```text
GET https://api.vercel.com/v1/query/web-analytics/visits/count
```

It uses the existing Vercel header-auth credential, the centrally configured
`vercel_project_id`, and a rolling seven-day UTC window. Its stored check uses:

- `checkType`: `VERCEL_WEB_ANALYTICS`
- `targetKey`: `VERCEL_ANALYTICS`
- `visitorCount`: numeric visitor count
- `pageviewCount`: numeric pageview count
- `periodStart`: API-normalized UTC period start
- `periodEnd`: API-normalized UTC period end

These four trend columns were added to `cavetta_weekly_health_checks`. They are
populated only for Vercel analytics rows and remain null for unrelated checks
and the weekly summary.

The Supabase infrastructure branch uses a restricted read-only OAuth credential
and the Management API Prometheus metrics endpoint:

```text
GET https://api.supabase.com/v1/projects/{supabase_project_ref}/analytics/endpoints/metrics
```

The public REST availability check remains separate. An infrastructure analytics
failure is normalized to `AMBER`/`NO_DATA` and cannot classify the public site as
unavailable.

### 4. Monthly maintenance report draft

The monthly workflow:

1. Calculates the previous reporting month.
2. Loads weekly health summaries.
3. Loads incident history.
4. Loads backup and restore-test history.
5. Loads Google Analytics 4 data.
6. Composes the maintenance result and client-readable summary.
7. Upserts the draft in `cavetta_monthly_maintenance_reports`.
8. Builds branded HTML.
9. Converts the HTML to PDF with Gotenberg.
10. Uploads the PDF to Google Drive.
11. Updates the report row with PDF metadata.

The legacy-named `Wait Until First Working Day` node can be deactivated for a
manual test, but should be enabled for normal scheduled operation. Its current
behavior is first-weekday only: Saturday or Sunday is delayed to Monday, while
public holidays are not modelled.

#### PDF service

- Image: `gotenberg/gotenberg:8.34.0-chromium`
- Gotenberg shares the Docker network `cloudit` with n8n.
- Health endpoint: `http://gotenberg:3000/health`
- Connectivity from the n8n container was confirmed with HTTP 200.

#### Report branding

- Display name: CloudIT Pvt Ltd
- Email: `info@cloudit.lk`
- Website: `www.cloudit.lk`
- Phone: `+94 75 686 8854`
- Logo: `https://ik.imagekit.io/4z66kkrjv/company-assets/cloudit_logo.png`

### 5. Monthly approval and sender workflow

The published workflow `Cavetta - Approved Monthly Report Sender` polls for manually approved reports, claims one for sending, downloads its PDF from Google Drive, sends it through Zoho SMTP, and updates the report status.

Approval remains intentionally manual: edit the report row and set `documentStatus` to `APPROVED` only after reviewing the PDF.

Status lifecycle:

```text
DRAFT -> APPROVED -> SENDING -> SENT
                             -> SEND_FAILED
```

Email routing:

- From: `CloudIT Pvt Ltd <support@cloudit.lk>`
- Client recipient: `info@cavetta.mt`
- Internal BCC: `info@cloudit.lk`
- Reply-to: `support@cloudit.lk`
- The generated PDF is attached.

A live test email was accepted by Zoho and arrived with the correct attachment.

The sender also has stale-claim recovery. A report left in `SENDING` longer than the configured timeout is changed to `SEND_FAILED`, allowing manual review rather than remaining stuck forever.

### 6. Google Analytics 4

- GA4 account ID: `404967853`
- GA4 property ID: `550378738`
- The dedicated automation Google account has viewer access to the property.
- The Google Analytics Admin API and OAuth client were configured for n8n.
- The n8n query successfully returned `totalUsers`, `sessions`, `newUsers`, and `screenPageViews`.
- Old report months may legitimately show `NO_DATA` if collection or automation history was not available for that period. The report logic handles this without stopping the workflow.

## Central maintenance configuration

Configuration is stored in `cavetta_maintenance_config` with these columns:

- `configKey`
- `configValue`
- `valueType`
- `description`
- `isActive`

Current active rows:

| Key | Value | Type |
| --- | --- | --- |
| `client_name` | `Cavetta Properties` | `STRING` |
| `public_site_url` | `https://cavetta.mt/` | `STRING` |
| `client_report_email` | `info@cavetta.mt` | `STRING` |
| `report_bcc_email` | `info@cloudit.lk` | `STRING` |
| `report_reply_to_email` | `support@cloudit.lk` | `STRING` |
| `report_sender_name` | `CloudIT Pvt Ltd` | `STRING` |
| `company_logo_url` | `https://ik.imagekit.io/4z66kkrjv/company-assets/cloudit_logo.png` | `STRING` |
| `stale_sending_minutes` | `30` | `NUMBER` |
| `ticketing_enabled` | `false` | `BOOLEAN` |
| `vercel_project_id` | `prj_R4vCB38bGxkZtmp1jAZwLu1DCp5b` | `STRING` |
| `supabase_public_api_url` | `https://kcnsztexllifcjurvtvz.supabase.co/rest/v1/public_properties` | `STRING` |
| `imagekit_health_asset_url` | `https://ik.imagekit.io/4z66kkrjv/monitoring/cavetta-healthcheck.png` | `STRING` |
| `ga4_property_id` | `550378738` | `STRING` |
| `supabase_project_ref` | provider project reference | `STRING` |
| `supabase_disk_warning_percent` | `85` | `NUMBER` |
| `supabase_memory_warning_percent` | `85` | `NUMBER` |
| `supabase_connection_warning_percent` | `80` | `NUMBER` |

All rows are active. Secrets must never be added here.

### Configuration loader sub-workflow

Reusable workflow: `Cavetta - Load Maintenance Configuration`

```text
Configuration Request
  -> Load Active Configuration Rows
  -> Normalize Maintenance Configuration
```

It returns:

```json
{
  "config": {},
  "configCount": 17,
  "loadedAt": "ISO timestamp"
}
```

The normalization node parses `STRING`, `NUMBER`, and `BOOLEAN` values and rejects missing required keys.

It has been integrated into:

- The approved monthly report sender
- The monthly report draft workflow
- The weekly health workflow

Verified dynamic configuration:

- Public health target generation returns five configured public endpoints.
- Vercel uses `config.vercel_project_id` and returned a `READY` production deployment.
- The Vercel evaluator returned `GREEN`.
- Supabase uses `config.supabase_public_api_url` and returned HTTP 200 with one public property ID.
- ImageKit uses `config.imagekit_health_asset_url`; both its success evaluator and network-error result report the configured URL.
- GA4 uses `config.ga4_property_id`; `Get GA4 Monthly Analytics` resolves property `550378738` from configuration.
- Monthly report generation completed end-to-end after configuration integration and uploaded its PDF.

## Resolved blocker: Supabase public API check

Resolved on 30 August 2026.

The weekly Supabase HTTP Request now reads its URL from:

```javascript
{{ $('Load Maintenance Configuration').first().json.config.supabase_public_api_url }}
```

Current request settings:

- Method: `GET`
- Authentication: generic `Header Auth account 4`
- Credential header name: `apikey`
- Query parameters:
  - `select=id`
  - `limit=1`

Do not copy the credential value into this file or a screenshot.

The stored URL contained an extra `i` in the Supabase project reference:

```text
Incorrect: kcnsztexllifcijurvtvz
Correct:   kcnsztexllifcjurvtvz
```

The n8n-container DNS test returned `ENOTFOUND` for the incorrect hostname. The
project URL was copied directly from the Supabase dashboard and the configuration
row was corrected to:

```text
https://kcnsztexllifcjurvtvz.supabase.co/rest/v1/public_properties
```

The installed n8n version accepts the Header Auth credential domain restriction
as a bare hostname, not an origin with the URL scheme. `Header Auth account 4`
is now restricted to:

```text
kcnsztexllifcjurvtvz.supabase.co
```

The Supabase HTTP Request node is named `Check Supabase Public API`. Its error
handling is `Continue (using error output)` with the following routing:

```text
Success -> Evaluate Supabase Public API
Error   -> Prepare Supabase API Error
```

The prior wiring sent successful responses to both the success evaluator and the
error-preparation node. That was corrected. The request now returns HTTP 200 with
one public `id`, and the complete workflow reports GREEN.

## Work completed after the Supabase fix

### Centralized ImageKit health URL

- Added active `STRING` config key `imagekit_health_asset_url`.
- Added it to the configuration loader's required keys.
- Published `Cavetta - Load Maintenance Configuration` with `configCount: 13` after centralizing the GA4 property ID.
- Changed `Check ImageKit Health Asset` to read the URL from configuration.
- Changed both `Evaluate ImageKit Health Asset` and `Prepare ImageKit Network Error` to report the configured URL.
- Re-ran the full weekly workflow successfully before publishing.

### Vercel Web Analytics and trend fields (Phase 5B partially complete)

- Confirmed Vercel Web Analytics is enabled for Cavetta.
- Added `Get Vercel Web Analytics Summary` using the existing Vercel credential.
- The request is read-only and uses `projectId`, `since`, and `until` query parameters.
- Added separate success and error outputs:

```text
Success -> Evaluate Vercel Web Analytics
Error   -> Prepare Vercel Web Analytics Error
```

- Added `VERCEL_ANALYTICS` as the eleventh required weekly target.
- Updated the weekly summary expectation to `All 11 required checks GREEN`.
- Added `visitorCount` and `pageviewCount` as Number columns.
- Added `periodStart` and `periodEnd` as String columns containing ISO timestamps.
- Added `Get Vercel Web Analytics Top Routes` using the read-only aggregate endpoint, grouped by `requestPath`, with `limit: 100`.
- Added `Filter Public Top Routes`, which excludes `Others`, `/admin`, `/agent`, `/share`, `/api`, `/_next`, and `/_vercel`, sorts by visitors then pageviews, and retains five routes.
- Added nullable String column `topRoutesJson` and merged the filtered routes with the totals before storage.
- Added `Prepare Vercel Top Routes Error`: a routes-only failure produces `AMBER`/`warning`, preserves the totals, and stores `[]` without claiming the website is down.
- Changed the main Vercel analytics error result from `RED` to `AMBER`/`warning`.
- Verified a stored GREEN analytics row containing the four structured total/period fields and the five public routes.
- Published the weekly workflow after an end-to-end 11/11 GREEN run.
- Added `Get Monthly Vercel Web Analytics Summary` and `Get Monthly Vercel Web Analytics Top Routes` to `Cavetta - Monthly Maintenance Report Draft`. Both use the report month's UTC start/end, the centralized project ID, and read-only requests.
- Added `Normalize Monthly Vercel Analytics`, `Normalize Monthly Vercel Analytics Error`, and `Normalize Monthly Vercel Top Routes Error` so analytics failures remain `NO_DATA`/`AMBER` warnings and a routes-only failure retains valid totals.
- Added monthly Data Table fields `vercelAnalyticsResult`, `vercelVisitorCount`, `vercelPageviewCount`, `vercelPeriodStart`, `vercelPeriodEnd`, and `vercelTopRoutesJson`.
- Updated `Compose Monthly Maintenance Report` and `Build Monthly Report HTML` with a separate Vercel analytics section, totals, exact period, and a top-five public-routes table.
- Verified the HTML builder through a temporary unconnected preview node and removed the preview afterward. PDF conversion, Drive upload, approval, and email were not executed.
- Published the monthly draft workflow.
- Historical July testing on 30 August returned HTTP 400 because the Vercel Hobby plan only permits the latest 31 days. This was correctly normalized to `NO_DATA`/warning and the existing July PDF was not regenerated.

Phase 5B implementation is complete. The following acceptance checks remain:

- Compare Vercel counts with the Vercel dashboard for the identical period.
- Validate the successful exact-month branch and the generated Vercel PDF section on the next scheduled first-of-month run. Historical July data cannot exercise the success branch under the Hobby-plan retention limit.

### Supabase infrastructure analytics (Phase 5C implemented)

Implemented and manually verified on 1 September 2026:

- Created the read-only OAuth credential `Supabase Analytics Read Only`. Secrets
  remain only in n8n Credentials.
- Confirmed that the Supabase `usage.api-counts` endpoint does not accept OAuth.
  Exact-period API request totals therefore remain explicitly `NO_DATA` rather
  than falling back to a broader credential.
- Added `Get Weekly Supabase Infrastructure Analytics` using the official
  OAuth-compatible Prometheus metrics endpoint.
- Added `Normalize Weekly Supabase Infrastructure Metrics`, which strips raw
  labels and internal identifiers and emits only aggregate metrics.
- Added `Evaluate Supabase Infrastructure Metrics` and a separate sanitized
  error branch. Analytics failures are `AMBER`/`NO_DATA`, never availability
  `RED`.
- Added configuration-driven disk, memory, and PgBouncer client-utilization
  warning thresholds.
- Added normalized weekly fields for PostgreSQL status, database size, direct,
  Supavisor and PgBouncer connections, PgBouncer maximum clients/utilization,
  waiting connections, disk and memory use, read-only state, OOM kills and
  PostgreSQL restarts.
- Added `SUPABASE_INFRASTRUCTURE` as the twelfth weekly target and verified a
  complete `12/12` GREEN weekly result.
- Added monthly aggregation of daily Supabase samples, database-size growth,
  peak connections/utilization, peak disk use, peak memory use, and explicit
  no-data counts.
- Extended the monthly composer, Data Table schema and branded HTML/PDF with a
  separate Supabase infrastructure section.
- Visually verified the generated three-page PDF. August correctly displays
  `NO DATA` and `N/A` because collection began in September.
- Hardened PDF metadata preparation so only an unapproved, unsent `DRAFT` can
  receive replacement PDF metadata.
- Set the PDF metadata Data Table update to `Map Automatically`, with
  `reportMonth`, `reportType`, and fixed `documentStatus = DRAFT` as `All
  Conditions`.

Phase 5C implementation is complete. Scheduled monthly acceptance remains for
the October run, which will report on September samples.

Manual-test note: the August 2026 row is non-authoritative test data and must
remain `DRAFT`. It was never approved or sent. Manual PDF testing created more
than one Drive file, and an intermediate manual metadata mapping temporarily
zeroed some August numeric fields. The owner chose not to repair this historical
test row because client reporting begins with the October run. Do not approve,
send, or use the August row as acceptance evidence. The temporary false-branch
connection and all pinned test data were removed after testing.

### ImageKit usage analytics (Phase 5D implemented)

Implemented, verified and published on 2 September 2026:

- Preserved `Check ImageKit Health Asset` as an independent unauthenticated
  delivery-availability check.
- Added restricted read-only ImageKit account usage for weekly month-to-date and
  monthly exact-previous-calendar-month reporting.
- Added centralized free-plan quotas and an 80% warning threshold; the loader now
  validates 22 active settings and `ticketing_enabled=false`.
- Added safe success/error normalization, structured Data Table fields and quota
  percentages without storing credentials or raw provider errors.
- Published the weekly workflow after a `13/13` GREEN run.
- Added the monthly ImageKit branch, permanent two-input analytics merge, DRAFT-
  protected storage, report composition and branded HTML/PDF section.
- Verified August `2026-08-01` through `2026-09-01` exclusive with GREEN usage
  status, 610.59 MB bandwidth and 22.64 MB Media Library storage.
- Removed the temporary preview path, restored the active PDF guard, left no
  pinned/mock data, and published the monthly draft workflow. No upload, approval
  or client delivery was performed; August remains non-authoritative DRAFT.

## Current restart point

Phases 5E and 5F are complete and published. Start the next working session with
**Phase 5G - Protected one-click approval**. The first
scheduled Phase 5E acceptance remains the October 2026 DRAFT using September
evidence, but that future checkpoint does not block Phase 5G.

Published on 6 September 2026:

- Separate workflow `Cavetta - Monthly Source Snapshot Capture` with timezone
  `Europe/Malta` and cron `0 0 1 * *`. Its next run is 1 October 2026 and targets
  September 2026.
- Data Table `cavetta_monthly_source_snapshots`, idempotently upserted by
  `snapshotKey` (`reportMonth:sourceKey`).
- Requested/actual period, timezone, boundary, retention, capture/source-as-of,
  freshness, evidence counts and `FULL`/`PARTIAL`/`NO_DATA` fields for all seven
  sources: weekly health, incidents/recoveries, backup/restore, GA4, Vercel Web
  Analytics, Supabase infrastructure and ImageKit usage.
- Vercel and ImageKit are marked as requiring month-boundary snapshots. Vercel
  never substitutes a rolling 31-day period. ImageKit records its provider
  boundary timezone and source-as-of timestamp as undocumented and remains
  `PARTIAL` until identical-period acceptance verifies the boundary.
- Success/error normalization stores only aggregate read-only evidence and
  sanitized failures. The workflow contains no rendering, upload, approval,
  delivery, ticketing, backup execution or restore execution nodes.
- The common day-1/report-month guard discarded all seven manual August test
  results and sent no input to the upsert. No mock or pinned data remains.
- The August report remains non-authoritative `DRAFT`; nothing was approved or
  sent and `ticketing_enabled=false`.

Implemented, verified and published on 7 September 2026:

- Added `Load Monthly Source Snapshots` to the first-weekday monthly DRAFT
  workflow. It reads only `cavetta_monthly_source_snapshots` rows whose
  `reportMonth` matches the report and has `Always Output Data` enabled so a
  missing month is handled explicitly.
- Added `Validate Monthly Source Snapshots`. It requires exactly one row for each
  of the seven fixed source keys, rejects missing, duplicate and unexpected
  sources, parses only stored aggregate `metricsJson`, and preserves requested
  and actual periods, timezone/boundary semantics, capture/source-as-of times,
  freshness, retention, evidence counts and coverage.
- Reworked `Compose Monthly Maintenance Report` and `Build Monthly Report HTML`
  so stored snapshots are authoritative. Every `PARTIAL` and `NO_DATA` source is
  visibly labelled in the DRAFT and PDF; missing metrics render as unavailable
  instead of inheriting a later provider query or rolling interval.
- Added the `sourceSnapshotsJson` column to
  `cavetta_monthly_maintenance_reports` and the
  `Prepare Monthly Report Storage Row` compatibility node. The latter removes
  top-level snapshot-assurance helper fields that are not Data Table columns
  while retaining the complete normalized snapshot array.
- Removed the legacy monthly GA4, Vercel, ImageKit and stored-evidence query
  branches from the published DRAFT workflow. Its scheduled path is now snapshot
  consumption only; the separate capture workflow remains unchanged.
- Verified six calendar cases covering 28-, 29-, 30- and 31-day months plus
  delayed report-run timestamps. These tests verified reporting-period stability;
  the production workflow delays weekends only and does not model public
  holidays. All six passed and the test recorded `storageGuardChanged=false`.
  The temporary verification node and connections were removed before
  publication.
- Confirmed the monthly workflow triggers at 09:00 on day 1 in `Europe/Malta`,
  after the separate snapshot capture at 00:00. Confirmed the PDF guard remains
  active and `ticketing_enabled=false`.
- During schema validation, `Store Monthly Maintenance Report` was executed once
  and upserted the existing August row with explicit seven-source `NO_DATA`
  evidence. It remained `DRAFT`; approval, PDF regeneration and delivery were not
  run. Its older PDF metadata must not be treated as Phase 5E acceptance evidence.
- Removed all temporary/legacy nodes and connections, left no disabled guard or
  pinned/mock data, and published `Cavetta - Monthly Maintenance Report Draft`.

Pending scheduled acceptance does not block Phase 5E:

- Phase 5B: compare Vercel counts/routes with the Vercel dashboard for the
  identical available interval and review the DRAFT PDF section.
- Phase 5C: on the October run, verify September Supabase samples, database
  growth and peak metrics in the DRAFT PDF.

Phase 5F was implemented, verified and published on 7 September 2026:

- Added `infrastructureOverviewJson` to the weekly-health and monthly-report
  Data Tables and populated a concise five-service overview for Uptime Kuma,
  Vercel, Supabase, ImageKit and Backups.
- Updated `Create Weekly Health Summary` to separate live service health from
  analytics availability across the existing 13 checks. Analytics `NO_DATA`
  cannot claim application downtime. The full acceptance run stored row `id 386`
  with `13/13` GREEN and only aggregate non-sensitive evidence.
- Updated the monthly composer and branded HTML builder to carry and render the
  same five-service overview with separate Health and Usage/analytics columns.
  Structural verification retained all seven source-evidence cards and visible
  status labels. The existing August PDF was not regenerated.
- Verified `Store Monthly Maintenance Report` still matches all of
  `reportMonth`, `reportType` and `documentStatus = DRAFT`. August row `id 4`
  remains non-authoritative `AMBER`/`DRAFT`, retains its private PDF metadata,
  and has empty `approvedAt` and `sentAt`.
- Kept the PDF, storage, approval and delivery guards unchanged, confirmed
  `ticketing_enabled=false`, and published both updated workflows. No report was
  approved or sent.

Continue in this order:

1. **Scheduled Phase 5E acceptance on 1 October 2026**: verify exactly one
   September snapshot for each source and confirm the October DRAFT consumed all
   seven. Compare Vercel counts/routes with the dashboard for the identical
   period, validate the September Supabase samples, and compare ImageKit using
   identical date labels while documenting its provider-boundary timezone. Keep
   the report in DRAFT during these checks.
2. **Phase 5H - Automation watchdog**: internally implemented and accepted on
   9 September 2026. The published 15-minute watchdog stores aggregate summaries,
   monitors missing/overdue evidence and stuck sends, and receives sanitized
   automatic execution failures through n8n Error Workflow links. Its minimal
   production health endpoint was verified `503 stale` before the first heartbeat
   and `200 ok` afterward. The temporary acceptance workflow and row were removed.
   An independent Grafana Cloud public-probe check remains deferred to the planned
   multi-domain monitoring rollout because the current Uptime Kuma shares the n8n
   server.
3. **Phase 5I - Ticketing and retention**: ticketing remains deferred because the
   owner is building the platform. Retention work can be designed separately, but
   cleanup must never remove monthly reports, sent evidence, encrypted backups or
   disaster-recovery records.

### Current monthly approval capability

Phase 5G was completed and published on 8 September 2026. Current operation is:

1. `Cavetta - Monthly Maintenance Report Draft` creates the private PDF and sends
   an internal-only review message containing the private Drive URL and protected
   review-form URL.
2. The maintainer signs into n8n, reviews the PDF, and submits `Approve and send`
   or `Reject` through `Cavetta - Monthly Report Review`.
3. Only an unsent `DRAFT` can change. Approval records `APPROVED`/`approvedAt`;
   rejection records `REJECTED`/`rejectedAt` and an optional sanitized reason.
4. The published sender alone advances approved rows through
   `APPROVED -> SENDING -> SENT`.
5. `Cavetta - Monthly Report Review Reminder` sends one internal reminder after
   48 hours if the row is still DRAFT and unsent.

The form uses `n8n User Auth`; its non-sensitive GET shell can be displayed, but
an anonymous submission prompts for credentials. Manual Data Table approval is
retained only as an emergency fallback.

Current required state:

- Keep `ticketing_enabled=false` while the ticketing platform is being built.
- Keep incident email optional/deferred; ticket creation will be the primary future notification path.
- Complete Phases 5B through 5H without waiting for deferred Phase 5I ticketing.
- Do not put provider or future ticketing tokens, webhook secrets, or API keys in a data table or workflow code.
- Use only stable documented read-only provider APIs and store aggregate non-sensitive metrics.
- Do not collect credentials, customer data, request bodies, or other sensitive payloads in trend rows.
- During the first live monthly cycle, verify exactly one report completes
  `APPROVED -> SENDING -> SENT`, receives `sentAt`, and is not selected again.

## New-session instruction

Use this prompt in the next session:

> Continue the Cavetta n8n maintenance automation after the internally accepted **Phase 5H - Automation watchdog**. First read `AGENTS.md`, `docs/n8n-maintenance-automation-handover-2026-08-29.md`, `docs/maintenance-automation-handover.md`, `docs/n8n-maintenance-automation-plan.md`, `docs/monthly-maintenance-report-delivery-runbook.md`, and `docs/database-backup-restore.md` completely. Do not recreate the published watchdog, protected review form, internal review notification, one-time 48-hour reminder, monthly DRAFT workflow, or approved-report sender. Continue with the scheduled 1 October 2026 Phase 5E acceptance. Defer the independent external heartbeat to the planned Grafana Cloud public-probe rollout; same-server Uptime Kuma is not independent. Keep `ticketing_enabled=false`, preserve all status and idempotency guards, and never approve, reject, regenerate, or send a real report during construction.
