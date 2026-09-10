# n8n Maintenance Automation Plan

## Purpose

This document defines the internal maintenance automation for the Cavetta website. n8n acts as a read-only coordinator: it collects service health information, verifies scheduled maintenance jobs, records results, and sends alerts and report drafts.

The automation must not make uncontrolled changes to the live website or its infrastructure.

## Objectives

- Detect website and service outages quickly.
- Confirm that database backups and restore tests are completing successfully.
- Complete a consistent weekly maintenance health check.
- Prepare a concise monthly client report for manual review.
- Reduce repetitive maintenance work while keeping production changes and disaster recovery under human control.

## Architecture

The implemented maintenance system currently consists of five published n8n workflows, with additional improvement workflows planned:

| Workflow | Frequency | Purpose |
|---|---|---|
| Incident Monitor | Real-time | Receive outage and recovery events, confirm the condition, and alert the maintainer |
| Backup Watchdog | Daily | Verify the GitHub database-backup and restore-test workflows |
| Weekly Health Check | Weekly | Check the website and connected service health and save a structured result |
| Monthly Report Draft | Monthly | Aggregate the weekly results and prepare a client-facing report for manual approval |
| Approved Monthly Report Sender | Every five minutes | Claim an approved report, download its private PDF, send it through Zoho, and record delivery state |

The current master handover and next-phase order are maintained in `docs/maintenance-automation-handover.md`.

## Safety boundaries

### Permitted automated actions

- Read public website endpoints.
- Read service-health and aggregate usage information.
- Read GitHub Actions workflow results using a read-only credential.
- Store maintenance statuses and non-sensitive aggregate metrics.
- Send private alerts to the maintainer.
- Prepare a report draft for manual review.

### Prohibited automated actions

- Restore, delete, or modify the production database.
- Redeploy or roll back the production application.
- Change Vercel environment variables or project settings.
- Change Cloudflare, DNS, domain, Supabase, or ImageKit configuration.
- Change or rotate secrets.
- Send a report directly to the client without maintainer approval.
- Send customer, landlord, booking, inquiry, or other personal data to an AI service.

Production disaster recovery remains a controlled manual procedure documented in `docs/database-backup-restore.md`.

## Phase 1: Incident Monitor

### Uptime Kuma monitors

Create the following HTTP monitors:

| Monitor | Target |
|---|---|
| Cavetta Website | `https://cavetta.mt` |
| Cavetta Listings | `https://cavetta.mt/properties` |
| Cavetta Sitemap | `https://cavetta.mt/sitemap.xml` |
| Cavetta Robots | `https://cavetta.mt/robots.txt` |
| Cavetta Image Delivery | One stable, permanent public ImageKit image URL |
| n8n | The n8n public health URL, if available |

Recommended starting configuration:

- Check interval: 60 seconds
- Retries before notification: 2
- Retry interval: 60 seconds
- Accepted HTTP status: 200-399
- SSL certificate-expiry notifications: enabled

### n8n workflow

The workflow sequence is:

1. An n8n Webhook node receives the Uptime Kuma notification.
2. A validation step confirms that the request is from the configured notification channel.
3. A Switch or If node separates `DOWN`, `UP`, and test notifications.
4. For a `DOWN` event, n8n waits two minutes.
5. An HTTP Request node tests the affected URL again.
6. If the URL is still unavailable, n8n sends a private critical alert.
7. If the URL recovered during confirmation, n8n records a temporary incident without issuing a critical alert.
8. For an `UP` event, n8n sends a recovery notification including the monitor name and outage duration when available.

The first test must use the n8n test webhook. After the payload has been inspected and mapped, the workflow is activated and Uptime Kuma is changed to the production webhook URL.

### Security

- Use a long, unguessable webhook path.
- Use webhook header authentication when supported by the installed Uptime Kuma and n8n versions.
- Store the authentication value in n8n Credentials, not in workflow names, notes, or exported JSON.
- Do not expose the production webhook URL in project documentation or source control.
- Sanitize notification text before sending it to any AI service.

### Initial alert content

The private downtime alert should include:

- Severity
- Monitor name
- Affected public URL
- Initial failure time
- Confirmation-test result
- HTTP status or safe error category
- A statement that production was not changed

The recovery alert should include:

- Monitor name
- Recovery time
- Approximate downtime duration, when available
- Whether manual investigation is still recommended

### Phase 1 acceptance test

Phase 1 is complete only when:

1. The Uptime Kuma test notification reaches the n8n test webhook.
2. The event payload is mapped without storing secrets or sensitive data.
3. A simulated or controlled failing test monitor produces one private alert after confirmation.
4. Recovery produces one recovery notification.
5. Repeated webhook deliveries do not create an excessive notification loop.
6. No website, database, deployment, DNS, or environment setting is changed.

## Phase 2: Daily Backup Watchdog

Run each day at approximately 06:00 Malta time, after the scheduled database backup has had time to finish.

The workflow checks:

- `.github/workflows/database-backup.yml`
- `.github/workflows/backup-restore-test.yml`

Use a GitHub fine-grained credential restricted to the `Cavetta/Cavetta` repository with Actions read access only.

The daily backup must:

- Have a `success` conclusion.
- Not be cancelled or still running beyond the expected time.
- Have a recent scheduled result, normally no older than 28 hours.

The monthly restore test must:

- Have a `success` conclusion.
- Have a recent result, normally no older than 35 days.

Successful daily checks may remain silent. Failure, cancellation, an overdue run, or an API-authentication error must produce a private warning. This workflow does not retry, rerun, delete, or modify any GitHub workflow run.

## Phase 3: Weekly Health Check

Run every Monday at approximately 08:00 Malta time.

Collect and record:

- Main website availability and response time
- Listings-page availability
- Sitemap and robots.txt availability
- SSL certificate status
- Stable ImageKit image availability
- Latest Vercel production deployment status
- Supabase availability or a safe public connectivity check
- Latest daily backup result
- Latest monthly restore-test result
- High-level Google Analytics activity

Store one structured weekly result in an n8n Data Table or a dedicated Google Sheet. The record must contain only maintenance statuses, timestamps, aggregate metrics, and safe error categories.

Use green, amber, and red classifications:

- Green: all important checks passed.
- Amber: a warning or trend requires review but the service remains usable.
- Red: an outage, failed backup, failed restore test, or major service problem requires investigation.

Send the maintainer a short private weekly summary. Do not send the weekly internal report directly to the client.

## Phase 4: Monthly Report Draft

Run report drafting on the first weekday of each month. The current workflow
delays Saturday or Sunday to Monday; it does not model public holidays.
Retention-sensitive source collection may run separately at the month boundary
and must never send or approve the report.

The workflow aggregates the previous month's weekly records and prepares a draft containing:

- Overall uptime and known incidents
- High-level website traffic
- Deployment and application-health observations
- Database and image-service health
- Backup and restore-test confirmation
- Maintenance completed
- Recommended actions

AI may rewrite the sanitized maintenance results into clear client-facing language. It must not receive personal data, raw database records, credentials, secret values, or internal error logs containing sensitive information.

The draft is sent only to the maintainer. Client delivery remains manual after review and correction.

## Phase 5E: Cross-provider Monthly Data-Window Assurance

Before the first authoritative client report, add a separate collection and
verification phase covering every monthly-report source: weekly health records,
incidents, backup/restore evidence, GA4, Vercel, Supabase and ImageKit.

For each source, record the requested calendar month, actual returned period,
timezone, inclusive/exclusive boundary semantics, retention limit, capture time,
source-as-of time and `FULL`, `PARTIAL` or `NO_DATA` coverage. Never silently use
a rolling lookback as if it were the exact previous calendar month.

Where a provider's retention may expire before the first-weekday report run,
collect aggregate read-only data in a separate month-boundary workflow and store
one idempotent snapshot per source and report month. The report workflow consumes
that evidence later. Snapshot collection must not render, upload, approve or send
a report and must not store credentials, raw provider errors or sensitive data.

## Implementation status

Status as of 29 August 2026:

### Phase 1: Incident Monitor

- Implemented and published in n8n as `Cavetta - Incident Monitor`.
- Uptime Kuma sends authenticated production webhook events to n8n.
- Approved monitor IDs are mapped to fixed Cavetta URLs; webhook-provided URLs are not trusted for confirmation requests.
- DOWN events wait two minutes and are independently confirmed with an HTTP request.
- HTTP failures, connection failures, temporary recoveries, UP events, and rejected monitor IDs are normalized into safe maintenance records.
- Records are stored in the n8n data table `cavetta_maintenance_events`.
- The temporary acceptance-test monitor is paused and excluded from the production allowlist.
- Zoho email delivery is deliberately deferred. Until it is added, incidents are visible in n8n Executions and the maintenance-events table.

### Phase 2: Daily Backup Watchdog

- Implemented in n8n as `Cavetta - Daily Backup Watchdog`.
- Scheduled every day at 07:15 using the `Europe/Malta` workflow timezone.
- Uses an n8n GitHub API credential backed by a fine-grained GitHub token; the token is stored only in n8n Credentials.
- Checks the latest run of `Database backup` and classifies it as healthy, running, stuck, failed, overdue, or missing. A successful backup becomes overdue after 28 hours.
- Checks the latest run of `Backup restore test` using the same classifications. A successful restore test becomes overdue after 35 days.
- GitHub API failures have explicit critical error paths.
- Results are stored in the n8n data table `cavetta_maintenance_checks`.
- The first stored verification records show both the database backup and isolated restore test as healthy.
- Zoho failure email delivery is deferred and will be connected to the critical outputs later.

### Phase 3: Weekly Health Check

- Implemented in n8n as `Cavetta - Weekly Health Check`.
- Scheduled every Monday at 08:00 using the `Europe/Malta` workflow timezone.
- Checks the home, properties, contact, robots.txt, and sitemap endpoints for successful responses and expected public content.
- Checks the latest Vercel production deployment using an authenticated, read-only HTTP request and classifies its deployment state.
- Checks the Supabase `public_properties` Data API using only the publishable key; no service-role credential or private table is used.
- Checks a permanent public ImageKit health asset stored at `monitoring/cavetta-healthcheck.png`; no ImageKit private credential is used.
- Reads the latest database-backup and restore-test health records produced by Phase 2.
- Stores individual results in the n8n data table `cavetta_weekly_health_checks` using green, amber, and red classifications.
- Waits two minutes for the independent check branches, reads the latest results in descending row order, and creates one `WEEKLY_SUMMARY` record.
- The first complete verification produced a green summary with all 10 required checks healthy.
- SSL certificate expiry and continuous availability remain monitored by Uptime Kuma. A separate weekly SSL row is unnecessary while that monitor remains active.
- Google Analytics aggregation and private report/ticket delivery are deferred to Phase 4 so monitoring and logging do not depend on those integrations.

### Phase 4: Monthly Report Draft

- Implemented and published in n8n as `Cavetta - Monthly Maintenance Report Draft`.
- Scheduled for the first day of each month at 09:00 in the `Europe/Malta` workflow timezone. If the first day is Saturday or Sunday, the workflow waits until Monday before continuing.
- Calculates the previous calendar month as the reporting period.
- Reads and aggregates `WEEKLY_SUMMARY` rows from `cavetta_weekly_health_checks`.
- Reads and aggregates production incident and recovery rows from `cavetta_maintenance_events`; test monitors and rejected events are excluded.
- Reads and aggregates database-backup and restore-test rows from `cavetta_maintenance_checks`.
- Reads GA4 aggregate totals with a dedicated Viewer account and Google Analytics OAuth credential. The GA4 property ID is `550378738`.
- The GA4 report requests `totalUsers`, `sessions`, `newUsers`, and `screenPageViews` for the exact previous-month date range.
- The Google Analytics node has `Always Output Data` enabled so a month with no analytics history becomes a safe `NO_DATA` result instead of stopping the workflow.
- Produces a structured client-report draft containing the website-health, incident, backup, restore-test, and analytics sections.
- Stores one row per report month in `cavetta_monthly_maintenance_reports` using an upsert condition on `reportMonth`.
- The July 2026 acceptance run correctly produced `AMBER` with `NO_DATA` for systems whose monitoring began in August. This is an expected historical-data limitation, not a production failure.
- Branded PDF rendering is implemented through a private Gotenberg container on the existing `cloudit` Docker network. Gotenberg has no published host port and is reachable from n8n only.
- Generated PDFs are stored privately under `Cavetta Maintenance Reports/<year>` in the dedicated automation Google Drive account.
- PDF metadata and the `DRAFT`, `APPROVED`, `SENDING`, `SENT`, and `SEND_FAILED` lifecycle are stored in `cavetta_monthly_maintenance_reports`.
- The separate workflow `Cavetta - Approved Monthly Report Sender` is published and polls every five minutes. It requires manual Data Table approval, downloads the private PDF, and sends it through the CloudIT Zoho Europe support mailbox.
- Delivery is configured for `info@cavetta.mt`, with `info@cloudit.lk` as BCC and `support@cloudit.lk` as Reply-To. A controlled test email arrived with the correct PDF attachment.
- Full configuration and operating instructions are in `docs/monthly-maintenance-report-delivery-runbook.md`.

### Remaining work

- Centralize non-secret workflow configuration in `cavetta_maintenance_config`.
- Add a stale-`SENDING` recovery guard and record `sendingStartedAt`.
- Add documented Vercel Web Analytics to weekly and exact-month reporting.
- Add read-only Supabase aggregate usage and database-health metrics.
- Complete Phase 5E cross-provider period, retention, coverage and month-boundary
  snapshot assurance before the first authoritative client report.
- Phase 5F consolidated weekly/monthly infrastructure reporting was implemented,
  verified and published on 7 September 2026. Health remains separate from
  analytics availability, and only aggregate non-sensitive evidence is shown.
- Replace routine Data Table approval with a protected POST-based review form; retain manual approval as fallback.
- The 15-minute automation watchdog was implemented and internally accepted on
  9 September 2026, including sanitized Error Workflow buckets and a minimal
  fail-closed health endpoint. Add the independent external HTTP check during the
  planned Grafana Cloud Synthetic Monitoring rollout; same-server Uptime Kuma is
  not an independent outage signal.
- Connect actionable conditions to the future ticketing system after its intake method is confirmed.
- Add safe retention cleanup for detailed monitoring rows.
- During the first live monthly cycle, verify one row completes `APPROVED -> SENDING -> SENT`, receives `sentAt`, and is not selected again.

The exact implementation order, acceptance checks, handover protocol, and new-session prompt are in `docs/maintenance-automation-handover.md`.

### Planned ticketing integration

- Direct maintainer email alerts are deferred while a ticketing system is being planned.
- The ticketing system is expected to accept new tickets through a dedicated inbound email address.
- Critical incident and maintenance-check outputs will later be formatted as structured ticket emails and sent to that intake address.
- Ticket creation must remain separate from detection and logging so a ticketing outage cannot stop monitoring records.
- Duplicate suppression will be added before enabling ticket delivery. Repeated checks for the same unresolved service condition must not create a new ticket each time.
- Recovery events should update or close the related ticket only when the selected ticketing system provides a safe supported mechanism; otherwise recovery will be added as a follow-up email or handled manually.
- Ticket emails must contain system status, public URLs, timestamps, safe error categories, and run links only. They must not contain credentials, customer data, landlord data, booking contents, inquiry contents, or raw sensitive logs.

## Credentials and access

Credentials must be created directly in the n8n Credentials interface. Passwords, tokens, bot secrets, and webhook secrets must not be pasted into project documentation, workflow notes, source control, or chat.

Expected credentials:

- Private notification destination, initially Telegram or email
- GitHub fine-grained token with Actions read access only
- Google Analytics read connection
- Vercel read-only token, if required for deployment checks
- Supabase fine-grained read access, only if a public connectivity check is insufficient
- Google Sheets connection if Sheets is selected for maintenance history

Each credential must use the minimum permission needed. Separate read-only maintenance credentials are preferred over owner-level credentials.

## Data handling

The automation may store:

- Monitor names and public URLs
- HTTP status and response time
- Incident start and recovery times
- Workflow names and success or failure statuses
- Deployment status
- Aggregate traffic counts
- Green, amber, and red maintenance classifications

The automation must not store or process:

- Customer or landlord names, phone numbers, emails, or messages
- Booking or inquiry contents
- Internal property notes or private addresses
- Database connection strings
- Encryption passwords
- OAuth refresh tokens or API tokens outside the n8n credential store

## Operational rules

- Begin with Phases 1 and 2 before adding analytics and AI reporting.
- Keep workflows small and independently testable.
- Use error workflows or explicit error branches so failed maintenance checks are visible.
- Avoid unsupported private APIs when a documented public API or webhook is available.
- Monitor n8n itself so a failed automation platform does not appear as a healthy system.
- Export sanitized workflow definitions to the repository after implementation; exported files must not contain credential values or production webhook URLs.
- Review n8n execution history weekly during the initial month and reduce retained execution data where appropriate.

## Information required before Phase 1

- n8n base URL
- n8n Cloud or self-hosted status
- Installed n8n version
- Uptime Kuma base URL and version
- Preferred private alert destination: Telegram or email
- One stable public ImageKit image URL

Secret values must be entered by the owner directly into the relevant n8n and Uptime Kuma interfaces.

## Implementation order

1. Record the installed n8n and Uptime Kuma versions.
2. Configure the private notification credential in n8n.
3. Create the Incident Monitor workflow using the n8n test webhook.
4. Connect one temporary Uptime Kuma monitor and inspect the test payload.
5. Implement event classification, delayed confirmation, and private alerts.
6. Complete the controlled Phase 1 acceptance test.
7. Activate the production webhook and attach the Cavetta monitors.
8. Observe executions for several days.
9. Implement the Daily Backup Watchdog.
10. Add the Weekly Health Check and Monthly Report Draft after the first two workflows are stable.

The original implementation order above is complete. All further work must follow the first incomplete Phase 5 item in `docs/maintenance-automation-handover.md` and must be implemented one tested node or small configuration step at a time.
