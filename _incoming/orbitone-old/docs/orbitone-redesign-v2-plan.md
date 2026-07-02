# OrbitOne Redesign Plan v2 — Digital Card → Meeting → CRM

## 1. Executive Summary & Decisions Made

This plan restructures the existing OrbitOne codebase around one clear product loop: **digital business card → booked meeting → lightweight CRM**. The current system is functionally rich but architecturally confusing because it mixes too many concepts. We will simplify it.

### Decisions made by the senior-dev lead

| Decision | Choice | Why |
|---|---|---|
| **Frontend stack** | React + Vite SPA + React Router | Next.js is already React, but the App Router/SSR model adds mental overhead. A Vite SPA gives the user a clearer “React” mental model and a clean separation from the API. |
| **Backend stack** | Keep Express + PostgreSQL + Redis | Already works. We restructure, not rewrite. |
| **Scope** | Drop Events and heavy Networking discovery | These distract from the core loop. Keep only “save contact / my network” as a free feature. |
| **Restructure vs rebuild** | Restructure in place | Rebuild would discard working code. We keep the repo but reorganize schema, routes, and frontend architecture. |
| **First live milestone** | Freelancer profiles + QR + save contact | This is the free foundation every other feature depends on. |
| **Freemium model** | Free calendar up to a weekly booking limit; CRM paid | Clear, easy-to-understand upgrade path. |
| **Pricing currency** | Sri Lankan Rupees (LKR) | Local market. Keep prices low enough for SMBs and freelancers. |

---

## 2. Product Vision: One Loop, Two Worlds

### The loop

```
Professional creates profile  →  shares QR / link  →  lead scans/saves  →  books meeting  →  CRM record is born  →  follow-up/rating
```

### Two product worlds

1. **Free world — “Be found and booked”**
   - Personal/staff profile.
   - QR code, vCard, share link.
   - Save contact / basic network.
   - Calendar booking with a weekly free limit.

2. **Paid world — “Turn meetings into customers”**
   - Business admin panel + staff management.
   - Unlimited (or higher-limit) booking.
   - Customer records, lifecycle, tags, notes, follow-ups.
   - Customer rating/reviews after meetings.
   - Admin analytics.

---

## 3. Personas

| Persona | Role | Pays? |
|---|---|---|
| **Freelancer** | Signs up individually, creates own profile, sets own availability. | Free up to booking limit; Pro Individual for more. |
| **Business Admin** | Creates an organization, adds staff, manages CRM, sees analytics. | Pro Business subscription. |
| **Staff Member** | Gets a profile created by the admin; uses booking and CRM. | Paid through the organization. |
| **Customer / Lead** | Scans QR, saves contact, books meeting, rates support. | Free, no account required. |

---

## 4. Freemium Model & Sri Lankan Pricing

### Feature matrix

| Feature | Free | Pro Individual | Pro Business |
|---|---|---|---|
| Profile + QR + vCard | ✅ | ✅ | ✅ |
| Save contact / basic network | ✅ | ✅ | ✅ |
| Calendar booking | ✅ up to 3 bookings/week | ✅ unlimited | ✅ unlimited |
| Custom slug / branding | ❌ | ✅ | ✅ |
| Analytics | ❌ | ✅ basic | ✅ full admin dashboard |
| Staff profiles | ❌ | ❌ | ✅ |
| Customer CRM | ❌ | ❌ | ✅ |
| Customer ratings | ❌ | ❌ | ✅ |
| Priority support | ❌ | ❌ | ✅ |

### Pricing recommendation (Sri Lanka)

| Plan | Monthly (LKR) | Yearly (LKR) | Notes |
|---|---|---|---|
| **Free** | LKR 0 | LKR 0 | Forever. 3 bookings/week. |
| **Pro Individual** | LKR 1,990 | LKR 19,900 (~2 months free) | Freelancers/solopreneurs. Unlimited bookings + basic analytics. |
| **Pro Business — Starter** | LKR 5,990 | LKR 59,900 | Up to 5 staff. CRM + ratings + admin dashboard. |
| **Pro Business — Growth** | LKR 11,990 | LKR 119,900 | Up to 20 staff. |
| **Pro Business — Enterprise** | Custom | Custom | 20+ staff, onboarding, integrations. |

### Why these prices

- Pro Individual at ~LKR 2,000/month is less than a mobile bill — low enough for freelancers to try.
- Pro Business Starter at ~LKR 6,000/month is accessible to small Sri Lankan businesses (cafes, clinics, agencies).
- Growth tier scales without being expensive compared to international CRM tools that charge USD.
- Offer yearly billing with 2 months free to improve cash flow.

### Payment methods for Sri Lanka

1. **PayHere** — local payment gateway, essential for LKR cards.
2. **Bank transfer / deposit** — manual activation for annual Business plans.
3. **Stripe** — optional, only if you plan to serve diaspora/international users.

---

## 5. Technical Architecture

### Frontend

- **Framework:** React 19 + Vite 6 + TypeScript 5
- **Routing:** React Router 7
- **Styling:** Tailwind CSS 4
- **Data fetching:** TanStack Query (React Query) v5
- **Forms:** React Hook Form + Zod
- **State:** React Context for auth/theme/i18n; TanStack Query for server state
- **Icons:** lucide-react
- **QR:** react-qr-code
- **Date/time:** date-fns + date-fns-tz
- **Build output:** static SPA (`dist/`) served by backend or uploaded to CDN

### Backend

- **Framework:** Express 4 + TypeScript 5
- **Database:** PostgreSQL 17
- **Cache/queue:** Redis (sessions, rate limits, background jobs later)
- **Auth:** JWT in httpOnly cookie (keep existing)
- **Validation:** Zod
- **Migrations:** raw SQL files in `backend/migrations/`
- **Structure:** domain-based folders (see below)

### Infrastructure

- **Local:** Docker Compose with frontend dev server, backend, Postgres, Redis.
- **Production:** Docker Compose or VPS with Traefik reverse proxy.
- **Frontend deploy:** build SPA → serve from backend `/` or static host.

---

## 6. New Database Schema

We add migrations (do not rewrite old ones). The new schema introduces organizations, customers, plan tracking, and simplifies the CRM model.

### New tables

```sql
-- Organizations = businesses
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  logo_url TEXT,
  industry TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro_individual','pro_business_starter','pro_business_growth','pro_business_enterprise')),
  plan_status TEXT NOT NULL DEFAULT 'active' CHECK (plan_status IN ('active','trialing','past_due','cancelled')),
  trial_ends_at TIMESTAMPTZ,
  subscription_renewal_at TIMESTAMPTZ,
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add role + org to users
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'freelancer' CHECK (role IN ('freelancer','admin','staff'));
ALTER TABLE users ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN is_billing_contact BOOLEAN NOT NULL DEFAULT false;

-- Profiles: now belong to a user; for staff users the org is via user.organization_id
ALTER TABLE profiles ADD COLUMN type TEXT NOT NULL DEFAULT 'personal' CHECK (type IN ('personal','staff'));
ALTER TABLE profiles ADD COLUMN department TEXT;
ALTER TABLE profiles ADD COLUMN job_title TEXT;
-- keep existing slug/contact/is_published fields

-- Customers = people who interact with a profile but are not users
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  owned_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- staff/freelancer who owns this customer
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  notes TEXT,
  lifecycle_stage TEXT NOT NULL DEFAULT 'new' CHECK (lifecycle_stage IN ('new','contacted','qualified','meeting','proposal','customer','lost','archived')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  next_step TEXT,
  last_contacted_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('scan','booking','manual','import')),
  source_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Customer tags (reuse existing tags table concept, scoped to org)
ALTER TABLE tags ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Customer notes / activities (merge connection_notes + connection_activities)
CREATE TABLE customer_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('note','call','email','meeting','sms','whatsapp','other')),
  title TEXT NOT NULL,
  body TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Customer follow-ups
CREATE TABLE customer_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Customer ratings after meetings
CREATE TABLE customer_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Usage tracking (simple counters for weekly booking limits)
CREATE TABLE usage_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  week INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(profile_id, year, week)
);

-- Org invites (admin adds staff by email)
CREATE TABLE organization_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('staff','admin')),
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, email)
);
```

### Tables to keep (mostly unchanged)

- `users`
- `profiles`
- `calendar_accounts`
- `meeting_types`
- `availability_rules`
- `availability_exceptions`
- `bookings`
- `booking_guests`
- `booking_guest_tokens`
- `booking_audit_events`
- `analytics_events`

### Tables to deprecate / hide

- `events`, `event_check_ins` — drop from UI; keep data or archive.
- `connections` — replace with `customers` for CRM and a lightweight `saved_contacts` view for free networking.
- `connection_notes`, `connection_activities`, `follow_ups` — migrate into `customer_activities` / `customer_follow_ups` if data exists, otherwise leave unused.

---

## 7. Backend Restructure Plan

### Folder structure

```
backend/src/
  config/
    env.ts
  db/
    postgres.ts
    redis.ts
  middleware/
    auth.ts          # requireUser, requireAdmin, requireOrgMember
    error.ts         # global error handler
    plan.ts          # check plan/usage limits
  domain/
    auth/
      routes.ts
      service.ts
      schemas.ts
    profiles/
      routes.ts
      service.ts
      schemas.ts
    public/
      routes.ts      # public profile, booking, vCard
      service.ts
    customers/
      routes.ts
      service.ts
      schemas.ts
    scheduling/
      routes.ts
      service.ts
      schemas.ts
      slots.ts
    crm/
      routes.ts
      service.ts
      schemas.ts
    organizations/
      routes.ts
      service.ts
      schemas.ts
    analytics/
      routes.ts
      service.ts
  lib/
    auth.ts          # JWT helpers
    calendar.ts      # external calendar helpers (placeholder)
    validation.ts    # Zod helpers
  server.ts          # compose routers
```

### Key backend changes

1. **Split `v1.ts` into domain routers.** Each domain owns its routes, service, and schemas.
2. **Add `organizations` domain** for admin panel, staff invites, plan checks.
3. **Replace connections-based CRM with customers-based CRM.**
4. **Add usage middleware** to enforce weekly booking limits on free plans.
5. **Centralize authorization** into middleware (`requireUser`, `requireAdmin`, `requireOrgMember`).
6. **Consolidate shared types** into a single `contracts/orbitone.ts` and have backend import from it. Remove duplicate `backend/src/types/contracts.ts`.
7. **Simplify public booking** so every booking creates/updates a `customer` record when the host is on a paid plan; free-plan hosts just get the booking email.
8. **Add rating endpoint** customer can submit after a completed meeting.

---

## 8. Frontend Migration Plan

### From Next.js App Router → Vite + React Router SPA

1. **Create new `frontend-v2/` directory** (or rename current `frontend/` after freeze).
2. **Port reusable pieces:**
   - UI primitives in `components/ui/`
   - Brand tokens / Tailwind config
   - `PublicShell`, empty states, loading skeletons
   - Auth context logic
3. **Replace data fetching:**
   - Remove `useEffect + fetch` patterns.
   - Introduce TanStack Query with a central API client.
   - Add query keys per domain.
4. **Replace routing:**
   - Map App Router routes to React Router routes.
   - Layout routes for public, dashboard, and public booking.
5. **Replace Next.js-specific APIs:**
   - `next/image` → plain `<img>` or a small image component.
   - `next/font` → Google Fonts CDN or local fonts.
   - `next/head` → `react-helmet-async`.
6. **Restructure pages by persona:**
   - `/` landing
   - `/login`, `/register`
   - `/p/:slug` public profile (replace `/u/:slug`)
   - `/book/:slug` public booking
   - `/dashboard` home
   - `/dashboard/profile`
   - `/dashboard/customers/*`
   - `/dashboard/bookings`
   - `/dashboard/availability`
   - `/dashboard/organization/*` (admin only)
   - `/dashboard/settings`

### New frontend architecture

```
frontend/src/
  main.tsx
  App.tsx
  routes.tsx
  components/
    ui/            # primitives
    layout/        # shells, nav, sidebar
    profile/       # profile card, form, public view
    booking/       # booking calendar + form
    customers/     # CRM list, detail, activities, follow-ups
    analytics/     # dashboard widgets
    organization/  # admin/staff management
  hooks/
    useAuth.ts
    useCurrentPlan.ts
    useBookingLimits.ts
  lib/
    api.ts         # axios/fetch wrapper
    contracts.ts   # re-export from shared contracts
    queryClient.ts
  providers/
    AuthProvider.tsx
    ThemeProvider.tsx
    I18nProvider.tsx
  routes/
    public.tsx
    dashboard.tsx
    booking.tsx
```

---

## 9. Build Phases

### Phase 0 — Foundation & Cleanup (Week 1)

- Freeze current feature development.
- Create `frontend-v2/` Vite + React + Tailwind + React Router + TanStack Query.
- Set up new backend folder structure.
- Create migration `0010_redesign_organizations.sql`.
- Write shared `contracts/orbitone.ts` v2.
- Port UI primitives and design tokens.

### Phase 1 — Free Core Identity (Weeks 2–3)

- Auth: register/login as freelancer.
- Profile creation/edit.
- Public profile page (`/p/:slug`).
- QR code + vCard + save contact.
- Basic dashboard shell.
- **Goal:** a freelancer can sign up, make a profile, share it, and someone can save their contact.

### Phase 2 — Free Calendar with Limit (Weeks 4–5)

- Availability settings.
- Meeting types.
- Public booking flow (`/book/:slug`).
- Weekly booking limit enforcement (3/week on free).
- Simple bookings list.
- **Goal:** leads can book free meetings; freelancer hits the limit and sees upgrade prompt.

### Phase 3 — Pro Individual Upgrade (Week 6)

- Upgrade flow + plan change.
- Unlimited bookings for Pro Individual.
- Basic analytics (profile views, saves, bookings).
- Custom slug priority / remove branding.
- **Goal:** freelancers can pay and unlock limits.

### Phase 4 — Business Admin + Staff (Weeks 7–8)

- Organization creation.
- Admin invites staff by email.
- Admin creates staff profiles.
- Staff login and sees their own dashboard.
- **Goal:** a business can have 5 staff with profiles and booking pages.

### Phase 5 — CRM + Ratings (Weeks 9–10)

- Customer list/detail.
- Activities, notes, follow-ups.
- Lifecycle, priority, next step.
- Customer rating prompt after meeting.
- Admin analytics dashboard.
- **Goal:** staff turn meetings into CRM records; admins see performance.

### Phase 6 — Polish & Launch (Weeks 11–12)

- PayHere integration.
- LKR pricing activation.
- Sri Lanka localization (Sinhala/Tamil).
- SMS/WhatsApp reminder placeholders.
- Security hardening, testing, deployment.

---

## 10. Migration Strategy from Current Code

### Data migration

- Existing `users` and `profiles` become freelancers on the free plan.
- Existing `connections` can be migrated to `customers` where the owner is a freelancer.
- Existing CRM data (`connection_activities`, `follow_ups`) migrates to `customer_activities` / `customer_follow_ups`.
- Events data is archived or left in old tables; no UI migration.
- Bookings and scheduling data are preserved because the new schema extends them.

### Code migration

- Keep the backend server running; introduce new domain routers under `/api/v2/`.
- Build new frontend as a separate app; switch Traefik/NGINX to serve it.
- Once v2 is stable, deprecate `/api/v1/` routes.
- Do not delete old frontend immediately; keep it until v2 launch.

### Deployment migration

- Run new migrations against existing Postgres.
- Deploy new frontend static build.
- Point domain to new frontend; backend API stays at `/api/v2/`.
- Monitor for 1 week; then remove v1 frontend.

---

## 11. Risks & Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| Frontend rewrite takes longer than expected | High | Port reusable UI first; build feature by feature; keep old frontend live until new one is ready. |
| Existing users lose data | High | Write migrations carefully; test on a copy of production data. |
| Plan/usage limit logic is bypassed | Medium | Enforce limits in backend service layer, not only frontend. |
| Calendar timezone bugs | Medium | Use `date-fns-tz`; add tests around DST. |
| PayHere integration delays | Medium | Start with manual bank-transfer activation for Business plans. |
| Scope creep (adding events/discovery back) | High | Write a short “not in v2” list and stick to it. |

---

## 12. Recommended First Step

**Create the new `frontend-v2/` shell and the `organizations` migration this week.**

This gives us:
- A clean React + Vite codebase the team can understand.
- The new business/organization data model.
- A foundation to port the profile and auth flows next.

Then we move feature by feature, always validating the “card → meeting → CRM” loop before adding the next piece.

---

## 13. “Not in v2” List (Protect Scope)

To keep the redesign focused, explicitly do **not** build:

- Public events module.
- Heavy profile discovery / social networking feed.
- Advanced networking (inbound saved-me, mutual connections).
- Deal/pipeline forecasting.
- Payments/invoicing.
- AI features.
- Mobile native app.
- Multi-language full translation (keep English primary; Sinhala/Tamil later).

These can be revisited after launch if the core loop proves traction.
