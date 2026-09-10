# Monthly Maintenance Report Delivery Runbook

## Purpose

This runbook continues the published n8n workflow `Cavetta - Monthly Maintenance Report Draft`. It defines how to turn the structured monthly result into a branded PDF, store it privately, require maintainer approval, and send it through CloudIT's Zoho mailbox.

The report must never be sent to the client before an explicit approval. Database recovery, deployment, DNS changes, and production mutations remain outside this workflow.

## Current handoff

Status as of 9 September 2026:

- The monthly draft workflow is published as `Cavetta - Monthly Maintenance Report Draft` and creates the previous month's report data.
- Health, incident, backup, restore-test, and GA4 aggregation are working.
- GA4 uses property ID `550378738` and the metrics `totalUsers`, `sessions`, `newUsers`, and `screenPageViews`.
- The final Code node is named `Compose Monthly Maintenance Report`.
- The final structured row is upserted by `reportMonth` through `Store Monthly Maintenance Report`.
- The destination table is `cavetta_monthly_maintenance_reports`.
- The July 2026 test row is intentionally `AMBER` because monitoring and GA4 data did not exist for that historical month.
- The CloudIT logo is publicly available without authentication at `https://ik.imagekit.io/4z66kkrjv/company-assets/cloudit_logo.png`. Use this stable URL in the PDF HTML template.
- The private Google Drive folder `Cavetta Maintenance Reports/2026` has been created in the dedicated automation account.
- The active Hetzner n8n Compose directory is `/opt/cloudit/cloudit-platform/infra/n8n` and its Compose file is `/opt/cloudit/cloudit-platform/infra/n8n/docker-compose.yml`.
- The recoverable pre-Gotenberg Compose copy is `docker-compose.yml.backup-20260828-094523`.
- The running n8n container is named `n8n`, is healthy, and is attached to the private Docker network `cloudit`.
- Gotenberg `8.34.0-chromium` is deployed on that private network without a published host port. Its health endpoint returned HTTP 200 when called from the n8n container.
- The monthly workflow now builds the branded HTML, converts it to PDF through Gotenberg, uploads the PDF privately to Google Drive, and stores the PDF metadata with `documentStatus: DRAFT`.
- The sender workflow is published as `Cavetta - Approved Monthly Report Sender` and runs every five minutes in the `Europe/Malta` timezone.
- Delivery uses `support@cloudit.lk` through Zoho Europe SMTP. Client delivery goes to `info@cavetta.mt`, with `info@cloudit.lk` as BCC and `support@cloudit.lk` as Reply-To.
- A controlled email test was accepted by Zoho and arrived with the correct PDF attachment.
- The 9 September safety acceptance began and ended with the same three real-row
  states: one `SENT` and two `DRAFT`. Historical test artifacts are not eligible
  for resend and are not evidence of a current delivery failure.
- The protected workflow `Cavetta - Monthly Report Review` is published with
  `n8n User Auth` and idempotent approval/rejection guards.
- The monthly DRAFT workflow sends one internal review notification after private
  PDF metadata is saved and records `reviewNotificationSentAt` after SMTP success.
- `Cavetta - Monthly Report Review Reminder` is published and checks daily at
  09:15 `Europe/Malta` for a single internal reminder after 48 hours.
- The sender, watchdog, and reusable configuration loader passed the 9 September
  production-safety correction and were republished. The correction changed no
  recipient, credential, PDF, Drive, approval, or client-notification behavior.

### Exact next action

No implementation action remains for this phase. Operate it as follows:

1. Wait for the internal review email sent after the monthly workflow creates the
   previous month's `DRAFT` row and private Drive PDF.
2. Open the private `pdfDriveUrl` from that email and review the entire PDF.
3. Open the protected review form, authenticate with n8n, and submit either
   `Approve and send` or `Reject`. Merely opening either URL changes nothing.
4. If approved, the separate sender claims it within five minutes, sends the
   attachment, and records `SENT` or `SEND_FAILED`.
5. If rejected, the row remains `REJECTED` and is never selected by the sender.
6. If no decision is submitted within 48 hours, one internal reminder is sent.
7. Manual Data Table approval remains available only as an emergency fallback.
8. If delivery fails, investigate `lastSendError`; return the row to `APPROVED`
   only after correcting the cause and explicitly authorizing one retry.

To resume in a new session, use:

> Read `docs/maintenance-automation-handover.md`, `docs/n8n-maintenance-automation-plan.md`, and `docs/monthly-maintenance-report-delivery-runbook.md`, then continue from the first incomplete phase in the master handover. The monthly PDF and approval-controlled delivery workflows are already published; do not recreate them. Guide the implementation one n8n node or one small configuration step at a time and wait for test output before advancing.

The protected POST-based approval form and internal automation watchdog are
implemented. The watchdog's scheduled summary, fail-closed health endpoint, and
sanitized Error Workflow path were accepted on 9 September 2026. Its independent
external check is deferred to the planned Grafana Cloud public-probe rollout.
The scheduled Phase 5E acceptance remains due on 1 October 2026.

## Report identity

Use the following client-facing identity:

- Display name: CloudIT Pvt Ltd
- Email: `info@cloudit.lk`
- Website: `www.cloudit.lk`
- Phone: `+94 75 686 8854`
- Client: Cavetta Properties
- Do not include a personal `Prepared by` line.
- Use a restrained white, black, and grey layout. The CloudIT logo provides the only brand colour.

## Target architecture

```text
Monthly monitoring aggregates
  -> Compose Monthly Maintenance Report
  -> Build Monthly Report HTML
  -> Convert HTML to index.html binary
  -> Gotenberg HTML-to-PDF conversion
  -> Upload private PDF to Google Drive
  -> Save PDF metadata with status DRAFT
  -> Send internal review email with private PDF and protected form links
  -> Authenticated maintainer submits Approve and send or Reject
  -> Optional single internal reminder after 48 hours in DRAFT
  -> Approved-report sender claims the row as SENDING
  -> Download PDF from Drive
  -> Send through Zoho Europe SMTP
  -> Mark SENT or SEND_FAILED
```

## Privacy and safety rules

- Store OAuth, SMTP, API, and Drive credentials only in n8n Credentials.
- Never write secrets into a Code node, Data Table, workflow note, exported JSON, repository file, or chat.
- The report may contain public URLs, aggregate traffic counts, service statuses, response times, incident timestamps, and safe workflow-run links.
- The report must not contain customer, landlord, booking, inquiry, internal property, or authentication data.
- Google Drive files remain private. The client receives the PDF attachment and does not need a Drive sharing link.
- No GET link may directly approve or send a report; email-security scanners can open links automatically.
- A report with a non-empty `sentAt` must not be sent again without a separate explicit resend procedure.

## Required Data Table columns

The existing table is `cavetta_monthly_maintenance_reports`. Retain its report and metric columns and add:

| Column | Type | Purpose |
|---|---|---|
| `documentStatus` | String | `DRAFT`, `APPROVED`, `SENDING`, `SENT`, or `SEND_FAILED` |
| `pdfFileName` | String | Generated PDF filename |
| `pdfDriveFileId` | String | Private Drive file identifier |
| `pdfDriveUrl` | String | Maintainer-only Drive review URL |
| `pdfGeneratedAt` | String | ISO timestamp |
| `approvedAt` | String | ISO approval timestamp |
| `rejectedAt` | String | ISO rejection timestamp |
| `rejectionReason` | String | Optional sanitized non-sensitive rejection reason, maximum 300 characters |
| `reviewNotificationSentAt` | String | ISO timestamp after the initial internal review email succeeds |
| `reviewReminderSentAt` | String | ISO timestamp after the one permitted internal reminder succeeds |
| `sendingStartedAt` | String | UTC timestamp written when a sender claims the report; used for stale-claim recovery |
| `sentAt` | String | ISO successful-delivery timestamp and duplicate-send guard |
| `sendAttemptCount` | String | Decimal delivery-attempt count; incremented atomically when a report is claimed |
| `lastSendError` | String | Fixed sanitized delivery or stale-recovery classification; never a raw provider error |

The monthly report upsert matches the string column `reportMonth` against `{{ $json.reportMonth }}`. Additional delivery columns must not be erased when report data is refreshed.

## Google Drive layout

Use the existing dedicated automation account, not the client's Gmail or a personal Drive account.

```text
My Drive/
  Cavetta Backups/
    Daily/
    Monthly/
    Restore Tests/
  Cavetta Maintenance Reports/
    2026/
```

Files are named:

```text
Cavetta-Monthly-Maintenance-Report-YYYY-MM.pdf
```

## Monthly data-window assurance

Report drafting remains on the first weekday: when day 1 is Saturday or Sunday,
the workflow waits until Monday. Public holidays are not currently modelled.
Data acquisition must not assume every provider retains a complete previous
month until that date. Phase 5E owns a separate cross-provider period and
retention check for all report sources:

- Weekly health and availability rows
- Incident and recovery rows
- Backup and isolated restore-test evidence
- GA4 analytics
- Vercel Web Analytics
- Supabase infrastructure samples
- ImageKit usage analytics

For every source, preserve or derive these non-secret fields:

- `sourceKey` and `reportMonth`
- Requested period start/end and explicit timezone
- Actual period start/end returned or represented by stored samples
- Inclusive/exclusive boundary semantics
- Capture timestamp and source-as-of timestamp
- Coverage status: `FULL`, `PARTIAL`, or `NO_DATA`
- Sanitized coverage detail and action required

Retention-sensitive provider data must be collected by a read-only
month-boundary workflow before expiry and stored as one idempotent snapshot per
`sourceKey` and `reportMonth`. The first-weekday draft workflow reads that
snapshot. The capture workflow must never build a PDF, upload a file, change a
report to `APPROVED`, or invoke client delivery.

Do not silently replace an exact calendar month with a rolling window. If actual
coverage differs from the requested month, keep the report in DRAFT, show
`PARTIAL` or `NO_DATA`, and require maintainer review. Compare each provider's
counts and dates with its dashboard or other authoritative evidence for the same
interval during acceptance.

The August 2026 report remains non-authoritative DRAFT test data. Phase 5E
acceptance begins with the October draft using September evidence.

## PDF contents

The A4 report should contain:

1. CloudIT logo, company contacts, client name, and reporting month.
2. Overall GREEN, AMBER, or RED status and executive summary.
3. Public website and service checks: home, properties, contact, robots, sitemap, Vercel, Supabase, and ImageKit.
4. Confirmed production incidents, recoveries, warnings, and affected monitor names.
5. Database-backup and isolated restore-test status with safe GitHub run links.
6. GA4 total users, new users, sessions, and page views.
7. Recommended actions and report-generation timestamp.

Do not claim an uptime percentage unless it is obtained directly from Uptime Kuma for the full reporting period.

## Gotenberg deployment

Gotenberg is the selected HTML-to-PDF renderer because n8n and Uptime Kuma are already self-hosted on Hetzner. It should run on the same private Docker network as n8n and must not publish a public host port.

Expected internal endpoint:

```text
http://gotenberg:3000/forms/chromium/convert/html
```

Before editing Docker Compose:

1. Locate the exact active Compose directory and file.
2. Save a recoverable copy of that file.
3. Confirm the n8n service name, Docker network, volumes, and current container health.
4. Add only the Gotenberg service and attach it to the existing private network.
5. Validate the resolved Compose configuration before applying it.
6. Start only the new service where possible.
7. Confirm `http://gotenberg:3000/health` is reachable from n8n.

Do not guess the active Hetzner paths or recreate the existing stack from scratch.

## Monthly PDF nodes

Add these nodes after the structured monthly report is composed:

1. `Build Monthly Report HTML` - Code node that escapes dynamic content and creates print-ready HTML/CSS.
2. `Convert Report HTML to File` - creates a binary file named `index.html`.
3. `Generate Monthly Report PDF` - HTTP Request using multipart form data to the private Gotenberg endpoint; response format is File.
4. `Upload Monthly Report PDF` - Google Drive upload using the dedicated automation account.
5. `Prepare Monthly PDF Metadata` - sets filename, Drive ID, review URL, timestamp, and `documentStatus: DRAFT`.
6. `Update Monthly Report PDF Metadata` - updates the row matching `reportMonth`.

The PDF path is private. Do not enable public link sharing.

## Approval and delivery workflow

Create a separate published workflow named:

```text
Cavetta - Approved Monthly Report Sender
```

Run it every five minutes in the `Europe/Malta` timezone.

1. Read rows where `documentStatus` equals `APPROVED`. An IF node first verifies
   that `sentAt` is empty.
2. Atomically claim only the row matching `reportMonth`, `id`,
   `documentStatus = APPROVED`, and `sentAt` equal to the Data Table's blank
   string. The claim sets only `documentStatus: SENDING`, the current UTC
   `sendingStartedAt`, and the incremented string `sendAttemptCount`.
3. Download `pdfDriveFileId` from Google Drive as binary data.
4. Send the PDF attachment through the Zoho SMTP credential.
5. On success, set only `documentStatus: SENT` and `sentAt`; retain all other
   report, approval, PDF, Drive, snapshot, metric, and delivery evidence.
6. On failure, set only `documentStatus: SEND_FAILED` and `lastSendError`.
   Provider diagnostics are reduced before storage to one fixed SMTP category,
   or to the fixed `PDF download failed` category. Raw provider errors are never
   stored.
7. A retry requires a maintainer to review the failure and change `SEND_FAILED` back to `APPROVED`.

The sender also has a schedule-triggered recovery branch:

```text
Get Sending Reports for Recovery
  -> Identify Stale Sending Reports
  -> Mark Stale Sending Report Failed
```

It validates the positive `stale_sending_minutes` configuration and ignores rows
without a valid claim timestamp. A row that remains `SENDING` beyond the
configured threshold, currently 30 minutes, is changed to `SEND_FAILED` with the
fixed recovery message containing that threshold. The update matches both the
row `id` and `documentStatus = SENDING` and changes no unrelated field.

The complete sender safety contract was acceptance-tested again on 9 September
2026 with six isolated far-future rows. The tests proved stale selection,
idempotent recovery, the atomic blank-`sentAt` claim, fixed SMTP/PDF failure
classification, and preservation of every protected sentinel field. The
preservation comparison returned six rows, zero mismatches. All temporary nodes,
pins, mock data, connections, and rows were removed before publication; no email
or Drive operation was executed.

The recovery-enabled sender revision was published after this acceptance test on 29 August 2026.

Normal approval uses the protected POST-based `Cavetta - Monthly Report Review`
workflow after the maintainer reviews `pdfDriveUrl`. Manual Data Table approval
is retained only as an emergency fallback. Merely opening a review link must not
approve, reject, or send a report.

## Zoho Europe SMTP

Use the n8n SMTP credential created for the CloudIT support mailbox. The working configuration is:

```text
Username: support@cloudit.lk
Host: smtppro.zoho.eu
Port: 587
SSL/TLS toggle: off (STARTTLS is negotiated on port 587)
Client host name: empty
```

Use a dedicated Zoho app-specific password when required. Hetzner blocks outbound port 465 in this environment, so the confirmed working submission path is port 587 with STARTTLS.

Never store the app password in the workflow. Confirm SPF and DKIM for `cloudit.lk` before client delivery.

## Client email format

```text
From: CloudIT Pvt Ltd <support@cloudit.lk>
To: info@cavetta.mt
BCC: info@cloudit.lk
Reply-To: support@cloudit.lk
Subject: Cavetta Monthly Maintenance Report - <Month YYYY>
Attachment: Cavetta-Monthly-Maintenance-Report-YYYY-MM.pdf
```

The message body should include the overall status, executive summary, a short statement that the detailed report is attached, and CloudIT support contact details. Do not include a public Drive link.

## Acceptance testing

The controlled test reached Zoho and delivered the correct PDF attachment. For the first live monthly cycle, complete this final operational verification:

1. Review every page of the newly generated PDF before approval.
2. Approve only one new report row.
3. Confirm the row progresses `APPROVED -> SENDING -> SENT` and receives a non-empty `sentAt`.
4. Confirm the client message, CloudIT BCC copy, subject, body, and attachment.
5. Let the sender run again and confirm the `SENT` row is not selected again.
6. If the state becomes `SEND_FAILED`, retain the private PDF, correct the cause, and manually return the row to `APPROVED` for one controlled retry.

## Completion criteria

This delivery phase is complete when:

- A branded PDF is generated without a paid external PDF service.
- The PDF is privately archived in the correct Drive year folder.
- The report remains `DRAFT` until explicit maintainer approval.
- Approval results in one Zoho email with the correct attachment.
- A completed report cannot be sent twice accidentally.
- Failures are visible as `SEND_FAILED` with a safe diagnostic.
- The workflow exports and project documentation contain no credential values.
