# @cloudit/operations-agent-contracts

Offline contracts and safety fixtures for the CloudIT AI Maintenance
programme (see `cloudit-operations-portal-transfer/docs/cloudit-operations-portal-ai-maintenance-operator-plan.md`
and `cloudit-operations-portal-transfer/docs/KIMI-AI-MAINTENANCE-EXECUTION-PLAN.md`).

**Scope:** typed contracts, deterministic canonicalization/hashing, drift
comparison and adversarial security fixtures. Everything here runs fully
offline against synthetic fixtures. No network access, no secrets, no
production data.

## Path ownership (Programme Phase B)

| Path | Owner |
| --- | --- |
| `src/contracts/**`, `test/contracts/**` | Worker A |
| `src/canonicalization/**`, `test/canonicalization/**` | Worker B |
| `src/security/**`, `test/security/**` | Worker C |
| `package.json`, `tsconfig*.json`, `jest.config.js`, `src/index.ts`, this file | Coordinator |

Workers never edit paths outside their assignment. Shared changes go
through the coordinator.

## Commands

```bash
npm test          # jest, offline only
npm run typecheck # tsc --noEmit
npm run build     # emits dist/
```
