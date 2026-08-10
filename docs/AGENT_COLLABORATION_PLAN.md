# Agent Collaboration Plan — Kimi (K3) + Codex

Status: approved direction, planning only. No feature code has been built yet.

Purpose: reduce K3 token consumption by delegating heavy implementation to Codex,
while keeping architecture, the AI core, and quality control with Kimi.

Principle: **Kimi keeps the brain, Codex gets the hands.**

---

## 1. Roles

### Kimi (K3) — architect / AI core / reviewer
- Writes a task spec for every Codex job (schema, API contracts, acceptance criteria).
- Designs and implements the AI-sensitive parts: workflow detection logic,
  system-prompt injection, qualification/classification prompts, review-reply prompts.
- Reviews every Codex diff against the spec before merge. Pattern violations go back with notes.
- Keeps docs, roadmap, and this plan current.
- Owns ambiguous product decisions.

### Codex — heavy implementation from specs
- Prisma models + migrations from Kimi's schema spec.
- NestJS modules, controllers, services, DTOs (pattern-following work).
- Next.js dashboard pages (workflow editor, customers/leads views, approval queues).
- API endpoint implementations (transactional API, Google reviews plumbing).
- Unit tests for the modules it builds.

---

## 2. How the two agents work together — sequential within a task, pipelined across tasks

It is **not** free-running parallel work, and **not** a strict one-at-a-time chain.
It is a pipeline:

```
Kimi:  [spec T1] [review T1] [spec T2] [review T2] [spec T3] ...
Codex:           [build T1]            [build T2]            [build T3] ...
```

- **Within one task: strictly sequential.** Kimi writes the spec → Codex builds only
  from that spec → Kimi reviews → fixes go back to Codex → merge. Codex never starts
  without a spec and never merges without review.
- **Across tasks: pipelined.** While Codex is building task N, Kimi writes the spec
  for task N+1. This is where the parallelism and the token savings come from.
- **Dependent features stay sequential.** The comment→DM pipeline depends on AI
  Workflows and the Messenger/IG bridge — those land first regardless of pipeline.
- One active Codex task at a time by default. Two parallel Codex tasks are allowed
  only when they touch disjoint apps (e.g. one API module + one landing-page task).

---

## 3. Task workflow (every task)

1. **Kimi writes a task spec** (template in section 5) and saves it under
   `docs/tasks/<phase>-<name>.md`.
2. **Codex reads `docs/CODEX_PLAYBOOK.md` first**, then the task spec. Nothing else
   is required reading; the spec must be self-contained.
3. **Codex builds on a branch** named `codex/<task-name>`, runs the verification
   commands from the spec, and reports what it changed and the command results.
4. **Kimi reviews the diff** against the spec: contracts, patterns, scope.
5. If changes are needed, **Kimi writes review notes and Codex fixes**. Repeat.
6. **Merge only after Kimi approves.** Codex never commits to the main branch
   and never merges its own work.

---

## 4. Per-feature allocation

| # | Feature | Kimi | Codex | Depends on |
|---|---------|------|-------|-----------|
| 1 | AI Workflows + AI-qualified CRM | Schema design, detection + prompt-injection logic, qualification prompts, review | Prisma models/migrations, workflows CRUD module, categories module, dashboard UI (workflow editor, leads view), tests | — |
| 2 | CTWA attribution | Spec only (small) | Entire build — **trial task** to validate this workflow | — |
| 3 | Messenger/IG via Chatwoot bridge | Plan + Chatwoot config design, webhook mapping decisions | Execution, infra config, setup docs | — |
| 4 | Google review AI replies | Reply-generation prompt design | GBP API plumbing module, approval queue UI | — |
| 5 | Comment → DM → lead pipeline | Orchestration design, comment-reply prompt | Comment webhook module, moderation queue UI | 1, 3 |
| 6 | Transactional API (OTP/utility) | API contract spec | Full build: API keys, send endpoint, logging | — |
| 7 | Landing page multi-channel rewrite | Copy + positioning (after channels ship) | Component/copy implementation | 3 |

Parked: marketing campaigns / bulk messaging (Meta quality-rating / ban risk).
Rejected: visual flow builder, keyword-rule engine (replaced by feature 1).

---

## 5. Task spec template (Kimi writes one per Codex task)

```markdown
# Task: <name>
Phase: <n> | App: <whatsapp-agent-api | whatsapp-agent-web | infra | thereplyte-landing>

## Goal
<one paragraph: what exists after this task that didn't before>

## Context
<only what Codex needs: relevant existing files, models, patterns to copy>

## Files to create / modify
- CREATE: <path> — <what it does>
- MODIFY: <path> — <what changes, precisely>

## Contracts
<exact Prisma model fields / endpoint signatures / DTO shapes / UI behavior>

## Do NOT
- <files/areas out of scope>
- no new npm dependencies
- no changes to existing behavior outside the listed files

## Acceptance criteria
- [ ] <verifiable statement>
- [ ] builds: `pnpm --filter whatsapp-agent-api build` passes
- [ ] tests: `pnpm --filter whatsapp-agent-api test` passes

## Report back
<what Codex must state when done: files changed, command outputs, deviations>
```

---

## 6. Sequencing

1. **Feature 2 (CTWA attribution) first** — small, self-contained, validates that Codex
   follows the playbook before it is trusted with the flagship build.
2. Feature 1 (AI Workflows + CRM) — the flagship; largest spec, closest review.
3. Feature 3 (Messenger/IG bridge) — can pipeline with feature 1's UI work.
4. Features 4 and 6 — independent, fit wherever capacity allows.
5. Feature 5 — after 1 and 3.
6. Feature 7 (landing page) — only after channels are live; also fixes the three
   current over-claims ("Broadcast campaigns", "Custom integrations & API access",
   "qualify leads") which may be fixed earlier as a standalone copy edit.

## 7. Token-efficiency rules (the reason this plan exists)

- Specs are self-contained so Codex never roams the repo.
- Kimi does not re-read files Codex already reported on unless the review demands it.
- Review feedback is a diff-level note list, not re-explained architecture.
- One spec = one focused task. Large features are split into multiple specs
  (schema+API first, UI second) rather than one giant prompt.
