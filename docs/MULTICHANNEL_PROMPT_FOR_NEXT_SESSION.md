# Prompt for next Kimi session — TheReplyte multi-channel rollout

## Your role

You are executing the plan in `docs/THEREPLYTE_MULTICHANNEL_ONBOARDING_PLAN.md`. You must work **one phase at a time**, finish it completely, commit it locally, and then **stop** so the user can bring the result back to the original Kimi session for verification.

## Hard rules

1. **Stick to the plan.** Do not skip phases, reorder phases, or add unplanned features. If a phase seems ambiguous, ask the user before deviating.
2. **One phase per run.** Finish the current phase fully, then stop. Do not start the next phase until the user says the original Kimi session has verified the previous one.
3. **Commit after every phase.** Use a clear, descriptive commit message. Example: `feat(thereplyte): Phase 1 — channel-aware conversation reply and Messenger/Instagram handoff`.
4. **Do NOT push.** Never run `git push`. Local commits only.
5. **Minimal changes.** Match the existing code style, naming, and file structure. Do not refactor unrelated code.
6. **Verify before declaring done.** Run the relevant build/test commands for the app(s) you changed. Do not say a phase is complete while tests are red or the build is broken.
7. **Update docs in Phase 0 only.** Do not modify docs in later phases unless the plan explicitly says so.

## Workflow per phase

1. Read `docs/THEREPLYTE_MULTICHANNEL_ONBOARDING_PLAN.md` and identify the current phase.
2. Implement every task listed for that phase.
3. Run the relevant checks:
   - Backend/API changes: `cd apps/whatsapp-agent-api && npm run build && npm run test`
   - Dashboard changes: `cd apps/whatsapp-agent-web && npm run build` (or the project's lint/typecheck command)
4. Fix any errors before proceeding.
5. Stage and commit all changes for the phase.
6. **STOP.** Return a concise summary to the user with:
   - What was changed (files)
   - Test/build results
   - The commit hash and message
   - Any blockers or deviations from the plan
   - A clear note: "Ready for verification by the original Kimi session."

## Communication style

- Be concise. No motivational filler.
- Report facts, not assumptions. If you could not run a test, say so plainly.
- If a task in the plan is already done or partially done, note it and move on.

## Current plan summary (do not modify)

- Phase 0: Documentation alignment
- Phase 1: Backend routing fixes (channel-aware reply + Messenger/Instagram handoff)
- Phase 2: Dashboard client onboarding (channel-aware form)
- Phase 3: Dashboard customer and support views
- Phase 4: Analytics, AI settings, and playground
- Phase 5: CloudIT go-live and regression

## Start of session instructions

When the session begins, ask the user which phase to start with (or infer from context), then execute only that phase and stop.
