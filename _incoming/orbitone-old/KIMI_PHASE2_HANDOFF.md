# Kimi Phase 2 Handoff

Owner: Kimi
Area: Phase 2 Professional Networking frontend
Files changed:

- `docs/phase-delivery-plan.md`
- `docs/backend-contracts.md`
- `contracts/orbitone.ts`

What changed:

- Codex started Phase 2 backend contracts for professional networking.
- Phase 2 must stay focused on networking, not CRM.

Contract needed:

- Use `GET /api/v1/profiles?query=&limit=` for discovering published profiles.
- Use `GET /api/v1/network/summary` for dashboard networking cards.
- Use `GET /api/v1/network/inbound` for people who saved my profile.
- Use `GET /api/v1/network/mutual` for mutual connections.
- Continue using `POST /api/v1/connections` to save a profile to my network.

Shared types:

- `NetworkConnectionStatus`
- `NetworkProfile`
- `NetworkSummary`

UI to build:

- Add a networking/discovery surface, likely `/dashboard/network`.
- Add search input for published profile discovery.
- Show connection badges:
  - `none`
  - `saved`
  - `saved_me`
  - `mutual`
- Add inbound and mutual sections.
- Add summary cards for saved by me, saved me, mutual, and discoverable profiles.

Do not build:

- Notes.
- Tags.
- Follow-ups.
- Lead status.
- CRM pipelines.
- Events.
- AI.
- Payments.

Open questions:

- Confirm whether `/dashboard/network` is the preferred route.
- Confirm whether `/dashboard/connections` should remain saved-by-me only or become the broader network page.

Verification:

- Run `npm.cmd run lint` in `frontend/`.
- Run `npm.cmd run build` in `frontend/`.
- Test with two accounts to verify `saved`, `saved_me`, and `mutual` states.
