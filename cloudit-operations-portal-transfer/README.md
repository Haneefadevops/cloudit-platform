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
- Phase 5 (overview and workflow visualization): implemented, not deployed;
  awaiting owner acceptance at the Phase 5 gate. See
  `docs/cloudit-operations-portal-phase-5-overview.md`.
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

