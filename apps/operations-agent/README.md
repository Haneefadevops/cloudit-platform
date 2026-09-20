# @cloudit/operations-agent

Read-only operations agent for the CloudIT AI Maintenance programme
(see `cloudit-operations-portal-transfer/docs/cloudit-operations-portal-ai-maintenance-operator-plan.md`).

**Phase C scope:** deterministic read-only runtime — sanitized evidence reads,
deterministic assessments, workflow-portal sync observation, job/budget/audit
controls and kill switches. No AI calls, no Telegram, no alerts, no repairs.
Everything runs against synthetic/local evidence.

## Path ownership (Programme Phase C)

| Path | Owner |
| --- | --- |
| `src/supervisor/**`, `test/supervisor/**` | Worker A |
| `src/sync/**`, `test/sync/**` | Worker B |
| `src/platform/**`, `test/platform/**` | Worker C |
| `src/telegram/webhook/**`, `test/telegram-webhook/**` | Worker A (Phase D) |
| `src/telegram/commands/**`, `test/telegram-commands/**` | Worker B (Phase D) |
| `test/telegram-security/**` | Worker C (Phase D) |
| `src/ai/**`, `test/ai/**` | Worker A (Phase E) |
| `test/ai-evals/**` | Worker C (Phase E) |
| `src/alerts/**`, `test/alerts/**` | Worker A (Phase F) |
| `test/alerts-evals/**` | Worker C (Phase F) |
| `src/ai-bindings/**` | Worker B (Phase F) |
| `test/ai-bindings/**` | Worker B (Phase F) |
| `src/remediation/**`, `test/remediation/**` | Worker A (Phase G) |
| `test/remediation-evals/**` | Worker C (Phase G) |
| `src/alerts/telegram-sender.ts`, `test/alerts/telegram-sender.spec.ts` | Worker A (sender binding) |
| `package.json`, `tsconfig*.json`, `jest.config.js`, `.gitignore`, `src/main.ts`, `src/app.module.ts`, `src/config/**`, `src/telegram/telegram.types.ts`, `src/telegram/index.ts`, `test/bootstrap.spec.ts`, `test/app-wiring.spec.ts`, `test/telegram-config.spec.ts`, `test/ai-config.spec.ts`, this file | Coordinator |

Workers never edit paths outside their assignment; shared wiring goes through
the coordinator. Import shared contracts with
`@cloudit/operations-agent-contracts` (mapped to source for tests; resolves to
the built package at runtime). Configuration only via `AgentConfigService` —
never read `process.env` directly.

## Commands

```bash
npm test          # jest, offline only
npm run typecheck # tsc --noEmit
npm run build     # emits dist/
```
