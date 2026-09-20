# AI Maintenance programme — phase gate record

Single running log of owner decisions at each phase gate. One entry per
gate; newest at the bottom. This file is part of the 30 September 2026 MVP
acceptance evidence pack.

## Phase G — Simulated remediation

**Date:** 2026 (recorded at Phase G gate)
**Gate (operator plan):** owner approves each initial Tier A runbook
individually.

**Owner decision:** `WF_STALE_SNAPSHOT` (rb-wf-stale-snapshot) APPROVED as
the first Tier A candidate. `WF_DRIFT_MISMATCH`, `INGESTION_GAP` and
`PORTAL_PROJECTION_STALE` are HELD — not rejected, pending owner review.

**Effect of this decision:** none operationally. The remediation engine
remains execute-nothing; approval only certifies the runbook text as an
acceptable procedure. No runbook may activate before Phase H controlled
production acceptance, which itself requires the Phase F seven-day
alert-only soak to have passed and a separate explicit owner approval.

**Verification at gate:** agent 86 suites / 650 tests, contracts 16 / 145,
portal tsc + eslint + build, secret sweep 0 matches (commit `5e1ffbd`).

## Deployment record — AI maintenance soak preparation (between Phases G and H)

**Date:** 2026-09-20
**Owner approvals:** sender binding gate, deployment-definition gate, and
the merge-to-master deploy (steps 1-3) each approved explicitly by the
owner in sequence.

**What shipped to production (master `56380df`, via the push-to-master
GitHub Action):**
- Telegram alert sender behind the engine's sender port (fail-closed until
  the server env provides a token; kill switch off by default)
- `infra/operations-agent/` deployment definition: Dockerfile, compose
  service (no published ports, read-only rootfs, protected env file),
  deploy.sh + rollback.sh wiring
- First deploy attempt (`e53b3af`) failed at the image build; three defects
  (hoisted node_modules COPY, tsc output root skewed by tsconfig paths,
  headless process exiting after init) were reproduced and fixed locally
  (`56380df`) before the successful re-deploy

**Production state after deploy:** `operations-agent` container running and
fully inert (`ai=false telegram=false remediation=false repairMaster=false`,
env created from the all-off template). Platform health checks green, no
rollback. No Telegram contact, no AI calls, no remediation — nothing is
enabled.

**Next (owner-side, not yet done):** place bot token / webhook secret /
allow-listed IDs in `infra/operations-agent/.env` on the server, decide
DM vs group for the first allow-listed chat, then explicitly enable
`TELEGRAM_COMMANDS_ENABLED=true` to start the 7-day alert-only soak.
