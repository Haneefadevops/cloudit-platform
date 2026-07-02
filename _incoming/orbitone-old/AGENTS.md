# OrbitOne Agent Collaboration Guide

## Product North Star

OrbitOne helps professionals turn every introduction into an opportunity.

### Redesign v2 scope

The product is being redesigned around one clear loop: **digital business card → booked meeting → lightweight CRM**.

Free tier:

- Authentication
- Profile builder + public profile
- QR code + save contact as `.vcf`
- Basic network (saved contacts)
- Calendar booking up to a weekly limit

Paid tier:

- Pro Individual: unlimited bookings, analytics, custom branding
- Pro Business: admin panel, staff profiles, customer CRM, ratings, admin analytics

Do not build events, heavy networking discovery, AI, payments/invoicing, or full CRM pipelines in v2.

Every feature must answer:

> Does this help users turn introductions into opportunities?

If the answer is no, do not build it.

## Team Roles

### Codex

Codex is the team lead and backend developer.

Codex owns:

- Product and technical direction
- Backend architecture
- Database schema
- PostgreSQL setup
- Authentication integration
- Backend authorization policies
- Server actions and backend API boundaries
- Analytics data model and events
- vCard generation
- Git commits and pushes
- Final integration checks before shipping

Codex may review frontend work for integration, security, product fit, and consistency, but should not take over frontend implementation unless explicitly requested.

### Kimi

Kimi is the frontend developer.

Kimi owns:

- Landing page
- Dashboard UI
- Profile pages
- Connections page
- Settings page
- Mobile-first responsive layouts
- Frontend interaction states
- Visual consistency with `BRAND_GUIDELINES.md`

Kimi should not build backend logic, database migrations, backend authorization policies, authentication internals, analytics storage, or vCard generation.

## Brand Rules

Always write the product name as `OrbitOne`.

Use the brand defined in `BRAND_GUIDELINES.md`:

- Primary: `#1A2E26`
- Secondary: `#047857`
- Accent: `#D97706`
- Background: `#FFFBF7`
- Surface: `#F5F2EE`
- Border: `#E7E2DC`
- Text: `#1F2937`
- Muted: `#786B5D`
- Typography: Inter, falling back to `system-ui`

The product should feel professional, premium, modern, trustworthy, global, minimal, and innovative.

## Source Of Truth

Read these files before major work:

- `README.md`
- `PROJECT_VISION.md`
- `MVP_REQUIREMENTS.md`
- `ROADMAP.md`
- `BRAND_GUIDELINES.md`
- `docs/orbitone-redesign-v2-plan.md`
- `prompts/backend_codex.md`
- `prompts/frontend_kimi.md`
- `docs/scheduling-upgrade-plan.md`

When documents disagree, use this priority:

1. User's latest instruction
2. `AGENTS.md`
3. `MVP_REQUIREMENTS.md`
4. `README.md`
5. `BRAND_GUIDELINES.md`
6. `ROADMAP.md`

## Collaboration Workflow

1. Codex breaks work into backend and frontend tasks.
2. Codex defines any shared contracts first: database fields, server action shape, route names, auth assumptions, and TypeScript types.
3. Kimi builds against those contracts.
4. Kimi hands off any frontend needs that require backend support.
5. Codex integrates, tests, commits, and pushes.

Backend-first rule:

- For every new feature, upgrade, or module, Codex starts first.
- Codex must complete backend schema, API boundaries, authorization checks, and shared TypeScript contracts before Kimi starts frontend implementation.
- Kimi must wait for Codex to mark the backend contract as `done` or `ready for frontend` in `AGENTS.md`.
- Kimi should not create frontend routes or screens for a new module before the backend contract exists, unless the user explicitly asks for design-only mockups.
- After Codex finishes backend work, the user will tell Kimi to start the matching frontend phase.

`AGENTS.md` is the active collaboration board. Codex and Kimi must update the three sections below instead of using separate handoff files as the primary workflow.

Rules:

- Codex updates **Codex Update** before starting meaningful backend/integration work.
- Codex updates **Codex Update** again when the work is done, including verification.
- Kimi updates **Kimi Update** before starting meaningful frontend work.
- Kimi updates **Kimi Update** again when the work is done, including verification.
- When a task is complete and ready for Codex to commit, add it to **Commit Ready** with status `ready`.
- Codex is the only owner for commits. After Codex commits an item, change its status from `ready` to `committed` and add the commit message/hash when available.
- If a task is blocked, mark it `blocked` in the owner section with the reason and required next action.

Use this update format inside the active sections:

```md
Owner:
Area:
Status:
Files changed:
What changed:
Contract needed:
Open questions:
Verification:
```

## Codex Update

Owner: Codex
Area: CRM Phases 2-4 backend
Status: done
Files changed:

- `backend/migrations/0017_crm_phases_2_4.sql`
- `backend/src/domain/crm/activity-types/*`
- `backend/src/domain/crm/templates/*`
- `backend/src/domain/crm/automation/*`
- `backend/src/domain/crm/webhooks/*`
- `backend/src/domain/crm/bulk/*`
- `backend/src/domain/crm/custom-fields/service.ts`
- `backend/src/domain/crm/pipelines/service.ts`
- `backend/src/domain/customers/service.ts`
- `backend/src/domain/customers/routes.ts`
- `backend/src/domain/customers/schemas.ts`
- `backend/src/lib/mappers.ts`
- `backend/src/middleware/plan.ts`
- `contracts/orbitone.v2.ts`

What changed:

- Added migration for activity type definitions, CRM templates, automation rules, webhook subscriptions/deliveries, and duplicate-detection indexes.
- Implemented scoped CRUD services/routes for activity types, templates, automation rules, and webhook subscriptions.
- Added webhook dispatcher that records deliveries and sends outbound `fetch` payloads.
- Added automation rule engine triggered on customer create, stage/lifecycle change, activity create, and follow-up create/complete.
- Added bulk actions endpoint (`/v2/customers/bulk`) for delete, assign, set stage/lifecycle/priority/outcome.
- Added duplicate detection (`/v2/customers/duplicates`) and merge (`/v2/customers/merge`) endpoints.
- Added JSON customer import endpoint (`/v2/customers/import`).
- Wired lifecycle ↔ pipeline stage sync and event triggers into the customer service.
- Fixed parameter-binding bugs in `custom-fields` and `pipelines` services caused by reused `$1`/`$2` scope clauses.
- Extended `PlanLimit` with activity type, template, automation rule, webhook, and bulk-action limits.

Contract needed:

- Frontend uses new `/v2/crm/*` endpoints and `/v2/customers/bulk`, `/v2/customers/duplicates`, `/v2/customers/merge`, `/v2/customers/import`.

Open questions:

- None.

Verification:

- `npm run typecheck` passed in `backend`.
- `npm run build` passed in `backend`.
- Docker backend rebuilt, migration `0017` applied, container stable.
- Full Playwright e2e suite (12 tests) passed.

---

Owner: Codex
Area: CRM Phase 1 lifecycle/pipeline sync and pipeline query fix
Status: done
Files changed:

- `backend/src/domain/customers/service.ts`
- `backend/src/domain/crm/pipelines/service.ts`

What changed:

- Kept `lifecycle_stage` and `pipeline_stage_id` in sync when creating, updating, or moving customers, and when updating lifecycle stage.
- `createCustomer` now places the customer in the pipeline stage whose name matches the initial lifecycle stage (default "New").
- `updateCustomer`, `updateLifecycle`, and `moveCustomerStage` sync the corresponding pipeline stage or lifecycle stage when one changes.
- Fixed a parameter-binding bug in `crm/pipelines/service.ts` where `id`-scoped queries reused `$1`/`$2` from the scope clause, causing "bind message supplies 3 parameters, but prepared statement requires 2".

Contract needed:

- `Pipeline.stages` names are the human-readable source of truth for the pipeline board; lifecycle values are derived from matching stage names.

Open questions:

- None.

Verification:

- `npm run typecheck` passed in `backend`.
- `npm run build` passed in `backend`.
- Docker backend rebuilt and restarted.
- Full Playwright e2e suite (9 tests) passed.

---

Owner: Codex + Kimi
Area: Production-readiness and UI/UX redesign planning
Status: in_progress
Files changed:

- `docs/production-readiness-and-uiux-redesign-plan.md`
- `AGENTS.md`

What changed:

- Audited backend and frontend-v2 for production readiness.
- Created a two-track plan: Track 1 (security/production fixes, excluding payments) and Track 2 (UI/UX redesign to match the reference purple-accented dashboard style).
- Recommended running the tracks separately to isolate risk and make review easier.

Contract needed:

- Track 1 backend fixes use existing v2 API contracts; no new shared types required.
- Track 2 may update brand tokens in `BRAND_GUIDELINES.md` and Tailwind config.

Open questions:

- Confirm primary accent color for Track 2: reference screenshot suggests purple/violet; keep green for success states?
- Confirm whether to implement `/book/manage/reschedule` and `/book/manage/cancel` pages or remove the broken links for now.
- Confirm payment gateway to integrate later (Stripe vs PayHere) — out of scope for Track 1.

Verification:

- Plan document saved and reviewed.

---

Owner: Codex
Area: Billing upgrade Pro Business support
Status: done
Files changed:

- `backend/src/domain/billing/schemas.ts`

What changed:

- Extended `upgradePlanSchema` to accept `pro_business_starter`, `pro_business_growth`, and `pro_business_enterprise` in addition to `pro_individual`.

Contract needed:

- Frontend sends `plan` value from `Plan` union when confirming upgrade.

Verification:

- `npm run typecheck` passed in `backend`.
- `npm run build` passed in `backend`.
- Manual curl test upgraded a user from `free` to `pro_business_starter` successfully.

---

Owner: Codex
Area: Phase 4 B2B accounts backend + integration
Status: done
Files changed:

- `backend/migrations/0015_b2b_accounts.sql`
- `backend/src/domain/accounts/service.ts`
- `backend/src/domain/accounts/schemas.ts`
- `backend/src/domain/accounts/routes.ts`
- `backend/src/middleware/plan.ts`
- `backend/src/routes/v2.ts`
- `contracts/orbitone.v2.ts`
- `frontend-v2/src/app/directory/page.tsx`
- `frontend-v2/src/app/a/[slug]/page.tsx`
- `frontend-v2/src/app/dashboard/accounts/detail.tsx`
- `frontend-v2/e2e/accounts.spec.ts`

What changed:

- Added `business_accounts` and `business_account_connections` tables; linked `customers.account_id` to accounts.
- Implemented B2B account CRUD, contact linking, cross-organization connection requests, and public directory.
- Added `requireB2B` plan middleware and mounted `/api/v2/accounts` router.
- Updated shared v2 contracts with `Account`, `AccountConnection`, and directory types.
- Fixed Playwright e2e strict-mode violations caused by duplicate directory entries across test runs by adding slug-based `data-testid` locators and scoping connection-request assertions.

Contract needed:

- Frontend uses B2B account endpoints:
  - `GET/POST /v2/accounts`
  - `GET/PUT /v2/accounts/:id`
  - `GET/POST /v2/accounts/:id/contacts`
  - `GET/POST /v2/accounts/:id/connections`
  - `GET /v2/accounts/directory`

Open questions:

- `tsx watch` dev server restart still triggers `EADDRINUSE :::8000` intermittently; workaround is to kill stale node process and restart.

Verification:

- `npm run typecheck` passed in `backend`.
- `npm run build` passed in `backend`.
- `npm run lint` passed in `frontend-v2` (one pre-existing warning).
- `npm run build` passed in `frontend-v2`.
- Full Playwright e2e suite (9 tests) passed, including the new B2B accounts flow.

---

Owner: Codex
Area: Phase 3 documents + feedback backend
Status: done
Files changed:

- `backend/migrations/0014_documents_feedback.sql`
- `backend/src/domain/documents/service.ts`
- `backend/src/domain/documents/schemas.ts`
- `backend/src/domain/documents/routes.ts`
- `backend/src/domain/feedback/service.ts`
- `backend/src/domain/feedback/schemas.ts`
- `backend/src/domain/feedback/routes.ts`
- `backend/src/domain/ratings/service.ts`
- `backend/src/domain/ratings/schemas.ts`
- `backend/src/routes/v2.ts`
- `contracts/orbitone.v2.ts`

What changed:

- Added `documents` and `feedback_requests` tables via migration.
- Implemented document CRUD, status lifecycle, and on-demand PDF generation using `pdfkit`.
- Added customer-scoped document endpoints (`/v2/customers/:id/documents`) and document actions (`/v2/documents/:id/download`, `/v2/documents/:id/status`).
- Implemented feedback request creation, token lookup, and completion tracking.
- Linked feedback tokens to rating submissions; submitting a rating with a token marks the feedback request completed.
- Documents and feedback creation write timeline activities on the customer record.

Contract needed:

- Frontend uses `Document`, `DocumentInput`, `FeedbackRequest`, `FeedbackTokenInfo`, and the updated `SubmitRatingInput` types from `contracts/orbitone.v2.ts`.

Verification:

- `npm run typecheck` passed in `backend`.
- Full Playwright e2e suite (8 tests) passed, including new document creation and feedback request/rating flow.

Open questions:

- `tsx watch` dev server restart still triggers `EADDRINUSE :::8000` intermittently; current workaround is to kill the stale node process and restart.

---

Owner: Codex
Area: Phase 2 CRM pipeline metrics backend
Status: done
Files changed:

- `backend/src/domain/customers/service.ts`

What changed:

- Extended `getCRMSummary` to compute additional pipeline metrics for the dashboard CRM snapshot.
- `forecastValue`: sum of `value_amount` for customers with `outcome = 'in_progress'`.
- `staleLeads`: in-progress customers whose `last_contacted_at` is older than 7 days or null.
- `wonCount` / `lostCount`: counts of closed deals.
- `conversionRate`: `won / (won + lost)` rounded to the nearest whole percent.

Contract needed:

- Frontend dashboard uses the new `CRMSummary` fields returned by `GET /api/v2/crm/summary`.

Verification:

- `npm run typecheck` passed in `backend`.
- Full Playwright e2e suite (8 tests) passed.

---

Owner: Codex
Area: CRM lifecycle foundation (Phase 1)
Status: done
Files changed:

- `backend/migrations/0013_customer_lifecycle.sql`
- `backend/src/domain/customers/service.ts`
- `backend/src/domain/customers/routes.ts`
- `backend/src/domain/customers/schemas.ts`
- `backend/src/domain/scheduling/service.ts`
- `backend/src/domain/dashboard/service.ts`
- `backend/src/lib/mappers.ts`
- `contracts/orbitone.v2.ts`

What changed:

- Extended `customers` table with `assigned_to_user_id`, `value_amount`, `value_currency`, `expected_close_date`, `outcome`, `closed_at`, `closed_reason`, `source_user_id`, and `source_booking_id`.
- Added `customer_stage_history` table for full stage-change audit trail.
- Added backend endpoints: `PUT /lifecycle`, `PUT /assign`, `PUT /close`, `GET /history`, plus server-side filtering/sorting on `GET /customers`.
- Booking creation now links the customer to the source booking and host user; confirmed/approved bookings auto-create a `meeting` activity on the customer timeline.
- Fixed dashboard upcoming-bookings query to alias guest columns so `mapBookingWithJoins` no longer throws.

Contract needed:

- Frontend uses new customer fields and the lifecycle/assign/close endpoints.

Verification:

- `npm run typecheck` passed in `backend`.
- Full Playwright e2e suite (8 tests) passed.

---

Owner: Codex
Area: CRM manual customer creation bug fix
Status: done
Files changed:

- `backend/src/domain/customers/service.ts`

What changed:

- Fixed `createCustomer` so manual customers store `source_profile_id` as `null` instead of inserting the source string into the UUID column.

Verification:

- `npm run typecheck` passed in `backend`.
- `npm run build` passed in `backend`.

---

Owner: Codex
Area: Phase 4 Business admin + staff backend
Status: done
Files changed:

- `backend/src/domain/organizations/routes.ts`
- `backend/src/domain/organizations/service.ts`
- `backend/src/domain/organizations/schemas.ts`
- `backend/src/domain/auth/routes.ts`
- `backend/src/domain/auth/schemas.ts`
- `backend/src/lib/auth.ts`
- `backend/src/lib/mappers.ts`
- `backend/src/routes/v2.ts`
- `contracts/orbitone.v2.ts`

What changed:

- Implemented full organization domain:
  - `POST /api/v2/organizations` — freelancer creates an organization and becomes admin.
  - `GET /api/v2/organizations/me` — get current user's organization.
  - `PUT /api/v2/organizations/me` — admin updates organization details.
  - `GET /api/v2/organizations/members` — list organization members with profiles.
  - `POST /api/v2/organizations/invites` — admin invites staff by email with a secure token.
  - `POST /api/v2/organizations/staff-profiles` — admin directly creates a staff user + profile.
- Implemented `POST /api/v2/auth/accept-invite` for invited staff to register and join the organization.
- Added `plan` to `User` and auth context; updated `mapUser` to include it.
- Organizations are created on Pro Business Starter plan; staff inherit the organization plan.

Contract needed:

- Frontend-v2 organization pages call the endpoints above.
- Frontend-v2 accept-invite page calls `POST /api/v2/auth/accept-invite` with `token`, `password`, and optional `fullName`.

Open questions:

- Email delivery for invites is a placeholder; actual email/SMTP integration deferred.
- Staff profile deletion and role changes not yet implemented.

Verification:

- `npm run typecheck` passed in `backend`.
- `npm run build` passed in `backend`.
- Backend Docker image rebuilt and restarted successfully.
- Smoke tested organization create, update, members list, staff invite, staff profile creation, invite acceptance, and staff permission denial end-to-end via curl.

Owner: Codex
Area: Phase 3 Pro Individual upgrade backend
Status: done
Files changed:

- `backend/migrations/0012_users_plan.sql`
- `backend/src/lib/auth.ts`
- `backend/src/lib/mappers.ts`
- `backend/src/domain/auth/service.ts`
- `backend/src/domain/auth/routes.ts`
- `backend/src/domain/billing/routes.ts`
- `backend/src/domain/billing/service.ts`
- `backend/src/domain/billing/schemas.ts`
- `backend/src/domain/analytics/routes.ts`
- `backend/src/domain/analytics/service.ts`
- `backend/src/domain/public/routes.ts`
- `backend/src/domain/scheduling/service.ts`
- `backend/src/routes/v2.ts`
- `contracts/orbitone.v2.ts`

What changed:

- Added `plan` column to `users` via migration `0012_users_plan.sql` so freelancers can have individual plans without organizations.
- Updated auth queries and `AuthContext` to include `plan`.
- Updated `getProfilePlan()` to fall back to the user's own plan when no organization exists.
- Created `/api/v2/billing/upgrade` endpoint to upgrade a freelancer to `pro_individual` and record a `plan_upgraded` analytics event.
- Implemented `GET /api/v2/analytics/me` returning `ProfileMetrics` + `UsageSummary`.
- Added `trackEvent` helper and wired `booking_page_view` and `booking_created` events in public booking routes.
- Added `AnalyticsSummary` type to shared contracts.

Contract needed:

- Frontend-v2 upgrade page calls `POST /api/v2/billing/upgrade` with `{ plan: "pro_individual" }`.
- Frontend-v2 analytics page and dashboard usage widget call `GET /api/v2/analytics/me`.

Open questions:

- Real payment integration (PayHere/Stripe) is deferred; the current upgrade is a placeholder toggle.
- Business plans (`pro_business_*`) still require organization logic not yet implemented.

Verification:

- `npm run typecheck` passed in `backend`.
- `npm run build` passed in `backend`.
- Backend Docker image rebuilt and restarted successfully.
- Migration `0012_users_plan.sql` applied manually to local Postgres.
- Smoke tested login (plan returned), analytics me, upgrade to Pro Individual, and booking beyond the free limit.

Owner: Codex
Area: Phase 2 free calendar with limits backend
Status: done
Files changed:

- `backend/migrations/0011_bookings_customer_id.sql`
- `backend/src/domain/scheduling/service.ts`
- `backend/src/domain/public/routes.ts`
- `backend/src/config/env.ts`
- `backend/src/server.ts`
- `docker-compose.local.yml`
- `contracts/orbitone.v2.ts`

What changed:

- Applied migration `0011_bookings_customer_id.sql` to add `customer_id` to `bookings` and fix the public booking creation failure.
- Updated `createPublicBooking` to return a full `PublicBookingConfirmation` including `booking`, `profile`, and raw `guestTokens` (`reschedule`/`cancel`).
- Updated `docker-compose.local.yml` `FRONTEND_ORIGIN` to allow both `http://localhost:3000` and `http://localhost:3002`.
- Updated backend CORS to accept a comma-separated list of origins so both the legacy Next.js frontend and `frontend-v2` dev server can authenticate.
- Added `FREE_BOOKINGS_PER_WEEK = 3` to shared v2 contracts.

Contract needed:

- Frontend-v2 public booking page should call `GET /api/v2/book/:slug`, `GET /api/v2/book/:slug/:meetingTypeSlug/slots`, and `POST /api/v2/book/:slug/:meetingTypeSlug/bookings`.
- `PublicBookingConfirmation.guestTokens` contains the raw reschedule/cancel tokens returned only at creation time.

Open questions:

- Guest self-service reschedule/cancel UI routes (`/book/manage/reschedule`, `/book/manage/cancel`) are placeholders and not yet implemented.
- Host approval endpoints exist in v1 but need to be ported to v2 if required by the host bookings UI.

Verification:

- `npm run typecheck` passed in `backend`.
- `npm run build` passed in `backend`.
- Backend Docker image rebuilt and restarted successfully.
- Smoke tested public booking profile lookup, slot generation, and booking creation end-to-end via curl.
- Verified free-plan weekly booking limit enforcement resets each ISO week and blocks excess bookings with a 402 error.

Owner: Codex
Area: Phase 1 free core identity backend
Status: done
Files changed:

- `backend/src/domain/auth/routes.ts`
- `backend/src/domain/auth/service.ts`
- `backend/src/domain/auth/schemas.ts`
- `backend/src/domain/profiles/routes.ts`
- `backend/src/domain/profiles/service.ts`
- `backend/src/domain/profiles/schemas.ts`
- `backend/src/lib/auth.ts`
- `backend/src/lib/mappers.ts`
- `backend/src/lib/slug.ts`
- `backend/src/lib/vcard.ts`

What changed:

- Implemented v2 auth endpoints: `POST /api/v2/auth/register`, `POST /api/v2/auth/login`, `POST /api/v2/auth/logout`, `GET /api/v2/auth/me`.
- Registration auto-creates an unpublished personal profile with a unique slug derived from the user's name.
- Implemented v2 profile endpoints: `GET /api/v2/profiles/me`, `PUT /api/v2/profiles/me`, `GET /api/v2/profiles/:slug`, `GET /api/v2/profiles/:slug/vcard`.
- Profile update uses upsert logic, preserving existing values for fields not sent by the client.
- Public profile enforces `is_published = true` and records `profile_view` analytics events.
- vCard endpoint generates and downloads a `.vcf` file and records `vcard_download` analytics events.
- Added reusable slug generation and vCard generation helpers.
- Added mappers for users, profiles, organizations, and `AuthMe`.

Contract needed:

- Frontend-v2 should call `/api/v2/*` endpoints for auth and profile flows.
- Frontend-v2 can build public profile URLs as `${appUrl}/p/${slug}`.
- Frontend-v2 can download vCards from `/api/v2/profiles/${slug}/vcard`.

Open questions:

- Avatar upload still uses `avatarUrl` string; a dedicated upload endpoint is recommended before production.

Verification:

- `npm run typecheck` passed in `backend`.
- `npm run build` passed in `backend`.
- Backend Docker image rebuilt and started successfully.
- Smoke tested register → me → update profile → public profile → vCard download end-to-end via curl.

Owner: Codex
Area: Redesign v2 backend foundation
Status: done
Files changed:

- `backend/migrations/0010_redesign_organizations.sql`
- `contracts/orbitone.v2.ts`
- `backend/src/server.ts`
- `backend/src/routes/v2.ts`
- `backend/src/lib/auth.ts`
- `backend/src/middleware/auth.ts`
- `backend/src/middleware/error.ts`
- `backend/src/middleware/plan.ts`
- `backend/src/domain/*/routes.ts`
- `backend/src/domain/*/service.ts`
- `backend/src/domain/*/schemas.ts`
- `backend/tsconfig.json`
- `backend/package.json`
- `backend/Dockerfile`
- `docker-compose.local.yml`
- `docker-compose.prod.yml`
- `docker-compose.test.yml`

What changed:

- Defined the redesign v2 product loop: digital card → meeting → CRM.
- Added `organizations`, `customers`, `customer_activities`, `customer_follow_ups`, `customer_ratings`, `usage_bookings`, and `organization_invites` tables.
- Added `role`, `organization_id`, and `is_billing_contact` to `users`.
- Added `type`, `department`, and `job_title` to `profiles`.
- Migrated existing `connections` and their notes/activities/follow-ups into the new `customers` model.
- Created `contracts/orbitone.v2.ts` as the single source of truth for the v2 API.
- Restructured backend into domain-based folders under `backend/src/domain/`.
- Added centralized auth and plan-limit middleware.
- Mounted new v2 routers under `/api/v2/` while keeping `/api/v1/` alive.
- Updated backend build to include shared contracts and adjusted Docker/Compose accordingly.

Contract needed:

- Frontend-v2 should import types from `contracts/orbitone.v2.ts`.
- Frontend-v2 should call `/api/v2/*` endpoints.

Open questions:

- v2 endpoints currently return 501 Not Implemented; implement auth/profile/booking/customer/CRM routes in upcoming phases.

Verification:

- `npm run typecheck` passed in `backend`.
- `npm run build` passed in `backend`.
- Docker backend image rebuilt and started successfully.
- Backend health reports `postgres=true` and `redis=true`.
- Migration `0010_redesign_organizations.sql` applied cleanly to local Postgres and migrated existing connection data.

Owner: Codex
Area: Scheduling S5 host approval and guest self-service tokens
Status: done
Files changed:

- `backend/migrations/0008_scheduling_guest_tokens.sql`
- `backend/src/routes/v1.ts`
- `backend/src/types/contracts.ts`
- `contracts/orbitone.ts`

What changed:

- Added `requires_approval` to `meeting_types` and `booking_guest_tokens` table for reschedule/cancel tokens.
- Updated shared contracts to include `requiresApproval` on `MeetingType`/`MeetingTypeInput` and `guestTokens` on `PublicBookingConfirmation`.
- Public bookings now default to `pending` when the meeting type requires approval, otherwise `confirmed`.
- Public booking creation now returns raw reschedule/cancel tokens and stores SHA-256 hashes.
- Added public guest self-service reschedule/cancel endpoints under `/book/:profileSlug/:meetingTypeSlug/{reschedule,cancel}`.
- Added authenticated host approval endpoints `/scheduling/bookings/:id/{approve,reject}`.
- Expanded `booking_audit_events` to include `approved`, `rejected`, `guest_rescheduled`, and `guest_cancelled`.

Contract needed:

- Frontend should treat `booking.status === 'pending'` as awaiting host approval.
- Frontend can build self-service URLs from `guestTokens.reschedule` and `guestTokens.cancel` returned at booking creation.

Open questions:

- Migration file is named `0008_scheduling_guest_tokens.sql`, which shares the `0008` prefix with the existing `0008_zoho_calendar_provider.sql`.
- Notifications and external calendar event updates are left as TODOs.

Verification:

- `npm run typecheck` passed in `backend`.
- `npm run build` passed in `backend`.

Owner: Codex
Area: UI/UX modernization integration review
Status: done
Files changed:

- `AGENTS.md`
- `frontend/app/layout.tsx`
- `frontend/components/profile/profile-form.tsx`
- `frontend/app/book/[slug]/[meetingTypeSlug]/page.tsx`

What changed:

- Reviewed Kimi's completed UI/UX modernization for integration, security, product fit, and build/runtime readiness.
- Normalized visible punctuation in metadata/profile/booking copy to ASCII-safe characters.
- Added a temporary 1MB avatar file-size guard while avatar persistence still uses `avatarUrl` data URLs.
- Rebuilt and restarted the local Docker frontend/backend services from verified images.

Contract needed:

- Temporary base64 avatar data URLs may remain only as a short-term UI bridge.
- Before production launch, Codex should add a dedicated authenticated avatar upload endpoint and storage path; Kimi can then wire the existing drag-and-drop UI to that endpoint.

Open questions:

- Recommended next backend task before calendar continuation: add real avatar upload persistence so the refreshed profile UI is launch-safe.

Verification:

- `npm run typecheck` passed in `backend`.
- `npm run lint` passed in `frontend`.
- Local `npm run build` in `frontend` hit the known Windows `.next/trace` `EPERM`.
- Docker frontend/backend build passed; Next generated all 16 routes.
- Docker frontend/backend services recreated successfully.
- Backend health passed with `postgres=true` and `redis=true`.
- HTTP route smoke passed for `/`, `/login`, `/dashboard`, `/dashboard/profile`, `/dashboard/scheduling`, and `/book/test-slug`.
- In-app browser verification was blocked by a local browser runtime startup error; Docker build and HTTP checks passed.

Owner: Codex
Area: Phase 1 backend, Docker, and integration foundation
Status: done
Files changed:

- `backend/`
- `backend/migrations/0001_orbitone_v1_schema.sql`
- `contracts/orbitone.ts`
- `docs/backend-contracts.md`
- `docs/phase-delivery-plan.md`
- `docker-compose.local.yml`
- `docker-compose.test.yml`
- `docker-compose.prod.yml`
- `.env.example`
- `.env.local`
- `.gitignore`
- `.dockerignore`
- `frontend/Dockerfile`
- `frontend/.dockerignore`
- `frontend/lib/api.ts`
- `frontend/README.md`
- `infra/traefik/README.md`

What changed:

- Built standalone backend API with PostgreSQL, Redis, auth, profile, public profile, vCard, connections, analytics, Docker, and Compose support.
- Fixed QR/share URL contract so public profile links use `NEXT_PUBLIC_APP_URL`.
- Local Docker stack is running with frontend, backend, PostgreSQL, and Redis.

Contract needed:

- Frontend must use `NEXT_PUBLIC_API_BASE_URL` for API calls.
- Frontend must use `NEXT_PUBLIC_APP_URL` through `getPublicProfileUrl(slug)` for public profile, QR, share, and copied links.

Open questions:

- Confirm test domain remains `https://to1.cloudit.lk`.
- Confirm production domain remains `https://po1.cloudit.lk`.

Verification:

- Backend typecheck passed.
- Backend build passed.
- Frontend lint passed.
- Frontend build passed.
- Docker Compose local stack runs.
- Backend health reports `postgres=true` and `redis=true`.
- Auth/profile smoke test passed.

Owner: Codex
Area: Phase 2 professional networking backend
Status: done
Files changed:

- `backend/src/routes/v1.ts`
- `contracts/orbitone.ts`
- `backend/src/types/contracts.ts`
- `docs/backend-contracts.md`
- `docs/phase-delivery-plan.md`

What changed:

- Added profile discovery endpoint.
- Added network summary endpoint.
- Added inbound saved-me endpoint.
- Added mutual connections endpoint.
- Added shared Phase 2 networking types.

Contract needed:

- Kimi can build Phase 2 UI against:
  - `GET /api/v1/profiles?query=&limit=`
  - `GET /api/v1/network/summary`
  - `GET /api/v1/network/inbound`
  - `GET /api/v1/network/mutual`

Open questions:

- Confirm whether Phase 2 frontend route should be `/dashboard/network`.
- Confirm whether `/dashboard/connections` remains saved-by-me only or becomes the broader networking page.

Verification:

- Backend typecheck passed.
- Backend build passed.
- Frontend lint passed.
- Docker stack rebuilt.
- Smoke test with two accounts passed for `saved`, `saved_me`, and summary counts.

Owner: Codex
Area: Phase 3 relationship management backend
Status: done
Files changed:

- `backend/migrations/0002_relationship_management.sql`
- `backend/src/routes/v1.ts`
- `backend/src/types/contracts.ts`
- `contracts/orbitone.ts`
- `docs/backend-contracts.md`
- `docs/phase-delivery-plan.md`

What changed:

- Added lightweight relationship management contracts for saved connections.
- Added relationship status on connections.
- Added private connection notes.
- Added private tags and connection tag assignment.
- Added follow-ups with due dates and completion state.

Contract needed:

- Kimi can build Phase 3 UI against:
  - `GET /api/v1/connections/:id/relationship`
  - `PUT /api/v1/connections/:id/relationship`
  - `GET /api/v1/connections/:id/notes`
  - `POST /api/v1/connections/:id/notes`
  - `DELETE /api/v1/connections/:id/notes/:noteId`
  - `GET /api/v1/tags`
  - `POST /api/v1/tags`
  - `DELETE /api/v1/tags/:id`
  - `PUT /api/v1/connections/:id/tags`
  - `GET /api/v1/connections/:id/follow-ups`
  - `POST /api/v1/connections/:id/follow-ups`
  - `PATCH /api/v1/connections/:id/follow-ups/:followUpId`
  - `DELETE /api/v1/connections/:id/follow-ups/:followUpId`

Open questions:

- Keep Phase 3 focused on connection-level relationship management only.
- Do not build full CRM pipelines, payments, AI, or events.

Verification:

- Backend typecheck passed.
- Backend build passed.
- Frontend lint passed.
- Local migration applied to PostgreSQL.
- Backend health reports `postgres=true` and `redis=true`.
- Phase 3 smoke test passed for relationship status, notes, tags, tag assignment, follow-up creation, follow-up completion, and relationship summary retrieval.

Owner: Codex
Area: Phase 4 event networking backend
Status: done
Files changed:

- `backend/migrations/0003_event_networking.sql`
- `backend/src/routes/v1.ts`
- `backend/src/types/contracts.ts`
- `contracts/orbitone.ts`
- `docs/backend-contracts.md`
- `docs/phase-delivery-plan.md`
- `frontend/lib/contracts.ts`
- `frontend/AGENTS.md`
- `AGENTS.md`

What changed:

- Added lightweight event networking contracts.
- Added event host create/list/update APIs.
- Added public event lookup by slug.
- Added attendee check-in using a published OrbitOne profile.
- Added event attendee list with existing network connection status.

Contract needed:

- Kimi can build Phase 4 UI against:
  - `GET /api/v1/events/me`
  - `POST /api/v1/events`
  - `PUT /api/v1/events/:id`
  - `GET /api/v1/events/:slug`
  - `POST /api/v1/events/:slug/check-ins`
  - `GET /api/v1/events/:id/check-ins`

Open questions:

- Keep Phase 4 focused on event networking only.
- Do not build tickets, payments, agendas, event CRM, AI, or automations.

Verification:

- Backend typecheck passed.
- Frontend lint passed.
- Frontend build passed after Codex Phase 3 review fixes.
- Local migration applied to PostgreSQL.
- Docker backend and frontend rebuilt.
- Backend health reports `postgres=true` and `redis=true`.
- Phase 4 smoke test passed for event create, public event lookup, attendee check-in, and attendee networking retrieval.

Owner: Codex
Area: Phase 5 light CRM backend
Status: done
Files changed:

- `backend/migrations/0004_light_crm.sql`
- `backend/src/routes/v1.ts`
- `backend/src/types/contracts.ts`
- `contracts/orbitone.ts`
- `docs/backend-contracts.md`
- `docs/phase-delivery-plan.md`
- `frontend/AGENTS.md`
- `AGENTS.md`

What changed:

- Added lightweight CRM fields on saved connections.
- Added private connection activity timeline.
- Added CRM summary endpoint for dashboard widgets.
- Added ownership checks for CRM state and activities.

Contract needed:

- Kimi can build Phase 5 UI against:
  - `GET /api/v1/crm/summary`
  - `GET /api/v1/connections/:id/crm`
  - `PUT /api/v1/connections/:id/crm`
  - `GET /api/v1/connections/:id/activities`
  - `POST /api/v1/connections/:id/activities`
  - `DELETE /api/v1/connections/:id/activities/:activityId`

Open questions:

- Keep Phase 5 focused on connection-level lifecycle, priority, next step, and activity history.
- Do not build full CRM pipelines, deal objects, forecasts, payments, AI, or automations.

Verification:

- Backend typecheck passed.
- Frontend lint passed.
- Frontend build passed.
- Local migration applied to PostgreSQL.
- Docker backend and frontend rebuilt.
- Phase 5 smoke test passed for CRM summary, lifecycle update, priority update, next step, and activity creation/retrieval.

Owner: Codex
Area: Track 1 backend production/security fixes
Status: done
Files changed:

- `backend/src/server.ts`
- `backend/src/config/env.ts`
- `backend/src/lib/auth.ts`
- `backend/src/lib/logger.ts`
- `backend/src/middleware/error.ts`
- `backend/src/middleware/rate-limit.ts`
- `backend/src/middleware/plan.ts`
- `backend/src/domain/auth/routes.ts`
- `backend/src/domain/auth/service.ts`
- `backend/src/domain/ratings/routes.ts`
- `backend/src/domain/ratings/service.ts`
- `backend/src/domain/customers/routes.ts`
- `backend/src/domain/customers/service.ts`
- `backend/scripts/migrate.ts`
- `backend/scripts/migrate-baseline.ts`
- `backend/Dockerfile`
- `backend/package.json`

What changed:

- Disabled legacy `/api/v1` when `NODE_ENV=production`; v2 remains mounted in dev/test for compatibility.
- Added Redis-backed rate limiting (`express-rate-limit` + `rate-limit-redis`) for global, auth, and public booking routes; disabled in dev/test so Playwright/e2e keeps working.
- Moved sessions to Redis: `signSession` stores a session ID in Redis, `getAuthUser` verifies the JWT and Redis session, and `revokeSessionByCookie` deletes the session on logout.
- Hardened CORS (explicit methods/headers, origin allowlist) and cookie settings (`httpOnly`, `secure` in production, `SameSite=Lax`, scoped path).
- Added structured logging with `pino` and replaced `console.error` in the global error handler.
- Fixed plan-gate middleware to pass `user.organization` into `getEffectivePlan`, so organization plans are honored.
- Secured ratings: ratings now require authentication + Pro Business plan, and the submitted profile/booking/customer must belong to the caller/org.
- Hardened CRM authorization: customer activities, follow-ups, and stage history now verify customer ownership; `assignedToUserId` can only be set to members of the same organization.
- Added an idempotent migration runner at `backend/scripts/migrate.ts` with `npm run migrate`.
- Added a `migrate:baseline` script to record existing migrations without re-running SQL.
- Wired the migration runner into `backend/Dockerfile` so migrations run before the server starts.

Contract needed:

- Frontend must continue using `/api/v2` only.
- Rating submission now requires an authenticated session; the rating page should rely on host/auth context.
- CRM activity/follow-up deletion respects ownership (creator for individuals; org membership for business).

Open questions:

- Production Compose still points the old frontend to `/api/v1`; it will need updating when frontend-v2 is deployed.
- For existing production databases, run `npm run migrate:baseline` once before the container starts auto-migrating.

Verification:

- `npm run typecheck` passed in `backend`.
- `npm run build` passed in `backend`.
- Docker backend rebuilt and healthy (`postgres=true`, `redis=true`).
- Migration runner applied all 15 migrations cleanly to a fresh database and reported no new migrations on re-run.
- `npx playwright test` passed: 9/9 e2e tests.

## Kimi Update

Owner: Kimi
Area: Premium dashboard + public profile UI polish — Phases A, B, C, D & E complete
Status: done
Files changed:

- `docs/premium-dashboard-public-profile-fix-plan.md` (new)
- `frontend-v2/src/app/globals.css`
- `frontend-v2/src/components/ui/button.tsx`
- `frontend-v2/src/components/ui/badge.tsx`
- `frontend-v2/src/components/ui/switch.tsx`
- `frontend-v2/src/components/ui/card.tsx`
- `frontend-v2/src/components/theme/theme-toggle.tsx` (new)
- `frontend-v2/src/app/dashboard/layout.tsx`
- `frontend-v2/src/hooks/useTimeOfDay.ts` (new)
- `frontend-v2/src/components/dashboard/celestial-animation.tsx` (new)
- `frontend-v2/src/components/dashboard/greeting-header.tsx` (new)
- `frontend-v2/src/app/dashboard/page.tsx`
- `frontend-v2/src/app/dashboard/profile/page.tsx`
- `frontend-v2/src/app/dashboard/scheduling/calendar/page.tsx`
- `frontend-v2/src/app/dashboard/scheduling/bookings/page.tsx`
- `frontend-v2/src/app/dashboard/customers/page.tsx`
- `frontend-v2/src/app/dashboard/accounts/page.tsx`
- `frontend-v2/src/app/dashboard/organization/page.tsx`
- `frontend-v2/src/app/dashboard/settings/page.tsx`
- `frontend-v2/src/app/p/[slug]/page.tsx`
- `frontend-v2/src/app/book/[slug]/page.tsx`
- `frontend-v2/e2e/auth.spec.ts`
- `frontend-v2/e2e/accounts.spec.ts`
- `frontend-v2/e2e/ui-redesign.spec.ts` (new)
- `frontend-v2/package.json`
- `frontend-v2/package-lock.json`

What changed:

- Created a focused UI polish plan based on the user's video walkthrough and the official `BRAND_GUIDELINES.md`.
- Added dark mode support with a theme toggle and full component coverage.
- Added a time-aware greeting header with animated sun/moon icon and an optional timezone clock; country-specific sunrise/sunset uses browser geolocation with a time-range fallback.
- Phase A completed:
  - Added CSS variable foreground colors and refined dark palette.
  - Updated `Button`, `Badge`, `Switch` to use foreground variables for correct light/dark contrast.
  - Updated `Card` to `rounded-2xl` per the premium plan.
  - Created `ThemeToggle` component and added it to dashboard sidebar footer and mobile header.
  - Redesigned sidebar active state to use a subtle left-border accent instead of a full green pill.
- Phase B completed:
  - Created `useTimeOfDay` hook with browser timezone clock and optional geolocation-based sunrise/sunset via `suncalc`.
  - Created `CelestialAnimation` SVG component with sun-rise, sun-pulse, sun-set, and moon/stars animations.
  - Created `GreetingHeader` component and replaced the static dashboard greeting.
  - Redesigned dashboard metric cards with primary/secondary hierarchy and a clear usage widget.
  - Combined profile info and QR code into one cohesive "Share" block.
  - Simplified CRM snapshot to 4 metrics and a friendly empty state.
  - Removed the cramped "Quick actions" tile block.
- Phase C completed:
  - Redesigned profile form with grouped sections (Profile details, Contact, Social, Visibility), two-column layout, avatar upload with live preview, and sticky save bar.
  - Polished scheduling: calendar uses standard `Card`, booking list has better empty state.
  - Improved empty states and page headers across Customers, Accounts, Organization, and Settings.
  - Fixed the pre-existing `any` lint error in `customers/page.tsx`.
- Phase D completed:
  - Redesigned the public profile page (`/p/[slug]`) with a warm gradient background, centered premium card layout, larger ringed avatar, and cleaner action row.
  - Moved the QR code into the hero card with a caption, added a "Save contact" action, and improved contact/meeting-type cards.
  - Added a subtle `animate-fade-in-up` entrance animation and fixed the vCard download URL in the QR section.
  - Replaced remaining `GlassCard` usage with standard `Card` for consistency.
- Phase E completed:
  - Mobile responsiveness sweep: tightened scheduling calendar grid on small screens, wrapped bookings filter chips, and stacked the Customers page header.
  - Dark mode sweep: removed hardcoded `text-white` on selected booking slots/dates in favor of `text-secondary-foreground`; verified no stray gray/black/white utility classes remain in page code.
  - QA: updated e2e auth test to accept any time-of-day greeting (fixes flakiness from time-aware header); updated accounts test to search the B2B directory for "Globex" (avoids test-data pollution pushing the target account off the first page).
  - Added a new `ui-redesign.spec.ts` covering the redesigned dashboard greeting, theme-toggle light/dark cycle, and public profile hero/QR/booking CTA.
- Work is scoped to pure frontend UI/UX polish in `frontend-v2`; no backend changes or new API contracts are needed.

Contract needed:

- None — uses existing v2 API contracts.

Open questions:

- None.

Verification:

- Plan document saved to `docs/premium-dashboard-public-profile-fix-plan.md`.
- `npm run lint` passed in `frontend-v2` (one pre-existing warning in `frontend-v2/src/app/dashboard/scheduling/availability/page.tsx` remains unchanged).
- `npm run build` passed in `frontend-v2`.
- Full Playwright e2e suite (9 tests) passed.

---

Owner: Kimi
Area: CRM Phases 2-4 frontend
Status: done
Files changed:

- `frontend-v2/src/hooks/useCRM.ts`
- `frontend-v2/src/app/dashboard/settings/crm/page.tsx`
- `frontend-v2/src/app/dashboard/settings/crm/activity-types-tab.tsx`
- `frontend-v2/src/app/dashboard/settings/crm/templates-tab.tsx`
- `frontend-v2/src/app/dashboard/settings/crm/automation-tab.tsx`
- `frontend-v2/src/app/dashboard/settings/crm/webhooks-tab.tsx`
- `frontend-v2/src/app/dashboard/customers/detail.tsx`
- `frontend-v2/src/app/dashboard/customers/page.tsx`
- `frontend-v2/src/app/dashboard/customers/pipeline.tsx`
- `frontend-v2/src/app/dashboard/customers/duplicates/page.tsx`
- `frontend-v2/src/routes.tsx`

What changed:

- Added TanStack Query hooks for activity types, templates, automation rules, webhooks, bulk actions, duplicates, merge, and import.
- Extended CRM settings with Activity types, Templates, Automation rules, and Webhooks tabs.
- Activity creation now supports custom activity types and activity templates.
- Pipeline Kanban board supports drag-and-drop stage movement.
- Customers list supports selection, bulk delete/set lifecycle/set priority/set stage, JSON export, and JSON import.
- Added `/dashboard/customers/duplicates` page to review and merge duplicates.

Contract needed:

- Uses new Phase 2-4 backend endpoints documented in the Codex Update.

Open questions:

- None.

Verification:

- `npm run build` passed in `frontend-v2`.
- `npm run lint` passed in `frontend-v2` (one pre-existing warning).
- Full Playwright e2e suite (9 tests) passed.

---

Owner: Kimi
Area: CRM Phase 1 frontend custom field wiring and e2e alignment
Status: done
Files changed:

- `frontend-v2/src/app/dashboard/customers/detail.tsx`
- `frontend-v2/e2e/crm.spec.ts`

What changed:

- Fixed custom field input rendering to use the contract field `type` (instead of the non-existent `fieldType`) and to handle select/multi-select options safely.
- Updated the CRM e2e assertion to expect the capitalized pipeline stage name "Qualified" now that the pipeline board renders configured stage names.

Contract needed:

- `CustomFieldDefinition.type` and `CustomFieldDefinition.options` are the source of truth for field rendering.

Open questions:

- None.

Verification:

- `npm run build` passed in `frontend-v2`.
- Full Playwright e2e suite (9 tests) passed.

---

Owner: Kimi
Area: Track 1 frontend production blockers
Status: done
Files changed:

- `frontend-v2/index.html`
- `frontend-v2/src/lib/api.ts`
- `frontend-v2/src/main.tsx`
- `frontend-v2/src/routes.tsx`
- `frontend-v2/src/providers/AuthProvider.tsx`
- `frontend-v2/src/components/ui/dialog.tsx`
- `frontend-v2/src/components/error-boundary.tsx` (new)
- `frontend-v2/src/app/not-found/page.tsx` (new)
- `frontend-v2/src/app/p/[slug]/page.tsx`
- `frontend-v2/src/app/book/[slug]/page.tsx`
- `frontend-v2/e2e/auth.spec.ts`

What changed:

- Added CSP meta tag, `<noscript>` message, font preload, and removed hardcoded `class="dark"`.
- Hardened `apiFetch`: HTTPS enforcement in production, full network-error handling, and conditional `Content-Type`.
- Added a global `ErrorBoundary` around `<App>` and `basename` support for `BrowserRouter`.
- Added a catch-all 404 route and `NotFoundPage`.
- Cleared React Query cache on logout.
- Made `Dialog` accessible with `role="dialog"`, `aria-modal`, `aria-labelledby`, Escape-to-close, body scroll lock, and basic focus loop.
- Fixed public-profile vCard download to use `API_BASE_URL`.
- Replaced broken booking reschedule/cancel links with a confirmation-message placeholder.
- Updated the auth e2e assertion to target the dashboard `<h1>`.

Contract needed:

- No backend contract changes.

Verification:

- `npm run lint` passed (one pre-existing warning).
- `npm run build` passed.
- Full Playwright e2e suite (9 tests) passed.

---

Owner: Kimi
Area: Mobile-responsive dashboard layout
Status: done
Files changed:

- `frontend-v2/src/app/dashboard/layout.tsx`

What changed:

- Replaced the always-visible mobile sidebar with a collapsible hamburger menu.
- On small screens the sidebar now slides in as an overlay and closes when a link is tapped or the overlay is clicked.
- Kept the full desktop sidebar unchanged.

Contract needed:

- No backend changes.

Verification:

- `npm run lint` passed in `frontend-v2` (one pre-existing warning).
- `npm run build` passed in `frontend-v2`.
- Full Playwright e2e suite (9 tests) passed.

---

Owner: Kimi
Area: README update for v2 design
Status: done
Files changed:

- `README.md`
- `frontend-v2/README.md`

What changed:

- Rewrote the root `README.md` to describe OrbitOne v2: product loop, freemium model, tech stack, project structure, local development instructions, service ports, testing commands, and v2 scope guardrails.
- Replaced the Vite template `frontend-v2/README.md` with app-specific setup, scripts, testing, and conventions.

Verification:

- Markdown renders correctly in preview.
- No code files changed; no build/test impact.

---

Owner: Kimi
Area: Settings page
Status: done
Files changed:

- `frontend-v2/src/app/dashboard/settings/page.tsx`
- `frontend-v2/src/routes.tsx`

What changed:

- Created a new `/dashboard/settings` page that shows account details (name, email, role, plan), a link to manage/upgrade the plan, and a logout button.
- Wired the settings route into the dashboard route tree so the sidebar **Settings** link now opens a real page.

Verification:

- `npm run lint` passed in `frontend-v2` (one pre-existing warning).
- `npm run build` passed in `frontend-v2`.
- Full Playwright e2e suite (9 tests) passed.

---

Owner: Kimi
Area: Team / user creation navigation
Status: done
Files changed:

- `frontend-v2/src/app/dashboard/layout.tsx`
- `frontend-v2/src/app/dashboard/organization/page.tsx`
- `frontend-v2/src/app/dashboard/organization/members/page.tsx`

What changed:

- Added a **Team** sidebar nav item (visible only for admin users) that links to `/dashboard/organization/members`.
- Added a "Manage team" card on the Organization page when an organization exists and the user is admin.
- Improved the Team members page to:
  - Prompt users to create an organization first if they don't have one.
  - Show an admin-only notice when the user isn't an admin.
  - Display member-loading errors clearly.

Contract needed:

- `/v2/organizations/me` returns the current user's organization.
- `/v2/organizations/members` returns members for organization admins.
- `/v2/organizations/invites` and `/v2/organizations/staff-profiles` require admin role and organization membership.

Verification:

- `npm run lint` passed in `frontend-v2` (one pre-existing warning).
- `npm run build` passed in `frontend-v2`.
- Full Playwright e2e suite (9 tests) passed.

---

Owner: Kimi
Area: Auth refresh after plan upgrade
Status: done
Files changed:

- `frontend-v2/src/hooks/useBilling.ts`

What changed:

- `useUpgradePlan` now calls `refresh()` from `AuthProvider` on success so the dashboard badge and CRM gating immediately reflect the new Pro Business plan without requiring a full page reload.

Contract needed:

- `AuthProvider` exposes `refresh()` via `useAuth()`.
- `POST /v2/billing/upgrade` returns the updated user.

Verification:

- `npm run lint` passed in `frontend-v2` (one pre-existing warning).
- `npm run build` passed in `frontend-v2`.
- Full Playwright e2e suite (9 tests) passed.

---

Owner: Kimi
Area: Billing upgrade page Pro Business support
Status: done
Files changed:

- `frontend-v2/src/app/dashboard/upgrade/page.tsx`

What changed:

- Added a third **Pro Business** plan card to the upgrade page with CRM, ratings, documents, feedback, B2B accounts, and admin analytics features.
- Fixed the upgrade flow so it upgrades to the selected plan instead of always selecting `pro_individual`.
- Enabled upgrading from **Pro Individual** to **Pro Business**.
- Disabled downgrade buttons and hid the confirmation banner when no higher plan is available.

Contract needed:

- `POST /v2/billing/upgrade` accepts `pro_business_starter` and returns the updated `User`.

Verification:

- `npm run lint` passed in `frontend-v2` (one pre-existing warning).
- `npm run build` passed in `frontend-v2`.
- Full Playwright e2e suite (9 tests) passed.

---

Owner: Kimi
Area: Phase 4 B2B accounts UI
Status: done
Files changed:

- `frontend-v2/src/hooks/useAccounts.ts`
- `frontend-v2/src/app/dashboard/accounts/page.tsx`
- `frontend-v2/src/app/dashboard/accounts/detail.tsx`
- `frontend-v2/src/app/a/[slug]/page.tsx`
- `frontend-v2/src/app/directory/page.tsx`
- `frontend-v2/src/app/dashboard/layout.tsx`
- `frontend-v2/src/routes.tsx`
- `frontend-v2/e2e/accounts.spec.ts`

What changed:

- Added `/dashboard/accounts` list with create/edit dialog.
- Added `/dashboard/accounts/:id` detail with contacts, connection requests, and accept/reject actions.
- Added public `/a/:slug` business profile page with connect CTA.
- Added public `/directory` with search and industry filter.
- Added `Accounts` item to dashboard sidebar and wired routes.
- Added `useAccounts`, `useDirectory`, and connection hooks.
- Added `data-testid` attributes to directory cards, public account name, connect button, and connection rows to support stable e2e selectors.

Contract needed:

- Backend endpoints used:
  - `GET/POST /v2/accounts`
  - `GET/PUT /v2/accounts/:id`
  - `GET/POST /v2/accounts/:id/contacts`
  - `GET/POST /v2/accounts/:id/connections`
  - `GET /v2/accounts/directory`

Verification:

- `npm run lint` passed in `frontend-v2` (one pre-existing warning).
- `npm run build` passed in `frontend-v2`.
- Full Playwright e2e suite (9 tests) passed, including the new B2B accounts flow.

---

Owner: Kimi
Area: Phase 3 documents + feedback UI
Status: done
Files changed:

- `frontend-v2/src/hooks/useDocuments.ts`
- `frontend-v2/src/hooks/useFeedback.ts`
- `frontend-v2/src/app/dashboard/customers/detail.tsx`
- `frontend-v2/src/app/dashboard/customers/documents-tab.tsx`
- `frontend-v2/src/app/dashboard/customers/feedback-tab.tsx`
- `frontend-v2/src/app/feedback/[token]/page.tsx`
- `frontend-v2/src/components/rating/rating-form.tsx`
- `frontend-v2/src/routes.tsx`
- `frontend-v2/e2e/crm.spec.ts`

What changed:

- Added **Documents** tab to customer detail: create quotation/invoice/agreement/other documents, line items, status actions, and PDF download.
- Added **Feedback** tab: create feedback requests, copy public links, and view completion status.
- Added public `/feedback/:token` rating page that prefills customer/booking/profile and links the rating back to the feedback request.
- Extended `RatingForm` to accept `customerId` and `feedbackToken`.
- Added `useDocuments` and `useFeedback` TanStack Query hooks.
- Expanded CRM e2e to cover document creation and the full feedback request → rating → completed loop.

Contract needed:

- Backend endpoints used:
  - `GET/POST /v2/customers/:id/documents`
  - `GET /v2/documents/:id/download`
  - `PUT /v2/documents/:id/status`
  - `GET/POST /v2/customers/:id/feedback`
  - `GET /v2/feedback/:token`
  - `POST /v2/ratings` with optional `feedbackToken`

Verification:

- `npm run lint` passed in `frontend-v2` (one pre-existing warning).
- `npm run build` passed in `frontend-v2`.
- Full Playwright e2e suite (8 tests) passed.

---

Owner: Kimi
Area: Phase 2 CRM pipeline board + dashboard snapshot
Status: done
Files changed:

- `frontend-v2/src/app/dashboard/page.tsx`
- `frontend-v2/src/app/dashboard/customers/page.tsx`
- `frontend-v2/src/app/dashboard/customers/pipeline.tsx`
- `frontend-v2/src/routes.tsx`
- `frontend-v2/e2e/crm.spec.ts`

What changed:

- Added `/dashboard/customers/pipeline` Kanban board view with lifecycle columns, per-column value totals, priority badges, expected close dates, and links to customer detail.
- Enhanced dashboard CRM snapshot with forecast value, stale leads, won/lost counts, conversion rate, and a direct link to the pipeline.
- Added a Pipeline button on `/dashboard/customers`.
- Expanded CRM e2e test to assert pipeline route and dashboard snapshot metrics.

Contract needed:

- Uses `GET /api/v2/customers` for board cards and the new `forecastValue`, `staleLeads`, `wonCount`, `lostCount`, and `conversionRate` fields from `GET /api/v2/crm/summary`.

Verification:

- `npm run lint` passed in `frontend-v2` (one pre-existing warning).
- `npm run build` passed in `frontend-v2`.
- Full Playwright e2e suite (8 tests) passed.

---

Owner: Kimi
Area: CRM lifecycle foundation UI (Phase 1)
Status: done
Files changed:

- `frontend-v2/src/hooks/useCRM.ts`
- `frontend-v2/src/app/dashboard/customers/page.tsx`
- `frontend-v2/src/app/dashboard/customers/detail.tsx`
- `frontend-v2/e2e/crm.spec.ts`

What changed:

- Added TanStack Query hooks for lifecycle change, assignment, close won/lost, and stage history.
- Rebuilt `/dashboard/customers` with server-side filter bar (lifecycle, priority, outcome, search, sort) and value display.
- Rebuilt customer detail as three tabs:
  - **Cycle:** current stage, one-click move to next stage, close won/lost/reopen, stage-change note, stage history timeline, ownership/deal value/expected close date.
  - **Details:** editable customer fields.
  - **Timeline:** activities and follow-ups.
- Added assignment dropdown using organization members.
- Expanded CRM e2e test to cover lifecycle move, close won, reopen, activity, and follow-up.

Contract needed:

- Uses new backend endpoints: `PUT /v2/customers/:id/lifecycle`, `PUT /v2/customers/:id/assign`, `PUT /v2/customers/:id/close`, `GET /v2/customers/:id/history`, and query params on `GET /v2/customers`.

Verification:

- `npm run lint` passed in `frontend-v2` (one pre-existing warning).
- `npm run build` passed in `frontend-v2`.
- Full Playwright e2e suite (8 tests) passed.

---

Owner: Kimi
Area: Phase 4 Business admin + staff frontend
Status: done
Files changed:

- `frontend-v2/src/app/dashboard/organization/page.tsx`
- `frontend-v2/src/app/dashboard/organization/members/page.tsx`
- `frontend-v2/src/app/accept-invite/page.tsx`
- `frontend-v2/src/hooks/useOrganizations.ts`
- `frontend-v2/src/routes.tsx`
- `frontend-v2/src/app/dashboard/layout.tsx`

What changed:

- Built `/dashboard/organization` page: create organization form and organization details/edit view.
- Built `/dashboard/organization/members` page: list members, invite staff by email, and directly add staff profiles.
- Built `/accept-invite` public page for invited staff to set password and join.
- Added `useOrganizations` hooks: `useMyOrganization`, `useCreateOrganization`, `useUpdateOrganization`, `useOrganizationMembers`, `useInviteStaff`, `useCreateStaffProfile`, `useAcceptInvite`.
- Updated dashboard sidebar and routing for Organization section.

Contract needed:

- Backend v2 organization endpoints are required and now implemented:
  - `GET /api/v2/organizations/me`
  - `POST /api/v2/organizations`
  - `PUT /api/v2/organizations/me`
  - `GET /api/v2/organizations/members`
  - `POST /api/v2/organizations/invites`
  - `POST /api/v2/organizations/staff-profiles`
  - `POST /api/v2/auth/accept-invite`

Open questions:

- Invite emails are not actually sent; the admin must copy/share the invite token/link manually for now.

Verification:

- `npm run lint` passed in `frontend-v2` (one `react-hooks/incompatible-library` warning remains).
- `npm run build` passed in `frontend-v2`.
- Dev server routes `/dashboard/organization`, `/dashboard/organization/members`, and `/accept-invite` return HTTP 200.

Owner: Kimi
Area: Phase 3 Pro Individual upgrade frontend
Status: done
Files changed:

- `frontend-v2/src/app/dashboard/upgrade/page.tsx`
- `frontend-v2/src/app/dashboard/analytics/page.tsx`
- `frontend-v2/src/app/dashboard/page.tsx`
- `frontend-v2/src/app/book/[slug]/page.tsx`
- `frontend-v2/src/hooks/useBilling.ts`
- `frontend-v2/src/hooks/useAnalytics.ts`
- `frontend-v2/src/routes.tsx`
- `frontend-v2/src/app/dashboard/layout.tsx`

What changed:

- Built `/dashboard/upgrade` page showing Free and Pro Individual plans with LKR pricing and a placeholder confirm-upgrade flow.
- Built `/dashboard/analytics` page displaying profile views, vCard downloads, bookings created, connections added, weekly booking usage, and ratings.
- Added dashboard usage widget and plan badge on `/dashboard`.
- Added upgrade CTA in the public booking page when the free weekly limit is hit.
- Added `useUpgradePlan` and `useAnalyticsMe` TanStack Query hooks.
- Updated dashboard sidebar and routing for Analytics and Upgrade pages.

Contract needed:

- Backend v2 billing and analytics endpoints are required and now implemented:
  - `POST /api/v2/billing/upgrade`
  - `GET /api/v2/analytics/me`

Open questions:

- Payment UI is a placeholder; real PayHere/Stripe integration comes in Phase 6.

Verification:

- `npm run lint` passed in `frontend-v2` (one `react-hooks/incompatible-library` warning remains).
- `npm run build` passed in `frontend-v2`.
- Dev server routes `/dashboard/upgrade` and `/dashboard/analytics` return HTTP 200.

Owner: Kimi
Area: Phase 2 free calendar with limits frontend
Status: done
Files changed:

- `frontend-v2/src/app/book/[slug]/page.tsx`
- `frontend-v2/src/app/dashboard/scheduling/layout.tsx`
- `frontend-v2/src/app/dashboard/scheduling/page.tsx`
- `frontend-v2/src/app/dashboard/scheduling/meeting-types/page.tsx`
- `frontend-v2/src/app/dashboard/scheduling/availability/page.tsx`
- `frontend-v2/src/app/dashboard/scheduling/bookings/page.tsx`
- `frontend-v2/src/hooks/usePublicBooking.ts`
- `frontend-v2/src/hooks/useScheduling.ts`
- `frontend-v2/src/components/ui/dialog.tsx`
- `frontend-v2/src/routes.tsx`
- `frontend-v2/src/app/dashboard/layout.tsx`

What changed:

- Built the public booking page (`/book/:slug`) with profile header, meeting type cards, date picker, available time slots, guest form, and confirmation state.
- Added public booking hooks (`usePublicBookingProfile`, `usePublicBookingSlots`, `useCreatePublicBooking`).
- Built the dashboard Scheduling section with overview, meeting types, availability editor, and bookings list.
- Added scheduling hooks (`useMeetingTypes`, `useCreateMeetingType`, `useUpdateMeetingType`, `useDeleteMeetingType`, `useAvailability`, `useUpdateAvailability`, `useBookings`, `useCancelBooking`).
- Added a simple `Dialog` component for the meeting type create/edit form.
- Updated dashboard sidebar and routing to include Scheduling.

Contract needed:

- Backend v2 scheduling endpoints are required and now implemented:
  - `GET /api/v2/book/:slug`
  - `GET /api/v2/book/:slug/:meetingTypeSlug/slots`
  - `POST /api/v2/book/:slug/:meetingTypeSlug/bookings`
  - `GET /api/v2/scheduling/meeting-types`
  - `POST /api/v2/scheduling/meeting-types`
  - `PUT /api/v2/scheduling/meeting-types/:id`
  - `DELETE /api/v2/scheduling/meeting-types/:id`
  - `GET /api/v2/scheduling/availability`
  - `PUT /api/v2/scheduling/availability`
  - `GET /api/v2/scheduling/bookings`
  - `POST /api/v2/scheduling/bookings/:id/cancel`

Open questions:

- Guest self-service reschedule/cancel pages are not yet built; tokens are displayed as placeholder links.
- Availability exceptions UI is not yet built.
- Calendar account connect/disconnect (Google/Outlook) is out of scope for Phase 2 free calendar.

Verification:

- `npm run lint` passed in `frontend-v2` (one `react-hooks/incompatible-library` warning remains for `form.watch` usage).
- `npm run build` passed in `frontend-v2`.
- Dev server started on `http://localhost:3002` and all new routes return HTTP 200.

Owner: Kimi
Area: Phase 1 free core identity frontend
Status: done
Files changed:

- `frontend-v2/src/app/dashboard/profile/page.tsx`
- `frontend-v2/src/app/dashboard/page.tsx`
- `frontend-v2/src/app/p/[slug]/page.tsx`
- `frontend-v2/src/app/login/page.tsx`
- `frontend-v2/src/app/register/page.tsx`
- `frontend-v2/src/hooks/useProfile.ts`
- `frontend-v2/src/components/ui/button.tsx`

What changed:

- Built the profile builder form with React Hook Form + Zod validation.
- Wired profile builder to `GET /api/v2/profiles/me` and `PUT /api/v2/profiles/me`.
- Built the public profile page (`/p/:slug`) with contact details, QR code, and vCard download.
- Built the dashboard home with profile status, public profile link, and shareable QR code.
- Improved login and register pages with React Hook Form + Zod.
- Added `useProfile` TanStack Query hooks for my profile, update profile, and public profile.
- Updated `Button` to support `asChild` for clean link rendering.

Contract needed:

- Backend v2 auth and profile endpoints are required and now implemented.

Open questions:

- Public profile design can be polished further once real user content is available.

Verification:

- `npm run lint` passed in `frontend-v2`.
- `npm run build` passed in `frontend-v2`.
- Dev server started and API proxy to backend confirmed working.

Owner: Kimi
Area: Redesign v2 frontend foundation
Status: done
Files changed:

- `frontend-v2/` (new Vite + React SPA)
- `frontend-v2/src/app/globals.css`
- `frontend-v2/src/components/ui/*`
- `frontend-v2/src/components/layout/*`
- `frontend-v2/src/components/brand/logo.tsx`
- `frontend-v2/src/providers/*`
- `frontend-v2/src/hooks/*`
- `frontend-v2/src/lib/*`
- `frontend-v2/src/routes.tsx`
- `frontend-v2/src/App.tsx`
- `frontend-v2/src/main.tsx`

What changed:

- Created a new Vite + React + TypeScript SPA to replace the Next.js frontend.
- Added React Router for client-side routing.
- Added TanStack Query for server state, React Hook Form + Zod for forms.
- Ported brand tokens from `BRAND_GUIDELINES.md` into Tailwind CSS v4 config.
- Built core UI primitives: Button, Input, Label, Textarea, Card, Badge, Avatar, Skeleton, Switch.
- Built public shell, marketing header, and brand logo.
- Built landing page with pricing for the Sri Lankan market.
- Built login and register placeholder pages.
- Built dashboard layout with sidebar navigation.
- Built placeholder dashboard home, profile, public profile, and booking pages.
- Wired shared v2 contracts from `contracts/orbitone.v2.ts`.

Contract needed:

- Backend v2 endpoints under `/api/v2/*` must be implemented for auth and profile flows to function.

Open questions:

- Public profile and booking pages are placeholders; implement them once backend v2 profile/scheduling APIs are ready.

Verification:

- `npm run lint` passed in `frontend-v2`.
- `npm run build` passed in `frontend-v2`.
- Vite production build generates static SPA assets.

Owner: Kimi
Area: Public booking pages redesign (Scheduling)
Status: done
Files changed:

- `frontend/app/book/[slug]/page.tsx`
- `frontend/app/book/[slug]/[meetingTypeSlug]/page.tsx`
- `frontend/components/profile/public-profile-card.tsx`
- `frontend/components/booking/booking-calendar.tsx`
- `frontend/components/booking/time-slot-picker.tsx`
- `frontend/components/booking/booking-guest-form.tsx`
- `frontend/components/booking/booking-confirmation.tsx`
- `frontend/components/booking/utils.tsx`

What changed:

- Redesigned `/book/[slug]` to lead with the host’s identity (compact `PublicProfileCard`) and a friendly “Book time with {fullName}” headline.
- Meeting types now render as cards with location icons, duration badges, location labels, and descriptions.
- Context query (`connectionId`, `eventId`) is preserved on navigation.
- Added an empty state when no active meeting types exist.
- Redesigned `/book/[slug]/[meetingTypeSlug]` with a calendar-style month picker that highlights days with available slots.
- Default selected date is the first available date.
- Time slots render as large touch-target buttons for the selected date with clear-selection support.
- Guest form uses `Input`, `Label`, and `Textarea` primitives and has a sticky bottom bar for the primary action on mobile.
- Confirmation view uses `success`/`success-subtle` tokens and shows placeholder actions for Google Calendar, .ics download, and WhatsApp share.
- Added no-slots fallback that suggests the next week and offers a WhatsApp fallback button.
- Preserved all existing API calls, request/response shapes, and booking logic.

Contract needed:

- API endpoints remain unchanged:
  - `GET /api/v1/book/:profileSlug`
  - `GET /api/v1/book/:profileSlug/:meetingTypeSlug/slots?from=&to=&timezone=`
  - `POST /api/v1/book/:profileSlug/:meetingTypeSlug/bookings`

Open questions:

- Backend TODOs: real Google Calendar invite link generation, real `.ics` file generation, and WhatsApp API/share URL for confirmed bookings.
- Should the calendar picker eventually support a configurable first day of the week (Monday vs Sunday)?

Verification:

- `npm run lint` passed.
- `npm run build` passed.

---

Owner: Kimi
Area: Unified public booking calendar page
Status: done
Files changed:

- `frontend/app/book/[slug]/page.tsx`
- `frontend/app/book/[slug]/[meetingTypeSlug]/page.tsx`
- `frontend/AGENTS.md`

What changed:

- Replaced the `/book/[slug]` meeting-type list with a single, transparent calendar page.
- Left panel shows host identity and all active meeting types with duration, location, description, and approval-required notices.
- Right panel shows the selected meeting type details, a real month calendar with available-day dots, time slots for the selected date, the guest booking form, and the confirmation state.
- Selecting a meeting type updates the URL (`?type=...`) without reloading so the page stays shareable.
- Old `/book/[slug]/[meetingTypeSlug]` URLs now redirect to the unified page with the same meeting type pre-selected and query params preserved.
- Preserved all backend contracts and analytics tracking.

Contract needed:

- API endpoints remain unchanged:
  - `GET /api/v1/book/:profileSlug`
  - `GET /api/v1/book/:profileSlug/:meetingTypeSlug/slots?from=&to=&timezone=`
  - `POST /api/v1/book/:profileSlug/:meetingTypeSlug/bookings`

Open questions:

- Host dashboard calendar view (`/dashboard/scheduling/calendar`) still shows only connection status; that remains a separate open item.

Verification:

- `npm run lint` passed.
- `npm run build` passed.
- Docker Compose frontend rebuilt and running.
- Backend health reports `postgres=true` and `redis=true`.
- `/book/test` returns HTTP 200.

---

Owner: Kimi
Area: Phase 1 frontend
Status: done, minor polish deferred by user
Files changed:

- `frontend/`

What changed:

- Built Phase 1 frontend: landing, auth UI, dashboard, profile builder, public profile, QR/share UI, vCard button, add-to-network UI, connections list, settings UI, loading/empty/error states.

Contract needed:

- Must keep using backend contracts in `docs/backend-contracts.md`.
- Must use shared types from `contracts/orbitone.ts`.

Open questions:

- Any minor UI issues found during user testing should be listed here before changes start.

Verification:

- Frontend lint passed.
- Frontend build passed.
- User tested and reported only minor issues to handle later.

Owner: Kimi
Area: Phase 2 professional networking frontend
Status: done
Files changed:

- `frontend/app/dashboard/discover/page.tsx`
- `frontend/app/dashboard/page.tsx`
- `frontend/app/dashboard/connections/page.tsx`
- `frontend/app/u/[slug]/page.tsx`
- `frontend/app/dashboard/layout.tsx`
- `frontend/lib/contracts.ts`
- `frontend/lib/use-network-status.ts`
- `frontend/.env.local`

What changed:

- Added `/dashboard/discover` search page for published profiles with connection status badges.
- Added network summary cards to `/dashboard`.
- Expanded `/dashboard/connections` with tabs for Saved by me, Saved me, and Mutual connections.
- Updated public profile page to show connection status and adjust the add-to-network CTA.
- Wired new shared Phase 2 types from `contracts/orbitone.ts`.
- Added `NEXT_PUBLIC_APP_URL` to `.env.local` to support `getPublicProfileUrl()`.

Contract needed:

- Phase 2 backend endpoints from Codex Update are used:
  - `GET /api/v1/profiles?query=&limit=`
  - `GET /api/v1/network/summary`
  - `GET /api/v1/network/inbound`
  - `GET /api/v1/network/mutual`

Open questions:

- `/dashboard/connections` was expanded instead of creating `/dashboard/network`; confirm this is acceptable.
- Should the public profile page fetch connection status from a dedicated endpoint instead of deriving it client-side from three endpoints?

Verification:

- `npm run lint` passed.
- `npm run build` passed.
- All new routes render with clean loading/empty/error states.
- Codex review: frontend lint passed, frontend build passed, Docker stack rebuilt successfully.
- Codex route checks: `/dashboard/discover` returns 200, `/dashboard/connections` returns 200.
- Codex health check: backend reports `postgres=true` and `redis=true`.

Owner: Kimi
Area: Phase 3 relationship management frontend
Status: done
Files changed:

- `frontend/app/dashboard/connections/[id]/page.tsx`
- `frontend/app/dashboard/connections/page.tsx`
- `frontend/components/relationship/status-selector.tsx`
- `frontend/components/relationship/notes-section.tsx`
- `frontend/components/relationship/tags-section.tsx`
- `frontend/components/relationship/follow-ups-section.tsx`
- `frontend/lib/contracts.ts`
- `frontend/AGENTS.md`

What changed:

- Added `/dashboard/connections/[id]` detail page for saved connections.
- Added relationship status selector (`new`, `active`, `follow_up`, `opportunity`, `archived`).
- Added private notes list/create/delete.
- Added tags list/create/assign/delete with color picker.
- Added follow-ups list/create/complete/delete with overdue highlighting.
- Updated `/dashboard/connections` list to show relationship status badges and link to detail pages.
- Wired new Phase 3 shared types from `contracts/orbitone.ts`.

Contract needed:

- Phase 3 backend endpoints from Codex Update:
  - `GET /api/v1/connections/:id/relationship`
  - `PUT /api/v1/connections/:id/relationship`
  - `GET /api/v1/connections/:id/notes`
  - `POST /api/v1/connections/:id/notes`
  - `DELETE /api/v1/connections/:id/notes/:noteId`
  - `GET /api/v1/tags`
  - `POST /api/v1/tags`
  - `DELETE /api/v1/tags/:id`
  - `PUT /api/v1/connections/:id/tags`
  - `GET /api/v1/connections/:id/follow-ups`
  - `POST /api/v1/connections/:id/follow-ups`
  - `PATCH /api/v1/connections/:id/follow-ups/:followUpId`
  - `DELETE /api/v1/connections/:id/follow-ups/:followUpId`

Open questions:

- Answered by Codex review: `PUT /api/v1/connections/:id/tags` uses `{ tagIds: string[] }`.
- Answered by Codex review: `PATCH /api/v1/connections/:id/follow-ups/:followUpId` uses `{ completed: boolean }`; response exposes `completedAt`.

Verification:

- `npm run lint` passed.
- `npm run build` passed.
- New `/dashboard/connections/[id]` route is dynamic and renders with loading/empty/error states.
- Codex review found and fixed two integration issues:
  - Tag creation now sends backend-required hex colors instead of color names.
  - Follow-up completion now sends `{ completed: boolean }` instead of `{ completedAt: string | null }`.
- Codex verification: frontend lint passed, frontend build passed, Docker frontend rebuilt.

Owner: Kimi
Area: Phase 4 event networking frontend
Status: done
Files changed:

- `frontend/app/dashboard/events/page.tsx`
- `frontend/app/dashboard/events/[id]/page.tsx`
- `frontend/app/e/[slug]/page.tsx`
- `frontend/app/dashboard/layout.tsx`
- `frontend/lib/contracts.ts`
- `frontend/AGENTS.md`

What changed:

- Added `/dashboard/events` host event list and create form.
- Added `/dashboard/events/[id]` event detail/edit page with attendee networking list.
- Added `/e/[slug]` public event page with event QR, copy link, check-in button, and attendee list with connection status.
- Added Events route to dashboard sidebar.
- Wired new Phase 4 shared types from `contracts/orbitone.ts`.

Contract needed:

- Phase 4 backend endpoints from Codex Update:
  - `GET /api/v1/events/me`
  - `POST /api/v1/events`
  - `PUT /api/v1/events/:id`
  - `GET /api/v1/events/:slug`
  - `POST /api/v1/events/:slug/check-ins`
  - `GET /api/v1/events/:id/check-ins`

Open questions:

- Answered by Codex review: `POST /api/v1/events` and `PUT /api/v1/events/:id` match the form payload.
- Answered by Codex review: `POST /api/v1/events/:slug/check-ins` requires no body.

Verification:

- `npm run lint` passed.
- `npm run build` passed.
- New routes `/dashboard/events`, `/dashboard/events/[id]`, and `/e/[slug]` render with loading/empty/error states.
- Codex review found and fixed two integration issues:
  - Dashboard event detail can now fetch owned events by ID, including drafts.
  - Event attendee response now includes `userId`; public event page now detects existing check-in by user ID.
- Codex verification: backend typecheck passed, frontend lint/build passed, Docker frontend/backend rebuilt.

Owner: Kimi
Area: Phase 5 light CRM frontend
Status: done
Files changed:

- `frontend/app/dashboard/page.tsx`
- `frontend/app/dashboard/connections/[id]/page.tsx`
- `frontend/components/crm/summary-cards.tsx`
- `frontend/components/crm/lifecycle-selector.tsx`
- `frontend/components/crm/priority-selector.tsx`
- `frontend/components/crm/activity-timeline.tsx`
- `frontend/lib/contracts.ts`
- `frontend/AGENTS.md`

What changed:

- Added CRM summary widgets to `/dashboard` (lifecycle breakdown, high priority, open/overdue follow-ups).
- Added lifecycle stage selector to `/dashboard/connections/[id]`.
- Added priority selector to `/dashboard/connections/[id]`.
- Added editable next-step field to `/dashboard/connections/[id]`.
- Added activity timeline list/create/delete (note, call, email, meeting, other) to `/dashboard/connections/[id]`.
- Wired new Phase 5 shared types from `contracts/orbitone.ts`.

Contract needed:

- Phase 5 backend endpoints from Codex Update:
  - `GET /api/v1/crm/summary`
  - `GET /api/v1/connections/:id/crm`
  - `PUT /api/v1/connections/:id/crm`
  - `GET /api/v1/connections/:id/activities`
  - `POST /api/v1/connections/:id/activities`
  - `DELETE /api/v1/connections/:id/activities/:activityId`

Open questions:

- Keep it light and connection-centered; no full CRM pipeline board.

Verification:

- `npm run lint` passed.
- `npm run build` passed.
- Dashboard CRM snapshot and connection detail CRM sections render with loading/empty/error states.
- Codex review: Phase 5 frontend request shapes match backend contracts.
- Codex verification: backend typecheck passed, frontend lint/build passed, Docker frontend/backend rebuilt.
- Codex route checks: `/dashboard`, `/dashboard/connections`, and `/dashboard/events` return 200.

Owner: Kimi
Area: Scheduling S1/S2 frontend
Status: done
Files changed:

- `frontend/app/dashboard/scheduling/page.tsx`
- `frontend/app/dashboard/scheduling/meeting-types/page.tsx`
- `frontend/app/dashboard/scheduling/availability/page.tsx`
- `frontend/app/dashboard/scheduling/bookings/page.tsx`
- `frontend/app/dashboard/scheduling/calendar/page.tsx`
- `frontend/app/dashboard/layout.tsx`
- `frontend/lib/contracts.ts`
- `frontend/AGENTS.md`

What changed:

- Built `/dashboard/scheduling` overview with calendar status, upcoming bookings, stats, and quick actions.
- Built `/dashboard/scheduling/meeting-types` list with create/edit, active toggle, and booking link copy.
- Built `/dashboard/scheduling/availability` weekly schedule editor with timezone selector and availability exceptions.
- Built `/dashboard/scheduling/bookings` list with status tabs and cancellation flow.
- Built `/dashboard/scheduling/calendar` connected account status view with Google/Outlook provider list.
- Added Scheduling route to dashboard sidebar.
- Re-exported all scheduling types from `frontend/lib/contracts.ts`.

Contract needed:

- Scheduling S1 backend endpoints from Codex Update:
  - `GET /api/v1/profiles/me` (for public booking link slug)
  - `GET /api/v1/scheduling/calendar-accounts`
  - `GET /api/v1/scheduling/meeting-types`
  - `POST /api/v1/scheduling/meeting-types`
  - `PUT /api/v1/scheduling/meeting-types/:id`
  - `DELETE /api/v1/scheduling/meeting-types/:id`
  - `GET /api/v1/scheduling/availability`
  - `PUT /api/v1/scheduling/availability`
  - `GET /api/v1/scheduling/bookings`
  - `POST /api/v1/scheduling/bookings/:id/cancel`

Open questions:

- Google Calendar OAuth connect UI is placeholder only; backend S2 will provide the connect flow.
- Public booking pages were built in S4 and integration buttons in S5.

Verification:

- `npm run lint` passed.
- `npm run build` passed.
- New routes render with loading/empty/error states: `/dashboard/scheduling`, `/dashboard/scheduling/calendar`, `/dashboard/scheduling/meeting-types`, `/dashboard/scheduling/availability`, `/dashboard/scheduling/bookings`.
- Request shapes match backend S1 contracts.
- Codex review: request shapes match Scheduling S1 backend contracts.
- Codex verification: backend typecheck passed, frontend lint/build passed, Docker frontend/backend rebuilt.
- Codex route checks: all scheduling dashboard routes return 200.

Owner: Kimi
Area: Scheduling S2 frontend
Status: done
Files changed:

- `frontend/app/dashboard/scheduling/calendar/page.tsx`

What changed:

- Wired real Google Calendar OAuth flow on `/dashboard/scheduling/calendar`.
- Enabled "Connect Google Calendar" button that calls `POST /api/v1/scheduling/google/connect` and navigates to `data.authorizationUrl`.
- Added success/error banners from OAuth callback query params (`?connected=google`, `?error=...`).
- Added disconnect support via `DELETE /api/v1/scheduling/calendar-accounts/:id`.
- Removed the "coming in Scheduling S2" placeholder copy.
- Kept Microsoft Outlook marked as coming later.

Contract needed:

- Scheduling S2 backend endpoints from Codex Update:
  - `POST /api/v1/scheduling/google/connect`
  - `GET /api/v1/scheduling/google/callback` (backend redirects to `/dashboard/scheduling/calendar?connected=google` or `?error=...`)
  - `DELETE /api/v1/scheduling/calendar-accounts/:id`

Open questions:

- Public booking pages were built in S4; profile/connection/event integration buttons were built in S5.
- Microsoft Outlook integration waits until Google Calendar booking works end to end.

Verification:

- `npm run lint` passed.
- `npm run build` passed.
- `/dashboard/scheduling/calendar` handles connect, disconnect, success, and error states.

Owner: Kimi
Area: Scheduling S4 public booking frontend
Status: done
Files changed:

- `frontend/app/book/[slug]/page.tsx`
- `frontend/app/book/[slug]/[meetingTypeSlug]/page.tsx`
- `frontend/AGENTS.md`

What changed:

- Built public booking pages against completed backend S3 contracts.
- Built `/book/[slug]` meeting type picker with profile header.
- Built `/book/[slug]/[meetingTypeSlug]` with date/slot picker, week navigation, guest booking form, and confirmation state.
- Built profile/connection/event integration buttons in S5.

Contract needed:

- Scheduling S3 backend endpoints from Codex Update:
  - `GET /api/v1/book/:profileSlug`
  - `GET /api/v1/book/:profileSlug/:meetingTypeSlug/slots?from=&to=&timezone=`
  - `POST /api/v1/book/:profileSlug/:meetingTypeSlug/bookings`

Open questions:

- Profile/connection/event integration buttons built in S5.

Verification:

- `npm run lint` passed.
- `npm run build` passed.
- New routes `/book/[slug]` and `/book/[slug]/[meetingTypeSlug]` render with loading/empty/error states.
- Request shapes match backend S3 contracts.

Owner: Kimi
Area: Scheduling S5 existing UI integration
Status: done
Files changed:

- `frontend/app/u/[slug]/page.tsx`
- `frontend/app/dashboard/connections/[id]/page.tsx`
- `frontend/app/dashboard/events/[id]/page.tsx`
- `frontend/app/book/[slug]/page.tsx`
- `frontend/app/book/[slug]/[meetingTypeSlug]/page.tsx`
- `frontend/AGENTS.md`

What changed:

- Added `Book a meeting` link from `/u/[slug]` to `/book/[slug]`.
- Added `Book follow-up` link from `/dashboard/connections/[id]` using `connectionId` context (fetches `/api/v1/profiles/me` for host slug).
- Added attendee `Book meeting` entry from `/dashboard/events/[id]` using `eventId` context.
- Passed `connectionId`/`eventId` query context through public booking pages and into booking creation with matching `source` values.
- Added optional `booking_slot_selected` analytics tracking via `POST /api/v1/analytics/events`.

Contract needed:

- Scheduling S4 backend integration endpoints from Codex Update:
  - `GET /api/v1/profiles/me` (for host profile slug on connection booking)
  - `POST /api/v1/book/:profileSlug/:meetingTypeSlug/bookings` accepts `connectionId` and `eventId`
  - `POST /api/v1/analytics/events` accepts `booking_slot_selected`

Open questions:

- Microsoft Calendar remains out of scope.

Verification:

- `npm run lint` passed.
- `npm run build` passed.
- `/u/[slug]`, `/dashboard/connections/[id]`, and `/dashboard/events/[id]` now expose booking entry points.
- Public booking pages preserve `connectionId`/`eventId` context and send the correct `source` on booking creation.
- Optional `booking_slot_selected` analytics event fires when a visitor selects a slot.
- Codex review passed after backend event-context validation fix.
- Docker frontend/backend rebuild passed.
- Published-event attendee booking smoke passed with `source: event` and `eventId` stored on booking.

Owner: Codex
Area: Zoho Calendar provider integration
Status: backend and calendar settings UI connection contract complete, awaiting live Zoho credentials/API verification
Files changed:

- `backend/migrations/0008_zoho_calendar_provider.sql`
- `backend/src/config/env.ts`
- `backend/src/routes/v1.ts`
- `backend/src/types/contracts.ts`
- `contracts/orbitone.ts`
- `frontend/app/dashboard/scheduling/calendar/page.tsx`
- `.env.example`
- `docs/backend-contracts.md`
- `docs/scheduling-upgrade-plan.md`
- `AGENTS.md`

What changed:

- Added `zoho` to the shared `CalendarProvider` contract.
- Added migration to allow `zoho` in `calendar_accounts.provider`.
- Added Zoho OAuth environment variables.
- Added Zoho OAuth connect and callback backend routes.
- Added encrypted backend-only Zoho token storage using existing `calendar_accounts`.
- Added Zoho Calendar option to `/dashboard/scheduling/calendar`.

Contract needed:

- Backend endpoints:
  - `GET /api/v1/scheduling/zoho/connect`
  - `POST /api/v1/scheduling/zoho/connect`
  - `GET /api/v1/scheduling/zoho/callback`
- `POST /api/v1/scheduling/zoho/connect` returns:
  - `{ ok: true, data: { authorizationUrl: string } }`
- `GET /api/v1/scheduling/zoho/callback` redirects to `/dashboard/scheduling/calendar?connected=zoho` or `/dashboard/scheduling/calendar?error=...`.
- Required env:
  - `ZOHO_CLIENT_ID`
  - `ZOHO_CLIENT_SECRET`
  - `ZOHO_CALENDAR_REDIRECT_URI`
  - `ZOHO_ACCOUNTS_BASE_URL`
  - `ZOHO_CALENDAR_SCOPES`
  - `CALENDAR_TOKEN_ENCRYPTION_KEY`

Open questions:

- Confirm the Zoho data center for your business accounts, for example `https://accounts.zoho.com`, `https://accounts.zoho.eu`, or another regional Zoho Accounts URL.
- Live Zoho busy-time lookup and event create/cancel need credentials and Zoho Calendar API endpoint confirmation.

Verification:

- `npm run typecheck` passed in `backend`.
- `npm run lint` passed in `frontend`.
- Docker frontend/backend rebuild passed.
- Backend health passed at `http://localhost:8000/health`.
- Authenticated `POST /api/v1/scheduling/zoho/connect` returns expected `503` until Zoho credentials are configured.

Owner: Kimi
Area: Landing page and auth UI modernization
Status: done
Files changed:

- `frontend/app/page.tsx`
- `frontend/app/login/page.tsx`
- `frontend/app/login/auth-form.tsx`
- `frontend/components/layout/marketing-header.tsx`
- `frontend/components/brand/logo.tsx`
- `frontend/app/globals.css`
- `BRAND_GUIDELINES.md`
- `AGENTS.md`
- `frontend/AGENTS.md`

What changed:

- Modernized the landing page (`/`) with a two-column hero, gradient background, demo profile card visual, social proof strip, feature grid, how-it-works steps, closing CTA, and richer footer.
- Modernized the login/signup page (`/login`) with a responsive split-screen layout, branded left panel with benefits list, and an upgraded auth form card.
- Improved the auth form with password visibility toggle, error alert icon, loading state on submit, and mode toggle that updates the URL.
- Updated the marketing header with a cleaner glassmorphism look and refined CTA.
- Updated the Logo component so the orbit path uses `currentColor`, allowing the wordmark to invert cleanly on dark backgrounds.
- Applied the new **Deep Forest + Sage Gold** brand palette across the landing page, auth pages, marketing header, logo, and global Tailwind theme.

Contract needed:

- No new backend contracts. Pure frontend UI work.
- Uses the updated brand colors and Tailwind tokens.

Open questions:

- Hero visual is a CSS demo profile card; can be replaced with a real product screenshot or illustration later.
- Google OAuth placeholder on auth page is deferred until backend auth OAuth is ready.

Verification:

- `npm run lint` passed.
- `npm run build` passed.
- `/`, `/login`, and marketing header render without errors.
- Demo profile link (`/u/demo`) will route through existing `/u/[slug]` dynamic page.
- Codex review passed: frontend lint, backend typecheck, and Docker frontend/backend production build passed.
- Local `npm run build` in `frontend` still hits Windows `EPERM` on `.next/trace`; Docker frontend build passed.
- Design caveat: landing hero uses CSS/demo-card visuals. For a stronger market-ready first impression, replace later with a real product screenshot, generated brand image, or richer interactive product preview.

Owner: Kimi
Area: UI/UX Phase 1 — Design system foundation
Status: done
Files changed:

- `frontend/app/globals.css`
- `frontend/components/ui/button.tsx`
- `frontend/components/ui/input.tsx`
- `frontend/components/ui/badge.tsx`
- `frontend/components/ui/card.tsx`
- `frontend/components/ui/label.tsx`
- `frontend/components/ui/textarea.tsx` (new)
- `frontend/components/ui/switch.tsx` (new)
- `frontend/components/ui/avatar.tsx` (new)
- `frontend/components/ui/skeleton.tsx` (new)
- `frontend/components/ui/toast.tsx` (new)
- `frontend/components/ui/dialog.tsx` (new)
- `frontend/next.config.ts`
- `frontend/lib/image-loader.ts` (new)
- `frontend/components/profile/public-profile-card.tsx`
- `frontend/app/u/[slug]/page.tsx`
- `frontend/app/e/[slug]/page.tsx`
- `frontend/app/dashboard/discover/page.tsx`
- `frontend/app/dashboard/connections/page.tsx`
- `frontend/app/dashboard/events/[id]/page.tsx`

What changed:

- Expanded design tokens: semantic success/error/warning/info colors, shadow tokens (card/dropdown/dialog), radius tokens, and focus-ring tokens.
- Updated existing primitives (Button, Input, Badge, Card, Label) to use semantic tokens and the new warm brand palette.
- Added new primitives: Textarea (with character counter and auto-resize), Switch, Avatar (with status indicator), Skeleton, Toast provider/hook, and Dialog.
- Added Button `link`/`icon` variants and press animation.
- Added Input helper text, icon slots, and `aria-describedby` wiring.
- Added Badge info/error/dot/soft variants.
- Fixed next/image optimization by adding a custom image loader and removing per-image `unoptimized` props.

Contract needed:

- No new backend contracts.

Open questions:

- Keep the custom image loader until backend file uploads are available; then switch to remotePatterns or a CDN loader.
- Replace `bg-red-50`/`text-red-700` inline alerts with the new `error-subtle`/`error` tokens in Phase 2.

Verification:

- `npm run lint` passed.
- `npm run build` passed.
- All 16 routes prerendered successfully.

Owner: Kimi
Area: UI/UX Phase 2 — Feedback & polish
Status: done
Files changed:

- `frontend/app/layout.tsx`
- `frontend/app/dashboard/profile/page.tsx`
- `frontend/components/profile/profile-form.tsx`
- `frontend/app/u/[slug]/page.tsx`
- `frontend/app/book/[slug]/[meetingTypeSlug]/page.tsx`
- `frontend/app/dashboard/scheduling/calendar/page.tsx`
- `frontend/app/dashboard/scheduling/meeting-types/page.tsx`
- `frontend/app/dashboard/page.tsx`
- `frontend/components/ui/switch.tsx`
- `frontend/components/loading/dashboard-skeleton.tsx` (new)
- `AGENTS.md`
- `frontend/AGENTS.md`

What changed:

- Wrapped the app in `ToastProvider` so any component can call `useToast()`.
- Replaced browser `confirm()` with accessible `Dialog` components for:
  - Disconnecting a calendar account.
  - Deleting a meeting type.
- Converted inline success/error banners to toasts for:
  - Profile save success/error.
  - Calendar OAuth connected/error states.
  - Calendar disconnect success/error.
  - Meeting type delete success/error.
  - Public profile "Add to network" success/error.
  - Public booking submission error.
- Added inline slug validation to the profile form with `Input` error state.
- Replaced raw `<textarea>` and custom publish toggle in profile form with the new `Textarea` and `Switch` primitives.
- Added a `DashboardSkeleton` loading state and wired it into `/dashboard`.

Contract needed:

- No new backend contracts.

Open questions:

- Some inline colored alerts still use old hardcoded Tailwind palettes (e.g., `bg-emerald-50`). These can be migrated to semantic tokens in Phase 3.
- More pages can adopt skeleton loading states over time.

Verification:

- `npm run lint` passed.
- `npm run build` passed.
- All 16 routes prerendered successfully.

Owner: Kimi
Area: UI/UX Phase 3 — Visual upgrade
Status: done
Files changed:

- `frontend/app/dashboard/page.tsx`
- `frontend/components/analytics/metrics-cards.tsx`
- `frontend/components/crm/summary-cards.tsx`
- `frontend/app/u/[slug]/page.tsx`
- `frontend/components/profile/public-profile-card.tsx`
- `frontend/app/book/[slug]/page.tsx`
- `frontend/app/book/[slug]/[meetingTypeSlug]/page.tsx`
- `AGENTS.md`
- `frontend/AGENTS.md`

What changed:

- Redesigned `/dashboard` as a bento-style layout:
  - Dark welcome/CTA hero card.
  - Metrics cards with icon backgrounds and hover lift.
  - Network summary as a compact sidebar card.
  - CRM snapshot as a wider card with lifecycle breakdown.
  - Quick-action grid with hover lift and arrow micro-animation.
- Modernized `/u/[slug]` public profile:
  - Larger avatar and cleaner card styling.
  - "Book a meeting" as the primary CTA.
  - Share, QR, and Save contact as secondary actions.
  - Moved QR code into a `Dialog` with copy-link action.
  - Connection status banner now uses semantic success/warning tokens.
- Modernized public booking pages (`/book/[slug]` and `/book/[slug]/[meetingTypeSlug]`):
  - Meeting type rows use card-style hover lift.
  - Slot buttons use shadow and hover lift.
  - Header/footer backgrounds use the new brand background token.
- Added consistent micro-interactions across cards and buttons:
  - `hover:-translate-y-0.5`
  - `hover:shadow-dropdown`
  - `active:scale-[0.98]` on buttons.

Contract needed:

- No new backend contracts.

Open questions:

- Full month-calendar slot picker and timezone selector remain future enhancements.
- Public booking confirmation page can be enriched with "Add to calendar" ICS/download later.

Verification:

- `npm run lint` passed.
- `npm run build` passed.
- All 16 routes prerendered successfully.

Owner: Kimi
Area: UI/UX Phase 4 — Advanced patterns
Status: done
Files changed:

- `frontend/app/layout.tsx`
- `frontend/app/globals.css`
- `frontend/components/theme-provider.tsx` (new)
- `frontend/components/theme-toggle.tsx` (new)
- `frontend/components/layout/marketing-header.tsx`
- `frontend/app/dashboard/layout.tsx`
- `frontend/components/command-palette.tsx` (new)
- `frontend/app/page.tsx`
- `frontend/components/profile/profile-form.tsx`
- `AGENTS.md`
- `frontend/AGENTS.md`

What changed:

- Added full dark mode support:
  - `ThemeProvider` with light/dark/system preference, persisted in `localStorage`.
  - Dark color tokens in `globals.css` using Tailwind v4 `@variant dark`.
  - Theme toggle in marketing header and dashboard sidebar/mobile header.
- Added global command palette:
  - Press `Cmd+K` (or `Ctrl+K`) from any page.
  - Search and navigate marketing + dashboard routes.
  - Keyboard navigation with arrow keys and Enter.
- Enriched landing page (`/`):
  - Animated mesh gradient background.
  - Use-cases section (events, sales, freelancers).
  - Testimonials section.
  - Updated closing CTA and footer.
- Added avatar image upload UI to profile form:
  - Drag-and-drop or click to upload.
  - Live preview via the `Avatar` primitive.
  - Stored as a base64 data URL for now; notes that Codex should add a dedicated upload endpoint for production.

Contract needed:

- No new backend contracts for dark mode, command palette, or landing page.
- Avatar upload UI is client-side only; a backend upload endpoint is recommended before shipping to production.

Open questions:

- Confirm dark mode color contrast on all pages (especially third-party charts if added later).
- Confirm whether to add a backend avatar upload endpoint in a future backend pass.

Verification:

- `npm run lint` passed.
- `npm run build` passed.
- All 16 routes prerendered successfully.

Owner: Kimi
Area: UI/UX v2 Pass B — Dashboard shell + pages
Status: done
Files changed:

- `frontend/app/dashboard/layout.tsx`
- `frontend/app/dashboard/page.tsx`
- `frontend/app/dashboard/connections/page.tsx`
- `frontend/app/dashboard/connections/[id]/page.tsx`
- `frontend/app/dashboard/discover/page.tsx`
- `frontend/app/dashboard/events/page.tsx`
- `frontend/app/dashboard/events/[id]/page.tsx`
- `frontend/app/dashboard/profile/page.tsx`
- `frontend/app/dashboard/settings/page.tsx`
- `frontend/app/dashboard/scheduling/page.tsx`
- `frontend/components/empty-states/index.tsx`
- `frontend/components/loading/dashboard-skeleton.tsx`
- `frontend/components/analytics/metrics-cards.tsx`
- `frontend/components/crm/summary-cards.tsx`
- `frontend/components/relationship/status-selector.tsx`
- `frontend/components/relationship/notes-section.tsx`
- `frontend/components/relationship/tags-section.tsx`
- `frontend/components/relationship/follow-ups-section.tsx`
- `frontend/components/crm/lifecycle-selector.tsx`
- `frontend/components/crm/priority-selector.tsx`
- `frontend/components/crm/activity-timeline.tsx`
- `frontend/components/profile/profile-form.tsx`
- `frontend/AGENTS.md`

What changed:

- Redesigned the authenticated dashboard experience to the Island Modern palette and style for the Sri Lankan market.
- New dashboard shell with glass/sticky mobile header, language switcher, theme toggle, user menu/avatar, and collapsible sidebar.
- Sidebar nav items use rounded cards, icon badges, and active state with secondary background + accent indicator.
- Restyled empty/error/loading states with semantic tokens (`error-subtle`, muted borders, secondary icons).
- Updated `DashboardSkeleton` to match the new bento dashboard layout.
- Updated `MetricsCards` and `CRMSummaryCards` with gradient icon badges, hover lift, and lifecycle breakdown.
- Redesigned `/dashboard` as a bento home: gradient hero card with "Made for Sri Lankan professionals" badge, metrics, network card, CRM snapshot, and gradient quick-action cards.
- Restyled `/dashboard/connections` and `/dashboard/connections/[id]` with `Avatar`, `Badge`, rounded cards, and Island Modern tabs.
- Restyled `/dashboard/discover` profile cards with status badges and hover lift.
- Restyled `/dashboard/events` and `/dashboard/events/[id]` with new cards, forms, `Switch` for publish state, and attendee cards.
- Refreshed `/dashboard/profile` and `ProfileForm` with local placeholder copy, new Input/Textarea/Switch/Avatar/Badge styles, and polished avatar dropzone.
- Refreshed `/dashboard/settings` with language and appearance cards.
- Refreshed `/dashboard/scheduling` with gradient stat cards and updated booking/calendar cards.
- Restyled relationship and CRM components (`status-selector`, `notes-section`, `tags-section`, `follow-ups-section`, `lifecycle-selector`, `priority-selector`, `activity-timeline`) to match Island Modern tokens while preserving all logic.

Contract needed:

- No new backend contracts. All existing API calls, types, request shapes, and data shapes are unchanged.

Open questions:

- Pass C should tackle public pages (`/u/[slug]`, `/e/[slug]`, `/book/[slug]/*`), command palette styling, and final responsive polish.
- WhatsApp share and bottom-sheet public profile actions are planned for Pass C.

Verification:

- `npm run lint` passed.
- `npm run build` passed.
- All 16 routes still prerender successfully.

Owner: Codex
Area: Final integration and launch readiness
Status: paused for Scheduling upgrade planning
Files changed:

- Not started yet.

What changed:

- All five product phases are now implemented and reviewed at contract/build level.

Contract needed:

- No new feature contracts. Focus on QA, environment hardening, Git setup, and deployment readiness.

Open questions:

- Project folder is still not a Git repository, so Codex cannot commit or push yet.
- Confirm test domain remains `https://to1.cloudit.lk`.
- Confirm production domain remains `https://po1.cloudit.lk`.

Verification:

- Pending final end-to-end QA.

Owner: Codex
Area: Scheduling upgrade planning
Status: done
Files changed:

- `docs/scheduling-upgrade-plan.md`
- `AGENTS.md`

What changed:

- Created separate OrbitOne Scheduling upgrade plan.
- Split work into Codex backend/integration phases and Kimi frontend phases.
- Updated workflow so all new modules are backend-first.
- Defined Google Calendar first, Microsoft Calendar later.
- Defined scheduling routes, backend contracts, frontend ownership, and definition of done.

Contract needed:

- Codex must define shared scheduling types and API contracts before Kimi starts implementation.
- Kimi should build only against contracts in `docs/scheduling-upgrade-plan.md` and later `docs/backend-contracts.md`.

Open questions:

- Confirm Google Calendar should be the first live provider.
- Confirm Microsoft Outlook should wait until Google scheduling works end to end.
- Confirm public booking routes should be `/book/[slug]` and `/book/[slug]/[meetingTypeSlug]`.

Verification:

- Documentation-only planning update.

Owner: Codex
Area: Scheduling S1 backend foundation
Status: done, ready for frontend handoff when user instructs Kimi
Files changed:

- `backend/migrations/0005_scheduling_foundation.sql`
- `backend/src/routes/v1.ts`
- `backend/src/types/contracts.ts`
- `contracts/orbitone.ts`
- `docs/backend-contracts.md`
- `docs/scheduling-upgrade-plan.md`
- `AGENTS.md`

What changed:

- Added Scheduling foundation schema.
- Added shared scheduling TypeScript contracts.
- Added calendar account status endpoint.
- Added meeting type CRUD endpoints.
- Added availability read/update endpoints.
- Added booking list/detail, cancel, and reschedule endpoints.
- Kept Google Calendar OAuth and external busy-time sync for Scheduling S2.

Contract needed:

- Kimi can build Scheduling dashboard/meeting type/availability/bookings frontend later against:
  - `GET /api/v1/scheduling/calendar-accounts`
  - `GET /api/v1/scheduling/meeting-types`
  - `POST /api/v1/scheduling/meeting-types`
  - `PUT /api/v1/scheduling/meeting-types/:id`
  - `DELETE /api/v1/scheduling/meeting-types/:id`
  - `GET /api/v1/scheduling/availability`
  - `PUT /api/v1/scheduling/availability`
  - `GET /api/v1/scheduling/bookings`
  - `GET /api/v1/scheduling/bookings/:id`
  - `POST /api/v1/scheduling/bookings/:id/cancel`
  - `POST /api/v1/scheduling/bookings/:id/reschedule`

Open questions:

- Google Calendar integration starts next in Scheduling S2.
- Public booking slot generation starts after Google busy-time integration.
- Kimi should wait until the user tells Kimi to start frontend.

Verification:

- Backend typecheck passed.
- Frontend lint passed.
- Local migration applied to PostgreSQL.
- Docker backend rebuilt.
- Scheduling S1 smoke test passed for calendar accounts, meeting type create/update, availability save/read, and bookings list.

## Scheduling Upgrade Handoff

Owner: Kimi
Area: OrbitOne Scheduling frontend S1/S2
Status: done
Files changed:

- `frontend/app/dashboard/scheduling/page.tsx`
- `frontend/app/dashboard/scheduling/meeting-types/page.tsx`
- `frontend/app/dashboard/scheduling/availability/page.tsx`
- `frontend/app/dashboard/scheduling/bookings/page.tsx`
- `frontend/app/dashboard/scheduling/calendar/page.tsx`
- `frontend/app/dashboard/layout.tsx`
- `frontend/lib/contracts.ts`
- `frontend/AGENTS.md`

What changed:

- Built Scheduling dashboard UI against completed backend S1 contracts.
- Wired real Google Calendar OAuth flow on `/dashboard/scheduling/calendar` using backend S2 endpoints.
- Implemented routes: `/dashboard/scheduling`, `/dashboard/scheduling/calendar`, `/dashboard/scheduling/meeting-types`, `/dashboard/scheduling/availability`, `/dashboard/scheduling/bookings`.
- Public booking pages (`/book/[slug]` and `/book/[slug]/[meetingTypeSlug]`) remain out of scope until backend S3.

Contract needed:

- Backend S1/S2 endpoints used:
  - `GET /api/v1/profiles/me`
  - `GET /api/v1/scheduling/calendar-accounts`
  - `POST /api/v1/scheduling/google/connect`
  - `GET /api/v1/scheduling/google/callback`
  - `DELETE /api/v1/scheduling/calendar-accounts/:id`
  - `GET /api/v1/scheduling/meeting-types`
  - `POST /api/v1/scheduling/meeting-types`
  - `PUT /api/v1/scheduling/meeting-types/:id`
  - `DELETE /api/v1/scheduling/meeting-types/:id`
  - `GET /api/v1/scheduling/availability`
  - `PUT /api/v1/scheduling/availability`
  - `GET /api/v1/scheduling/bookings`
  - `POST /api/v1/scheduling/bookings/:id/cancel`

Open questions:

- Keep Scheduling UI OrbitOne-native and professional, not a generic Calendly clone.
- Microsoft Outlook integration waits until Google Calendar scheduling works end to end.

Verification:

- `npm run lint` passed.
- `npm run build` passed.
- All new dashboard scheduling routes render with loading/empty/error states.
- Connect/disconnect flow and OAuth callback success/error states wired on `/dashboard/scheduling/calendar`.

Owner: Codex
Area: Scheduling S2 Google Calendar backend integration
Status: backend complete, awaiting real Google credentials for live OAuth test
Files changed:

- `backend/src/config/env.ts`
- `backend/src/routes/v1.ts`
- `backend/src/types/contracts.ts`
- `contracts/orbitone.ts`
- `frontend/lib/contracts.ts`
- `.env.example`
- `docs/backend-contracts.md`
- `docs/scheduling-upgrade-plan.md`
- `AGENTS.md`

What changed:

- Added Google Calendar OAuth connect routes.
- Added backend-only token encryption storage for Google access and refresh tokens.
- Added calendar account disconnect route that clears tokens and marks the account disconnected.
- Added optional Google Calendar environment variables so local development still boots before credentials exist.
- Documented the Scheduling S2 backend contract for Kimi.

Contract needed:

- Kimi can update the calendar connect UI after the user asks Kimi to start.
- Frontend can either redirect to `GET /api/v1/scheduling/google/connect` or call `POST /api/v1/scheduling/google/connect` and then navigate to `data.authorizationUrl`.
- Backend endpoints:
  - `GET /api/v1/scheduling/google/connect`
  - `POST /api/v1/scheduling/google/connect`
  - `GET /api/v1/scheduling/google/callback`
  - `DELETE /api/v1/scheduling/calendar-accounts/:id`
- `POST /api/v1/scheduling/google/connect` returns:
  - `{ ok: true, data: { authorizationUrl: string } }`
- `GET /api/v1/scheduling/google/callback` redirects to `/dashboard/scheduling/calendar?connected=google` or `/dashboard/scheduling/calendar?error=...`.
- `DELETE /api/v1/scheduling/calendar-accounts/:id` returns the disconnected `CalendarAccount`.

Open questions:

- Need Google OAuth client credentials before live OAuth can be fully tested:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_CALENDAR_REDIRECT_URI`
  - `CALENDAR_TOKEN_ENCRYPTION_KEY`
- Public booking pages (`/book/[slug]` and `/book/[slug]/[meetingTypeSlug]`) are built; profile/connection/event integration buttons were built in S5.

Verification:

- `npm run typecheck` passed in `backend`.
- `npm run lint` passed in `frontend`.
- Docker backend rebuilt with `docker compose -f docker-compose.local.yml up -d --build backend`.
- Backend health smoke passed at `http://localhost:8000/health`.
- Authenticated `POST /api/v1/scheduling/google/connect` returns expected `503` until Google credentials are configured.

Owner: Codex
Area: Scheduling S3 slot engine and public booking backend
Status: backend complete, ready for Kimi public booking UI
Files changed:

- `backend/migrations/0006_scheduling_public_booking.sql`
- `backend/src/routes/v1.ts`
- `backend/src/types/contracts.ts`
- `contracts/orbitone.ts`
- `frontend/lib/contracts.ts`
- `docs/backend-contracts.md`
- `docs/scheduling-upgrade-plan.md`
- `AGENTS.md`

What changed:

- Added public booking profile endpoint.
- Added public slot lookup endpoint with OrbitOne availability, availability exceptions, minimum notice, booking window, duration, buffers, max bookings per day, and existing booking conflict checks.
- Added public booking creation endpoint that re-checks selected slot availability before confirming the booking.
- Added booking guest creation and booking audit event creation.
- Added shared public booking TypeScript contracts.
- Added migration for calendar account `scopes` column, meeting type `max_bookings_per_day`, and active booking time index.

Contract needed:

- Kimi can build public booking pages after the user asks Kimi to start.
- Backend endpoints:
  - `GET /api/v1/book/:profileSlug`
  - `GET /api/v1/book/:profileSlug/:meetingTypeSlug/slots?from=&to=&timezone=`
  - `POST /api/v1/book/:profileSlug/:meetingTypeSlug/bookings`
- `GET /api/v1/book/:profileSlug` returns:
  - `{ ok: true, data: { profile: PublicProfile, meetingTypes: MeetingType[] } }`
- `GET /api/v1/book/:profileSlug/:meetingTypeSlug/slots` returns:
  - `{ ok: true, data: { profile: PublicProfile, meetingType: MeetingType, slots: BookingSlot[] } }`
- `POST /api/v1/book/:profileSlug/:meetingTypeSlug/bookings` accepts:
  - `guestName`
  - `guestEmail`
  - `guestCompany`
  - `guestMessage`
  - `startAt`
  - `timezone`
  - `source`
- `POST /api/v1/book/:profileSlug/:meetingTypeSlug/bookings` returns:
  - `{ ok: true, data: { booking: Booking, profile: PublicProfile } }`

Open questions:

- Google free/busy merge still needs real Google OAuth credentials before live verification.
- Max bookings per day is enforced when `max_bookings_per_day` is configured.
- Kimi built profile/connection/event integration buttons in S5 after Codex S4 backend integration was ready.

Verification:

- `npm run typecheck` passed in `backend`.
- `npm run lint` passed in `frontend`.
- Docker backend rebuild passed.
- Public booking smoke passed for profile lookup, slot lookup, and booking creation after final backend rebuild.
- Applying migration `0006` to the existing local Docker database was blocked by the approval system; new environments will run it automatically on first initialization.

Owner: Codex
Area: Scheduling S4 OrbitOne integration backend
Status: backend complete, ready for Kimi S5 existing UI integration
Files changed:

- `backend/migrations/0007_scheduling_orbitone_integration.sql`
- `backend/src/routes/v1.ts`
- `backend/src/types/contracts.ts`
- `contracts/orbitone.ts`
- `docs/backend-contracts.md`
- `docs/scheduling-upgrade-plan.md`
- `AGENTS.md`

What changed:

- Added scheduling analytics event types for booking page view, slot selected, confirmed, cancelled, and rescheduled.
- Extended public booking input with optional `connectionId` and `eventId`.
- Validated linked connection/event context before booking creation.
- Allowed event attendee booking context when the booking profile checked into the event.
- Stored linked `connection_id` and `event_id` on bookings when supplied.
- Created CRM meeting activity after connection-linked booking confirmation.
- Updated connection lifecycle from `new` or `contacted` to `meeting` after linked booking confirmation.
- Added automatic analytics tracking for booking page view, booking confirmed, booking cancelled, and booking rescheduled.

Contract needed:

- Kimi can build Scheduling S5 existing UI integration after the user asks Kimi to start.
- Existing public booking endpoint now also accepts:
  - `connectionId?: string | null`
  - `eventId?: string | null`
- `connectionId` must belong to the booking profile owner.
- `eventId` must either belong to the booking profile owner or be a published event.
- Frontend may track `booking_slot_selected` through `POST /api/v1/analytics/events`.
- Kimi S5 frontend can add:
  - `/u/[slug]` `Book a meeting` link to `/book/[slug]`
  - `/dashboard/connections/[id]` `Book follow-up` link with `connectionId` context
  - `/dashboard/events/[id]` attendee booking link with `eventId` context

Open questions:

- Google free/busy and Google event creation still need real OAuth credentials before live verification.
- Existing local Docker database may need migrations `0006` and `0007` applied manually; approval system blocked manual migration application earlier.

Verification:

- `npm run typecheck` passed in `backend`.
- `npm run lint` passed in `frontend`.
- Docker backend rebuild passed.
- Docker frontend rebuild/build passed.
- Backend health passed at `http://localhost:8000/health`.
- Connection-linked public booking smoke passed: booking stored as `source: connection`, `connectionId` returned, and CRM meeting activity created.
- Event-linked public booking smoke passed: booking stored as `source: event`, `eventId` returned.
- Local `npm run build` in `frontend` hit Windows `EPERM` on `.next/trace`; Docker frontend build passed and verified the Next production build.

Owner: Kimi
Area: Scheduling host approval and guest self-service reschedule/cancel frontend
Status: done
Files changed:

- `frontend/app/book/[slug]/[meetingTypeSlug]/page.tsx`
- `frontend/app/book/[slug]/[meetingTypeSlug]/reschedule/page.tsx`
- `frontend/app/book/[slug]/[meetingTypeSlug]/cancel/page.tsx`
- `frontend/components/booking/booking-confirmation.tsx`
- `frontend/components/booking/booking-guest-form.tsx`
- `frontend/components/booking/utils.tsx`
- `frontend/app/dashboard/scheduling/meeting-types/page.tsx`
- `frontend/app/dashboard/scheduling/bookings/page.tsx`
- `AGENTS.md`

What changed:

- Updated public booking creation to consume the new `PublicBookingConfirmation` shape and pass `guestTokens` to the confirmation screen.
- Added pending-approval UI in `BookingConfirmation` with reschedule/cancel links when tokens are present.
- Built guest self-service reschedule page with slot picker and token-based POST.
- Built guest self-service cancel page with optional reason and token-based POST.
- Added `requiresApproval` toggle to the meeting type form and card badge.
- Expanded host bookings page with tabs (All, Upcoming, Pending approval, Past, Cancelled), approve/reject actions for pending bookings, and host cancel/reschedule actions for confirmed/upcoming bookings.
- Added `toDateTimeLocal`/`fromDateTimeLocal` helpers in `frontend/components/booking/utils.tsx`.

Contract needed:

- Backend endpoints used:
  - `POST /api/v1/book/:profileSlug/:meetingTypeSlug/bookings`
  - `GET /api/v1/book/:profileSlug/:meetingTypeSlug/reschedule?token=`
  - `POST /api/v1/book/:profileSlug/:meetingTypeSlug/reschedule?token=`
  - `GET /api/v1/book/:profileSlug/:meetingTypeSlug/cancel?token=`
  - `POST /api/v1/book/:profileSlug/:meetingTypeSlug/cancel?token=`
  - `POST /api/v1/scheduling/bookings/:id/approve`
  - `POST /api/v1/scheduling/bookings/:id/reject`
  - `POST /api/v1/scheduling/bookings/:id/cancel`
  - `POST /api/v1/scheduling/bookings/:id/reschedule`
- Shared types already updated in `contracts/orbitone.ts`:
  - `MeetingType.requiresApproval`
  - `MeetingTypeInput.requiresApproval`
  - `PublicBookingConfirmation.guestTokens`

Open questions:

- Host reschedule uses a datetime-local input tied to the original booking timezone; a slot-picker integration could be added later.
- Google Calendar invite, `.ics` download, and WhatsApp share remain placeholders in `BookingConfirmation`.

Verification:

- `npm run lint` passed in `frontend`.
- `npm run build` passed in `frontend`.
- New routes `/book/[slug]/[meetingTypeSlug]/reschedule` and `/book/[slug]/[meetingTypeSlug]/cancel` render as dynamic routes.

## Commit Ready

Status: ready
Owner: Kimi
Area: Settings, team nav, mobile layout, README, and production blockers
Suggested commit message: `feat: settings, team nav, mobile layout, readme, and frontend production hardening`
Files ready:

- `frontend-v2/src/app/dashboard/settings/page.tsx`
- `frontend-v2/src/routes.tsx`
- `frontend-v2/src/app/dashboard/layout.tsx`
- `frontend-v2/src/app/dashboard/organization/page.tsx`
- `frontend-v2/src/app/dashboard/organization/members/page.tsx`
- `frontend-v2/index.html`
- `frontend-v2/src/lib/api.ts`
- `frontend-v2/src/main.tsx`
- `frontend-v2/src/providers/AuthProvider.tsx`
- `frontend-v2/src/components/ui/dialog.tsx`
- `frontend-v2/src/components/error-boundary.tsx`
- `frontend-v2/src/app/not-found/page.tsx`
- `frontend-v2/src/app/p/[slug]/page.tsx`
- `frontend-v2/src/app/book/[slug]/page.tsx`
- `frontend-v2/e2e/auth.spec.ts`
- `README.md`
- `frontend-v2/README.md`
- `AGENTS.md`

Verification:

- `npm run lint` passed in `frontend-v2` (one pre-existing warning).
- `npm run build` passed in `frontend-v2`.
- Full Playwright e2e suite (9 tests) passed.

---

Status: ready
Owner: Kimi + Codex
Area: Billing upgrade page Pro Business support
Suggested commit message: `feat: add pro business upgrade option`
Files ready:

- `frontend-v2/src/app/dashboard/upgrade/page.tsx`
- `frontend-v2/src/hooks/useBilling.ts`
- `backend/src/domain/billing/schemas.ts`
- `frontend-v2/e2e/helpers/api.ts`
- `AGENTS.md`

Verification:

- `npm run lint` passed in `frontend-v2` (one pre-existing warning).
- `npm run build` passed in `frontend-v2`.
- Full Playwright e2e suite (9 tests) passed.

---

Status: ready
Owner: Codex + Kimi
Area: Phase 4 B2B accounts backend, frontend, and e2e
Suggested commit message: `feat: phase 4 b2b accounts and networking`
Files ready:

- `backend/migrations/0015_b2b_accounts.sql`
- `backend/src/domain/accounts/service.ts`
- `backend/src/domain/accounts/schemas.ts`
- `backend/src/domain/accounts/routes.ts`
- `backend/src/middleware/plan.ts`
- `backend/src/routes/v2.ts`
- `contracts/orbitone.v2.ts`
- `frontend-v2/src/hooks/useAccounts.ts`
- `frontend-v2/src/app/dashboard/accounts/page.tsx`
- `frontend-v2/src/app/dashboard/accounts/detail.tsx`
- `frontend-v2/src/app/a/[slug]/page.tsx`
- `frontend-v2/src/app/directory/page.tsx`
- `frontend-v2/src/app/dashboard/layout.tsx`
- `frontend-v2/src/routes.tsx`
- `frontend-v2/e2e/accounts.spec.ts`
- `AGENTS.md`

Verification:

- `npm run typecheck` passed in `backend`.
- `npm run build` passed in `backend`.
- `npm run lint` passed in `frontend-v2` (one pre-existing warning).
- `npm run build` passed in `frontend-v2`.
- Full Playwright e2e suite (9 tests) passed.

---

Status: ready
Owner: Kimi + Codex
Area: UI/UX modernization and Codex integration review
Suggested commit message: `frontend: modernize orbitone ui`
Files ready:

- `frontend/app/globals.css`
- `frontend/components/ui/*`
- `frontend/components/theme-provider.tsx`
- `frontend/components/theme-toggle.tsx`
- `frontend/components/command-palette.tsx`
- `frontend/components/loading/dashboard-skeleton.tsx`
- `frontend/app/layout.tsx`
- `frontend/app/page.tsx`
- `frontend/app/dashboard/layout.tsx`
- `frontend/app/dashboard/page.tsx`
- `frontend/app/u/[slug]/page.tsx`
- `frontend/app/book/[slug]/page.tsx`
- `frontend/app/book/[slug]/[meetingTypeSlug]/page.tsx`
- `frontend/components/profile/profile-form.tsx`
- `frontend/components/profile/public-profile-card.tsx`
- `frontend/components/analytics/metrics-cards.tsx`
- `frontend/components/crm/summary-cards.tsx`
- `frontend/next.config.ts`
- `frontend/lib/image-loader.ts`
- `AGENTS.md`
- `frontend/AGENTS.md`

Verification:

- Kimi: `npm run lint` passed.
- Kimi: `npm run build` passed.
- Codex: `npm run typecheck` passed in `backend`.
- Codex: `npm run lint` passed in `frontend`.
- Codex: local frontend build hit known Windows `.next/trace` `EPERM`.
- Codex: Docker frontend/backend build passed; all 16 Next routes generated.
- Codex: Docker services restarted from verified images.
- Codex: backend health passed.
- Codex: HTTP route smoke passed for `/`, `/login`, `/dashboard`, `/dashboard/profile`, `/dashboard/scheduling`, and `/book/test-slug`.

Commit status:

- Not committed because this folder is not yet a Git repository.

Status: ready
Owner: Codex
Area: Zoho Calendar provider integration
Suggested commit message: `backend: add zoho calendar provider`
Files ready:

- `backend/migrations/0008_zoho_calendar_provider.sql`
- `backend/src/config/env.ts`
- `backend/src/routes/v1.ts`
- `backend/src/types/contracts.ts`
- `contracts/orbitone.ts`
- `frontend/app/dashboard/scheduling/calendar/page.tsx`
- `.env.example`
- `docs/backend-contracts.md`
- `docs/scheduling-upgrade-plan.md`
- `AGENTS.md`

Verification:

- `npm run typecheck` passed in `backend`.
- `npm run lint` passed in `frontend`.
- Docker frontend/backend rebuild passed.
- Backend health passed.
- Zoho connect missing-config smoke returns expected `503`.

Commit status:

- Not committed because this folder is not yet a Git repository.

Status: ready
Owner: Kimi
Area: Scheduling S5 existing UI integration
Suggested commit message: `frontend: add scheduling integration entry points`
Files ready:

- `frontend/app/u/[slug]/page.tsx`
- `frontend/app/dashboard/connections/[id]/page.tsx`
- `frontend/app/dashboard/events/[id]/page.tsx`
- `frontend/app/book/[slug]/page.tsx`
- `frontend/app/book/[slug]/[meetingTypeSlug]/page.tsx`
- `frontend/AGENTS.md`

Verification:

- `npm run lint` passed.
- `npm run build` passed.
- Booking entry points wired on `/u/[slug]`, `/dashboard/connections/[id]`, and `/dashboard/events/[id]`.
- `connectionId`/`eventId` context passes through public booking pages and into booking creation.
- Optional `booking_slot_selected` analytics event fires on slot selection.

Commit status:

- Not committed because this folder is not yet a Git repository.

Status: ready
Owner: Codex
Area: Scheduling S4 OrbitOne integration backend
Suggested commit message: `backend: integrate scheduling with orbitone crm`
Files ready:

- `backend/migrations/0007_scheduling_orbitone_integration.sql`
- `backend/src/routes/v1.ts`
- `backend/src/types/contracts.ts`
- `contracts/orbitone.ts`
- `docs/backend-contracts.md`
- `docs/scheduling-upgrade-plan.md`
- `AGENTS.md`

Verification:

- `npm run typecheck` passed in `backend`.
- `npm run lint` passed in `frontend`.
- Docker backend rebuild passed.
- Docker frontend rebuild/build passed.
- Connection-linked public booking smoke passed.

Commit status:

- Not committed because this folder is not yet a Git repository.

Status: ready
Owner: Kimi
Area: Scheduling S4 public booking frontend
Suggested commit message: `frontend: add public scheduling booking pages`
Files ready:

- `frontend/app/book/[slug]/page.tsx`
- `frontend/app/book/[slug]/[meetingTypeSlug]/page.tsx`
- `frontend/AGENTS.md`

Verification:

- `npm run lint` passed.
- `npm run build` passed.
- New routes `/book/[slug]` and `/book/[slug]/[meetingTypeSlug]` render with loading/empty/error states.
- Request shapes match backend S3 contracts.

Commit status:

- Not committed because this folder is not yet a Git repository.

Status: ready
Owner: Codex
Area: Scheduling S3 slot engine and public booking backend
Suggested commit message: `backend: add public scheduling booking api`
Files ready:

- `backend/migrations/0006_scheduling_public_booking.sql`
- `backend/src/routes/v1.ts`
- `backend/src/types/contracts.ts`
- `contracts/orbitone.ts`
- `frontend/lib/contracts.ts`
- `docs/backend-contracts.md`
- `docs/scheduling-upgrade-plan.md`
- `AGENTS.md`

Verification:

- `npm run typecheck` passed in `backend`.
- `npm run lint` passed in `frontend`.
- Docker backend rebuild passed.
- Public booking smoke passed.

Commit status:

- Not committed because this folder is not yet a Git repository.

Status: ready
Owner: Kimi
Area: Scheduling S2 frontend Google Calendar connect
Suggested commit message: `frontend: wire google calendar connect flow`
Files ready:

- `frontend/app/dashboard/scheduling/calendar/page.tsx`

Verification:

- `npm run lint` passed.
- `npm run build` passed.
- `/dashboard/scheduling/calendar` handles connect, disconnect, success, and error states.

Commit status:

- Not committed because this folder is not yet a Git repository.

Status: ready
Owner: Codex
Area: Scheduling S2 Google Calendar backend integration
Suggested commit message: `backend: add google calendar scheduling connect`
Files ready:

- `backend/src/config/env.ts`
- `backend/src/routes/v1.ts`
- `backend/src/types/contracts.ts`
- `contracts/orbitone.ts`
- `frontend/lib/contracts.ts`
- `.env.example`
- `docs/backend-contracts.md`
- `docs/scheduling-upgrade-plan.md`
- `AGENTS.md`

Verification:

- `npm run typecheck` passed in `backend`.
- `npm run lint` passed in `frontend`.
- Docker backend rebuild passed.
- Backend health smoke passed.
- Google connect missing-config smoke returns expected `503`.

Commit status:

- Not committed because this folder is not yet a Git repository.

Status: ready
Owner: Kimi
Area: Scheduling S1/S2 frontend
Suggested commit message: `frontend: add scheduling dashboard ui`
Files ready:

- `frontend/app/dashboard/scheduling/page.tsx`
- `frontend/app/dashboard/scheduling/meeting-types/page.tsx`
- `frontend/app/dashboard/scheduling/availability/page.tsx`
- `frontend/app/dashboard/scheduling/bookings/page.tsx`
- `frontend/app/dashboard/scheduling/calendar/page.tsx`
- `frontend/app/dashboard/layout.tsx`
- `frontend/lib/contracts.ts`
- `frontend/AGENTS.md`

Verification:

- `npm run lint` passed.
- `npm run build` passed.
- New routes `/dashboard/scheduling`, `/dashboard/scheduling/calendar`, `/dashboard/scheduling/meeting-types`, `/dashboard/scheduling/availability`, `/dashboard/scheduling/bookings` render with loading/empty/error states.
- Codex review verified request shapes against Scheduling S1 backend.
- Codex verified backend typecheck, frontend lint/build, Docker frontend/backend rebuild, backend health, and scheduling route checks.

Commit status:

- Not committed because this folder is not yet a Git repository.

Status: ready
Owner: Codex
Area: Phase 1 backend/frontend integration and Docker foundation
Suggested commit message: `backend: add phase 1 api and local docker stack`
Files ready:

- `backend/`
- `contracts/`
- `docs/`
- `frontend/Dockerfile`
- `frontend/.dockerignore`
- `frontend/lib/api.ts`
- `frontend/README.md`
- `infra/`
- `docker-compose.local.yml`
- `docker-compose.test.yml`
- `docker-compose.prod.yml`
- `.env.example`
- `.gitignore`
- `.dockerignore`
- `README.md`
- `AGENTS.md`
- `codex.md`
- `kimi.md`
- `prompts/backend_codex.md`

Verification:

- Backend typecheck/build passed.
- Frontend lint/build passed.
- Docker local stack healthy.

Commit status:

- Not committed because this folder is not yet a Git repository.

Status: ready
Owner: Codex
Area: Phase 2 professional networking backend contracts
Suggested commit message: `backend: add phase 2 networking endpoints`
Files ready:

- `backend/src/routes/v1.ts`
- `backend/src/types/contracts.ts`
- `contracts/orbitone.ts`
- `docs/backend-contracts.md`
- `docs/phase-delivery-plan.md`
- `AGENTS.md`

Verification:

- Backend typecheck/build passed.
- Frontend lint passed.
- Docker stack rebuilt.
- Phase 2 smoke test passed.

Commit status:

- Not committed because this folder is not yet a Git repository.

Status: ready
Owner: Kimi
Area: Phase 2 professional networking frontend
Suggested commit message: `frontend: add phase 2 networking ui`
Files ready:

- `frontend/app/dashboard/discover/page.tsx`
- `frontend/app/dashboard/page.tsx`
- `frontend/app/dashboard/connections/page.tsx`
- `frontend/app/u/[slug]/page.tsx`
- `frontend/app/dashboard/layout.tsx`
- `frontend/lib/contracts.ts`
- `frontend/lib/use-network-status.ts`
- `frontend/.env.local`
- `frontend/AGENTS.md`

Verification:

- `npm run lint` passed.
- `npm run build` passed.
- All new routes render with clean loading/empty/error states.
- Codex verified frontend lint/build.
- Codex rebuilt local Docker stack.
- Codex verified `/dashboard/discover` and `/dashboard/connections` return 200.
- Codex verified backend health is green.

Commit status:

- Not committed because this folder is not yet a Git repository.

Status: ready
Owner: Codex
Area: Phase 3 relationship management backend contracts
Suggested commit message: `backend: add phase 3 relationship management`
Files ready:

- `backend/migrations/0002_relationship_management.sql`
- `backend/src/routes/v1.ts`
- `backend/src/types/contracts.ts`
- `contracts/orbitone.ts`
- `docs/backend-contracts.md`
- `docs/phase-delivery-plan.md`
- `frontend/AGENTS.md`
- `AGENTS.md`

Verification:

- Backend typecheck passed.
- Backend build passed.
- Frontend lint passed.
- Local migration applied to PostgreSQL.
- Backend health reports `postgres=true` and `redis=true`.
- Phase 3 smoke test passed for relationship status, notes, tags, tag assignment, follow-up creation, follow-up completion, and relationship summary retrieval.

Commit status:

- Not committed because this folder is not yet a Git repository.

Status: ready
Owner: Kimi
Area: Phase 3 relationship management frontend
Suggested commit message: `frontend: add phase 3 relationship management ui`
Files ready:

- `frontend/app/dashboard/connections/[id]/page.tsx`
- `frontend/app/dashboard/connections/page.tsx`
- `frontend/components/relationship/status-selector.tsx`
- `frontend/components/relationship/notes-section.tsx`
- `frontend/components/relationship/tags-section.tsx`
- `frontend/components/relationship/follow-ups-section.tsx`
- `frontend/lib/contracts.ts`
- `frontend/AGENTS.md`

Verification:

- `npm run lint` passed.
- `npm run build` passed.
- New `/dashboard/connections/[id]` route renders with loading/empty/error states.
- Codex review fixed tag color and follow-up completion request body integration issues.
- Codex verified frontend lint/build and rebuilt Docker frontend.

Commit status:

- Not committed because this folder is not yet a Git repository.

Status: ready
Owner: Codex
Area: Phase 4 event networking backend contracts
Suggested commit message: `backend: add phase 4 event networking`
Files ready:

- `backend/migrations/0003_event_networking.sql`
- `backend/src/routes/v1.ts`
- `backend/src/types/contracts.ts`
- `contracts/orbitone.ts`
- `docs/backend-contracts.md`
- `docs/phase-delivery-plan.md`
- `frontend/AGENTS.md`
- `AGENTS.md`

Verification:

- Backend typecheck passed.
- Frontend lint passed.
- Frontend build passed.
- Local migration applied to PostgreSQL.
- Docker backend and frontend rebuilt.
- Phase 4 smoke test passed for event create, public event lookup, attendee check-in, and attendee networking retrieval.

Commit status:

- Not committed because this folder is not yet a Git repository.

Status: ready
Owner: Kimi
Area: Phase 4 event networking frontend
Suggested commit message: `frontend: add phase 4 event networking ui`
Files ready:

- `frontend/app/dashboard/events/page.tsx`
- `frontend/app/dashboard/events/[id]/page.tsx`
- `frontend/app/e/[slug]/page.tsx`
- `frontend/app/dashboard/layout.tsx`
- `frontend/lib/contracts.ts`
- `frontend/AGENTS.md`

Verification:

- `npm run lint` passed.
- `npm run build` passed.
- New routes `/dashboard/events`, `/dashboard/events/[id]`, and `/e/[slug]` render with loading/empty/error states.
- Codex review fixed owned event detail loading and checked-in attendee detection.
- Codex verified backend typecheck, frontend lint/build, and rebuilt Docker frontend/backend.

Commit status:

- Not committed because this folder is not yet a Git repository.

Status: ready
Owner: Codex
Area: Phase 5 light CRM backend contracts
Suggested commit message: `backend: add phase 5 light crm`
Files ready:

- `backend/migrations/0004_light_crm.sql`
- `backend/src/routes/v1.ts`
- `backend/src/types/contracts.ts`
- `contracts/orbitone.ts`
- `docs/backend-contracts.md`
- `docs/phase-delivery-plan.md`
- `frontend/app/e/[slug]/page.tsx`
- `frontend/lib/contracts.ts`
- `frontend/AGENTS.md`
- `AGENTS.md`

Verification:

- Backend typecheck passed.
- Frontend lint passed.
- Frontend build passed.
- Local migration applied to PostgreSQL.
- Docker backend and frontend rebuilt.
- Phase 4 review smoke test passed for owned event detail by ID.
- Phase 5 smoke test passed for CRM summary, lifecycle update, priority update, next step, and activity creation/retrieval.

Commit status:

- Not committed because this folder is not yet a Git repository.

Status: ready
Owner: Kimi
Area: Phase 5 light CRM frontend
Suggested commit message: `frontend: add phase 5 light crm ui`
Files ready:

- `frontend/app/dashboard/page.tsx`
- `frontend/app/dashboard/connections/[id]/page.tsx`
- `frontend/components/crm/summary-cards.tsx`
- `frontend/components/crm/lifecycle-selector.tsx`
- `frontend/components/crm/priority-selector.tsx`
- `frontend/components/crm/activity-timeline.tsx`
- `frontend/lib/contracts.ts`
- `frontend/AGENTS.md`

Verification:

- `npm run lint` passed.
- `npm run build` passed.
- Dashboard CRM snapshot and connection detail CRM sections render with loading/empty/error states.
- Codex review verified Phase 5 request shapes match backend contracts.
- Codex verified backend typecheck, frontend lint/build, Docker frontend/backend rebuild, and route checks for `/dashboard`, `/dashboard/connections`, and `/dashboard/events`.

Commit status:

- Not committed because this folder is not yet a Git repository.

Owner: Kimi
Area: Pass C — Public pages + final polish
Status: done
Files changed:

- `frontend/app/u/[slug]/page.tsx`
- `frontend/app/e/[slug]/page.tsx`
- `frontend/app/book/[slug]/page.tsx`
- `frontend/app/book/[slug]/[meetingTypeSlug]/page.tsx`
- `frontend/components/profile/public-profile-card.tsx`
- `frontend/components/command-palette.tsx`
- `frontend/components/layout/public-shell.tsx`
- `frontend/AGENTS.md`
- `AGENTS.md`

What changed:

- Redesigned all public-facing pages to Island Modern style.
- Created shared `PublicShell` with Logo, language switcher, theme toggle, and Sign in/Dashboard button.
- Restyled `PublicProfileCard` with larger gradient avatar ring, sunset header, pill-shaped meta badges, and contact icon links.
- Added Island Modern action bar on public profile: Book a meeting, WhatsApp share, native share/copy fallback, QR dialog, Save vCard, Add to network.
- Added WhatsApp share button that opens `https://wa.me/?text=...` with profile name and public URL.
- Updated connection status banner to use `Badge` with Island Modern success/warning colors.
- Redesigned public event page with gradient event hero card, date/location meta, publish state badge, check-in CTA with success state, event QR card, and attendee grid with avatars and connection status badges.
- Redesigned public booking profile selection with profile card and meeting-type rows with hover lift and Island Modern icons.
- Redesigned public booking flow with profile + meeting header, week navigation, slot picker grouped by date, booking form using `Textarea` primitive, and confirmation view using success-subtle/success tokens.
- Restyled command palette with glass/surface palette and improved selected-item highlight.
- Added "Made for Sri Lankan professionals" trust badge to public footer.

Contract needed:

- No backend contract changes. All existing API calls, types, and data shapes preserved.

Open questions:

- None.

Verification:

- `npm run lint` passed.
- `npm run build` passed.
- All public routes render with Island Modern styling.
- QR dialog, copy link, vCard download, add-to-network, check-in, slot selection, and booking submission logic preserved.

Owner: Kimi
Area: Phase 5 v2 frontend — CRM pages and rating UI
Status: done
Files changed:

- `frontend-v2/src/hooks/useCRM.ts`
- `frontend-v2/src/hooks/useDashboard.ts`
- `frontend-v2/src/hooks/useRating.ts`
- `frontend-v2/src/app/dashboard/page.tsx`
- `frontend-v2/src/app/dashboard/customers/page.tsx`
- `frontend-v2/src/app/dashboard/customers/detail.tsx`
- `frontend-v2/src/app/rate/[slug]/page.tsx`
- `frontend-v2/src/components/rating/rating-form.tsx`
- `frontend-v2/src/routes.tsx`
- `backend/src/domain/customers/service.ts`
- `frontend-v2/playwright.config.ts`
- `frontend-v2/e2e/helpers/api.ts`
- `frontend-v2/e2e/auth.spec.ts`
- `frontend-v2/e2e/profile.spec.ts`
- `frontend-v2/e2e/scheduling.spec.ts`
- `frontend-v2/e2e/crm.spec.ts`
- `frontend-v2/e2e/rating.spec.ts`

What changed:

- Added CRM hooks for customers, activities, follow-ups, and CRM summary.
- Fixed backend `createCustomer` source_profile_id expression that incorrectly inserted the source string into a UUID column for manual customers.
- Installed Playwright and added an e2e suite covering auth, profile, scheduling booking, CRM, and ratings flows.
- Made customer cards fully clickable on `/dashboard/customers`.
- Built `/dashboard/customers` list with search, lifecycle/priority badges, and add-customer dialog.
- Built `/dashboard/customers/:id` detail with editable details, lifecycle/priority selectors, next step, notes, activity timeline, and follow-ups (add/complete/delete).
- Wired dashboard home to `GET /api/v2/dashboard/summary` and added CRM snapshot + upcoming bookings cards.
- Added `RatingForm` component with star input and optional review.
- Added public `/rate/:slug` page for submitting ratings against `POST /api/v2/ratings`.
- Registered `/dashboard/customers`, `/dashboard/customers/:id`, and `/rate/:slug` routes.

Contract needed:

- Uses v2 backend endpoints from Codex Phase 5 backend work:
  - `GET /api/v2/customers`
  - `POST /api/v2/customers`
  - `GET /api/v2/customers/:id`
  - `PUT /api/v2/customers/:id`
  - `DELETE /api/v2/customers/:id`
  - `GET /api/v2/customers/:id/activities`
  - `POST /api/v2/customers/:id/activities`
  - `GET /api/v2/customers/:id/follow-ups`
  - `POST /api/v2/customers/:id/follow-ups`
  - `PATCH /api/v2/customers/:id/follow-ups/:followUpId`
  - `DELETE /api/v2/customers/:id/follow-ups/:followUpId`
  - `GET /api/v2/dashboard/summary`
  - `POST /api/v2/ratings`

Open questions:

- Customer tags endpoints are defined in the schema migration but not exposed in the backend v2 routes yet; UI omits tags for now.

Verification:

- `npm run lint` passed (one pre-existing React Compiler warning in scheduling availability page).
- `npm run build` passed in `frontend-v2`.
- `npm run typecheck` and `npm run build` passed in `backend`.
- `npx playwright test` passed: 6/6 e2e specs.

---

Owner: Kimi
Area: Dark futuristic UI/UX redesign — landing + dashboard
Status: done
Files changed:

- `frontend-v2/index.html`
- `frontend-v2/src/app/page.tsx`
- `frontend-v2/src/app/dashboard/page.tsx`
- `frontend-v2/src/app/dashboard/layout.tsx`
- `frontend-v2/src/components/layout/marketing-header.tsx`
- `frontend-v2/src/components/ui/glass-card.tsx`
- `frontend-v2/src/components/ui/stat-tile.tsx`
- `frontend-v2/src/components/ui/gradient-text.tsx`
- `frontend-v2/src/components/dashboard/quick-actions.tsx`
- `UIUX_REDESIGN_PLAN.md`

What changed:

- Switched the app to dark mode by default via `<html class="dark">`.
- Redesigned the landing page with a glass header, gradient hero headline, glowing CSS orb, bento feature grid, how-it-works, pricing, and gradient CTA footer.
- Redesigned the dashboard home with a welcome header, stat tiles, bento-grid widgets (profile, QR, usage, analytics sparkline, upcoming bookings, CRM snapshot, quick actions).
- Updated the dashboard sidebar to a compact glass style with active pill indicator and user profile panel.
- Added reusable components: `GlassCard`, `StatTile`, `GradientText`, `QuickActions`.

Verification:

- `npm run lint` passed (existing scheduling availability warning only).
- `npm run build` passed in `frontend-v2`.
- `npx playwright test` passed: 6/6 e2e specs.

---

Owner: Kimi
Area: Scheduling calendar page
Status: done
Files changed:

- `frontend-v2/src/app/dashboard/scheduling/layout.tsx`
- `frontend-v2/src/app/dashboard/scheduling/calendar/page.tsx`
- `frontend-v2/src/routes.tsx`

What changed:

- Added a "Calendar" tab to the scheduling sub-navigation.
- Built `/dashboard/scheduling/calendar` with a custom month-view grid, prev/next navigation, today button, and day selection.
- Bookings are grouped by date with color-coded dots (confirmed/pending/cancelled).
- Side panel shows bookings for the selected day or upcoming bookings when no day is selected.
- Added quick filters to jump to today or the bookings list.
- Events integration is left as a placeholder for when the backend events domain is added to v2.

Verification:

- `npm run lint` passed (existing scheduling availability warning only).
- `npm run build` passed.
- `npx playwright test` passed: 6/6.

---

Owner: Kimi
Area: Public profile page redesign + booking section
Status: done
Files changed:

- `frontend-v2/src/app/p/[slug]/page.tsx`

What changed:

- Redesigned the public profile page with a dark, futuristic hero card, ambient glows, and gradient avatar ring.
- Added a prominent action bar: Book a meeting (always visible), Download vCard, Share, Copy profile link.
- Fixed backend `getPublicBookingProfile` so the booking page can load even when no meeting types exist, showing a friendly empty state instead of "Booking page not found."
- Improved booking page error and empty states with links back to the public profile.
- Added an "About" section for the bio.
- Added a "Book a meeting" section that lists active meeting types with duration/location and links to the booking flow with the type pre-selected.
- Restyled contact links and QR card to match the glass/dark theme.

Verification:

- `npm run lint` passed (existing scheduling availability warning only).
- `npm run build` passed.
- `npx playwright test` passed: 6/6.

## Ownership Boundaries

Backend files are owned by Codex:

- PostgreSQL migrations and configuration
- Server actions
- Backend utilities
- Auth helpers
- Analytics utilities
- vCard generation utilities
- API route handlers, if used

Frontend files are owned by Kimi:

- Page layouts
- Components
- Styling
- Client-side interactions
- Empty, loading, and error UI states

Shared files require care:

- Type definitions
- Route constants
- Validation schemas
- Environment variable examples
- Package configuration

Before changing a shared file, check whether the change affects both agents.

## Git Rules

Codex is responsible for commits and pushes.

Before committing:

- Run `git status --short`.
- Review changed files.
- Do not revert user or agent changes unless explicitly asked.
- Run the relevant checks available in the repo.
- Keep commits focused and explain what changed.

Commit messages should use concise prefixes:

- `backend: ...`
- `frontend: ...`
- `schema: ...`
- `auth: ...`
- `analytics: ...`
- `docs: ...`
- `chore: ...`

Push only after the working state is coherent and the committed changes match the requested work.

If the project is not yet a Git repository, Codex must ask before initializing Git or adding a remote.

## Technical Direction

Default stack:

- Next.js
- TypeScript
- Tailwind
- Shadcn UI
- Docker
- PostgreSQL
- Redis
- Traefik
- Hetzner VPS
- Cloudflare

Backend choices should be simple, explicit, and V1-safe. Prefer clear tables, strict backend authorization checks, small API handlers, and predictable validation over broad abstractions.

Frontend choices should be mobile first, clean, minimal, and SaaS-oriented. Avoid building CRM-like workflows, event features, payment flows, or AI features in V1.

## Definition Of Done

A task is done when:

- It matches the V1 requirements.
- It respects role ownership.
- It does not introduce out-of-scope product surface.
- Shared contracts are documented or obvious in code.
- Relevant checks have been run, or skipped with a clear reason.
- Codex has reviewed the Git diff.
- Codex has committed and pushed when Git is configured.
