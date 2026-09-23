# Kimi AI Maintenance Execution Plan

Status: **DRAFT EXECUTION PLAN ONLY - owner approval is required before each
implementation phase; no production mutation is authorized**

Date: 18 September 2026

Target: complete and accept the safe read-only MVP by **30 September 2026**, then
observe the existing seven-source September acceptance on **1 October 2026**.

## 1. Purpose

This document tells Kimi how to build the AI-assisted maintenance capability
described in
[`cloudit-operations-portal-ai-maintenance-operator-plan.md`](./cloudit-operations-portal-ai-maintenance-operator-plan.md).
It is an execution and coordination guide, not permission to deploy anything.

The work uses one Kimi coordinator and up to three worker agents. The workers
operate in parallel only when their file ownership is disjoint. The coordinator
owns integration, acceptance gates and the final decision to present work to the
owner.

The September objective is intentionally narrow:

- read-only health monitoring;
- workflow-to-portal drift detection;
- AI-assisted incident explanation and prioritization;
- private Telegram status, alerts and questions;
- portal views for findings, audit history and AI budget;
- deterministic, low-risk self-healing only where explicitly allowlisted; and
- no production write path that can alter workflows, reports, backups,
  credentials, deployments or client communications.

## 2. Required reading before work starts

The coordinator and every worker must read the files relevant to their task.
The coordinator must read all of them before creating branches or assigning
work:

1. `AGENTS.md`
2. `README.md`
3. `docs/cloudit-operations-portal-phase-0-specification.md`
4. `docs/cloudit-operations-portal-plan.md`
5. `docs/portal-repository-handover.md`
6. `docs/reference/maintenance-automation-handover.md`
7. `docs/reference/n8n-maintenance-automation-plan.md`
8. `docs/cloudit-operations-portal-ai-maintenance-operator-plan.md`
9. this file

If the repository state contradicts either plan, the repository and accepted
handover evidence win. Record the discrepancy and stop for owner direction when
it affects scope or safety.

## 3. Non-negotiable safety rules

All agents must follow these rules:

- Work locally until the owner separately approves a push or deployment.
- Never use Kimi's unattended or automatic approval mode.
- Never display or copy secrets into prompts, logs, fixtures, commits or chat.
- Use synthetic fixtures and local mocks. Do not use real customer payloads.
- Do not call production mutation endpoints.
- Do not import, activate, publish or edit a live n8n workflow.
- Do not change production environment variables, DNS, credentials or firewall
  rules.
- Do not send Telegram messages to a real operational chat during construction.
- Do not create tickets or notify clients. `ticketing_enabled` stays `false`.
- Do not mutate real report state. The real report remains `DRAFT` during the
  1 October acceptance.
- Do not restore, decrypt, delete or overwrite backups.
- Do not run destructive Git or filesystem commands.
- Do not merge a worker branch until its scoped tests pass and the coordinator
  has reviewed the diff.
- Stop when a phase gate is reached. Do not begin the next phase without owner
  approval.

The model may recommend a repair, but it must never generate arbitrary code or
shell commands for automatic execution. Any self-healing action must be a
prewritten, versioned, deterministic runbook with an explicit allowlist, input
schema, timeout, rate limit, audit record and rollback/failure behavior.

## 4. Kimi agent topology

Use this structure:

```text
Owner
  |
  v
Kimi Coordinator (integration worktree)
  |-- Worker A: contracts / supervisor / Telegram webhook / AI adapter
  |-- Worker B: drift engine / sync auditor / Telegram commands / portal UI
  `-- Worker C: security fixtures / platform controls / security and AI evals
```

The coordinator is responsible for:

- confirming the current repository and branch state;
- creating shared skeletons before parallel work;
- assigning exact file boundaries and acceptance criteria;
- keeping a decision and risk log;
- reviewing every worker diff;
- running integration checks;
- resolving conflicts rather than delegating blind conflict resolution;
- enforcing budget and security gates; and
- presenting one phase at a time for owner approval.

Workers are responsible for:

- changing only assigned paths;
- reporting any necessary cross-boundary change before making it;
- adding tests with the implementation;
- making small, reviewable commits only after approval to commit;
- returning a concise handoff with files, tests, risks and open decisions; and
- stopping at the assigned phase boundary.

Kimi subagents have isolated conversation contexts, but they can still collide
on a shared filesystem. Therefore, every writing worker must use a separate Git
worktree.

## 5. Worktree and branch model

Recommended local layout:

```text
.worktrees/master-portal   coordinator and integration
.worktrees/ai-worker-a     Worker A
.worktrees/ai-worker-b     Worker B
.worktrees/ai-worker-c     Worker C
```

Recommended branches:

```text
ai-maintenance/integration
ai-maintenance/worker-a-<phase>
ai-maintenance/worker-b-<phase>
ai-maintenance/worker-c-<phase>
```

Before creating worker worktrees, the coordinator must:

1. verify that the integration worktree has no unexpected changes;
2. identify and preserve owner-created changes;
3. review both planning documents;
4. ask the owner before creating a planning commit or any branch that will be
   pushed; and
5. create the shared package/app skeleton for the phase so workers do not each
   invent incompatible foundations.

Never have two agents edit the same file concurrently. If a shared type or
bootstrap must change, the worker requests it from the coordinator. The
coordinator makes that shared edit first and rebases or updates worker branches
before parallel work resumes.

Limit the swarm to three workers:

```powershell
$env:KIMI_CODE_AGENT_SWARM_MAX_CONCURRENCY = "3"
```

This is a concurrency ceiling, not an instruction to keep all three agents busy.
Use fewer agents when a task is sequential or too small to justify a handoff.

## 6. Delivery calendar

| Date | Gate | Deliverable |
|---|---|---|
| 18 Sep | Preparation | Approve plans, confirm repository state, create integration skeleton and task ledger |
| 19-20 Sep | Phase B | Contracts, canonicalization, hashing, drift fixtures and adversarial security fixtures |
| 21-24 Sep | Phase C | Read-only operations service, supervisor, sync auditor, job/budget/audit controls and kill switches |
| 25-26 Sep | Phase D | Telegram test-bot interface, authorization, replay defense and command security tests |
| 27-29 Sep | Phase E/F MVP | AI adapter, strict model routing/budget controls, portal AI views and evaluation suite |
| 30 Sep | MVP acceptance | Full local/staging verification and owner go/no-go for read-only monitoring only |
| 1 Oct | Existing acceptance | Observe the seven September source snapshots; real report remains `DRAFT`; no AI repair or report action |

The calendar is a target, not permission to skip a failed gate. If the safe MVP
cannot pass by 30 September, reduce optional UI polish or defer AI conveniences.
Do not weaken authorization, audit, budget, isolation or production-safety tests.

## 7. Phase-by-phase parallel assignments

### Preparation - 18 September

The coordinator works alone:

- inventory the actual package manager, workspace layout, lint/type/test
  commands and CI checks;
- confirm whether the proposed paths already exist;
- create a task ledger with owner, branch, path boundary, prerequisites,
  acceptance tests and status;
- create only the minimum shared package/app skeleton required by Phase B; and
- present the exact Phase B diff plan to the owner.

No worker starts until the owner approves Phase B.

### Phase B - contracts and offline safety, 19-20 September

Coordinator prerequisite: create the shared
`packages/operations-agent-contracts` skeleton and its test configuration.

Worker A owns:

```text
packages/operations-agent-contracts/src/contracts/**
```

Deliver:

- typed health, finding, recommendation, repair-request and audit contracts;
- explicit severity, confidence, approval and execution-state enums;
- schema validation for all external inputs; and
- tests for rejected unknown or oversized input.

Worker B owns:

```text
packages/operations-agent-contracts/src/canonicalization/**
packages/operations-agent-contracts/test/canonicalization/**
```

Deliver:

- deterministic workflow canonicalization;
- stable hashing that excludes approved volatile metadata;
- workflow/portal drift comparison fixtures; and
- tests proving stable, repeatable output.

Worker C owns:

```text
packages/operations-agent-contracts/src/security/**
packages/operations-agent-contracts/test/security/**
```

Deliver:

- prompt-injection and secret-leakage fixture sets;
- untrusted-text labeling and sanitization rules;
- malformed, replayed and over-budget input cases; and
- fail-closed tests.

Phase B exit gate:

- all schemas and fixtures pass locally;
- canonicalization is deterministic;
- malicious evidence is treated only as data;
- no network or production access is required by tests; and
- coordinator records the accepted contract version.

### Phase C - read-only operations service, 21-24 September

Coordinator prerequisite: create the shared `apps/operations-agent` bootstrap,
configuration schema, dependency wiring and test harness.

Worker A owns:

```text
apps/operations-agent/src/supervisor/**
apps/operations-agent/test/supervisor/**
```

Deliver the maintenance supervisor that converts sanitized evidence into
findings and recommendations. It must not execute tools or repairs.

Worker B owns:

```text
apps/operations-agent/src/sync/**
apps/operations-agent/test/sync/**
```

Deliver the workflow-portal sync auditor using the Phase B canonical contracts.
All n8n and portal observations are read-only adapters or mocks.

Worker C owns:

```text
apps/operations-agent/src/platform/**
apps/operations-agent/test/platform/**
```

Deliver:

- job scheduling abstractions;
- per-run and monthly AI budget enforcement;
- immutable audit-event emission;
- global and per-capability kill switches;
- concurrency limits, timeouts and circuit breakers; and
- read-only adapter interfaces.

Phase C exit gate:

- the service works entirely with synthetic/local evidence;
- every decision has a traceable audit event;
- budget exhaustion fails closed;
- kill switches override all scheduled activity;
- tenant and environment identifiers cannot cross boundaries; and
- no repair executor is connected.

### Phase D - Telegram test interface, 25-26 September

Coordinator prerequisite: create the Telegram module bootstrap and synthetic
test configuration. Use a test bot/chat only after the owner explicitly provides
approval and credentials through the approved secret store.

Worker A owns:

```text
apps/operations-agent/src/telegram/webhook/**
apps/operations-agent/test/telegram-webhook/**
```

Deliver webhook authentication, approved-user/chat allowlists, freshness
checks, replay protection, rate limits and safe response formatting.

Worker B owns:

```text
apps/operations-agent/src/telegram/commands/**
apps/operations-agent/test/telegram-commands/**
```

Deliver read-only commands such as `/status`, `/incidents`, `/sync`, `/budget`,
`/explain <finding-id>` and `/help`. Commands reference audit IDs and never
include secrets or raw customer payloads.

Worker C owns:

```text
apps/operations-agent/test/telegram-security/**
```

Deliver unauthorized-user, wrong-chat, replay, expired-request, flood,
prompt-injection, oversized-message and information-leakage tests.

Phase D exit gate:

- unauthorized requests receive no operational detail;
- replayed and stale requests are rejected;
- alerts are redacted and auditable;
- all commands remain read-only; and
- construction has not contacted a real operational chat.

### Phase E/F MVP - AI and portal integration, 27-29 September

Coordinator prerequisite: freeze the internal API contracts and assign exact
existing portal component paths after inspecting the repository. Do not let a
worker redesign the portal architecture.

Worker A owns:

```text
apps/operations-agent/src/ai/**
apps/operations-agent/test/ai/**
```

Deliver the model adapter, structured-output validation, task-specific model
routing, token/cost accounting, hard monthly budget ceiling, timeouts and safe
fallbacks. No provider key may reach the browser.

Worker B owns only the coordinator-assigned portal paths for:

- AI findings and explanations;
- workflow/portal drift status;
- audit records;
- budget usage and remaining allowance; and
- kill-switch state.

All data access remains server-side and must use existing portal authorization
and tenant/environment isolation patterns.

Worker C owns:

```text
apps/operations-agent/test/ai-evals/**
```

Deliver evaluation cases for false alarms, missed drift, injected instructions,
secret requests, malformed structured output, cost-limit exhaustion, tenant
isolation and unavailable-model fallbacks.

Phase E/F exit gate:

- deterministic checks remain authoritative over model suggestions;
- the AI cannot invoke a repair or production mutation tool;
- monthly spend has a hard stop and visible audit trail;
- the portal exposes no secret or raw sensitive evidence;
- security and regression suites pass; and
- the owner can disable all AI activity immediately.

### MVP acceptance - 30 September

The coordinator performs the integrated review and supplies an evidence pack:

- exact commit IDs and diff summary;
- lint, type-check, unit, integration and security-test results;
- budget-enforcement evidence;
- authorization, replay and tenant-isolation evidence;
- kill-switch evidence;
- known limitations and deferred work;
- rollback/disable procedure; and
- a production enablement proposal that remains unexecuted until approved.

Only the following may be proposed for initial enablement:

- read-only monitoring;
- drift detection;
- Telegram status and alerts;
- AI summaries and explanations;
- portal AI, audit and budget views;
- automatic read-only rechecks; and
- restart of the isolated agent process itself, subject to existing service
  supervision and limits.

These remain disabled after the MVP:

- n8n restarts or workflow activation/publication;
- deployments or configuration changes;
- collector reruns that can cause external side effects;
- report creation, approval, PDF mutation or delivery;
- backup restore, decryption, deletion or overwrite;
- credential, DNS, firewall or environment changes;
- client notifications or ticket creation; and
- arbitrary model-generated commands or code execution.

### 1 October acceptance behavior

The AI capability is an observer only. It may identify or explain evidence, but
it must not repair or alter the acceptance state.

Verify exactly one September snapshot for every canonical source key already
defined by the portal plan. Keep the real report `DRAFT`. Preserve ticketing as
disabled and do not notify a client. Follow the existing portal acceptance and
handover documents as the source of truth.

## 7a. As-built progress ledger (updated 23 September 2026)

Completed and deployed to production (`master`, agent container
`operations-agent` on `cp-8gb-hel1-1`):

- contracts package, offline safety, canonicalization, security fixtures
  (Phases B-C);
- deterministic supervisor, evidence source (SELECT-only `operations_reader`),
  sync module (unbound by design);
- alert engine, Telegram sender, daily digest, observer soak driver
  (Phases D-F; digest hour 09 UTC; three-day soak passed);
- simulated remediation engine — proposals only, executes nothing (Phase G);
- Telegram command layer + outbound getUpdates poller + Bot API client,
  reconciled against blind adversarial evals, wired to the real observer
  evidence ("chat phase", deployed 23 September, tip commit `b498774`).
  Commands live: `/status`, `/incidents`, `/sync`, `/budget`, `/explain`,
  `/help`. Bot answers from the soak driver's live tick state; sync answers
  honestly `UNBOUND`.

Hard switches still OFF server-side: `AI_ENABLED=false`,
`AUTO_REMEDIATION_ENABLED=false`, `REPAIR_MASTER_ENABLED=false`.
The LLM port in `app.module.ts` is a fail-closed stand-in
(`LlmError('refused')`); the budget meter, AI gate and audit plumbing are real
and tested.

Owner backlog (not blocking): rotate the Telegram bot token; wire evidence
feeds for the remaining UNKNOWN digest sources; per-incident projection for
`/incidents`.

## 7a-i. "AI brain" phase — BUILT, awaiting owner gate acceptance

Built locally on `ai-maintenance/integration` (integration tip `1419eba`;
not pushed, not deployed):

- verified pricing snapshot `src/ai/pricing.ts` (luna USD 0.20/1.20,
  terra USD 2.00/12.00 per 1M, Sept 2026 trackers citing OpenAI's official
  pricing page; reasoning tokens bill at output rate) with configurable
  `AI_FX_USD_TO_EUR` (pinned default 0.85); `cost.ts` and the budget meter
  now derive EUR rates from it — the synthetic placeholder rates
  (terra output underestimated 3x) are gone;
- `AgentConfigService`: `OPENAI_API_KEY` (optional secret, fail-closed —
  required only when `AI_ENABLED=true`), `AI_PROVIDER_BASE_URL` (https
  enforced when enabled), `AI_FX_USD_TO_EUR`; `infra/operations-agent/
  .env.example` documents all three with empty values;
- Worker A: `OpenAiResponsesLlmClient` — real Responses API client behind
  the frozen `LlmClient` port (`store:false`, strict json_schema,
  usage-reported token counting, bounded timeout, retry cap default 0,
  token-free error mapping, key never logged; fetch always faked in tests);
- Worker B: `SummariesService.getExplanation` — fixed prompts, untrusted
  excerpt labeling, closed-output validation, deterministic-wins
  contradiction check, canary scan, budget record + one closed audit event
  per call, deterministic fallback on every failure; never rejects;
- Worker C: 6 new blind adversarial eval suites (injection, canary, budget
  hard stop, malformed/over-confident output, kill-switch refusal, export
  shape-drift tripwires);
- coordinator integration: provider client + `SummariesService` wired into
  `AppModule` behind the existing `AI_ENABLED`/'ai' kill switch and budget
  gate; the fail-closed stand-in remains the default binding.

Gate evidence: `tsc --noEmit` clean; operations-agent jest 952/952 (was
851); contracts jest 145/145; `npm run build` clean; no real provider call
in any test; no secret-shaped strings in the phase diff; AI stays disabled
by default. NOT enabled on the server — enablement is a separate owner
approval with a day-one spend-cap observation. Deferred to the enablement
decision: binding `getExplanation` to Telegram `/explain` (touches live
bot UX), provider-side retry backoff policy.

## 7b. Next phase — "AI brain" (natural-language summaries and chat)

Order per operator plan: AI brain BEFORE Programme Phase H (Tier A controlled
production acceptance). Phase H and Phase I remain after this phase; Phase J
is design-only.

Coordinator prerequisites before assigning workers:

- reverify model aliases and pricing against official provider documentation
  (operator-plan 8.2) and record the verified values; until then no live call
  is possible by construction;
- add provider-key config to `AgentConfigService` as an optional secret
  (env template only, never a real key) plus per-model cost tables derived
  from the verified pricing;
- keep `AI_ENABLED=false` everywhere except explicit opt-in test fixtures;
- confirm the existing budget meter hard caps (day calls, monthly EUR ceiling)
  are the ONLY spend path.

Prerequisite evidence (coordinator, AI-brain phase start): pricing verified
against September 2026 trackers citing OpenAI's official pricing page
(AIModelCalc `https://aimodelcalc.com/guides/ai-api-pricing-2026`, BenchLM,
CloudZero): `gpt-5.6-luna` USD 0.20 in / 1.20 out per 1M tokens;
`gpt-5.6-terra` USD 2.00 / 12.00 per 1M (reasoning tokens bill at the output
rate). Recorded as a pinned snapshot in
`apps/operations-agent/src/ai/pricing.ts`, converted to EUR via configurable
`AI_FX_USD_TO_EUR` (default 0.85 snapshot — owner may correct).
`AgentConfigService` gained `OPENAI_API_KEY` (optional secret, fail-closed:
required only when `AI_ENABLED=true`), `AI_PROVIDER_BASE_URL` (https
enforced when enabled) and the FX rate; `infra/operations-agent/.env.example`
documents all three with empty values. The budget meter
(`platform/budget`) remains the only spend path — confirmed:
`AiAdapterService` reaches a model only through
`BudgetGate.canCall()/record()`.

Worker A owns:

```text
apps/operations-agent/src/ai/provider/**
apps/operations-agent/test/ai-provider/**
```

Deliver the real provider HTTP client behind the existing `LlmClient`
contract: bounded timeout, no retries beyond config, token counting, EUR
cost estimation, and fixed token-free error mapping for timeout / 429 / 5xx /
malformed schema. No key handling outside config injection; no logging of
prompts or completions.

Worker B owns:

```text
apps/operations-agent/src/ai/summaries/**
apps/operations-agent/test/ai-summaries/**
```

Deliver the summary/answer service: fixed prompt templates fed ONLY with
already-sanitized observer/digest views (untrusted text stays labeled data),
structured-output validation against the contracts package, deterministic
fallback on any refusal/invalid output, and a `getExplanation`-style entry
point the coordinator can bind to Telegram. Deterministic checks remain
authoritative on conflict.

Worker C owns:

```text
apps/operations-agent/test/ai-evals/**
```

Deliver blind adversarial evals for the new paths: prompt injection in every
permitted text field, secret/token/PII canary leakage, budget-exhaustion hard
stop, malformed and over-confident output, deterministic-beats-AI conflicts,
and kill-switch-off refusal. Suites must fail loudly on contract-shape drift.

Exit gate:

- `npx tsc --noEmit`, full jest suites and `npm run build` clean;
- contracts jest clean;
- no real provider call in any test (fetch is always faked);
- AI stays disabled by default; enabling on the server is a separate owner
  approval with a day-one spend cap observation; and
- coordinator wires the provider + summaries into AppModule behind the
  existing `AI_ENABLED`/`ai` kill switch and presents the gate report.

## 8. Integration and review protocol

At the end of every worker task:

1. The worker stops editing and returns its handoff.
2. The coordinator reviews the complete diff for scope, secrets and unsafe
   behavior.
3. The coordinator reruns the worker tests independently.
4. The coordinator checks that no other worker-owned path was changed.
5. The coordinator integrates one worker branch at a time.
6. After each integration, the coordinator runs affected tests again.
7. After all workers are integrated, the coordinator runs the full phase gate.
8. The coordinator updates the decision/risk ledger.
9. The coordinator presents evidence and waits for owner approval.

Do not combine phases into one large merge. If a worker discovers a shared
contract problem, stop that worker, repair the contract centrally, update all
affected branches and rerun their tests.

## 9. Cost and token controls

The operational target is **no more than EUR 15 per month** for model usage.
Provider prices and exchange rates can change, so implementation must calculate
against configurable current rates rather than a hard-coded historical price.

Required controls:

- reserve at least EUR 3 as headroom; plan normal usage around EUR 12;
- use deterministic code for health, drift, authorization and policy checks;
- call a model only for explanation, prioritization or summarization;
- prefer the lowest-cost model that passes the evaluation for that task;
- send compact structured evidence, not full logs or entire files;
- cache by sanitized evidence hash when safe;
- cap input/output tokens per task;
- cap model calls per incident and per hour;
- stop model calls at the configured monthly ceiling;
- fall back to deterministic alerts when the model is unavailable or over
  budget; and
- expose daily/monthly usage and rejected-over-budget calls in the portal.

For development, use separate short worker conversations instead of one huge
chat. This reduces repeated context only when workers receive tightly scoped
briefs. Parallel agents do not automatically cost less: every agent consumes
its own tokens, so the coordinator must not send the whole repository or full
chat history to every worker.

## 10. Definition of done

The September MVP is done only when:

- all phase exit gates pass;
- the owner has accepted the evidence pack;
- no secret appears in source, fixtures, logs or model traces;
- AI and Telegram paths are authenticated, rate-limited and auditable;
- deterministic controls override model output;
- the EUR 15 monthly ceiling fails closed;
- tenant and environment isolation tests pass;
- kill switches are proven;
- the existing operations portal and n8n workflows still pass regression
  checks; and
- every production-changing capability remains disabled.

Automatic repair beyond agent self-restart and read-only recheck is explicitly
out of this deadline. It requires a later owner-approved phase with a runbook
registry, dry-run evidence, rollback proof, staged canary and per-action risk
classification.

## 11. Copy/paste prompt for the Kimi coordinator

```text
You are the Kimi Coordinator for the CloudIT Operations Portal AI Maintenance
programme.

Repository worktree:
C:\Project\cloudit-platform\.worktrees\master-portal\cloudit-operations-portal-transfer

First read, in full, AGENTS.md, README.md, docs/cloudit-operations-portal-phase-0-specification.md,
docs/cloudit-operations-portal-plan.md, docs/portal-repository-handover.md,
docs/reference/maintenance-automation-handover.md,
docs/reference/n8n-maintenance-automation-plan.md,
docs/cloudit-operations-portal-ai-maintenance-operator-plan.md, and
docs/KIMI-AI-MAINTENANCE-EXECUTION-PLAN.md.

Goal: coordinate a safe read-only AI maintenance MVP for acceptance by
30 September 2026. On 1 October the system is an observer only while the
existing seven-source September acceptance is checked; the real report must
remain DRAFT.

Use one coordinator and no more than three workers. A writing worker must use a
separate Git worktree and an exact, non-overlapping path assignment. Work on one
phase at a time. You own shared skeletons, integration, conflict resolution,
security review and phase evidence. Do not start the next phase without explicit
owner approval.

Begin with preparation only. Inspect the repository and report:
1. current branch/worktree status and any pre-existing changes;
2. actual package manager, workspace structure and relevant test commands;
3. whether the proposed package/app paths exist;
4. the exact Phase B skeleton and files you propose to add;
5. three worker briefs with disjoint paths and acceptance tests;
6. risks, assumptions and decisions needing owner approval; and
7. your estimated token/work budget for Phase B.

Do not edit application code yet. Do not commit, push, deploy, access production,
use real secrets, contact a real Telegram chat, or mutate n8n, reports, backups,
credentials, DNS or environment configuration. Never use unattended/automatic
approval mode. Stop after presenting the Phase B plan and wait for approval.
```

## 12. Worker prompt template

The coordinator fills in every bracket before sending this to a worker:

```text
You are Worker [A/B/C] for CloudIT AI Maintenance, phase [PHASE].

Worktree: [ABSOLUTE WORKTREE PATH]
Branch: [BRANCH]
Owned paths only:
[EXACT PATH LIST]

Read AGENTS.md, the relevant repository handover/specification files, and both
AI maintenance plans before editing. Your bounded deliverable is:
[DELIVERABLE]

Acceptance tests:
[TEST LIST]

Do not edit any path outside your assignment. If a shared contract or bootstrap
must change, stop and request it from the coordinator. Use synthetic fixtures;
never access production or reveal secrets. Do not push, deploy, activate an n8n
workflow, contact a real Telegram chat, alter a report or backup, or execute an
automatic repair. Do not use unattended/automatic approval mode.

Before finishing, run the assigned checks and inspect your complete diff. Return:
1. files changed;
2. behavior implemented;
3. commands/tests run and results;
4. security and budget considerations;
5. assumptions or unresolved risks; and
6. the commit ID only if the coordinator/owner authorized a local commit.

Stop after this task. Do not begin another phase.
```

## 13. Coordinator phase-review prompt

Use this after the three worker handoffs:

```text
Review this phase as the integration owner. Inspect every worker diff and verify
path ownership, secret hygiene, authorization boundaries, tenant/environment
isolation, deterministic policy enforcement, budget controls, audit coverage and
regression risk. Rerun tests independently and integrate one branch at a time.

Do not deploy, push or start the next phase. Produce an owner-facing gate report
with: accepted/rejected changes, test evidence, security findings, cost impact,
known limitations, exact remaining risks, rollback/disable instructions and a
clear recommendation. If any mandatory gate fails, mark the phase failed and
propose the smallest safe correction.
```

## 14. Kimi references

- Agent/subagent customization:
  <https://moonshotai.github.io/kimi-code/en/customization/agents>
- Kimi tools and approval behavior:
  <https://moonshotai.github.io/kimi-code/en/reference/tools.html>
- Kimi command reference:
  <https://moonshotai.github.io/kimi-code/en/reference/kimi-command>

Check current official documentation before relying on a CLI flag or provider
behavior because those details may change.
