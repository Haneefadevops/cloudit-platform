# CloudIT Operations Portal — Phase 9 design: Read-only Report Centre

Date: 15 September 2026
Status: **BUILT AND LOCALLY VERIFIED — awaiting deployment, inactive n8n relay import, and real-DRAFT gate**

## Purpose and phase boundary

Phase 9 adds a private, read-only Report Centre: a report list and a report
viewer for sanitized metadata, findings, evidence coverage, delivery state, and
history. It does **not** approve, reject, generate, send, retry, upload,
download from a provider in the browser, or otherwise mutate a report. There
will be no report-state writer, command writer, n8n action command, form, or
external/provider link in this phase.

The existing state-machine and idempotency guards remain authoritative. In
particular, `sent_at` is never changed by the Phase 9 read path.

## Investigation result: report source and PDF location

The portal worktree proves the operations-database representation and ingest
writers. Four owner-supplied current workflow exports were additionally
inspected from `cloudit-operations-portal-transfer/docs/monthReport/` in the
main checkout (the working convention prevents modifying that checkout):

- `Cavetta - Monthly Maintenance Report Draft`
- `Cavetta - Approved Monthly Report Sender`
- `Cavetta - Monthly Report Review`
- `Cavetta - Monthly Report Review Reminder`

- The historical Phase 0 inventory says Google Drive, but the exported draft
  workflow confirms the current source of truth: generated PDFs live in the
  private Cloudflare R2 bucket `cavetta-private-storage`. It uploads to the
  object-key pattern `Cavetta Maintenance Reports/<year>/<pdfFileName>` using
  the restricted `Cavetta R2 Reports` S3 credential. Monthly draft generation
  consumes the seven monthly source snapshots, creates a `DRAFT`, renders a
  PDF privately, stores private R2 metadata in the existing n8n report record,
  and sends one internal review notice. The workflow catalogue
  seed records `cavetta.monthly_maintenance_report_draft` as cron
  `0 9 1 * *` in `Europe/Malta`, with a first-weekday rule.
- The n8n Data Table is `cavetta_monthly_maintenance_reports`. Its legacy
  field names must not be exposed or renamed casually: `pdfDriveFileId` is now
  the **R2 object key**, and `pdfDriveUrl` is a private internal storage
  locator, not a public URL. The sender proves this by downloading from R2
  using `fileKey = pdfDriveFileId` before email delivery.
- The four supplied workflows contain no `reportKey`, no
  `CloudIT - Publish Operations Evidence v2` call, and no `report_summary` or
  `report_finding` record. Therefore the operations portal cannot receive real
  report rows from them yet. This is a verified integration gap, not a reason
  for the portal to read n8n directly or expose a Data Table/R2 identifier.
- The operations database intentionally has only `pdf_available`; it contains
  neither PDF bytes nor an R2 object key, URL, filename, or provider
  credential. This is correct and must remain true.

The owner subsequently confirmed the summary publisher in n8n and replayed it:
two summaries were already present and the replay returned `duplicates: 2`,
`rejected: 0`. The private relay is now implemented as an inactive export and
has only been exercised with synthetic data locally. It uses the verified
legacy R2 mapping inside n8n; no browser/API field reveals it.

### Required n8n additions (new, inactive exports; no change to the four live workflows yet)

1. The inactive `CloudIT - Monthly Report Evidence Publisher` publishes
   sanitized `report_summary` records through
   `CloudIT - Publish Operations Evidence v2`. It derives `pdfAvailable`
   without publishing the R2 key. Sanitized finding publication remains
   empty until an explicit safe upstream finding representation is confirmed;
   raw report content is never inferred or copied into evidence.
2. The inactive `CloudIT - Private Report PDF Relay` reads the Data Table by a
   portal-only report identity, verifies the report has an allowed status and
   complete private R2 metadata, downloads via `Cavetta R2 Reports`, and
   streams the binary only back to the portal server. It has no Data Table
   update node, email node, report-action node, or publisher call.
3. The summary publisher periodically reconciles authoritative state changes.
   The operations database writer creates append-only state events. No live
   review, sender, or draft-generation workflow is modified by Phase 9.

## Existing schema and ingest map

No migration `0010` is required for the list/history/read metadata path.

| Need | Existing source | Result |
| --- | --- | --- |
| Report identity/list | `operations.reports` | `report_key`, client association, month, type, status, overall status, coverage, generated time, `pdf_available`, safe delivery fields, version. |
| Findings | `operations.report_findings` | Only allowlisted category, severity, finding status, safe title/summary/action, and safe timestamps. |
| History | `operations.report_events` | Append-only `GENERATED`, state transitions, and `STATE_RECONCILED`; safe timestamps/statuses only. |
| Ingestion | `0005_ingest_records.sql` | `insert_report_summary` and `insert_report_finding` already exist and are dispatched by `submit_batch`. The report-summary writer preserves terminal `SENT`, preserves an existing `sent_at`, takes max row version/send attempts, and writes an event only for an inserted or state-changed summary. |
| PDF availability | `operations.reports.pdf_available` | Availability signal only; deliberately not a location/reference. |

The current publisher allowlist includes both `report_summary` and
`report_finding`; report findings require their parent report to have been
published first. Report events are emitted by the summary writer, not accepted
as a browser or portal write path.

### Migration 0010

`0010_report_pdf_retrieval_nonces.sql` adds only a private one-use replay
ledger containing a SHA-256 nonce hash, expiry, consumed time, and report/client
foreign key. It stores no PDF bytes, R2 key, URL, filename, or credential. The
table is not directly readable by the portal, ingestion, or anonymous roles;
`operations_owner` can execute only the narrow security-definer claim function.
The function reloads the report, requires `pdf_available` and an allowed report
state, enforces a maximum five-minute database expiry, and rejects duplicate
nonce hashes atomically.

## Read path

### Metadata API

Add one internal, SELECT-only platform API endpoint:

`GET /api/operations/reports`

It queries `operations.reports`, active `operations.clients`, findings, and
events as `operations_owner` through the existing `OperationsDataService`
convention. It returns only an explicit allowlist:

- `reportKey`, `clientKey`, client display name, report month/type;
- document and overall states, coverage, generated/observed timestamps,
  `pdfAvailable`, send-attempt count, and safe failure category;
- safe finding fields listed above and server-derived severity counts;
- report event type, from/to state, occurred time, and safe correlation key if
  it remains opaque and useful (otherwise omit it);
- one generated-at timestamp for the response.

No SQL query selects `report_commands`, any provider identifier, source payload,
or PDF data. The endpoint has no request body and no write-capable dependency.
Unknown report keys return the existing generic `Not found` response. Database
errors continue through the safe operations exception filter.

Pagination/ordering should be bounded from the first release: newest report
month first, then generated time; a small fixed page size with an opaque cursor
is preferable to returning unbounded permanent report history. The initial
single-client view must retain client fields and joins so RLS/isolation remains
correct for later tenants.

### Private PDF relay (only after live n8n retrieval is verified)

The browser requests a same-origin portal route such as
`GET /reports/{portalReportKey}/pdf?disposition=inline|attachment`. The route
does not expose an R2, n8n, or object URL. It validates the authenticated
portal session, reloads the report/client association server-side, and checks
`pdf_available` before initiating any retrieval.

The portal server then calls a dedicated private n8n retrieval endpoint using a
short-lived, signed, one-use request containing only the opaque report key,
issued/expiry timestamps, nonce, correlation ID, and requested disposition.
n8n validates the HMAC and time window, then calls the internal platform API to
atomically claim the hashed nonce in migration 0010. n8n reloads the authoritative report row,
requires private R2 PDF metadata and an allowed report state, retrieves the
object with its restricted S3 credential, and streams bytes directly to the
portal server.
The portal validates the MIME type, size (25 MiB maximum), and `%PDF-` prefix,
then streams with a fixed `application/pdf` MIME type and safe generated
filename; it never logs body bytes.

The portal response uses `Cache-Control: private, no-store`, `X-Content-Type-
Options: nosniff`, frame protection, and a restrictive PDF route CSP. Downloads
use the same relay with `Content-Disposition: attachment`; previews use
`inline`. Both are read paths. No external link or signed cloud URL is exposed.
No R2 object key, n8n URL, credential, raw provider error, report body,
or stack trace enters browser code or an API JSON response.

Preview/download controls render only when both `pdfAvailable` and all three
server-only relay settings are present. Otherwise the UI shows a non-actionable
unavailable state. There is no provider URL or fallback download.

## Governing security contract (Phase 0 §9)

The implementation follows the specified sequence verbatim in substance:

1. An authenticated portal session requests `/reports/{portalReportKey}/pdf`.
2. The portal server reloads membership and report/client association; it does
   not trust browser state or a supplied provider ID.
3. The portal sends a short-lived signed, one-use retrieval request containing
   only report key, timestamp, nonce, and correlation ID.
4. n8n reloads the authoritative report, requires private PDF metadata and an
   allowed state, retrieves it using its credential, and streams a fixed-type
   PDF with a safe filename.
5. The portal applies private no-store caching, clickjacking protection, strict
   CSP, and an audit event; it never exposes an R2 object key/URL, R2 credential, or n8n
   URL to browser code.
6. GET/view/download paths are structurally incapable of changing report state.

The final item is a code-structure requirement: the Phase 9 controller/service
imports no Phase 10 command client or mutation method; its database role/path is
SELECT-only; route handlers have no state/action parameter; and tests compare a
report row before and after both preview and attachment requests.

## Portal page design

Add `ReportsPage` in the existing server-rendered Phase 7/8 convention and
replace only the existing `/reports` placeholder dispatch. The page contains:

- a page title, non-sensitive generated/freshness time, and an explicit
  “Read-only — report actions are unavailable” label;
- report cards/table sorted by newest month, showing client, month, state,
  overall status, coverage, generation time, PDF availability, and safe
  delivery state;
- a selected-report detail panel with severity count chips, sanitized findings,
  and append-only state history;
- preview/download controls only when `pdfAvailable` and the private relay has
  been configured and verified; otherwise a clear unavailable state;
- loading/empty/error states matching existing operations pages, with generic
  safe failures and no raw error details.

State labels are exactly `DRAFT`, `APPROVED`, `SENDING`, `SENT`, `REJECTED`,
and `SEND_FAILED`; no control resembles approval, rejection, sending, retry,
or regeneration. Responsive layout keeps report identity/state visible before
the detail panel collapses on mobile.

## Local verification completed (15 September 2026)

- Both workflow exports parse; the relay Code nodes pass a harness covering a
  valid request, signature tampering, report-state denial, valid PDF, and
  invalid PDF.
- `platform-api`: build green; complete Jest suite **89/89**; operations lint
  green. Tests cover the report output allowlist/cross-report attachment guard
  and signed claim validation/tamper/expiry.
- `operations-web`: typecheck, lint, and production build green. A local
  authenticated same-origin route test passed for preview and attachment with
  a harmless synthetic `%PDF-` stream; anonymous access redirected to login.
- Disposable `pgvector/pgvector:pg16`: migrations 0001–0010 applied fresh and
  reapplied idempotently. The complete isolation suite is **93/93 PASS**. Its
  Phase 9 assertions prove atomic replay denial, expired-claim denial, direct
  ledger-read denial, and an identical report-state fingerprint before/after
  the claim. The long-standing seeded-client count assertion was corrected to
  test the two fixture clients rather than incorrectly assuming no catalogue
  client exists.
- All local servers, scripts, data, and the disposable container were removed.

The production gate is still owner-executed: securely view and download the
first real October DRAFT and prove its report row is unchanged. It remains
`DRAFT`; no report action is performed.

## Live activation record (owner-executed; do not activate during build)

| Check | Record when available |
| --- | --- |
| Live workflow identity/revision | Confirm the monthly-draft workflow and dedicated private PDF-retrieval endpoint; record opaque workflow revision only. |
| PDF source | Confirm private R2 storage and that n8n can reload by `reportKey`; do not record R2 object keys/URLs. |
| Retrieval controls | Confirm signature expiry, one-use nonce rejection, allowed-state check, and generic safe failures. |
| Browser boundary | Confirm no provider/n8n URL, ID, credential, raw error, or PDF bytes appears in JSON, HTML source, logs, or browser network requests other than the same-origin streamed response. |
| State trap | Record before/after safe row fingerprint for one real DRAFT preview and download; all fields must match. |
| Gate | Owner explicitly approves only after the real DRAFT PDF is viewed securely and unchanged-state evidence is recorded. |

## Remaining live prerequisites

1. Import the relay inactive and link the three credentials/settings described
   in `infra/n8n/workflows/README.md`; confirm the live Data Table matches the
   verified `reportMonth` + `MONTHLY_MAINTENANCE` lookup.
2. Provision matching relay secrets in protected n8n, operations-web, and
   platform-api environments, deploy migration 0010 and both applications,
   then activate only after a manual synthetic/controlled check.
3. Is a view/download audit event desired now? The Phase 0 text calls for one,
   but the existing `report_events` enum models authoritative state transitions
   only. Adding a new read-audit record type/table must be separately designed
   and approved; it is not included in this no-migration Phase 9 design.

## Explicitly not done

- No production database change, credential, deployment, push, or live
  activation was performed in the local build.
- No report-state mutation, command, action audit insertion, notification,
  ticket, email, regeneration, upload, provider link, or public PDF URL.
- No real report or client data used for construction tests.
