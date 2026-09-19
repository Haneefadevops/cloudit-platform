# CloudIT Operations Portal - AI Maintenance Operator Plan

Status: **DRAFT PLAN ONLY - awaiting owner approval; no implementation or
production mutation authorized**

Date: 18 September 2026

## 1. Objective

Build a private, security-first AI-assisted maintenance operation for Cavetta
that reduces routine owner involvement while preserving the existing CloudIT
Operations Portal, n8n, report, backup, tenant-isolation and audit boundaries.

The programme adds two narrowly scoped agents and one deterministic remediation
controller:

1. **Maintenance Supervisor** - evaluates sanitized operational evidence,
   explains problems, prioritizes work and produces internal digests.
2. **Workflow-Portal Sync Auditor** - compares approved workflow intent, live
   read-only n8n observations, portal catalogue state and evidence freshness.
3. **Remediation Controller** - executes only fixed, versioned and allowlisted
   runbooks after deterministic policy checks. It is not an AI agent and cannot
   execute model-generated code.

Telegram becomes the private owner interface for status, alerts, questions and
carefully bounded confirmations. The Operations Portal remains the complete
system of record for evidence, approvals, repair attempts and audit history.

This is not authorization to implement, import, activate, publish, deploy or
test against production. Every construction and production phase below has a
separate stop-and-approve gate.

## 2. Existing gates and non-negotiable boundaries

This programme must not bypass the existing portal phase gates or outstanding
operational acceptance work.

- The 1 October 2026 Phase 5E acceptance must still verify exactly one
  September snapshot for each of the seven canonical source keys.
- The real report must remain `DRAFT` during that evidence review.
- Phase 7's identical-period Vercel/ImageKit comparison remains separately
  gated.
- Phase 8's first scheduled restore-test and monthly-prefix evidence remains
  separately gated.
- Phase 9's private PDF unchanged-state gate remains separately gated where not
  already evidenced by an accepted production record.
- Phase 10's complete guarded command lifecycle remains separately gated. The
  AI programme must not be used as construction test data for a real report.
- Phase 12 production hardening and the external whole-server probe remain
  required.
- `ticketing_enabled` remains `false`.
- Client notifications remain disabled.
- n8n remains the only provider-integration and automation layer.
- The operations database remains separate from Cavetta Supabase and the n8n
  database.
- Report state and delivery remain authoritative in the existing n8n workflows.
  No AI component may directly write `documentStatus`, `sentAt`, report PDF
  metadata, recipients or delivery fields.
- Production backup restoration/decryption, credential rotation, DNS changes,
  environment changes and destructive data operations remain human-only.

## 3. Operating model

```text
Providers/public services
          |
          v
Existing n8n collectors and guarded workflows
          |
          | signed, normalized, sanitized evidence
          v
Operations API and operations PostgreSQL
          |
          +-----------------------+
          |                       |
          v                       v
Maintenance Supervisor     Workflow-Portal Sync Auditor
          |                       |
          +-----------+-----------+
                      |
                      v
             AI explanation layer
                      |
                      v
             Deterministic policy engine
                      |
          +-----------+-----------+
          |                       |
          v                       v
   Telegram owner UI       Operations Portal UI/audit
          |
          v
Allowlisted Remediation Controller
          |
          v
Independent verification -> audit -> recovery/escalation
```

The deterministic evaluators decide health, severity, freshness, eligibility,
idempotency and whether a runbook is allowed. AI may explain those conclusions,
correlate already-sanitized findings and recommend an existing runbook. AI never
decides that a dangerous action is safe.

## 4. Agent 1 - Maintenance Supervisor

### 4.1 Responsibilities

The Maintenance Supervisor reads a dedicated allowlisted Operations API
projection and evaluates:

- Public website and API availability, confirmation state and response time.
- Database availability, size, connection utilization, disk/memory signals,
  read-only state, restarts, waiting connections and OOM evidence.
- Open incidents, recoveries, repeated failures and evidence freshness.
- Daily backup, checksum, encrypted-object, R2 round-trip and retention evidence.
- Monthly isolated restore-test age and result.
- Vercel deployment/analytics and ImageKit delivery/usage coverage.
- Expected versus observed n8n workflow executions.
- Monthly seven-source snapshot coverage (`FULL`, `PARTIAL`, `NO_DATA`).
- Safe maintenance-report state and whether evidence/PDF metadata is present.
- Sync/drift findings emitted by the Workflow-Portal Sync Auditor.
- AI budget, alert-channel health and supervisor health.

The supervisor must classify missing or stale evidence as `UNKNOWN`, `NO_DATA`
or the existing deterministic AMBER/RED rule. It must never infer GREEN from
absence.

### 4.2 Cadence

Existing evidence collection schedules remain unchanged. The supervisor adds:

| Activity | Proposed cadence |
| --- | --- |
| Deterministic delta scan | Every 15 minutes |
| AI call | Only on meaningful state change, new/recovered incident, repeated-failure threshold, stale critical source or requested digest |
| Daily owner digest | 11:30 `Europe/Malta`, after backup reconciliation |
| Weekly digest | Monday approximately 08:20 `Europe/Malta`, after the weekly check |
| Monthly pre-review | Approximately 10:00 on the effective DRAFT weekday |
| Critical internal alert | Immediately after deterministic confirmation |
| Recovery notification | After deterministic recovery confirmation |

If the AI provider fails, times out or reaches the budget ceiling, the
supervisor sends a fixed deterministic alert/digest and continues monitoring.

### 4.3 AI responsibilities

AI may:

- Produce a concise owner summary from safe evidence.
- Explain what changed since the previous accepted assessment.
- Correlate related sanitized findings without inventing new evidence.
- Prioritize existing findings.
- Select or recommend an approved runbook key.
- Draft an internal Telegram message.
- Answer bounded owner questions about sanitized portal evidence.

AI may not:

- Set or override deterministic health/status.
- Read raw provider responses, unrestricted logs or execution payloads.
- Call arbitrary URLs, SQL, shell, browser, deployment or infrastructure tools.
- Edit, activate, publish, delete or import n8n workflows.
- Approve, reject, retry or send a maintenance report.
- Restore/decrypt backups or inspect backup contents.
- Change credentials, DNS, environment variables, firewall rules or provider
  configuration.
- Generate code and pass it directly to an executor.

## 5. Agent 2 - Workflow-Portal Sync Auditor

### 5.1 Sources of truth

- **Git-approved manifest:** authoritative approved intent.
- **Live n8n:** authoritative runtime state.
- **Operations Portal catalogue:** authoritative sanitized presentation state.
- **Execution and ingestion evidence:** authoritative proof that scheduled work
  ran and reached the portal.

A mismatch is reported; it is never automatically converged.

### 5.2 Desired-state manifest

Create one reviewed entry per in-scope workflow containing:

- Stable `workflowKey` and display name.
- Server-only live workflow mapping.
- Expected active/published state.
- Trigger kind, cron expression and timezone.
- Completion SLA and criticality.
- Required Error Workflow.
- Allowed credential types only, never credential names, IDs or values.
- Canonical semantic SHA-256.
- Source repository path and commit/revision.
- Owner, approval record and rollback export reference.

The canonical Cavetta workflow definitions remain in the automation/Cavetta
repository. The portal repository stores only the approved sanitized manifest
and hashes, not unrestricted live exports.

### 5.3 Live observation

Run the observer outside n8n so an n8n outage remains observable.

- Activation/schedule/freshness scan: every 15 minutes.
- Semantic-definition scan: every six hours.
- Full reconciliation: daily.
- Use a genuinely read-only, scoped n8n API identity only after its permissions
  are verified against the installed n8n version.
- If n8n cannot provide an adequately scoped read-only identity, use
  owner-generated redacted exports/manual baseline. Do not grant a broad API key
  to AI or the observer.
- Allow only fixed private-network `GET` paths, a fixed base URL, short timeouts
  and no user/model-supplied URL.

Canonicalization happens in memory. Remove volatile UI/server fields and every
credential identifier/value. Retain behavior-bearing node types/versions,
parameters, connections, triggers, schedules, timezone, Error Workflow and
workflow settings. Discard raw live JSON after comparison.

### 5.4 Sync result

Publish only sanitized observations through the existing signed/idempotent
ingestion path. Proposed result states:

- `MATCH` - approved intent, live state and evidence agree.
- `DRIFT` - a confirmed semantic, activation, schedule or evidence-flow
  difference exists.
- `UNKNOWN_STALE` - the observer/API is unavailable or the scan is stale.

Proposed closed drift codes include:

- `workflow_missing`
- `unexpected_active_workflow`
- `active_state_mismatch`
- `published_revision_mismatch`
- `semantic_hash_mismatch`
- `schedule_mismatch`
- `timezone_mismatch`
- `error_workflow_detached`
- `catalogue_mismatch`
- `expected_execution_missing`
- `portal_evidence_missing`
- `observer_unavailable`
- `observation_stale`

Critical sender, report-command, authentication, publisher and incident-path
semantic drift is RED. Schedule/catalogue drift is normally AMBER. Observer
failure is `UNKNOWN_STALE`, never GREEN.

## 6. Telegram owner interface

### 6.1 Initial commands

| Command | Behaviour | AI call? |
| --- | --- | --- |
| `/status` | Overall deterministic Cavetta status | No |
| `/incidents` | Current sanitized RED/AMBER incidents | No |
| `/workflows` | Drift, missed runs and stale evidence | No |
| `/backups` | Backup and restore-test status | No |
| `/reports` | Safe report status only | No |
| `/repairs` | Proposed/recent safe repair status | No |
| `/daily` | Current daily digest | Usually cached; Luna only when regeneration is needed |
| `/cost` | AI calls, token usage and budget state | No |
| `/ask <question>` | Bounded question over sanitized evidence | Luna; Terra escalation only by policy |
| `/cancel` | Cancel an unexecuted confirmation | No |
| `/help` | Allowed commands and privacy warning | No |

Version 1 accepts text commands and callback buttons only. It does not accept or
download documents, images, voice notes, contacts, locations or arbitrary URLs.

### 6.2 Authentication and webhook controls

- Private chat only; group joining disabled through BotFather.
- Allowlist the owner's exact numeric Telegram user ID and chat ID. A username is
  not an authorization identity.
- HTTPS webhook with Telegram `secret_token`; verify
  `X-Telegram-Bot-Api-Secret-Token` using constant-time comparison.
- Accept only `message` and `callback_query` update types required by the bot.
- Persist and deduplicate `update_id` before processing.
- Apply strict body-size, command-length, per-user and per-IP rate limits.
- Callback actions carry an opaque, server-stored, single-use nonce with a
  five-minute expiry; never place a secret or complete action context in
  `callback_data`.
- Acknowledge callback buttons quickly, then process work asynchronously.
- Store the bot token and webhook secret only in protected runtime secrets;
  never Git, documentation, n8n exports, logs, browser bundles or chat.
- Provide a tested bot-token rotation and webhook-revocation runbook.

### 6.3 Approval boundary

Telegram is an operational convenience channel, not sufficient authentication
for high-risk changes.

- Tier A automatic repairs need no Telegram approval but must meet the complete
  policy/runbook contract.
- Tier B low-risk repairs require two-step Telegram confirmation.
- Tier C infrastructure/workflow changes require a Telegram request followed by
  recent step-up authentication in the Operations Portal.
- Tier D prohibited actions have no Telegram execution path.

The portal currently documents password-only owner sessions with login-time TOTP
optional. Until step-up TOTP or passkey authentication is designed, enabled and
accepted, Tier C controls must remain absent from Telegram and the portal.

Telegram messages contain only safe identifiers, status, timestamps, evidence
keys and bounded summaries. They never contain credentials, raw errors, email
addresses, report recipients, private PDF/R2/Drive identifiers, backup contents,
customer/landlord/booking/inquiry data or unrestricted execution links.

## 7. Remediation Controller

### 7.1 Authority tiers

| Tier | Authority | Initial examples |
| --- | --- | --- |
| A - automatic safe | Reversible/idempotent, no external business side effect | Repeat a read-only check; retry a safe internal alert; restart only the monitoring worker; confirm recovery; close an AI-generated alert after two healthy scans |
| B - owner-confirmed low risk | Fixed runbook, narrow operational side effect | Re-run an approved idempotent read-only collector; retry sanitized evidence publication when the contract/freshness preconditions pass |
| C - step-up approval | Service/workflow availability impact | Restart n8n/portal service; activate/deactivate or restore an approved workflow revision; deploy an approved change; retry a backup job |
| D - human-only/prohibited | Irreversible, sensitive or client/data effect | Restore/decrypt production backup; rotate credentials; modify DNS/firewall/provider settings; delete data/workflows/objects; arbitrary SQL/shell; approve/reject/retry/send a real report; reset `SENT`/`sentAt`; client notification |

Tier C is a future phase and remains disabled until portal step-up authentication,
rollback, concurrency and controlled non-real acceptance are complete.

### 7.2 Runbook contract

Every executable runbook must declare:

- Immutable runbook key and version.
- Closed issue codes it accepts.
- Exact service/workflow/endpoint target allowlist.
- Required evidence and maximum evidence age.
- Preconditions checked immediately before execution.
- Required authority tier and approval freshness.
- Idempotency key and concurrency lock.
- Maximum attempts, normally one automatic attempt.
- Timeout and circuit-breaker policy.
- Exact fixed parameters; no model/user-provided command, SQL or URL.
- Expected safe result codes.
- Independent post-action verification.
- Rollback procedure where possible.
- Audit events and safe data fields.

After one failed automatic repair, or two failed owner-confirmed attempts, the
controller stops, opens no ticket, performs no broader action and escalates to
the owner. A credential/security failure stops immediately.

### 7.3 Initial allowlist

The first production allowlist should contain only:

1. `RB-READONLY-RECHECK-001`
2. `RB-INTERNAL-ALERT-RETRY-001`
3. `RB-MONITOR-WORKER-RESTART-001`
4. `RB-INCIDENT-RECOVERY-VERIFY-001`

An idempotent read-only collector rerun may be added only after the exact live
workflow, freshness behavior, duplicate result, absence of report/notification/
backup side effects and rollback are accepted individually.

## 8. AI provider, models and budget

### 8.1 Provider integration

Use the OpenAI Responses API through a dedicated project/API key stored only in
the monitoring service's protected environment. Set `store: false`. Send only
the allowlisted sanitized assessment input; do not send raw logs or provider
payloads.

Require strict structured output similar to:

```json
{
  "assessment": "GREEN | AMBER | RED | UNKNOWN",
  "summary": "bounded internal summary",
  "evidenceKeys": ["safe-reference"],
  "confidence": "LOW | MEDIUM | HIGH",
  "issueCode": "closed_issue_code",
  "recommendedRunbook": "approved-runbook-key | none",
  "automationEligibility": "AUTO_SAFE | OWNER_REQUIRED | PROHIBITED"
}
```

The server validates the schema, every enum, evidence-key membership, summary
length and runbook/issue compatibility. Invalid output is discarded and replaced
by a deterministic template. Do not store chain-of-thought or unrestricted full
prompts.

### 8.2 Model routing

- `gpt-5.6-luna`: normal summaries, recovery wording, safe question answering
  and runbook explanation.
- `gpt-5.6-terra`: only deterministic RED cases with multiple conflicting
  signals, low-confidence Luna output or an owner-requested deeper explanation.
- No automatic use of Astra, web search, computer use, code interpreter, hosted
  shell or other separately charged/model-controlled tools.

Model aliases/pricing must be reverified against official documentation at
implementation time and may be pinned to an evaluated snapshot.

### 8.3 EUR 15 monthly ceiling

The budget applies to ongoing operating cost, not implementation labour.

| Allocation | Ceiling |
| --- | ---: |
| Luna routine use | EUR 3 |
| Terra escalation | EUR 3 |
| External monitor | Free tier initially |
| Existing server/database/SMTP | No planned incremental charge |
| FX, tax and incident reserve | EUR 9 |
| Absolute owner budget | **EUR 15/month** |

Application-enforced controls:

- Maximum ten AI requests per day.
- Maximum three Terra escalations per day.
- Strict input/output token limits; target output at or below 1,000 tokens.
- No AI call for deterministic Telegram commands.
- Internal warning at estimated EUR 5.
- Application AI circuit breaker at estimated EUR 7.
- AI-disabled mode continues deterministic monitoring and Telegram templates.
- Record tokens, model, latency and estimated EUR cost for every call.
- Reset the application budget only on a UTC calendar-month boundary.
- Configure provider-side project alerts/limits as a second layer, allowing
  headroom for FX/tax differences.

Expected steady-state model usage is approximately 50-100 calls per month and
should normally remain materially below the ceiling.

## 9. Proposed technology stack

| Area | Technology | Reason |
| --- | --- | --- |
| Existing portal UI | Next.js/TypeScript (`apps/operations-web`) | Reuse current authenticated, responsive portal |
| Existing internal API | NestJS/TypeScript (`apps/platform-api`) | Reuse sanitized operations contracts and authorization conventions |
| New agent runtime | Separate NestJS/TypeScript service, proposed `apps/operations-agent` | Independent lifecycle from n8n; familiar monorepo stack; explicit modules and testability |
| Scheduling/queues | PostgreSQL-backed durable jobs/outbox; lightweight scheduler in the agent service | Avoid a new paid service; survive restarts; enforce idempotency |
| Evidence/audit store | Existing dedicated operations PostgreSQL | Tenant isolation, append-only audit and existing backup policy |
| Provider automation | Existing n8n | Preserve the approved provider-integration boundary |
| AI | OpenAI Responses API with strict Structured Outputs | Bounded explanations and typed results |
| Owner channel | Telegram Bot HTTP API webhook and `sendMessage`/callback buttons | Private alerts and commands without a paid messaging platform |
| External availability | Grafana Cloud Synthetic Monitoring free tier if still suitable at implementation time | Detect total loss of the shared server/network |
| Deployment | Existing Docker Compose/reverse proxy/GitHub Actions path | No new hosting bill; separate container and secrets |

The initial agent runtime must not expose a generic internal proxy, SQL endpoint,
shell endpoint, arbitrary HTTP tool or arbitrary n8n execution endpoint.

## 10. Proposed data model additions

Exact schema design is a later gated deliverable. The minimum concepts are:

- `agent_assessments` - deterministic state plus optional validated AI summary,
  evidence keys, model/prompt version, confidence and cost.
- `workflow_sync_observations` - expected/live hash, activation, schedule,
  revision, match state, drift codes and freshness.
- `remediation_runbooks` - versioned metadata and authority tier; executable
  implementation remains code-reviewed, not database code.
- `remediation_proposals` - issue, target, runbook, state, expiry and approval
  requirements.
- `remediation_attempts` - immutable attempt/result/verification/rollback state.
- `telegram_update_receipts` - update ID digest, authorized/denied result and
  timestamp for replay protection; no message-body retention.
- `telegram_action_nonces` - hashed, single-use, short-lived confirmations.
- `ai_usage_daily` - model, token counts, request count, safe result and estimated
  cost.
- Existing `audit_events` receives closed agent/Telegram/remediation events.

Every tenant-scoped record requires `client_id`, composite tenant-safe foreign
keys and RLS. Browser projections exclude prompts, raw evidence, Telegram IDs,
nonces, internal hashes, provider response data and secret material.

## 11. Security and privacy controls

### 11.1 Least privilege and isolation

- Separate runtime identities for the agent, sync observer, Telegram sender and
  remediation executor.
- Agent reads only a dedicated sanitized API projection; no direct broad
  database role.
- Sync observer receives read-only n8n metadata scope only if proven.
- Remediation adapters receive one permission per approved runbook family, not
  administrator credentials.
- Operations PostgreSQL remains private with no published host port.
- Egress allowlist: required OpenAI and Telegram endpoints plus fixed private
  Operations API/n8n endpoints. No arbitrary destinations.
- Secret values remain in protected runtime files/secret stores and never enter
  prompts, traces, audit details, browser data or Telegram.

### 11.2 Prompt-injection and output controls

- Treat every text field from monitoring evidence as untrusted data.
- Convert evidence to a closed typed structure before building a prompt.
- Strip URLs, HTML/control characters, email addresses, token-like strings and
  fields outside the allowlist.
- Clearly separate system instructions from evidence data.
- Model receives no mutation tool.
- Validate structured output and evidence references server-side.
- The policy engine ignores AI-provided target, command, URL, SQL and arbitrary
  parameters.
- Deterministic severity/status always overrides contradictory AI wording.

### 11.3 Audit and retention

- Append-only audit for each scan, alert, denial, proposal, approval, attempt,
  verification, rollback and circuit-breaker event.
- Store safe reason/result codes, not raw exceptions or provider responses.
- Do not store full Telegram message bodies after command parsing.
- Store no chain-of-thought.
- AI assessment retention should follow the existing detailed-evidence 90-day
  policy unless a later legal/security decision changes it.
- Security-critical approvals and remediation audit remain permanent under the
  existing audit policy.

### 11.4 Kill switches

Provide independent configuration switches:

- `AI_ENABLED=false` - deterministic operation continues.
- `TELEGRAM_COMMANDS_ENABLED=false` - outbound alerts may continue if approved.
- `AUTO_REMEDIATION_ENABLED=false` - proposals/alerts continue.
- Per-runbook enable flags default false.
- One emergency global repair-disable switch that requires no AI or Telegram.

## 12. Failure handling

| Failure | Required behavior |
| --- | --- |
| OpenAI timeout/429/5xx | Deterministic message; record safe failure; no repair widening |
| Invalid/hallucinated AI result | Reject; deterministic fallback; optionally use Terra only within policy/budget |
| Telegram unavailable | Portal/audit continue; bounded retry; no duplicate repair |
| n8n unavailable | External sync observer marks `UNKNOWN_STALE`/RED by deterministic policy and alerts independently |
| Operations API/database unavailable | Fail closed; no repair; external alert/probe where possible |
| Evidence stale/missing | Never GREEN; show source and freshness gap |
| Duplicate Telegram callback | Return already processed; no second action |
| Repair timeout/failure | Stop, verify, rollback if defined, escalate |
| Flapping signal | Existing confirmation plus cooldown/deduplication; no repeated repair loop |
| Budget exhausted | Disable AI calls; deterministic monitoring/alerts continue |
| Whole server unavailable | Independent external probe alerts outside the shared failure domain |

## 13. Implementation phases and stop gates

### Programme Phase A - Design, threat model and owner decisions

- Approve this plan's scope and boundaries.
- Inventory every service, workflow and evidence source.
- Define the closed issue-code and runbook catalogues.
- Decide Telegram private-chat identity and alert policy without recording
  tokens/secrets.
- Decide step-up authentication direction for future Tier C actions.
- Confirm model/provider and EUR 15 budget.

**Gate:** owner approves the complete design and explicitly authorizes only
Phase B. No application or production change.

### Programme Phase B - Contracts and offline harnesses

- Define sanitized supervisor/sync/AI/remediation contracts.
- Build canonicalization and drift fixtures.
- Build deterministic assessment fixtures.
- Build prompt/output validation and injection/leakage tests.
- Define schema/migration design without applying production changes.

**Gate:** all offline fixtures pass; security review; owner approval.

### Programme Phase C - Deterministic read-only runtime

- Create the separate agent service and durable job/outbox design.
- Add sanitized API reads and deterministic assessments.
- Add sync observation without AI and without alerts/actions.
- Add application cost meter and kill switches.

**Gate:** local tests/builds, fresh/idempotent migration test if a migration is
approved, tenant isolation proof and owner approval.

### Programme Phase D - Telegram read-only bot

- Create a separate test bot; production bot/token not yet used.
- Implement private owner authentication, webhook replay defense, read-only
  commands and deterministic templates.
- Prove unauthorized users/groups, forged webhook secret, replayed update,
  oversized body and rate-limit denial.

**Gate:** owner verifies the test bot and complete safe payloads; no repair
buttons and no AI yet.

### Programme Phase E - AI shadow mode

- Add Luna structured summaries and Terra policy escalation.
- No owner alerts driven by AI; output appears only in an internal review view.
- Run at least 14 days and compare assessments with deterministic evidence and
  owner judgement.
- Measure false RED/AMBER, missed finding, invalid-output, token and cost rates.

**Gate:** zero secret/PII leakage, no status override, accepted accuracy and
cost; owner approval.

### Programme Phase F - Internal alerts and digests

- Enable deterministic RED/recovery alerts through Telegram.
- Enable reviewed daily/weekly/monthly AI summaries.
- Keep repairs disabled.
- Prove alert deduplication, recovery and Telegram outage fallback.

**Gate:** seven-day alert-only soak with no duplicate/noisy critical alerts and
owner approval.

### Programme Phase G - Simulated remediation

- Generate remediation proposals from fixed issue/runbook mapping.
- Execute nothing; display exact preconditions, expected impact, verification
  and rollback.
- Exercise failures, expiry, replay, concurrency and circuit breakers offline.

**Gate:** owner approves each initial Tier A runbook individually.

### Programme Phase H - Tier A controlled production acceptance

- Activate one Tier A runbook at a time.
- Use controlled non-real/non-destructive evidence.
- Prove exactly one attempt, verification, audit and cleanup.
- Observe for at least 14 days before expanding.

**Gate:** owner approves each runbook for normal automatic operation.

### Programme Phase I - Tier B confirmations

- Add two-step Telegram confirmation with expiring single-use nonces.
- Accept one runbook at a time using controlled data.
- Prove denial for wrong user/chat, replay, expiry, stale evidence and concurrent
  requests.

**Gate:** owner approves each Tier B runbook. Stop before Tier C.

### Programme Phase J - Future Tier C design only

- Design step-up TOTP/passkey, portal handoff and recent-auth proof.
- Design service restart/workflow restore/deployment runbooks and rollback.
- No Tier C implementation until separately authorized after existing Phase 12
  production hardening.

**Gate:** separate design and production authorization. Tier D remains
prohibited.

## 14. Acceptance test matrix

At minimum test:

- GREEN, AMBER, RED, `NO_DATA`, `UNKNOWN` and stale evidence.
- New incident, repeated incident, recovery and flapping.
- Missed schedules, DST and month-boundary behavior.
- Exactly seven September snapshot keys without acting on the real report.
- Live n8n unavailable while the external observer remains available.
- Semantic, connection, cron, timezone, activation and Error Workflow drift.
- Identical reordered exports producing the same semantic hash.
- Credential identifiers and raw node data absent from stored/published output.
- Prompt injection in every permitted text field.
- Secret, token, email, URL, private-ID and PII canary leakage.
- Model timeout, 429, 5xx, refusal, malformed schema and confident false claim.
- Deterministic/AI conflict with deterministic result winning.
- Cross-tenant read/write denial.
- Telegram wrong user/chat, group use, forged secret, replay, expired callback,
  rate limit and duplicate callback.
- Runbook precondition drift, duplicate idempotency key, concurrent attempt,
  timeout, failed verification, rollback and circuit breaker.
- AI-disabled, Telegram-disabled and remediation-disabled modes.
- Budget warning and hard cutoff without loss of deterministic monitoring.
- Structural absence of report action, backup restore/decrypt, credential,
  client-notification, ticket, arbitrary HTTP, SQL and shell paths.
- Complete cleanup of temporary workflows, rows, pins, mocks, endpoints and
  fixed clocks after controlled acceptance.

## 15. Production readiness criteria

Normal operation is allowed only when:

- Existing portal acceptance gates relevant to the monitored feature are
  complete or explicitly documented as pending without being masked by AI.
- External whole-server monitoring is active.
- The live workflow inventory and desired-state manifest are owner-accepted.
- Read-only shadow and alert-only soak periods pass.
- AI prompts/outputs contain only sanitized allowlisted data.
- Tenant isolation, webhook replay defense and append-only audit pass.
- The EUR 7 application AI cutoff and deterministic fallback are proven.
- Every enabled repair runbook passed isolated acceptance and cleanup.
- Kill switches and bot-token rotation are tested.
- Operations database backup/recovery documentation includes the new tables.
- Desktop and 390 px mobile portal views pass accessibility/security review.
- No real report, client notification, ticket, production restore or credential
  change was used as construction evidence.

## 16. Owner decisions required before implementation

1. Approve two agents plus a non-AI Remediation Controller as the architecture.
2. Approve Telegram private-chat use for safe operational information.
3. Approve Luna for routine output and Terra only for policy escalation.
4. Approve the EUR 7 application AI cutoff inside the EUR 15 owner ceiling.
5. Approve the initial four Tier A runbooks or amend the allowlist.
6. Confirm that Tier B collector reruns must be approved individually.
7. Confirm that Tier C remains disabled until step-up portal authentication and
   separate acceptance are complete.
8. Confirm all Tier D actions remain human-only/prohibited.
9. Approve the proposed data retention for AI assessments and Telegram receipts.
10. Confirm Grafana Cloud Synthetic Monitoring or select another independent
    free-tier external probe.
11. Confirm `ticketing_enabled=false` and client notifications remain disabled.
12. Confirm construction begins with Programme Phase B only after explicit
    approval; no production mutation is implied by approving this plan.

## 17. Reference documentation

Project references:

- `docs/cloudit-operations-portal-phase-0-specification.md`
- `docs/cloudit-operations-portal-plan.md`
- `docs/cloudit-operations-portal-phase-10-report-actions.md`
- `docs/cloudit-operations-portal-phase-11-incidents-audit.md`
- `docs/reference/maintenance-automation-handover.md`
- `docs/reference/n8n-maintenance-automation-plan.md`
- `infra/n8n/workflows/README.md`

External references to reverify at implementation time:

- OpenAI Responses API and models: `https://developers.openai.com/api/`
- OpenAI data controls: `https://developers.openai.com/api/docs/guides/your-data`
- Telegram Bot API: `https://core.telegram.org/bots/api`
- Telegram bot features/security: `https://core.telegram.org/bots/features`

## 18. Final phase gate

This document authorizes planning discussion only. It does not authorize code,
schema, Telegram bot creation, API-key creation, workflow import, workflow
activation/publication, deployment, DNS changes, production tests, report
actions, backup operations, client notifications or ticket creation.

After owner approval, begin **Programme Phase B - Contracts and offline
harnesses** only, then stop for the stated gate.
