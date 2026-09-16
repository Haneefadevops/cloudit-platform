# CloudIT Operations Portal

This folder is the transfer package for the private multi-client CloudIT
Operations Portal planned for `operations.cloudit.lk`.

## Current state

- Phase 0 specification: approved.
- Phase 1 visual design: approved.
- Phase 2 foundation: deployed to `operations.cloudit.lk` on 10 September 2026
  with password-only login (TOTP deferred; required no later than Phase 10);
  awaiting the owner's final login check and explicit approval. See
  `docs/cloudit-operations-portal-phase-2-foundation.md`.
- Phase 3 (operations database): approved by the owner on 10 September 2026.
  Production acceptance passed (isolation suite 89/89 on the server). See
  `docs/cloudit-operations-portal-phase-3-database.md`.
- Phase 4 (sanitized n8n publishing): approved by the owner on 11 September
  2026. Production gate evidence recorded in
  `docs/cloudit-operations-portal-phase-4-publishing.md`.
- Phase 5 (overview and workflow visualization): approved and live. See
  `docs/cloudit-operations-portal-phase-5-overview.md`.
- Phase 6 (infrastructure analytics): approved and live. See
  `docs/cloudit-operations-portal-phase-6-collector-design.md`.
- Phase 7 (Vercel and ImageKit analytics): built and live; the ~48h soak and
  the identical-range comparison gate against the provider dashboards remain
  pending owner approval. See `docs/cloudit-operations-portal-phase-7-vercel-imagekit.md`.
- Phase 8 (backup centre, Cloudflare R2): gate passed for backup evidence on
  15 September 2026; collector activated on the corrected ~09:00 UTC schedule.
  Restore-test evidence and the monthly-prefix verification are deferred to
  the first scheduled monthly restore test (expected early October 2026). See
  `docs/cloudit-operations-portal-phase-8-backup-centre.md`.
- Phase 9 (read-only Report Centre): built and locally verified. Metadata list,
  sanitized findings/history, inactive summary publisher, private R2 PDF relay,
  same-origin preview/download, and atomic one-use nonce claims are complete.
  Deployment, relay activation, and the unchanged-state real-DRAFT gate remain
  pending owner approval. See
  `docs/cloudit-operations-portal-phase-9-report-centre.md`.
- Phase 10 (guarded report actions): built, committed (`0afccde`) and deployed
  on 16 September 2026. Migration `0011` applied automatically and verified
  idempotent; the command workflow `CloudIT - Guarded Report Command` is
  imported with credentials. Per owner decision on 16 September 2026 the
  step-up TOTP requirement was removed: actions are available to any
  authenticated owner session (email+password), with session auth, rate
  limiting, strict Origin and CSRF HMAC checks still enforced. Login-time
  TOTP remains optional (`OPERATIONS_MFA_REQUIRED=false`). See
  `docs/cloudit-operations-portal-phase-10-report-actions.md`.
- The scheduled 1 October 2026 Phase 5E acceptance remains pending and its real
  report must remain `DRAFT` during review.
- `ticketing_enabled` must remain `false`.

## Transfer

Copy the contents of this folder into the root of the separate private CloudIT
platform repository. Do not copy the folder into the Cavetta application as a
permanent subproject.

After copying, open the destination repository as the workspace and ask the new
session to read `AGENTS.md`, this file, the Phase 0 specification, and the portal
plan completely. The owner must explicitly approve Phase 0 before Phase 1 begins.

## Intended hosting

- Portal application: dedicated Docker container on the CloudIT server.
- Operations database: dedicated PostgreSQL container, database role, volume and
  backup policy on the CloudIT server.
- Reverse proxy: existing server proxy, with HTTPS for
  `operations.cloudit.lk`.
- Cavetta data: remains in its existing Supabase cloud project and is never used
  as the operations database.
- n8n: remains the provider-integration and automation layer and publishes only
  sanitized operational evidence.

See `docs/deployment-architecture.md` for the proposed later deployment flow.
