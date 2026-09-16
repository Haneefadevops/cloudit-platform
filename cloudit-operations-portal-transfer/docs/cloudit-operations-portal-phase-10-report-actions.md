# CloudIT Operations Portal — Phase 10 design: guarded report actions

Date: 16 September 2026  
Status: **DESIGN ONLY — awaiting owner approval; no implementation or production mutation**

## Purpose and boundary

Phase 10 adds owner-only commands for an authoritative n8n monthly-report
workflow without making the portal a report-state writer or delivery agent.
The only commands are:

| Command | Precondition at request and n8n execution | Authoritative effect |
| --- | --- | --- |
| `APPROVE_AND_SEND` | unsent `DRAFT`, matching row version, complete private-PDF metadata | `DRAFT → APPROVED` only; the existing sender later alone claims `APPROVED → SENDING` and delivers |
| `REJECT` | unsent `DRAFT`, matching row version | `DRAFT → REJECTED`; optional safe reason, 300 characters maximum |
| `RETRY_SEND` | `SEND_FAILED`, matching row version, explicit second confirmation | guarded return to `APPROVED`; the existing sender performs the only delivery claim |

There is no portal regenerate, force-send, arbitrary recipient editing, state
editing, reset of `SENT`, direct Data Table write, direct database report-state
write, or action through a GET/view/download path. `SENT` always requires the
existing sender to record a real `sentAt`, and is terminal.

## Preflight record and authoritative workflow inventory

The repository/export evidence establishes the following current intended
workflow behavior. The active production definitions must be exported
read-only and compared node-by-node before implementation; the four current
source exports are not present in this worktree, so this document deliberately
does not claim they are identical to live n8n.

| Workflow | Current documented/exported behavior relevant to Phase 10 |
| --- | --- |
| `Cavetta - Monthly Maintenance Report Draft` | Runs at 09:00 Europe/Malta with the first-weekday rule; consumes seven authoritative snapshots, creates an unsent `DRAFT`, renders the branded PDF, and stores private R2 metadata. The current R2 path is `Cavetta Maintenance Reports/<year>/<pdfFileName>` via `Cavetta R2 Reports`. |
| `Cavetta - Monthly Report Review` | Authenticated n8n Form POST. Reloads the report; only an unsent `DRAFT` may be approved or rejected. Approval requires complete private PDF metadata and records `approvedAt`; rejection records `rejectedAt` and an optional bounded safe reason. Duplicate submissions make no change. |
| `Cavetta - Approved Monthly Report Sender` | Runs every five minutes. It alone atomically claims an unsent `APPROVED` row to `SENDING`, records `sendingStartedAt` and increments attempts, downloads the private R2 PDF, then marks `SENT` with `sentAt` or `SEND_FAILED` with a fixed safe failure category. Its stale-`SENDING` recovery remains unchanged. |
| `Cavetta - Monthly Report Review Reminder` | Sends one internal reminder only after 48 hours for an unsent `DRAFT`; it is not a delivery path. |
| `CloudIT - Monthly Report Evidence Publisher` | Publishes sanitized state/version/PDF-availability summaries into the operations database; it must continue to reconcile command outcomes after a state change. |
| `CloudIT - Private Report PDF Relay` | Private server-to-server R2 relay only. It validates PDF-retrieval HMAC and one-use nonce, then reads and streams a PDF. It has no report-action or Data Table update node. |
| `CloudIT - Recover Legacy Report PDF to R2` | One-time recovery workflow only. It must remain archived/deleted, inactive, and unscheduled. It is never part of Phase 10. |

The documented current report Data Table is
`cavetta_monthly_maintenance_reports`; legacy `pdfDriveFileId` denotes the
private R2 object key and must never leave n8n. The August 2026 row remains a
real `DRAFT` with `NO_DATA` snapshot evidence and is not Phase 10 test data.

### Required read-only live comparison before implementation

Obtain current exports and capture only safe evidence for the draft, review,
sender, Phase 9 publisher and PDF relay workflows. Compare: active/published
state and revision; webhook authentication; Data Table query/update match
conditions; exact state guards; R2 metadata checks; sender claim fields;
recipient source; error mapping; schedules; and all branches/calls. Record
differences before proposing any workflow mutation. Confirm the recovery
workflow remains archived. The Phase 9 DRAFT preview/download unchanged-state
check must be referenced from recorded evidence rather than repeated without
owner approval.

## Existing pieces to reuse and gaps to close

| Reuse | Verified role | Phase 10 completion gap |
| --- | --- | --- |
| `operations.reports` | sanitized mirror, `row_version`, PDF availability, state and immutable mirror handling for `SENT`/`sent_at` | action eligibility must be reloaded under owner/client scope immediately before command creation and again in n8n. |
| `operations.report_commands` | command type, expected version/state, nonce, expiry, requester, status and safe result-code fields with unique command and nonce keys | no atomic dispatch-claim, acknowledgement/completion protocol, fixed result-code constraint, expiry sweep, or safe rejection-reason representation is present. |
| `operations_private.create_report_command(...)` | owner-context and mirrored state/version/nonce guard; portal has no direct insert grant | it does not enforce per-command PDF/sent eligibility, expiry range, requested-by membership, idempotent client request key, or command-specific validation. |
| `operations.audit_events` and `record_audit_event(...)` | append-only safe audit channel | command lifecycle event/action/result allowlists and correlation uniqueness need a narrow private writer. |
| RLS/grants | `operations_owner` has read-only access to reports/commands/audit; private security-definer functions are the write route | retain this: no portal role gets report-state write access. The command service must set trusted owner/user GUCs per transaction. |
| Phase 9 PDF relay | same-origin server route, private token, HMAC, nonce claim and no-store stream validation | use separate command endpoint, Header Auth token and HMAC secret. Never reuse a PDF relay secret/token. |
| web login/TOTP | TOTP verification is implemented; runtime config fails invalid required TOTP configuration | sessions contain no MFA verification timestamp and the deployed setting is documented as `OPERATIONS_MFA_REQUIRED=false`; therefore controls remain absent until MFA is enabled and action freshness is implemented and tested. |

The anticipated smallest additive database work is migration `0011` only after
the live/schema audit confirms it: constrained command lifecycle columns or a
separate append-only command-event ledger; a nonce hash rather than a plaintext
nonce where compatible with the signed protocol; private functions to create,
claim, acknowledge, complete and expire commands; and closed safe-code
constraints. Old migrations are not edited.

## Trust boundaries and canonical command

```text
Browser --same-origin POST, CSRF, recent MFA--> operations-web
  --internal authenticated request--> platform-api / operations DB
  --dedicated Header Auth + HMAC command POST--> inactive n8n command webhook
  --CAS guarded action--> authoritative n8n Data Table / existing review+sender
  --sanitized acknowledgement/reconciliation--> operations DB --> portal display
```

The browser supplies only a report key, selected command, a server-rendered
single-use confirmation token, and (for rejection) bounded text. It never
supplies a client ID, actor, row version, recipient address, nonce, expiry,
signature, correlation ID, command key, or result code.

Platform API reloads the mirror under the trusted session/client scope and
creates all protocol identifiers. The n8n webhook authenticates separately,
verifies the HMAC over exactly one UTF-8 canonical payload, then atomically
claims its command before reloading the authoritative Data Table row. n8n
remains the sole integration and status-transition authority.

Proposed canonical payload — newline-delimited, UTF-8, no optional fields:

```text
v1
commandKey
commandType
reportKey
clientKey
expectedRowVersion
expectedState
nonce
issuedAtEpochSeconds
expiresAtEpochSeconds
correlationId
recipientPolicyKey
reasonDigestOrDash
```

The HMAC is SHA-256 over those exact bytes. `reasonDigestOrDash` is a SHA-256
digest of the final normalized rejection reason, not the reason itself. The
reason itself is held only where the existing authoritative review action
requires it and is never echoed to browser/API/audit responses. Recipient
policy is a fixed server-side allowlist identity such as `cavetta-monthly-report`;
its mapping to an address lives only in the existing protected n8n configuration.

## Command lifecycle and idempotency

| Command status | Who may transition it | Meaning/result |
| --- | --- | --- |
| `pending` | private create function | eligible request durably recorded with expiry and an idempotency key bound to actor/report/action/version |
| `dispatched` | atomic private dispatch claim | exactly one server dispatch owns the signed delivery attempt |
| `claimed` | authenticated n8n webhook | nonce/expiry/signature verified and replay ledger claimed |
| `acknowledged` | n8n | authoritative action accepted but sender outcome remains asynchronous |
| `completed` | reconciler/n8n with compare-and-set | final safe outcome, including observed `SENT` or `SEND_FAILED` |
| terminal denial/expiry | private function | `rejected_replay`, `rejected_expired`, `rejected_stale_version`, `rejected_state`, `failed_safe`; no report mutation |

Creation is idempotent for a bounded browser idempotency key coupled to the
trusted actor, command type, report and expected version. A repeated submit
returns the same safe command representation; it never signs another command.
The command webhook has an independent one-use nonce claim. A network timeout
does not permit a new command: the portal polls/reloads safe command status.

`APPROVE_AND_SEND` completes at `APPROVED` acknowledgement, then reconciles
to `SENDING`, `SENT`, or `SEND_FAILED` exclusively from the authoritative
summary publisher. `RETRY_SEND` similarly only authorizes the existing sender
path; it cannot call SMTP or change `SENDING` directly. A scheduled command
expiry sweep marks only unclaimed expired commands and records a safe audit
entry. It never changes a report.

## Browser security and confirmation UX

Action controls are rendered only if all server-side conditions hold:

1. authenticated `cloud_owner` session and active client membership;
2. valid action configuration, dedicated command credentials, and enabled MFA;
3. a TOTP-backed MFA proof no older than the approved action-freshness window;
4. report eligibility returned by a new safe server-side eligibility projection.

Every route is POST-only, same-origin and checks exact `Origin` against
`OPERATIONS_PUBLIC_ORIGIN`; absent/mismatched `Origin` and cross-site fetch
metadata are denied. Use a per-session CSRF secret, constant-time comparison,
strict SameSite/secure/HTTP-only cookies, bounded body size, per-user and
per-IP rate limits, and a short confirmation expiry. Confirmation must show
client display identity, month, current state, selected action, and for a send
path the fixed recipient policy identity (not an address). Retry needs a second
explicit acknowledgement that it may send once. Reject text is Unicode-normalized,
trimmed, control-character stripped, sanitized, limited to 300 characters, and
is optional.

The UI disables repeat submission, presents only safe pending/acknowledged/final
states, and provides a refreshable append-only command history. Accessible
dialogs must identify the target in text, preserve keyboard focus, provide a
visible cancellation action, and work on mobile. Read/PDF routes stay GET-only
and contain no action parser or writer.

## n8n command workflow design

Export a new inactive `CloudIT - Guarded Report Command` workflow. Its straight
path is:

1. dedicated Header Auth webhook;
2. strict JSON shape/size validation and canonical HMAC, expiry and nonce checks;
3. internal API atomic command claim (never trust payload alone);
4. reload authoritative monthly-report Data Table row by fixed report identity;
5. exact client, version, unsent/state and private-PDF guards;
6. invoke/reuse the protected review behavior for approve/reject or use the
   narrowly audited retry-to-`APPROVED` guard; it must not call SMTP;
7. publish safe acknowledgement and request sanitized summary reconciliation;
8. respond with only command key, safe status and allowlisted result code.

The workflow has no PDF generation/upload/recovery branch, no arbitrary Data
Table update mapping, no recipient field from request input, no email node, and
no connection to the legacy recovery workflow. It must preserve the existing
sender's atomic `APPROVED`/blank-`sentAt` claim, stale-SENDING recovery and safe
failure classification.

## Audit and safe results

Each request/dispatch/claim/acknowledgement/completion/denial writes one
append-only audit entry with opaque actor key, report key, command key,
correlation ID, action, time and a closed code. Proposed exposed codes are:

`accepted`, `already_recorded`, `dispatch_pending`, `acknowledged`, `sent`,
`send_failed`, `rejected_auth`, `rejected_csrf`, `rejected_mfa`,
`rejected_rate_limit`, `rejected_replay`, `rejected_expired`,
`rejected_stale_version`, `rejected_state`, `rejected_pdf_unavailable`,
`rejected_recipient_policy`, `failed_safe`.

No audit, command row, response or log may contain an email address, report
body, reason text, provider response, SMTP/R2/n8n payload, token, secret,
stack trace, object key, filename or URL.

## Acceptance, rollback and cleanup

Before implementation: owner approves this design; supplies/export-confirms the
live workflow comparison; enables and acceptance-tests TOTP plus action
freshness; approves a dedicated command secret/Header Auth credential; and
approves exact non-real test report, controlled recipient/sink or non-delivery
transport, maintenance window and cleanup plan.

Local acceptance covers fresh and idempotent PostgreSQL 16 migration runs, the
full isolation suite, API Jest/build, web typecheck/lint/build, and a semantic
command harness for authentication, CSRF, fresh MFA, origin, tamper, replay,
expiry, wrong state, stale version, already-sent, duplicate request, tenant
isolation, PDF absence, state transitions, safe audit and mutation-free read/PDF
paths.

Production acceptance is separately approved and uses one unmistakable non-real
row only. It must demonstrate exactly one controlled delivery (or approved
non-delivery transport), all denials without report mutation, safe history and
complete cleanup of the row, PDF/object, command/audit test data, workflow pins,
mocks and temporary configuration. Rollback deactivates the new command
workflow, hides controls by failing configuration closed, and leaves the
existing draft/review/sender/relay workflows and real reports untouched.

## Decisions required from the owner

1. Approve the lifecycle, canonical payload, recipient-policy model and closed
   result-code list above.
2. Provide read-only current workflow exports or authorize their inspection;
   identify any live/export divergence before construction.
3. Approve TOTP activation and the exact recent-MFA interval before controls
   are exposed.
4. Approve the dedicated command HMAC secret and Header Auth credential setup
   (values remain protected and are never recorded here).
5. Approve the controlled non-real test delivery/sink, time window and exact
   cleanup evidence. No real report is in scope.

---

## Implementation record (design approved 2026-09-16; construction in progress)

Decisions taken during construction, consistent with the approved design;
recorded here so the implementation can be audited against intent.

1. **Command statuses** use the approved lifecycle
   (`pending → dispatched → claimed → acknowledged → completed`, plus safe
   terminal denials). Migration 0011 recreates the Phase 0 status CHECK as a
   superset that also retains the never-emitted legacy values `signed`/`sent`
   so the constraint recreation is valid on any pre-existing rows.
2. **Nonce at rest**: only the SHA-256 hex of the wire nonce is stored (the
   `nonce` column holds the hash). Consequently an unclaimed command cannot
   be re-dispatched byte-identically; if n8n is unreachable the command stays
   `dispatched`/`dispatch_pending` until claimed or lazily expired, and the
   owner re-confirms (a fresh nonce and command). Exactly-once protections
   are unaffected because the claim is a one-use atomic CAS.
3. **Reconciliation is lazy in platform-api**: command-history reads and
   command creation run `operations_private.reconcile_report_commands(100)`
   first (expire in-flight expired commands; complete `acknowledged`
   commands whose mirror shows SENT/SEND_FAILED). The mirror only changes
   through the authoritative evidence publisher, so n8n remains the
   state authority; no publisher workflow mutation is required.
4. **Step-up MFA**: the session keeps its existing shape (no MFA timestamp).
   Instead, every action confirmation requires a fresh TOTP code verified
   server-side at submit time (`verifyTotp`, ±1 step window), which is
   strictly fresher than any session stamp. Action routes and UI fail closed
   while `OPERATIONS_MFA_REQUIRED=false`.
5. **Idempotency**: `request_key` = HMAC(server secret, actor|report|action|
   render nonce), generated per server render; a bounded unique index on
   (client, actor, action, report, request_key) makes double-clicks and
   retries return the originally recorded command (`already_recorded`)
   without a second command. Denials never create rows but always persist
   audit entries (the new functions return denial codes instead of raising).
6. **Browser-facing denials return HTTP 200 with a closed `denialCode`**
   because the module exception filter deliberately replaces exception
   messages with generic strings; business outcomes are data, not errors
   (same pattern as ingest `submit_batch`).
7. **RETRY_SEND** authorises only the existing sender path: the command
   workflow performs a CAS `SEND_FAILED → APPROVED` on the authoritative
   Data Table (filters include the current state; `sentAt` must be empty)
   and never touches SMTP, `sentAt`, or attempt counters; the sender's own
   atomic claim and stale-SENDING recovery remain the only delivery path.
8. **Recipient policy**: canonical `recipientPolicyKey` is
   `cavetta-monthly-report` for APPROVE_AND_SEND/RETRY_SEND and `-` for
   REJECT; the address mapping stays only in protected n8n configuration.
9. **Migration 0011** (`0011_report_command_lifecycle.sql`) is the only
   database change: additive columns/closed constraints, the request-key
   unique index, and seven `operations_private` functions
   (record_report_command_event, create_report_command_request,
   dispatch_report_command, claim_report_command,
   acknowledge_report_command, complete_report_command,
   reconcile_report_commands). Verified: fresh apply and idempotent rerun in
   a disposable PostgreSQL 16.14 container; isolation suite 123/123
   (93 pre-existing + 30 new Phase 10 assertions covering tenant isolation,
   append-only closed-code audit, duplicate-request idempotency, replay,
   expiry, stale-version, wrong-state, tenant-mismatch, PDF-absence and
   already-sent denials, SENT-requires-real-sent_at, and the structural
   absence of any portal report-state write path).

## Local acceptance (2026-09-16, all green)

- **platform-api**: full Jest 133/133 (7 suites; 31 new command-payload util
  tests + 12 new command service tests incl. signature re-verification and
  wire-nonce-never-persisted assertions); production `nest build` passes.
- **operations-web**: `tsc --noEmit` clean, `next lint` clean, production
  build passes with `/reports/[reportKey]/command` and `/commands` as
  dynamic routes; middleware and the Phase 9 PDF route carry zero diff
  (read/view/download paths remain structurally mutation-free).
- **Database**: migrations 0001–0011 applied fresh and re-applied
  idempotently in a disposable PostgreSQL 16.14 container; operations
  isolation suite 123/123; disposable container removed afterwards.
- **Command protocol**: n8n semantic harness 26/26 (7 structural + 9
  signature/tamper/expiry/shape cases + 10 authoritative-row guard cases);
  DB-level replay/expiry/stale/wrong-state/tenant/duplicate/state-transition
  denials covered by the isolation suite; CSRF, strict-Origin, step-up TOTP
  and rate limiting are enforced in the operations-web POST route (order:
  session → fail-closed MFA gate → rate limit → Origin → bounded body →
  CSRF HMAC → TOTP → command validation → relay) and are verified by
  typecheck/build/code review — the app has no JS test runner, matching the
  project's Phase 9 web-verification convention.
- **Hygiene**: no secrets, tokens, recipient addresses, row versions, nonces
  or signatures reach the browser bundle or HTML; no new runtime
  dependencies; `.env` scratch file and the workflow generator under
  `.scratch/` are gitignored; nothing committed.

## Production deployment record (2026-09-16)

- **Commit**: `0afccde` (`feat(operations): add phase 10 guarded report actions`),
  pushed to `master` and deployed via GitHub Actions.
- **Migration**: `0011_report_command_lifecycle.sql` applied automatically by
  `deploy.sh`; the owner re-ran
  `bash infra/scripts/ensure-operations-database.sh` on the server and confirmed
  idempotent re-application (`already exists, skipping` on every object, final
  line `OK: 4 roles, 26 tables, Cavetta catalogue seeded`).
- **Portal**: `https://operations.cloudit.lk/reports` shows the intended
  fail-closed state — "Report actions are locked: owner MFA (TOTP) is not
  enabled." banner, no action buttons, August/July DRAFT cards with
  Preview/Download PDF intact.
- **n8n**: `CloudIT - Guarded Report Command` imported **inactive** with
  credentials linked (webhook Header Auth `CloudIT Report Command`; four HTTP
  nodes on `CloudIT Operations Internal API`).
- **Owner decision**: the owner explicitly declined TOTP for now. Login stays
  email+password, `OPERATIONS_MFA_REQUIRED=false`, the action controls stay
  hidden, and the command workflow stays inactive. This is the intended parked
  state — every action path fails closed with `MFA_NOT_ENABLED`, so no report
  command can be issued from the portal until TOTP is configured.
- **Deferred**: kickoff step 7 (controlled non-real production acceptance)
  cannot run without MFA and is parked, not failed. To unlock later: configure
  TOTP, set `OPERATIONS_MFA_REQUIRED=true`, activate the command workflow in
  n8n, then run the controlled non-real lifecycle test with the owner's
  approval. A real report may be approved/rejected/sent only with a separate
  explicit authorization. No real report was touched during construction.
