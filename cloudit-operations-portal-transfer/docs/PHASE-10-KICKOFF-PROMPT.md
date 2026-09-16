# Phase 10 kickoff prompt (paste this into the new session)

Continue the CloudIT Operations Portal in `C:\Project\cloudit-platform` and
design/build **Phase 10 — guarded report actions**. Do not redo Phases 0–9.

The production portal is `https://operations.cloudit.lk`. Work only in the
existing `C:\Project\cloudit-platform\.worktrees\master-portal` worktree on
`master`; preserve the unrelated main checkout and all user changes.

## Read completely before changing anything

1. `cloudit-operations-portal-transfer/AGENTS.md`
2. `cloudit-operations-portal-transfer/README.md`
3. `cloudit-operations-portal-transfer/docs/cloudit-operations-portal-plan.md`
   — Phase 10 and all gates
4. `cloudit-operations-portal-transfer/docs/cloudit-operations-portal-phase-0-specification.md`
   — report command contract, schema, security, Phase 9/10 acceptance
5. `cloudit-operations-portal-transfer/docs/cloudit-operations-portal-phase-9-report-centre.md`
6. `cloudit-operations-portal-transfer/docs/portal-repository-handover.md`
7. `cloudit-operations-portal-transfer/docs/reference/maintenance-automation-handover.md`
8. `cloudit-operations-portal-transfer/docs/reference/monthly-maintenance-report-delivery-runbook.md`
9. `cloudit-operations-portal-transfer/docs/reference/n8n-production-safety-correction-plan-2026-09-09.md`
10. `apps/operations-web/README.md`, authentication/session code, the reports
    page and PDF route
11. `apps/platform-api/src/operations/operations.controller.ts`,
    `operations.service.ts`, `operations.config.ts`, and their tests
12. `infra/postgres/operations/migrations/0002_schema.sql`, `0003_security.sql`,
    `0005_ingest_records.sql`, and
    `0010_report_pdf_retrieval_nonces.sql`
13. Current exports of these n8n workflows before proposing any mutation:
    `Cavetta - Monthly Report Review`,
    `Cavetta - Approved Monthly Report Sender`,
    `Cavetta - Monthly Maintenance Report Draft`, and the Phase 9 evidence/PDF
    workflows.

Inspect `git status`, recent commits and the live/export differences first.
Never assume the checked-in n8n export is identical to the published workflow.

## What has already been completed — do not redo

- Phases 0–8 are complete and deployed.
- Phase 9 Read-only Report Centre is implemented and deployed:
  - sanitized `GET /api/operations/reports`;
  - `/reports` list/history/findings UI;
  - private same-origin PDF preview/download route;
  - server-to-server private n8n/R2 PDF relay;
  - HMAC signing, short expiry and atomic one-use nonce claims;
  - no R2 key, provider credential, raw report body or PDF locator reaches the
    browser/API response;
  - migration `0010_report_pdf_retrieval_nonces.sql`;
  - monthly sanitized `report_summary` publisher.
- Phase 9 tests passed before deployment:
  - operations DB migrations applied fresh and idempotently in PostgreSQL 16;
  - operations isolation suite: 93/93;
  - platform-api Jest: 89/89 and production build;
  - operations-web typecheck, lint and production build;
  - PDF signature/tamper/state/size/MIME and one-use nonce harnesses.
- Phase 9 primary commit: `ceceb71`.
- Follow-up recovery/fixes:
  - `fc052fc` added the one-time legacy PDF recovery workflow;
  - `6edcd27` corrected n8n 2.27 binary helper usage to
    `this.helpers.getBinaryDataBuffer(...)` in both PDF workflows;
  - `f524571` restored the exact original branded monthly-report HTML template
    for recovery.
- Deployment for `f524571` succeeded:
  `https://github.com/Haneefadevops/cloudit-platform/actions/runs/35059656992`.
- The real August 2026 report is still `DRAFT`. Its inaccessible Google Drive
  PDF was regenerated from its authoritative stored DRAFT content and placed in
  private R2. Preview works with the original branded format.
- August correctly remains `NO_DATA`, snapshot contract `FAIL`, 0/7 snapshots.
  The authoritative monthly snapshot workflow was introduced after the August
  boundary. Do not “repair” this by inventing historical evidence.
- The September evidence cycle is expected on 1 October 2026: snapshot capture
  at 00:00 Europe/Malta and DRAFT generation at 09:00. This is an operational
  acceptance track, not Phase 10 construction data. The real report must stay
  `DRAFT`.

## Phase 9 production configuration that must be preserved

- `OPERATIONS_REPORT_PDF_RELAY_SECRET` is the same protected value in n8n,
  platform-api and operations-web.
- `OPERATIONS_REPORT_PDF_RELAY_TOKEN` is the operations-web value used by the
  n8n Header Auth credential `CloudIT Report PDF Relay` with header
  `x-cloudit-pdf-relay-token`.
- n8n credential `CloudIT Operations Internal API` uses header
  `x-operations-internal-token` and the existing protected
  `OPERATIONS_INTERNAL_API_TOKEN`.
- n8n credential `Cavetta R2 Reports` is the restricted private R2 credential.
- Private production relay URL:
  `http://n8n:5678/webhook/cloudit-report-pdf-relay`.
- Never print, rotate, copy into source, or expose any of these values.
- The one-time workflow `CloudIT - Recover Legacy Report PDF to R2` must be
  archived/deleted after use and must never be scheduled or published.

Before Phase 10 work, verify the Phase 9 close-out without changing report
state: preview and download the DRAFT once, compare report state/version and
protected timestamps before/after, confirm no change, and confirm the recovery
workflow is archived. If this has already been recorded with sufficient
evidence, do not repeat it.

## Phase 10 objective

Add owner-only, guarded server-side report commands while keeping n8n
authoritative for report state and delivery:

- `APPROVE_AND_SEND`: only an unsent `DRAFT` with complete private PDF metadata.
  Approval may move only `DRAFT → APPROVED`; the existing sender alone claims
  `APPROVED → SENDING` and performs delivery.
- `REJECT`: only an unsent `DRAFT`; optional sanitized reason, maximum 300
  characters.
- `RETRY_SEND`: only `SEND_FAILED`, after an explicit confirmation. It must use
  the existing guarded sender path and must not bypass exactly-once protections.
- Display safe command progress and final `SENT`/`SEND_FAILED` state.
- Record a complete append-only safe audit trail.

Do not add regenerate, force-send, reset-SENT, arbitrary recipient editing,
arbitrary state editing, or a direct database report-state mutation from the
portal.

## Non-negotiable security model

1. Browser actions POST only to the operations-web same-origin server.
2. Require an authenticated owner session, CSRF protection, strict Origin/
   same-site validation, rate limiting, and recent/step-up MFA.
3. TOTP is currently documented as deferred with
   `OPERATIONS_MFA_REQUIRED=false`. **Do not expose Phase 10 action controls in
   production until TOTP is configured, enabled and acceptance-tested.** Never
   print or commit the TOTP secret.
4. Every confirmation displays client, report month, current state and intended
   action. Sending requires explicit recipient confirmation using only an
   allowlisted server-side recipient identity; the browser must not submit an
   arbitrary address.
5. The server reloads the report and checks client membership, current state,
   `row_version`, `sent_at`, PDF availability and command eligibility.
6. The operations DB records a single-use command before dispatch. Use the
   existing `operations.report_commands`, `operations.audit_events`,
   `operations_private.create_report_command(...)` and RLS/security design as
   the starting point. Audit existing implementation before adding a migration;
   do not duplicate tables that already exist.
7. The server signs a short-lived command for a dedicated n8n command webhook.
   Use a dedicated command HMAC secret and dedicated Header Auth token, separate
   from PDF relay and ingest secrets.
8. n8n validates Header Auth, HMAC, expiry, nonce, command type and exact
   canonical payload; atomically rejects replay/expiry/stale version/wrong state.
9. n8n reloads the authoritative monthly-report Data Table row and applies
   compare-and-set guards. The portal cannot bypass existing review/sender
   checks.
10. `SENT` requires a real `sentAt`; it can never be reset or replayed. Preserve
    the production sender's stale-SENDING recovery and sanitized failure codes.
11. Command outcome reconciliation and audit must contain only allowlisted safe
    result codes. Never store or return raw SMTP/provider errors, recipient
    addresses, message bodies, credentials, n8n payloads or stack traces.
12. GET/view/download paths must remain structurally incapable of actions.
13. Keep ticketing and all unrelated client notifications disabled.

## Existing schema/security to inspect first

The foundational migrations already contain much of Phase 10:

- `operations.report_commands` with command type, expected version/state,
  nonce, expiry, status, safe result code and uniqueness constraints;
- append-only `operations.audit_events`;
- `operations_private.create_report_command(...)`, which checks owner context,
  report version/state and nonce replay before creating the command;
- tenant RLS and restricted grants.

Determine the smallest additive completion needed for atomic dispatch claim,
acknowledgement/result completion, expiry/replay handling and safe audit. If a
new migration is necessary, it must be the next numbered additive, idempotent
migration; never edit old migrations. Verify fresh application of all migrations
and idempotent rerun in a disposable PostgreSQL 16 container, then run the full
isolation suite.

## Required work plan — stop at each gate

### 1. Preflight and design only

- Inspect live/exported review and sender workflows and document their exact
  current states, guards, R2 path and sender behavior.
- Audit the existing command/audit schema and authentication/MFA implementation.
- Create
  `docs/cloudit-operations-portal-phase-10-report-actions.md` covering:
  command state machine, trust boundaries, canonical signed payload, CSRF/MFA,
  confirmation UX, recipient policy, idempotency/replay/expiry, n8n CAS behavior,
  asynchronous sender/result reconciliation, audit allowlists, failure mapping,
  rollback and cleanup.
- Include sequence diagrams or compact tables where they clarify the command
  lifecycle.
- Present the design and unresolved decisions to the owner. **Do not implement
  or mutate production before design approval.**

### 2. Database command primitives

- Reuse the existing tables/functions wherever safe.
- Add only missing atomic functions/constraints for claiming, acknowledging and
  completing a command with fixed safe result codes.
- Prove tenant isolation, append-only audit, replay denial, expiry denial,
  stale-version denial, wrong-state denial and duplicate command idempotency.
- Portal roles must not receive direct report-state write access.

### 3. Platform API command service

- Add narrowly scoped internal endpoints for command creation/dispatch/result
  reconciliation.
- Validate report key, client, expected version/state, command type and bounded
  reject reason.
- Generate opaque command key, nonce, correlation ID and short expiry server-side.
- Sign one canonical payload; never accept browser-provided signature, recipient
  address, nonce, actor identity or client scope.
- Map failures to fixed safe status/result codes.
- Add comprehensive unit/integration tests.

### 4. Dedicated inactive n8n command workflow

- Export it inactive under `infra/n8n/workflows/`.
- Straight, auditable path: authenticated webhook → signature/expiry validation
  → atomic command claim → authoritative Data Table reload → exact CAS guard →
  invoke/reuse the existing protected review/sender behavior → safe command
  acknowledgement/result publication.
- Do not weaken or duplicate the existing sender's exactly-once claim.
- No report PDF regeneration and no arbitrary state mutation.
- Build a local semantic harness for valid command, tamper, replay, expiry,
  stale version, wrong state, already sent, tenant mismatch and duplicate retry.

### 5. Operations-web action UX

- Add actions to the existing report page only when the server says they are
  eligible and MFA/action configuration is complete.
- Use POST endpoints/server actions, never action links or GET requests.
- Require deliberate confirmations with client/month/state/action.
- Reject reason: optional, trimmed/sanitized, at most 300 characters.
- Display pending/acknowledged/final safe state and append-only history.
- Disable double submission and handle idempotent retries without creating a
  second command.
- Maintain desktop/mobile accessibility and never expose secret/internal fields.

### 6. Local acceptance

- Run platform-api full Jest/build and operations-web typecheck/lint/build.
- Run fresh/idempotent migration verification and the full operations isolation
  suite.
- Run command-protocol harness tests for CSRF, auth, MFA freshness, tamper,
  replay, expiry, stale version, duplicate submission, tenant isolation and all
  state transitions.
- Prove report read/PDF paths remain mutation-free.

### 7. Controlled production acceptance — separately approved

- Do not use the real August or September reports.
- Create one unmistakable temporary non-real report only after the owner approves
  the exact test data, safe recipient/sink, maintenance window and cleanup plan.
- Never send to a real client recipient. Use only an owner-approved controlled
  test mailbox or non-delivering test transport.
- Verify the complete lifecycle, exactly one delivery, duplicate/replay denial,
  stale-version/wrong-state/expiry denial and safe audit history.
- Compare protected fields before/after and remove every temporary row, PDF,
  command, audit/test evidence, workflow pin/mock and test object permitted by
  the approved cleanup plan.
- A real report may be approved/rejected/sent only with a separate explicit
  authorization after Phase 10 acceptance.

## Phase 10 gate

The phase passes only when a separately approved **non-real** report completes
the intended lifecycle exactly once; duplicate/replay/stale/expired/wrong-state
requests make no change; audit history is safe and complete; cleanup is proven;
MFA is enabled for action access; and the owner explicitly approves the gate.

Stop before Phase 11.

## Repository and production safety

- Work only in `.worktrees/master-portal`; never reset/clean the main checkout.
- Preserve unrelated changes.
- Use `apply_patch` for edits.
- Do not commit `.env`, credentials, tokens, PDFs, provider payloads or test data.
- Secrets stay only in protected server environment files/n8n credentials and
  must not contain `$` because Compose env-file interpolation has caused issues.
- Production n8n activation, MFA activation, DB mutation, test-row creation,
  email delivery, deployment and push each require the applicable explicit
  approval. A terminal “finish” instruction does not authorize a real report
  action.
- No real report approval, rejection, retry, recipient notification or send
  during construction.
- No temporary nodes, connections, rows, pins, mocks, PDFs, R2 objects or fixed
  clocks may remain after acceptance.

## First response expected from the new session

After reading and inspecting, summarize:

1. what Phase 10 will add;
2. which existing schema/security pieces can be reused;
3. the exact live n8n workflows involved;
4. the proposed command lifecycle and trust boundaries;
5. prerequisites/blockers, especially MFA and safe test delivery;
6. the design-document plan.

Then begin with the Phase 10 design document only and stop for owner approval
before implementation.
