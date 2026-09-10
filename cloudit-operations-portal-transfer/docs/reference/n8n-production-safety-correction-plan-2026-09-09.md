# Cavetta n8n Production-Safety Correction Plan

Status: **PROPOSED - planning only; no correction authorized or applied**

Date: 9 September 2026

## Purpose

Complete a separate, production-safe correction batch for the existing Cavetta
n8n maintenance automation before CloudIT Operations Portal Phase 1 begins.

This batch addresses seven findings in the latest workflow exports under `n8n/`.
It does not build portal code, schemas, UI, DNS, credentials or deployments.

Every phase below is a hard gate. Work must stop after each phase for owner review
and explicit approval before the next phase starts.

## Non-negotiable safety boundaries

- Do not approve, reject, regenerate, retry or send a real report.
- Do not execute the real SMTP, Google Drive upload or PDF-generation path.
- Do not restore or decrypt a production backup.
- Do not change backup workflows.
- Keep `ticketing_enabled=false` and keep ticketing/client incident notification
  disabled.
- Preserve the complete DRAFT, APPROVED, SENDING, SENT, REJECTED and SEND_FAILED
  lifecycle.
- Preserve `sentAt` as the duplicate-send guard.
- Preserve the DRAFT-only PDF replacement guard.
- Never expose credentials, tokens, passwords, webhook secrets, database URLs,
  email bodies, personal/client data, raw provider errors or stack traces.
- Do not create temporary nodes, workflows, connections, rows, mocks or pinned
  data until their exact test and cleanup steps have been approved.
- Remove every approved temporary test item before publication.
- Do not publish a corrected workflow until its controlled tests pass.
- Use the n8n visual editor one node or one small change at a time and capture the
  relevant node output or screenshot after every step.
- Do not begin CloudIT Operations Portal Phase 1 in this batch.

## Read-only export verification

The ten supplied workflow exports parse as JSON, report `active=true`, contain no
pinned data, and contain no disabled nodes. The following findings are present in
the saved exports and still require live-editor verification:

| Finding | Export evidence | Severity |
| --- | --- | --- |
| Stale recovery syntax | `Identify Stale Sending Reports` begins with an incomplete `const cutoffTime = const config =` fragment and redeclares `cutoffTime` | Critical |
| Destructive sender mappings | Claim/failure/stale updates map existing evidence counters to literal zero; claim also maps `reportMonth` to `=` | High |
| Raw SMTP/provider diagnostic storage | `Mark Monthly Report Send Failed` truncates an untrusted provider message to 500 characters instead of using a closed safe classification | High |
| Attempt-count type mismatch | Embedded Data Table schema describes `sendAttemptCount` as String while the claim performs numeric addition | Medium |
| Watchdog snapshot keys | Watchdog expects `INCIDENTS` and `GA4` instead of authoritative `INCIDENTS_RECOVERIES` and `GA4_ANALYTICS` | High before October 2026 |
| Working-day behavior | `Prepare Monthly Report Period` handles Saturday/Sunday only and contains no Malta holiday calendar | Medium |
| Required configuration | `monthly_report_review_form_url` is used by dependent workflows but absent from `Normalize Maintenance Configuration` required keys | Low |

These findings must not be treated as proof of the live published configuration.
Phase 1 performs the live comparison.

## Authoritative monthly snapshot keys

The correction must use exactly:

1. `WEEKLY_HEALTH`
2. `INCIDENTS_RECOVERIES`
3. `BACKUP_RESTORE`
4. `GA4_ANALYTICS`
5. `VERCEL_WEB_ANALYTICS`
6. `SUPABASE_INFRASTRUCTURE`
7. `IMAGEKIT_USAGE`

The watchdog must continue requiring exactly one snapshot per key and must never
approve, regenerate or send a report.

## Phase gates

| Phase | Work | Required stop gate |
| --- | --- | --- |
| 1 | Verify all seven findings in the live visual editor | Owner confirms live/export comparison |
| 2 | Freeze exact correction, rollback, test and cleanup specifications | Owner approves all mutations and temporary evidence |
| 3 | Correct sender code and non-destructive mappings in unpublished draft | Review node-by-node diff; no publication |
| 4 | Resolve `sendAttemptCount` type safely | Owner separately approves conversion after read-only audit |
| 5 | Correct watchdog keys and configuration validation | Review isolated code outputs; no publication |
| 6 | Resolve working-day documentation mismatch | Owner accepts weekend-only behavior for October |
| 7 | Run isolated sender and watchdog acceptance tests | Owner reviews results and complete cleanup proof |
| 8 | Publish only corrected workflows and observe production-safe runs | Owner accepts live evidence |
| 9 | Re-export, validate and update handover documents | Present final evidence and stop |

## Phase 1 - Live visual-editor verification

Open and inspect only the following live nodes/settings. Do not edit or execute:

### Approved Monthly Report Sender

- `Identify Stale Sending Reports`
- `Claim Report for Sending`
- `Mark Monthly Report Send Failed`
- `Mark Stale Sending Report Failed`
- The Data Table schema/type displayed for `sendAttemptCount`
- Current connections from Google Drive and SMTP error outputs
- Current published/saved revision state

Confirm whether:

- The stale-recovery JavaScript matches the malformed export.
- Claim matches `reportMonth` and `documentStatus=APPROVED` and whether it also
  atomically requires an empty `sentAt`.
- Any state-transition node maps unrelated report/evidence columns.
- Failure storage can retain any raw provider diagnostic.
- Current real rows include any APPROVED or SENDING report. Display only row ID,
  report month, document status, `sendAttemptCount`, `sendingStartedAt` and whether
  `sentAt` is present; do not display report contents or recipient information.

### Automation Watchdog

- `Evaluate Automation Watchdog`
- Confirm the exact seven keys used in the monthly snapshot block.
- Confirm the October activation/deadline guard remains intact.

### Load Maintenance Configuration

- `Normalize Maintenance Configuration`
- Confirm `monthly_report_review_form_url` is absent from the required-key list.
- Confirm the active non-secret configuration row exists without printing its
  value.

### Monthly Maintenance Report Draft

- `Prepare Monthly Report Period`
- Confirm weekend-only behavior and absence of a holiday source.

**Stop:** Present a live/export comparison table. No Phase 2 work without owner
approval.

## Phase 2 - Exact correction, rollback, test and cleanup specification

Before any edit or temporary evidence, provide:

- Exact node names, types, fields, mappings, expressions and connections.
- Complete replacement JavaScript for each Code node.
- Screenshots or exported before-state for every node to be changed.
- A file hash/copy of the latest JSON exports for rollback.
- Exact Data Table rows/mocks/pins needed for testing.
- Exact cleanup order and proof required before publication.
- A short sender maintenance-window plan if live scheduling must be paused.

No credentials or report contents may appear in the plan or screenshots.

**Stop:** The owner explicitly approves the full mutation, test and cleanup plan.

## Phase 3 - Sender safety corrections in an unpublished draft

Make one visual-editor change at a time and inspect it before continuing.

### 3.1 Correct stale recovery parsing and eligibility

Replace only `Identify Stale Sending Reports` JavaScript so it:

- Reads `stale_sending_minutes` from `Cavetta - Load Maintenance Configuration`.
- Rejects a missing, non-numeric or non-positive configured value.
- Ignores empty placeholder items.
- Selects only `documentStatus === 'SENDING'`.
- Ignores missing or invalid `sendingStartedAt`.
- Selects only rows at or older than the calculated cutoff.
- Emits the original row plus `documentStatus='SEND_FAILED'` and one fixed,
  sanitized recovery message based only on the validated configured duration.
- Does not alter any other field.

Run a syntax-only/manual Code-node test after the exact test inputs are approved.

### 3.2 Make claim compare-and-set and non-destructive

`Claim Report for Sending` must:

- Match the intended `reportMonth` expression.
- Require `documentStatus=APPROVED`.
- Require the report to be unsent using the live Data Table node's supported empty
  value comparison for `sentAt`.
- Update only `documentStatus`, `sendingStartedAt` and `sendAttemptCount`.
- Never rewrite `reportMonth`, `approvedAt`, report metrics, PDF metadata,
  snapshots or any unrelated field.

The existing sender alone remains responsible for the APPROVED-to-SENDING claim.

### 3.3 Make failed-send storage a closed classification

Replace raw-message truncation with a closed allowlist that can store only one of:

- `SMTP authentication failed`
- `SMTP connection failed`
- `SMTP timeout`
- `SMTP provider rejected delivery`
- `PDF download failed`
- `Unknown sanitized delivery failure`

The classifier may inspect an error in memory but must emit/store only the fixed
safe value. It must never output or store the raw provider message, recipient,
server response, credential detail, stack or request data.

Whether this is implemented as a minimal permanent Code node or a closed Data
Table expression will be decided in Phase 2 after the live connections and n8n
item-linking behavior are verified.

`Mark Monthly Report Send Failed` must update only `documentStatus=SEND_FAILED`
and the approved safe `lastSendError` value while matching the intended SENDING
report.

### 3.4 Make stale failure update non-destructive

`Mark Stale Sending Report Failed` must match only the row emitted by the stale
selector and update only `documentStatus` and sanitized `lastSendError`.

**Stop:** Review every changed node and an unpublished workflow export/diff. Do
not publish.

## Phase 4 - `sendAttemptCount` read-only audit and conversion gate

This phase has a separate approval because a column-type change can affect stored
values.

### Read-only audit

- Inspect only Data Table row ID, report month, document status and
  `sendAttemptCount`.
- Classify each existing value as empty, zero, or a non-negative integer string.
- Stop if any value is negative, fractional, non-numeric or outside the safe
  integer range.
- Confirm the live column type and n8n's displayed conversion behavior.

### Proposed safest conversion

1. Export a private local rollback copy of the affected row IDs and attempt-count
   values only. Do not commit it, paste it into chat or retain it after acceptance.
2. Confirm no real APPROVED or SENDING report is active.
3. Pause the sender only during the separately approved maintenance window if the
   live UI cannot guarantee an atomic schema change.
4. Convert `sendAttemptCount` to Number using the supported Data Table operation.
5. Verify every value equals its pre-conversion numeric value.
6. Verify the claim expression produces a Number and increments exactly once.
7. Resume/publish only after the sender tests pass.

### Rollback

- If conversion or validation fails, stop immediately.
- Restore the original String type only through the supported Data Table UI.
- Restore only the captured attempt-count values by exact row ID.
- Do not change report state, timestamps, metrics, PDF metadata or `sentAt`.
- Re-verify every restored value, then securely remove the local rollback copy.

No type change occurs until the owner approves the audit result and exact live
conversion behavior.

**Stop:** Owner approves or rejects the conversion. If rejected, retain String
storage and use an explicitly string-safe increment while documenting the schema.

## Phase 5 - Watchdog keys and configuration validation

### 5.1 Watchdog snapshot contract

In `Evaluate Automation Watchdog`, replace only the two incorrect key literals:

- `INCIDENTS` -> `INCIDENTS_RECOVERIES`
- `GA4` -> `GA4_ANALYTICS`

Do not change the October gate, exactly-seven requirement, report logic, alerts,
ticketing or any unrelated watchdog behavior.

### 5.2 Required configuration

After confirming the active non-secret row exists, add only
`monthly_report_review_form_url` to `Normalize Maintenance Configuration`'s
required-key list. Never display or print the URL.

**Stop:** Review isolated Code-node results and saved unpublished definitions.

## Phase 6 - Working-day documentation correction

Recommended minimal October-safe decision:

- Keep the current Saturday/Sunday-only behavior.
- Correct documentation that currently implies configured Malta public holidays.
- Explicitly call the behavior `first weekday`, not `first working day`, until a
  separately approved non-secret holiday configuration exists.
- Do not add a holiday API, credential, table or integration in this batch.

This avoids introducing a new calendar dependency immediately before the first
authoritative October cycle.

**Stop:** Owner confirms weekend-only behavior and documentation wording.

## Phase 7 - Isolated acceptance and cleanup

No temporary evidence is allowed before Phase 2 approval. The following is the
proposed controlled approach.

### Preconditions

- Confirm there is no real APPROVED or SENDING report.
- Keep all real reports unchanged.
- If required, unpublish/pause only the sender for a short approved maintenance
  window so its five-minute trigger cannot race test SENDING rows.
- Never run the SMTP, Drive download/upload, PDF generation, report review,
  backup, restore, notification or ticket branches.
- Use unmistakable far-future report months and a non-real test report type.

### Temporary report cases

Create only the minimum approved rows needed to represent:

1. A non-SENDING row.
2. A recent SENDING row.
3. An old SENDING row.
4. A SENT row with `sentAt` present.
5. An inconsistent APPROVED row with `sentAt` present to prove the atomic unsent
   claim guard.
6. One unsent APPROVED row for the claim-and-preservation test.

Every row will contain distinctive sentinel values in the safe report-count,
PDF-metadata, snapshot, approval and delivery fields so preservation can be
compared exactly. Use no real recipient, PDF, Drive object or report content.

### Sender tests

- Execute only the relevant Code/Data Table node or approved isolated path.
- Prove the non-SENDING row is ignored.
- Prove the recent SENDING row is ignored.
- Prove only the old SENDING row becomes SEND_FAILED.
- Prove repeated stale recovery returns no eligible row and makes no further
  change.
- Prove the unsent APPROVED row is claimed once and all unrelated sentinel fields
  remain byte-for-byte/equivalent unchanged.
- Prove SENT and APPROVED-with-`sentAt` rows are never selected or changed.
- Feed approved synthetic error strings to the sanitizer without contacting a
  provider and prove output is exactly one allowed fixed category.
- Prove a sanitized failure update preserves every unrelated sentinel field.

### Watchdog tests

- In the unpublished draft only, use approved temporary pinned input and a
  temporary fixed post-October clock value so the real October guard can be
  exercised before October.
- Supply exactly one snapshot for each authoritative key and verify no missing-key
  finding.
- Remove one authoritative key and verify exactly that key is reported missing.
- Restore `const now = new Date()` exactly, remove every pin/mock and compare the
  final node with the approved correction before publication.
- Execute only the evaluator; do not execute the summary upsert during this
  synthetic contract test.

### Required preservation comparison

Before and after values must be compared for:

- `reportMonth`
- Health, incident, backup and analytics results/counts
- Vercel, GA4, Supabase and ImageKit metrics
- PDF filename, Drive file ID/URL and generated timestamp
- `sourceSnapshotsJson` and infrastructure overview
- Approval/rejection/review timestamps
- `sentAt`

### Cleanup order

1. Remove all pinned/mock data and any temporary fixed clock.
2. Remove any approved temporary node or connection.
3. Delete only the far-future test rows by exact row ID.
4. Verify all real report rows retain their pre-test states and protected fields.
5. Verify no test record exists in report, watchdog or execution-evidence tables.
6. Verify the sender has no test item queued as APPROVED or SENDING.
7. Re-enable/resume the sender only after cleanup and final node review.
8. Re-export the cleaned unpublished definitions and scan for test markers.

**Stop:** Present outputs, before/after preservation comparison and cleanup proof.
No publication without owner approval.

## Phase 8 - Controlled publication and observation

Publish only the workflows whose accepted definitions changed:

- `Cavetta - Approved Monthly Report Sender`
- `Cavetta - Automation Watchdog`
- `Cavetta - Load Maintenance Configuration`

The Monthly Maintenance Report Draft does not require publication if only its
documentation is corrected and weekend-only code remains unchanged.

After publication:

- Run/observe the configuration loader without exposing the review URL.
- Observe a normal sender schedule with zero eligible APPROVED/SENDING reports;
  no SMTP or Drive branch should run.
- Observe a normal watchdog schedule and verify its summary upsert.
- Confirm `ticketing_enabled=false` and no client notification/ticket path exists.
- Do not create another real or synthetic report action.

**Stop:** Owner reviews production-safe execution evidence.

## Phase 9 - Export, syntax scan and documentation

After successful publication:

1. Re-export the corrected workflow JSON files.
2. Replace only their corresponding files under `n8n/`.
3. Parse every JSON export.
4. Extract and syntax-check every Code node.
5. Confirm no pinned data, disabled safety guard, temporary connection, test row,
   temporary endpoint, mock value or credential value exists.
6. Confirm the authoritative seven keys agree in capture, report validation and
   watchdog definitions.
7. Update the maintenance handover and monthly report runbook with exact verified
   behavior and weekend-only wording.
8. Preserve the scheduled 1 October 2026 Phase 5E acceptance; do not approve or
   send its real report as part of this batch.

**Final stop:** Present the complete evidence and wait for explicit owner approval.
Do not begin CloudIT Operations Portal Phase 1.

## Expected workflow behavior after acceptance

- Stale recovery parses and uses validated centralized configuration.
- Only valid old SENDING rows become SEND_FAILED.
- Sender status transitions preserve all unrelated report evidence.
- Claim is atomic across month, APPROVED state and unsent state.
- SMTP/Drive failures store only a fixed safe classification.
- Attempt-count storage and increment behavior agree with the accepted schema.
- Watchdog recognizes exactly the seven authoritative snapshot keys.
- Missing snapshot evidence produces a correct finding without false positives.
- Configuration loading fails early if the review-form URL setting is absent,
  without exposing its value.
- Monthly scheduling is accurately documented as weekend-only/first-weekday.
- No real report, email, Drive operation, backup, restore, notification or ticket
  is triggered during correction or acceptance.

## First action after plan approval

Begin with Phase 1 only: inspect the specified live visual-editor nodes and return
a live/export comparison. Make no edits and stop for approval.
