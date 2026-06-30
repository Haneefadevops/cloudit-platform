# OrbitOne

Turn every introduction into an opportunity.

OrbitOne v2 is a focused professional networking and lightweight CRM app built around one loop:

**Digital business card → booked meeting → CRM record.**

## Current state

The v2 redesign is **feature-complete on the backend** and **functionally complete on the frontend**. The latest work is the production-readiness and UI/UX redesign planning track.

### Recently completed

- **Track 1 backend production/security fixes** — Redis-backed sessions and rate limiting, hardened CORS/cookies, structured logging, idempotent migration runner, CRM and ratings authorization hardening, legacy `/api/v1` disabled in production.
- **CRM Phases 2-4** — activity types, templates, automation rules, webhooks, bulk actions, duplicate detection/merge, JSON import, pipeline board with drag-and-drop, lifecycle ↔ pipeline sync.
- **B2B accounts** — business account CRUD, contact linking, cross-organization connections, public directory.
- **Documents + feedback** — PDF quotations/agreements, feedback requests, public rating page.
- **Business admin + staff** — organization creation, staff invites, staff profiles, accept-invite flow.
- **Billing upgrade** — Pro Individual and Pro Business plans (placeholder toggle, no real payments).
- **Free calendar with limits** — public booking, availability, meeting types, weekly booking limit enforcement.
- **Core identity** — auth, profile builder, public profile, QR code, vCard download.

### In progress

- **Production-readiness and UI/UX redesign planning** — a two-track plan separating security/production fixes (Track 1, done) from a visual refresh to a purple-accented dashboard style (Track 2).

## What's in this repo

- `backend/` — Express + TypeScript API, PostgreSQL 17, Redis.
- `frontend-v2/` — React 19 + Vite 6 + React Router 7 + TanStack Query + Tailwind CSS 4. This is the current redesign.
- `frontend/` — Legacy Next.js frontend (kept until v2 is fully launched).
- `contracts/` — Shared TypeScript contracts between frontend and backend.
- `docs/` — Architecture, contracts, and phase plans.
- `infra/` — Traefik and deployment notes.

## Product loop

1. A professional creates a profile and shares a QR code or link.
2. A lead scans/saves the contact, then books a meeting.
3. On paid plans, the meeting becomes a customer record with lifecycle, notes, follow-ups, and ratings.

## Freemium model

| Plan | Price (LKR) | Key features |
|---|---|---|
| **Free** | 0 | Profile + QR + vCard, save contact, calendar booking up to 3/week. |
| **Pro Individual** | 1,990/month | Unlimited bookings, custom slug priority, remove branding, basic analytics. |
| **Pro Business Starter** | 4,990/month | Everything in Pro Individual + CRM, pipeline, ratings, documents, feedback, B2B accounts, admin analytics, staff profiles. |
| **Pro Business Growth / Enterprise** | Contact us | Larger staff limits and onboarding. |

Plan upgrades are currently a development placeholder (no real payment gateway yet).

## Tech stack

**Backend**

- Express 4 + TypeScript 5
- PostgreSQL 17 + Redis 7
- JWT sessions stored in Redis (httpOnly cookies in production)
- Zod validation
- Domain-based routers under `/api/v2/`
- `pino` structured logging
- Idempotent SQL migration runner (`npm run migrate`)

**Frontend v2**

- React 19 + Vite 6 + TypeScript 5
- React Router 7 (data routers)
- TanStack Query v5
- Tailwind CSS 4
- React Hook Form + Zod
- react-qr-code, date-fns, lucide-react

## Local development

1. Copy `.env.example` to `.env.local` and set a strong `JWT_SECRET`.
2. Start the backend, PostgreSQL, and Redis:

```sh
docker compose -f docker-compose.local.yml up --build
```

This starts the legacy frontend on `http://localhost:3000`, the backend on `http://localhost:8000`, PostgreSQL on `5432`, and Redis on `6379`.

3. In another terminal, start the new frontend-v2 dev server:

```sh
cd frontend-v2
npm install
npm run dev -- --port 3002
```

Open `http://localhost:3002`.

### Local service ports

| Service | URL |
|---|---|
| Frontend v2 | http://localhost:3002 |
| Legacy frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

## Project structure

```
backend/
  src/
    domain/        # domain routers: auth, profiles, scheduling, customers, crm, organizations, accounts, billing, documents, feedback, analytics
    middleware/    # auth, rate limiting, plan/usage gates
    db/            # postgres + redis clients
    migrations/    # raw SQL migrations
    scripts/       # migration runner, baseline recorder
frontend-v2/
  src/
    app/           # page components
    components/    # UI primitives and feature components
    hooks/         # TanStack Query hooks
    providers/     # auth + theme providers
    lib/           # API client, contracts, utils
    routes.tsx     # React Router routes
```

## Testing

Backend:

```sh
cd backend
npm run typecheck
npm run build
npm run migrate   # applies migrations against DATABASE_URL
```

Frontend v2:

```sh
cd frontend-v2
npm run lint
npm run build
npx playwright test
```

The full Playwright e2e suite currently has **9 tests** and is passing.

## v2 scope guardrails

In scope:

- Auth, profile builder, public profile, QR, vCard, save contact.
- Scheduling, availability, meeting types, bookings.
- Upgrade flow (placeholder), basic + admin analytics.
- Customer CRM, pipeline, tags, notes, follow-ups, activities.
- Customer ratings and feedback requests.
- Documents and PDF quotations/agreements.
- Organizations, staff invites/profiles, B2B accounts, directory.
- CRM automation rules, activity types, templates, webhooks, bulk actions, duplicate merge, import/export.

Explicitly not in v2:

- Public events module.
- Heavy profile discovery / social feed.
- Payments/invoicing (placeholder upgrades only).
- AI features.
- Mobile native app.

## Architecture & planning docs

- `OrbitOne_ARCHITECTURE_v3_OFFICIAL.md` — system architecture.
- `docs/orbitone-redesign-v2-plan.md` — v2 redesign plan.
- `docs/production-readiness-and-uiux-redesign-plan.md` — production readiness and redesign planning.
- `AGENTS.md` — active collaboration board and handoff notes.
- `BRAND_GUIDELINES.md` — colors, typography, and tone.
