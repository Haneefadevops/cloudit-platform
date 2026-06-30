# OrbitOne Phase Delivery Plan

This plan follows `OrbitOne_ARCHITECTURE_v3_OFFICIAL.md`.

## Phase 1: Digital Business Card MVP

Goal:

Create profile -> generate QR -> share -> save contact -> add to network -> see basic dashboard metrics.

Build status:

- Authentication: implemented, needs browser QA.
- Profile Builder: implemented, needs browser QA.
- Public Profile: implemented, needs public URL configuration.
- QR Code: implemented, needs public URL configuration.
- Save Contact `.vcf`: implemented, needs browser QA.
- Add To Network: implemented, needs browser QA with two users.
- Dashboard: implemented, needs metrics QA.
- Connections List: implemented, needs browser QA.
- Basic Analytics: implemented, needs event QA.

Codex owns:

- Backend API correctness.
- PostgreSQL migrations.
- Auth/session security.
- vCard output.
- Analytics storage and metrics.
- Docker/local/test/prod environment wiring.
- Final integration tests.

Kimi owns:

- User-facing flows and polish.
- Mobile-first responsive UI.
- Public profile/QR/share UX.
- Loading, empty, success, and error states.
- Brand consistency.

Phase 1 completion checklist:

- QR/share URLs use `NEXT_PUBLIC_APP_URL`, not `window.location.origin`.
- API base uses `NEXT_PUBLIC_API_BASE_URL`.
- Local `.env.local` uses local URLs.
- Test `.env.test` uses `https://to1.cloudit.lk`.
- Production `.env.prod` uses `https://po1.cloudit.lk`.
- Register/login/profile publish flow passes in browser.
- Public profile is reachable from another device after test deployment.
- vCard downloads with correct name, title, company, email, phone, and URLs.
- Add To Network works with two different accounts.
- Duplicate Add To Network shows a clean error state.
- Dashboard metrics update after profile view, vCard download, and connection add.
- Frontend lint/build pass.
- Backend typecheck/build pass.
- Docker Compose local stack starts cleanly.

## Phase 2: Professional Networking

Status: started after local Phase 1 validation.

Build now:

- Profile discovery for published OrbitOne profiles.
- Connection status: not saved, saved by me, saved me, mutual.
- Inbound network list: people who saved my profile.
- Mutual connections list.
- Improved networking dashboard summary.

Do not build CRM workflows yet.

Codex owns:

- `GET /api/v1/profiles?query=&limit=`
- `GET /api/v1/network/summary`
- `GET /api/v1/network/inbound`
- `GET /api/v1/network/mutual`
- Shared TypeScript contracts for networking.

Kimi owns:

- Discovery page or section.
- Inbound/mutual connection UI.
- Network dashboard cards.
- Mobile-first search/filter states.
- Empty/loading/error states.

## Phase 3: Relationship Management

Status: backend complete and ready for Kimi frontend implementation.

Build now:

- Private notes on saved connections.
- Private tags for organizing saved connections.
- Follow-ups with due dates and completion state.
- Lightweight relationship status:
  - `new`
  - `active`
  - `follow_up`
  - `opportunity`
  - `archived`

Codex owns:

- `backend/migrations/0002_relationship_management.sql`
- Relationship management API contracts.
- Ownership checks so users can manage only their own saved connections.

Kimi owns:

- Connection detail or side panel UI.
- Notes UI.
- Tags UI.
- Follow-up list/create/complete UI.
- Relationship status selector.

Frontend contract note:

- Follow-up completion is represented by `completedAt`; treat `completedAt !== null` as complete.

Do not build full CRM pipelines, AI, payments, or events.

## Phase 4: Event Networking

Status: backend complete and ready for Kimi frontend implementation.

Build now:

- Event profile sharing through public event pages.
- Event check-in with a published OrbitOne profile.
- Event attendee networking surfaces with connection status.

Codex owns:

- `backend/migrations/0003_event_networking.sql`
- Event networking API contracts.
- Ownership and attendee access checks.

Kimi owns:

- Event list/create/edit UI for hosts.
- Public event page.
- Event check-in UI.
- Event attendee networking UI.

Do not build tickets, payments, agendas, event CRM, AI, or automations.

## Phase 5: Light CRM

Status: backend complete and ready for Kimi frontend implementation.

Build now:

- Lightweight lifecycle stage on saved connections.
- Priority and next step.
- Simple private activity timeline.
- CRM dashboard summary widgets.

Codex owns:

- `backend/migrations/0004_light_crm.sql`
- Light CRM API contracts.
- Ownership checks for private CRM data.

Kimi owns:

- CRM summary widgets on dashboard.
- Lifecycle/priority/next-step UI on connection detail.
- Activity timeline list/create/delete UI.

Do not build full CRM pipelines, deal objects, forecasts, payments, AI, or automations.

## Not In Current Build

- AI relationship assistant.
- Payments.
- Full CRM.
- n8n workflows inside OrbitOne infrastructure.
- Kubernetes or multi-server production.

## Current Handoff To Kimi

Owner: Kimi
Area: Phase 1 frontend completion
Files changed:

- Frontend files under `frontend/`

What changed:

- Phase 1 frontend exists and builds.
- Backend and Docker stack are running locally.

Contract needed:

- Use `NEXT_PUBLIC_APP_URL` for public profile links, QR values, share links, and copied links.
- Use `NEXT_PUBLIC_API_BASE_URL` for API calls and vCard download URLs.
- Keep public profile route as `/u/[slug]`.

Open questions:

- Confirm the first deployed test URL remains `https://to1.cloudit.lk`.
- Confirm the first production URL remains `https://po1.cloudit.lk`.

Verification:

- After Kimi updates public URL handling, run `npm.cmd run lint` and `npm.cmd run build` in `frontend/`.
