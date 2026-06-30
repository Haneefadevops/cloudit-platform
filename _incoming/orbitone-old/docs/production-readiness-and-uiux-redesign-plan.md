# OrbitOne Production Readiness + UI/UX Redesign Plan

## 1. Executive Summary

OrbitOne v2 is functionally complete but **not production-ready**. This plan splits the remaining work into two tracks:

1. **Track 1 — Production & Security Fixes** (excluding payments): backend/frontend hardening required before any real users or data.
2. **Track 2 — UI/UX Redesign**: a visual refresh to match the cleaner, purple-accented dashboard style shown in the reference screenshot.

**Recommendation: run the tracks separately.** Track 1 changes security, auth, and API behavior; Track 2 changes colors, layout, and components. Doing them separately avoids mixing critical security fixes with large visual refactors and makes review/rollback easier.

---

## 2. Track 1 — Production & Security Fixes

Goal: make the app safe, reliable, and launchable for a small private beta **without real payments**.

### 2.1 Backend

| # | Task | Files | Rationale |
|---|---|---|---|
| 1.1 | Disable `/api/v1` mutations in production | `backend/src/server.ts`, `backend/src/routes/v1.ts` | v1 bypasses v2 plan/auth rules. Keep read-only or return 410/404. |
| 1.2 | Add Redis-backed rate limiting | `backend/src/server.ts`, `backend/src/middleware/rateLimit.ts` | Protect auth, public booking, and analytics from brute-force/abuse. |
| 1.3 | Secure ratings endpoint | `backend/src/domain/ratings/routes.ts`, `service.ts` | Require valid `feedbackToken` or authenticated ownership. |
| 1.4 | Add CRM sub-resource authorization | `backend/src/domain/customers/routes.ts`, `service.ts` | Verify every activity/follow-up/customer belongs to caller/org. |
| 1.5 | Validate `assignedToUserId` | `backend/src/domain/customers/service.ts` | Prevent reassignment outside org/self. |
| 1.6 | Add production migration runner | `backend/Dockerfile`, `docker-compose.prod.yml` | Run migrations on container start, not only on first Postgres boot. |
| 1.7 | Move sessions to Redis with revocation | `backend/src/lib/auth.ts`, `domain/auth/service.ts` | Allow logout/password-change to invalidate tokens. |
| 1.8 | Harden CORS & cookies | `backend/src/config/env.ts`, `server.ts`, `lib/auth.ts` | Enforce HTTPS origin, `__Host-` prefix, `SameSite=Strict`. |
| 1.9 | Validate query params/pagination | `backend/src/domain/customers/routes.ts`, `accounts/routes.ts`, `accounts/service.ts` | Use Zod, clamp limit/offset, cap search length. |
| 1.10 | Handle slug-update conflicts | `backend/src/domain/organizations/service.ts` | Return 409 instead of raw 500. |
| 1.11 | Sanitize document download filename | `backend/src/domain/documents/routes.ts` | Prevent header injection. |
| 1.12 | Add structured logging + redaction | `backend/src/middleware/error.ts`, `server.ts` | Replace `console.error` with `pino`, redact tokens/passwords. |
| 1.13 | Configure DB/Redis TLS & pool limits | `backend/src/db/postgres.ts`, `redis.ts` | Production-grade connection security. |
| 1.14 | Fix plan-gate middleware for org plans | `backend/src/middleware/plan.ts` | Use organization plan when user belongs to org. |
| 1.15 | Close weekly booking race window | `backend/src/domain/scheduling/service.ts` | Re-check count inside locked transaction. |
| 1.16 | Cap public slot generation | `backend/src/domain/public/routes.ts`, `scheduling/service.ts` | Avoid huge payloads from long ranges. |
| 1.17 | Enforce document status transitions | `backend/src/domain/documents/service.ts` | Reject invalid workflow moves. |
| 1.18 | Escape vCard fields | `backend/src/lib/vcard.ts` | Produce valid, safe vCards. |

### 2.2 Frontend

| # | Task | Files | Rationale |
|---|---|---|---|
| 1.19 | Add CSP meta tag | `frontend-v2/index.html` | Mitigate XSS; move to response headers in production. |
| 1.20 | Enforce HTTPS API base in prod | `frontend-v2/src/lib/api.ts` | Prevent cookie leakage over HTTP. |
| 1.21 | Add global error boundary | `frontend-v2/src/main.tsx`, new `components/error-boundary.tsx` | Avoid blank-screen crashes. |
| 1.22 | Handle network errors in `apiFetch` | `frontend-v2/src/lib/api.ts` | Catch fetch failures and return graceful errors. |
| 1.23 | Fix broken booking manage links | `frontend-v2/src/app/book/[slug]/page.tsx`, `routes.tsx` | Either implement `/book/manage/*` pages or remove links. |
| 1.24 | Add server catch-all / 404 route | `frontend-v2/src/routes.tsx`, new `app/not-found/page.tsx` | Support deep-link refreshes and unknown paths. |
| 1.25 | Clear React Query cache on logout | `frontend-v2/src/providers/AuthProvider.tsx` | Prevent data leak on shared devices. |
| 1.26 | Global 401 handling + redirect | `frontend-v2/src/lib/api.ts`, `providers/AuthProvider.tsx` | Redirect to login on session expiry. |
| 1.27 | Make Dialog accessible | `frontend-v2/src/components/ui/dialog.tsx` | Focus trap, Escape, ARIA attributes. |
| 1.28 | Wire form errors to inputs | All form pages | `aria-invalid`, `aria-describedby`, `role="alert"`. |
| 1.29 | Use `API_BASE_URL` for vCard downloads | `frontend-v2/src/app/p/[slug]/page.tsx` | Works when SPA and API are on different origins. |
| 1.30 | Support optional `basename` | `frontend-v2/src/main.tsx` | Allow subpath deploys. |
| 1.31 | Add plan-gate wrapper | `frontend-v2/src/components/plan-gate.tsx` | Show upsell card for paid routes instead of blank sidebar. |
| 1.32 | Add icon-only button `aria-label`s | Multiple dashboard pages | Screen-reader support. |
| 1.33 | Lock body scroll when dialog open | `frontend-v2/src/components/ui/dialog.tsx` | Better mobile UX. |
| 1.34 | Add `<noscript>` + page titles | `frontend-v2/index.html`, all page components | Basic robustness and SEO/UX. |

---

## 3. Track 2 — UI/UX Redesign

Goal: refresh the visual design to match the reference dashboard style (light gray canvas, purple primary accent, icon-only left rail, rounded cards, modern analytics).

### 3.1 Design direction

**Keep the existing brand colors** defined in `BRAND_GUIDELINES.md`:

- Primary: `#1A2E26`
- Secondary: `#047857`
- Accent: `#D97706`
- Background: `#FFFBF7`
- Surface: `#F5F2EE`

The redesign changes **layout, shapes, and hierarchy**, not the palette:

- **Layout**: icon-only left sidebar rail, top app bar with search + notifications + avatar, main content as a dashboard grid.
- **Surface**: cleaner cards with larger radius (`rounded-2xl` / `rounded-3xl`) and softer shadows, using the existing surface/background tokens.
- **Typography**: keep Inter, increase contrast, cleaner heading hierarchy.
- **Cards**: more padding, rounded corners, subtle shadows, colored accent bars for active states using existing secondary/accent tokens.
- **Buttons**: rounded-full pills for primary actions; ghost/outline for secondary.

### 3.2 Component changes

| Component | Changes |
|---|---|
| `DashboardLayout` | Convert sidebar to icon-only rail; add top app bar with search, notifications, user dropdown. |
| `Card` / `GlassCard` | White background, larger radius, softer shadow, optional accent stripe. |
| `Button` | Rounded-full pills for primary actions; ghost/outline for secondary. |
| `Badge` | Softer backgrounds, pill shape. |
| `Input` | Larger radius, subtle focus ring in purple. |
| `Avatar` | Keep, ensure consistent sizing. |
| `Dialog` | Larger radius, overlay blur (from a11y work in Track 1). |

### 3.3 Page refreshes

| Page | Refresh notes |
|---|---|
| `/dashboard` | New dashboard overview with stat tiles, recent bookings, CRM snapshot, quick actions in a bento grid. |
| `/dashboard/customers` | Cleaner list cards, lifecycle badges, priority chips. |
| `/dashboard/customers/pipeline` | Keep horizontal scroll, polish column headers and cards. |
| `/dashboard/customers/:id` | Tabbed layout, cleaner activity timeline. |
| `/dashboard/scheduling/*` | Cleaner calendar, meeting-type cards, availability rows. |
| `/dashboard/accounts` / `directory` / `a/:slug` | Align cards and public profile to new visual language. |
| `/p/:slug` public profile | More modern hero card, action buttons, QR. |
| `/book/:slug` | Simplified date/slot picker, sticky confirm button on mobile. |
| `/login`, `/register` | Centered card on gray background, social-style inputs. |

### 3.4 Brand guidelines update

- Keep `BRAND_GUIDELINES.md` colors unchanged.
- Update component tokens and spacing to feel more modern while preserving the existing brand identity.

---

## 4. Recommended Execution Order

1. **Phase A — Track 1 (Backend security + frontend blockers)**
   - Start with backend: disable v1, rate limiting, CRM/ratings auth, migration runner.
   - Then frontend: CSP, error boundary, apiFetch fixes, 404 route, logout cache, dialog a11y.
   - Run full e2e suite after each batch.

2. **Phase B — Track 1 polish**
   - Query validation, slug conflicts, logging, DB/Redis TLS, plan middleware.

3. **Phase C — Track 2 (UI/UX redesign)**
   - Update design tokens/Tailwind config.
   - Refactor layout, cards, buttons.
   - Refresh page by page.
   - Run visual regression / manual mobile checks.

4. **Phase D — Final verification**
   - Full e2e suite, backend typecheck/build, frontend lint/build.
   - Manual mobile walkthrough.
   - Security smoke tests (401 handling, rate limiting, CRM isolation).

---

## 5. Why separate the tracks?

- **Risk isolation:** Track 1 fixes data-security and auth bugs. A mistake there is high-impact. Track 2 is visual; mistakes there are lower-impact.
- **Reviewability:** Security fixes are easier to review in a focused PR. A 50-file visual refactor mixed with auth changes is hard to review.
- **Stability:** Track 1 establishes a stable baseline. Track 2 can then restyle components without worrying about breaking security logic.
- **Deployment:** Track 1 can ship to a private beta immediately; Track 2 can ship afterward as a visual update.

---

## 6. Verification Checklist

- [ ] All `/api/v1` mutations disabled or removed.
- [ ] Rate limits active on auth and public booking.
- [ ] Ratings require token/auth.
- [ ] CRM endpoints enforce org/user scoping.
- [ ] Migrations run automatically on deploy.
- [ ] CSP present and no `unsafe-inline` for scripts (or nonce/hash implemented).
- [ ] Global error boundary catches render errors.
- [ ] Network errors handled in `apiFetch`.
- [ ] Deep links work after refresh.
- [ ] Logout clears cached data.
- [ ] Dialog is keyboard/screen-reader accessible.
- [ ] New design renders correctly on 375px, 768px, 1440px viewports.
- [ ] `npm run typecheck` and `npm run build` pass in backend.
- [ ] `npm run lint` and `npm run build` pass in frontend-v2.
- [ ] Playwright e2e suite passes.

---

## 7. Files Expected to Change

### Track 1
- `backend/src/server.ts`
- `backend/src/routes/v1.ts` (disable)
- `backend/src/middleware/*` (new rate limit, hardened auth/plan)
- `backend/src/domain/auth/*`
- `backend/src/domain/customers/*`
- `backend/src/domain/ratings/*`
- `backend/src/domain/organizations/service.ts`
- `backend/src/domain/documents/routes.ts`
- `backend/src/domain/scheduling/service.ts`
- `backend/src/domain/public/routes.ts`
- `backend/src/lib/auth.ts`, `vcard.ts`
- `backend/src/db/postgres.ts`, `redis.ts`
- `backend/Dockerfile`, `docker-compose.prod.yml`
- `frontend-v2/index.html`
- `frontend-v2/src/lib/api.ts`
- `frontend-v2/src/main.tsx`
- `frontend-v2/src/routes.tsx`
- `frontend-v2/src/providers/AuthProvider.tsx`
- `frontend-v2/src/components/ui/dialog.tsx`
- `frontend-v2/src/components/error-boundary.tsx` (new)
- `frontend-v2/src/components/plan-gate.tsx` (new)
- `frontend-v2/src/app/not-found/page.tsx` (new)
- `frontend-v2/src/app/book/manage/*` (new or remove links)
- Many form pages for a11y wiring.

### Track 2
- `BRAND_GUIDELINES.md`
- `frontend-v2/src/index.css` or Tailwind config
- `frontend-v2/src/app/dashboard/layout.tsx`
- `frontend-v2/src/components/ui/card.tsx`, `button.tsx`, `badge.tsx`, `input.tsx`
- `frontend-v2/src/app/dashboard/page.tsx`
- `frontend-v2/src/app/p/[slug]/page.tsx`
- `frontend-v2/src/app/book/[slug]/page.tsx`
- Most dashboard page components for visual alignment.

---

*Plan created: 2026-06-23*
