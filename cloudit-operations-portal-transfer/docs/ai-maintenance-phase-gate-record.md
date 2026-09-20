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
