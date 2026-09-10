# CloudIT Operations Portal - Technical Build Plan

Status: **Approved for phased planning; implementation not started**

Last updated: 9 September 2026

## Purpose

Build a private, visual operations website for CloudIT at
`operations.cloudit.lk`. The portal will initially monitor Cavetta Properties and
will be structured to support additional clients and domains later.

The portal will:

- Show current and historical workflow health visually.
- Show infrastructure, database and connection-health analytics collected by n8n.
- Show Vercel and ImageKit analytics collected through supported provider APIs.
- Show daily and monthly Google Drive backup evidence and restore-test history.
- Display private monthly maintenance-report PDFs.
- Allow an authorized maintainer to approve, reject and send a report through the
  existing guarded n8n workflows.
- Keep client data, provider credentials and raw execution payloads out of the
  browser.

Every phase is gated. Implementation must stop after each phase for testing,
screenshots and owner approval before the next phase begins.

## Agreed architecture

```text
Vercel --------+
ImageKit ------+
Supabase ------+
GitHub --------+
Public sites --+--> n8n workflows
Backups -------+         |
SMTP / Drive --+         | sanitized results only
                         v
               CloudIT operations database
                         |
                         v
               CloudIT Operations Portal
```

### Responsibilities

| Component | Responsibility |
| --- | --- |
| n8n | Contact providers, run schedules, evaluate evidence and publish sanitized operational records |
| Operations database | Store multi-client workflow, infrastructure, backup, report and incident evidence |
| Operations portal | Authenticate users and present dashboards, charts, reports and guarded actions |
| Existing report workflows | Remain authoritative for report status transitions and email delivery |
| External monitor | Later detect loss of the server hosting both n8n and the portal |

The browser must never connect directly to provider APIs or receive provider,
SMTP, Google Drive, database or n8n credentials.

## Agreed product decisions

- Build a separate CloudIT portal rather than adding cross-client monitoring to
  the Cavetta admin application.
- Use a separate repository and operations database.
- Host the portal on the owner's server at `operations.cloudit.lk`.
- Start with a single CloudIT owner account, while making the data model
  multi-client from the beginning.
- Use Cavetta as the first monitored client and later convert its configuration
  into a reusable onboarding template.
- Keep monthly report delivery manually approved. Never send a DRAFT
  automatically.
- Keep n8n as the provider-integration and automation layer.
- Keep external whole-server monitoring as a separate later integration because
  the existing Uptime Kuma instance shares the n8n server.

## Portal navigation

The intended top-level areas are:

1. Overview
2. Clients
3. Workflows
4. Infrastructure
5. Vercel Analytics
6. ImageKit Analytics
7. Backups
8. Reports
9. Incidents
10. Audit Log
11. Settings

## Phase gates

| Phase | Deliverable | Required stop-and-approve gate |
| --- | --- | --- |
| 0 | Final specification and source-data inventory | Approve scope, fields, boundaries and acceptance criteria |
| 1 | Desktop and mobile visual design | Approve every screen and navigation path |
| 2 | Portal foundation | Verify domain, HTTPS, authentication and protected routes |
| 3 | Operations database | Verify isolation, RLS, audit model and ingestion authentication |
| 4 | Sanitized n8n publishing | Verify Cavetta evidence reaches the portal safely and idempotently |
| 5 | Overview and workflow visualization | Verify every displayed workflow status against n8n |
| 6 | Infrastructure analytics | Verify website, database and connection charts against source evidence |
| 7 | Vercel and ImageKit analytics | Compare identical periods with the provider dashboards |
| 8 | Google Drive backup visualization | Match Drive metadata, checksum evidence and GitHub run |
| 9 | Read-only Report Centre | Verify private PDF viewing without a report-state change |
| 10 | Approve, reject and send controls | Complete an isolated test and remove all test evidence |
| 11 | Incidents and audit history | Verify a safe incident lifecycle and action audit |
| 12 | Production hardening and launch | Complete security, mobile, failure and recovery acceptance |
| 13 | Multi-client onboarding template | Onboard another domain only after Cavetta is stable |

## Phase 0 - Specification and source-data inventory

Document before coding:

- Every existing n8n workflow, trigger, schedule and expected completion window.
- Every safe field produced by the existing evidence and report workflows.
- The portal's metric names, types, units, thresholds and freshness rules.
- Report states, allowed actions and existing idempotency guards.
- Google Drive backup metadata and GitHub Actions evidence currently available.
- User roles and client/domain isolation rules.
- Refresh frequencies, history ranges and retention requirements.
- Acceptance evidence required for all later phases.

No code, schema or production-workflow change is allowed in this phase.

**Gate:** The owner approves the final specification and data contract.

## Phase 1 - Visual design

Design desktop and mobile versions of:

- Login
- Multi-client overview
- Client dashboard
- Visual workflow status and history
- Infrastructure and connection analytics
- Vercel analytics
- ImageKit analytics
- Backup centre
- Report list and report viewer
- Incidents and audit history
- Settings

The design should show responsive navigation, empty/loading/error states, chart
legends, freshness indicators and GREEN/AMBER/RED definitions.

**Gate:** The owner approves the complete visual design before implementation.

## Phase 2 - Portal foundation

Create and deploy the isolated portal foundation:

- Separate repository and deployment configuration.
- `operations.cloudit.lk` DNS and HTTPS.
- Private owner authentication.
- Protected server-rendered routes.
- Secure session and logout behavior.
- Desktop and mobile application shell.
- Environment validation and secret separation.
- No provider or n8n credentials in client-side code.

**Gate:** Verify login, logout, unauthorized access, HTTPS, desktop and mobile
behavior.

## Phase 3 - Operations database

Create a dedicated multi-client operational data model. Expected areas include:

- Clients and environments
- Domains and monitored endpoints
- Workflow catalogue and expected schedules
- Workflow execution summaries
- Metric definitions and samples
- Backup and restore-test evidence
- Incidents and findings
- Monthly reports and report events
- Report-action commands
- Audit events

Use explicit grants and Row Level Security. Anonymous access must be denied. The
service credential used for n8n ingestion must remain server-side and scoped as
narrowly as the selected platform permits.

**Gate:** Prove anonymous denial, owner access, client isolation, ingestion
authentication and audit behavior.

## Phase 4 - Sanitized n8n data publishing

Create one reusable n8n sub-workflow, provisionally named:

`CloudIT - Publish Operations Evidence`

Existing workflows will call it with normalized records. Stable record keys will
make ingestion idempotent.

Allowed data includes:

- Workflow name, expected schedule, status, duration and timestamps
- Public endpoint identity and aggregate availability
- Aggregate database and connection metrics
- Backup filename metadata, size, age and verification state
- Aggregate Vercel and ImageKit analytics
- Monthly report metadata and state
- Sanitized finding categories and safe action text

Forbidden data includes:

- Credentials, tokens, connection strings or passwords
- Raw errors, stack traces or unrestricted execution payloads
- Customer, landlord, booking or inquiry data
- Email bodies or arbitrary request bodies
- Decrypted backup contents

**Gate:** Compare every Cavetta record with its n8n source, retry ingestion and
prove no duplicate record is created.

## Phase 5 - Overview and workflow visualization

Build the main operational dashboard and curated workflow diagrams.

The overview will show:

- Client/domain GREEN, AMBER or RED state
- Website, workflow, backup and infrastructure status
- Active findings
- Latest monthly report state
- Evidence freshness and last update time

Each workflow view will show:

- A curated step diagram, not an editable copy of the n8n canvas
- Latest status and last successful run
- Latest safe failure category
- Next expected run and overdue state
- Duration and schedule delay
- Success percentage over selectable periods
- Recent execution timeline

**Gate:** Verify every displayed workflow state and timestamp against n8n.

## Phase 6 - Infrastructure analytics

Build current-state cards and historical charts for evidence available through
the workflows, including:

- Website availability and response time
- Supabase/PostgreSQL health and database size
- Direct, Supavisor and PgBouncer connection counts
- Active, idle and waiting connections where safely available
- Connection usage percentage
- Database memory, disk and read-only indicators where safely available
- Restart and connectivity evidence
- Workflow success, duration and missed-schedule analytics

Views should support current, 24-hour, 7-day, 30-day and monthly ranges where the
underlying sampling frequency supports them.

Never store raw SQL text, connection strings, query contents or customer data.

**Gate:** Compare the portal values with an identical source-evidence period.

## Phase 7 - Vercel and ImageKit analytics

### Vercel

Display supported evidence collected by n8n:

- Visitors and page views
- Daily, weekly and monthly traffic
- Top routes
- Deployment status and history
- Deployment duration
- Domain health
- Supported invocation, error, edge-request and usage metrics where available to
  the current Vercel plan and documented API

### ImageKit

Display supported evidence collected by n8n:

- Bandwidth used, quota and remaining percentage
- Media Library storage used, quota and remaining space
- Video-processing units
- Extension units
- Original-cache storage
- Daily/monthly usage trends
- Warning-threshold history
- API/credential connectivity and last successful collection

Do not scrape either provider dashboard. Use only supported APIs and keep
credentials inside n8n. ImageKit usage collection must respect its provider-side
cache and reporting-period rules.

**Gate:** Compare an identical date range with the Vercel and ImageKit dashboards
and document any provider-boundary or timezone differences.

## Phase 8 - Google Drive backup visualization

The backup centre must visually represent the existing encrypted database-backup
pipeline.

### Current source process

- `Database backup` runs in GitHub Actions every day at 02:17 UTC.
- It uploads an AES-256-encrypted archive and SHA-256 checksum to the dedicated
  Google Drive account.
- It downloads the stored Drive copy into a temporary directory, verifies the
  checksum, decrypts and validates the archive, then removes temporary decrypted
  files.
- Daily files are retained for 30 days.
- A monthly copy is retained for 366 days.
- `Backup restore test` runs an isolated, non-production restore test monthly.
- Production disaster recovery remains separately authorized and manual.

### Portal presentation

Show:

- Daily backup calendar with success, failure and missing-day states
- Latest backup time, age, duration and GitHub run link
- Encrypted archive present
- Matching checksum present and verified
- Google Drive round-trip verification state
- Backup file size and size trend
- Daily versus monthly retention category
- Latest isolated restore-test time, age and result
- Expected-next-run and overdue state
- Private `Open in Drive` action where safe

To reconcile actual Drive inventory, n8n may use a read-only Google Drive
credential restricted to listing metadata from the dedicated `Daily`, `Monthly`
and `Restore Tests` folders. The portal must not download, decrypt or expose backup
contents.

Example:

```text
Daily Backups - September 2026

Mon  Tue  Wed  Thu  Fri  Sat  Sun
 -    01   02   03   04   05   06
07   08   09
OK   OK   OK

Latest backup
Created:          09 Sep 2026, 04:17 Europe/Malta
Encrypted:        Yes
Checksum:         Verified
Drive round trip: Passed
Size:             68.2 MB
Status:           HEALTHY

Latest restore test
Isolated restore: Passed
RLS validation:   Passed
Status:           HEALTHY
```

**Gate:** Match one displayed backup to its encrypted Drive file, checksum,
GitHub Actions run and n8n evidence without opening or decrypting the archive.

## Phase 9 - Read-only Report Centre

Build a report list and private viewer that shows:

- Client and report month
- DRAFT, APPROVED, SENDING, SENT, REJECTED or SEND_FAILED state
- Overall result, severity and sanitized findings
- Evidence coverage and generation time
- Private PDF preview and authorized download
- Delivery state and report history

PDF retrieval must occur server-to-server. Opening or downloading a report must
never approve, reject or send it.

**Gate:** View a real DRAFT PDF securely and prove that its report row remains
unchanged.

## Phase 10 - Approve, reject and send controls

Add guarded server-side actions:

- Approve
- Reject with an optional sanitized reason
- Approve and send
- Recipient and report-month confirmation
- Duplicate-submission and replay protection
- Exactly-once claim and delivery
- SENT or SEND_FAILED result display
- Complete action audit trail

The portal sends a signed command to n8n. The existing n8n report-status and
idempotency checks remain authoritative. The portal cannot bypass them.

**Gate:** Use a temporary non-real report to verify the complete lifecycle and
duplicate protection. Remove the test report, commands and evidence afterward. A
real report may be sent only with separate explicit authorization.

## Phase 11 - Incidents and audit history

Build:

- Active and resolved findings
- Severity, client, domain and provider filters
- Repeated-failure buckets
- Recovery timeline
- Safe investigation links
- Report-action and administrative audit history

Do not display raw provider errors, secrets, customer data or unrestricted n8n
payloads.

**Gate:** Complete a controlled sanitized incident from detection through
recovery and verify its audit trail.

## Phase 12 - Production hardening and launch

Acceptance must cover:

- Authentication and authorization
- Tenant isolation
- Signed-command replay resistance
- Rate limiting
- PDF authorization
- Report status and duplicate-send protection
- Failure and stale-data behavior
- Responsive behavior at desktop and mobile widths
- Operations-database backup and recovery documentation
- Monitoring of `operations.cloudit.lk`
- Secret and public-payload review

Because the portal and n8n share the owner's server, an externally hosted probe is
still required to detect total server or network loss.

**Gate:** Formal production acceptance before normal operational use.

## Phase 13 - Multi-client onboarding template

After Cavetta is stable:

- Create the next client and environments.
- Register its domains, workflows and providers.
- Apply reusable dashboards and thresholds.
- Add only the provider configuration it requires.
- Verify tenant isolation.
- Generate and review its first report draft.

**Gate:** Accept each client separately. Do not bulk-enable unverified clients.

## Initial operating frequencies

| Evidence | Initial frequency |
| --- | --- |
| Public website checks | Every 5 minutes |
| Automation watchdog | Every 15 minutes |
| Database and connection samples | Every 15 minutes |
| Vercel traffic analytics | Hourly or daily, subject to provider limits |
| ImageKit usage analytics | Every 6-12 hours, subject to provider caching |
| Google Drive backup evidence | After each backup plus daily reconciliation |
| Monthly report state | Event-driven |
| Portal screen refresh | Every 30-60 seconds without bypassing source freshness |

## Initial retention proposal

- Detailed metric samples: 90 days.
- Daily aggregate metrics: 24 months.
- Weekly summaries and incidents: 24 months.
- Backup evidence: at least 12 months.
- Monthly reports, delivery evidence and audit actions: permanent unless a later
  approved policy states otherwise.
- Never delete encrypted backup archives or disaster-recovery evidence through
  portal-retention automation.

Retention implementation remains separately gated and must not alter the existing
Google Drive retention process without explicit approval.

## Global safety rules

- Stop after every phase and wait for owner approval.
- Do not interrupt the live Cavetta website to test monitoring.
- Do not restore over the production database.
- Do not approve, reject, regenerate or send a real report during construction.
- Do not weaken the current report status or idempotency guards.
- Do not expose provider, database, SMTP, Drive or n8n credentials.
- Do not publish raw failures, stacks, execution payloads or sensitive logs.
- Do not put customer, landlord, booking or inquiry data in the operations portal.
- Do not add client notifications or ticket creation until separately approved.
- Remove every temporary workflow, endpoint, row, mock and pinned item after its
  acceptance test.
- Keep provider integration failures independent from monitoring-record storage
  so evidence remains available when an optional downstream action fails.

## First action when implementation is authorized

Begin only with **Phase 0**. Produce the final source inventory, field-level data
contract, screen requirements, security model and acceptance checklist. Stop and
obtain owner approval before beginning Phase 1.
