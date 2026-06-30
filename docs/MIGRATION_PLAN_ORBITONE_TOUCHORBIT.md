# Migration Plan: OrbitOne & TouchOrbit into cloudit-platform

> Status: **IN PROGRESS** — Phase 1 and Phase 2 complete; Phase 3 not started.  
> Branch: `migration/orbitone-touchorbit` (to be created).  
> Approved by: product owner.

---

## 1. Goals

- Move the existing **OrbitOne** local project and **TouchOrbit** Vercel/Supabase project into the `cloudit-platform` monorepo.
- Deploy both products from the monorepo CI/CD pipeline.
- Integrate with the platform module-gating system (`PLATFORM_API_URL/modules/internal/:orgId`).
- Keep the migration safe: work on a feature branch, verify builds locally, then merge to `master`.

---

## 2. Decisions

| Area | Decision | Rationale |
|---|---|---|
| OrbitOne backend | Migrate Express backend to **NestJS** | Aligns with monorepo; enables native `@RequireModule()` gating; no live users yet, so now is the safest time. |
| OrbitOne frontend | Migrate `frontend-v2` (Vite + React Router) to **Next.js App Router** | Aligns with `apps/orbitone-web`; keeps the same UI components, only routing/framework changes. |
| TouchOrbit frontends | 3 separate deployments | Admin, Employee, and Kiosk need different domains and auth contexts. |
| TouchOrbit URLs | Short subdomains on `cloudit.lk` | `to-admin.cloudit.lk`, `to-employee.cloudit.lk`, `to-kiosk.cloudit.lk` |
| TouchOrbit backend/data | Two-phase approach | Phase 1: keep Supabase. Phase 2: migrate schema/data to platform Postgres and port admin API routes to `apps/touchorbit-api`. |

---

## 3. Final URL Map

| Product | Service | URL |
|---|---|---|
| Platform | Platform API | `https://api-platform.cloudit.lk` |
| Platform | Platform Web | `https://app.cloudit.lk` |
| OrbitOne | Web | `https://orbitone.cloudit.lk` |
| OrbitOne | API | `https://api-orbitone.cloudit.lk` |
| TouchOrbit | Admin Web | `https://to-admin.cloudit.lk` |
| TouchOrbit | Employee Web | `https://to-employee.cloudit.lk` |
| TouchOrbit | Kiosk Web | `https://to-kiosk.cloudit.lk` |
| TouchOrbit | API (later) | `https://api-touchorbit.cloudit.lk` |

---

## 4. Branch Strategy

1. Create `migration/orbitone-touchorbit` from current `master`.
2. Do all work on that branch.
3. Push the branch to GitHub regularly for backup, but **do not merge** until all phases build successfully.
4. Final merge to `master` triggers CI deployment.

---

## 5. Phases

### Phase 1 — OrbitOne backend to NestJS ✅ COMPLETE

**Target:** `apps/orbitone-api`

**Decision:** Pragmatic raw-SQL port. The existing `pg` pool, 17 raw-SQL migrations, and custom migration runner were kept and wrapped in NestJS services. Prisma remains in place only for the existing `event_logs`/`health` wiring; a full schema migration to Prisma is deferred.

1. ✅ Replaced placeholder NestJS code with real OrbitOne backend logic.
2. ✅ Mapped Express domains to NestJS modules:
   - `backend/src/domain/accounts` → `src/accounts/`
   - `backend/src/domain/analytics` → `src/analytics/`
   - `backend/src/domain/auth` → `src/auth/`
   - `backend/src/domain/billing` → `src/billing/`
   - `backend/src/domain/crm` → `src/crm/` (with submodules)
   - `backend/src/domain/customers` → `src/customers/`
   - `backend/src/domain/dashboard` → `src/dashboard/`
   - `backend/src/domain/documents` → `src/documents/`
   - `backend/src/domain/feedback` → `src/feedback/`
   - `backend/src/domain/organizations` → `src/organizations/`
   - `backend/src/domain/profiles` → `src/profiles/`
   - `backend/src/domain/public` → `src/public-booking/`
   - `backend/src/domain/ratings` → `src/ratings/`
   - `backend/src/domain/scheduling` → `src/scheduling/`
3. ✅ Converted Express routers to NestJS controllers under `/api/v2/*`.
4. ✅ Converted services to NestJS injectable services using `DatabaseService`, `RedisService`, `SlugService`, etc.
5. ✅ Added `@RequireModule('orbitone', '<module-key>')` decorators to gated controllers.
6. ✅ Reused `ProductModulesService` / `ModuleGuard` already in the monorepo.
7. ✅ Kept raw SQL migrations; copied migration runner and wired it into `Dockerfile` and `predeploy`.
8. ✅ Updated `Dockerfile`; `infra/orbitone-api/docker-compose.yml` was already aligned.
9. ✅ `npm run build --workspace=@cloudit/orbitone-api` passes.
10. ✅ `npm run test --workspace=@cloudit/orbitone-api` passes.
11. ✅ `npm run lint --workspace=@cloudit/orbitone-api` passes.

**Module keys for OrbitOne (current):**
- `crm` — customers + CRM submodules
- `scheduling`
- `analytics`
- `ratings`
- `business_accounts`

**Known TODOs / follow-up:**
- Dashboard CRM summary currently returns `null` until a cross-domain call to `CustomersService` is wired.
- Customer-scoped document/feedback sub-routes were omitted; they exist under top-level `/v2/documents` and `/v2/feedback`.
- Placeholder `cards` and `templates` modules were removed; these were v1-only domains.

---

### Phase 2 — OrbitOne frontend to Next.js ✅ COMPLETE

**Target:** `apps/orbitone-web`

**Decision:** Compatibility-first port. Kept React 18 and Tailwind v3 to match `@cloudit/ui` and the monorepo; ported the old `frontend-v2` source and adapted only routing, providers, and the API client.

1. ✅ Replaced placeholder Next.js app with `frontend-v2` code.
2. ✅ Converted Vite + React Router routes into Next.js App Router:
   - `src/routes.tsx` → `app/` directory structure.
   - 25 routes generated (static + dynamic).
3. ✅ Moved global providers into a client `app/providers.tsx`:
   - `QueryClientProvider`
   - `AuthProvider`
   - `ThemeProvider`
4. ✅ Replaced `VITE_API_BASE_URL` with `NEXT_PUBLIC_API_BASE_URL`.
5. ✅ Updated `next.config.js` for standalone output.
6. ✅ Existing `infra/orbitone-web/Dockerfile` already builds standalone output; verified it still works.
7. ✅ `infra/orbitone-web/docker-compose.yml` already uses `orbitone.${DOMAIN:-cloudit.lk}`.
8. ✅ `npm run build --workspace=@cloudit/orbitone-web` passes with no ESLint warnings.
9. ✅ `npm run lint --workspace=@cloudit/orbitone-web` passes.

**Important note:** The UI design stays the same. Next.js only changes how pages are rendered/routed. Old `src/components/ui/*` primitives were kept; migration to `@cloudit/ui` is deferred.

---

### Phase 3 — TouchOrbit frontends (3 deployments)

**Targets:**
- `apps/touchorbit-admin-web`
- `apps/touchorbit-employee-web`
- kiosk as a route inside employee web (`/kiosk`)

1. Create `apps/touchorbit-admin-web` from `touchorbit-old/apps/admin`.
2. Create `apps/touchorbit-employee-web` from `touchorbit-old/apps/employee`.
3. Merge shared UI package `touchorbit-old/packages/ui` into `packages/ui` **or** keep as `packages/touchorbit-ui` if conflicts exist.
4. Update package names from `@touchorbit/admin`, `@touchorbit/employee`, `@touchorbit/ui` to monorepo names (`@cloudit/touchorbit-admin-web`, etc.).
5. Update `next.config.js` in each app for standalone output and `transpilePackages`.
6. Update root `package.json` workspaces if needed.
7. Create/duplicate Docker Compose files:
   - `infra/touchorbit-admin-web/docker-compose.yml` → `to-admin.cloudit.lk`
   - `infra/touchorbit-employee-web/docker-compose.yml` → `to-employee.cloudit.lk` and `to-kiosk.cloudit.lk`
8. Add the new services to `infra/scripts/deploy.sh` and `infra/scripts/health-check.sh`.
9. Build both apps and fix errors.

**At the end of Phase 3, the frontends still talk to Supabase.**

---

### Phase 4 — TouchOrbit backend/data migration

**Prerequisites:**
- Supabase project URL
- Supabase service role key
- Or a PostgreSQL dump file

**Target:** `apps/touchorbit-api`

1. Export Supabase schema:
   - Use `pg_dump` or Supabase CLI.
   - Capture tables, views, functions, triggers, policies, RPCs.
2. Convert the SQL schema to Prisma schema in `apps/touchorbit-api/prisma/schema.prisma`.
3. Create an initial Prisma migration.
4. Migrate Supabase data into platform Postgres.
5. Port admin app API routes (`apps/admin/app/api/*`) into `apps/touchorbit-api` NestJS controllers.
6. Port Supabase Edge Functions (`supabase/functions/*`) into scheduled jobs or API endpoints.
7. Update frontends to call `https://api-touchorbit.cloudit.lk` instead of Supabase.
8. Add module-gating decorators for TouchOrbit modules:
   - `employees`
   - `attendance`
   - `payroll`
9. Build and test.

---

### Phase 5 — Final integration and merge

1. Ensure all apps build:
   ```bash
   npm run build --workspace=@cloudit/ui
   npm run build --workspace=@cloudit/orbitone-api
   npm run build --workspace=@cloudit/orbitone-web
   npm run build --workspace=@cloudit/touchorbit-admin-web
   npm run build --workspace=@cloudit/touchorbit-employee-web
   npm run build --workspace=@cloudit/touchorbit-api
   ```
2. Update DNS records in Cloudflare for the new subdomains.
3. Update Traefik/Cloudflare env if needed.
4. Push branch and open a pull request (or merge directly after review).
5. Merge to `master` → CI deploys.
6. Run health checks:
   ```bash
   curl https://api-orbitone.cloudit.lk/api/health
   curl https://to-admin.cloudit.lk/api/health
   curl https://to-employee.cloudit.lk/api/health
   curl https://to-kiosk.cloudit.lk/api/health
   ```

---

## 6. Files & Folders Expected to Change

- `apps/orbitone-api/` — full replacement
- `apps/orbitone-web/` — full replacement
- `apps/touchorbit-admin-web/` — new
- `apps/touchorbit-admin-web/` — new
- `apps/touchorbit-employee-web/` — new
- `apps/touchorbit-api/` — updated in Phase 4
- `packages/ui/` — merged with TouchOrbit shared UI
- `infra/orbitone-api/docker-compose.yml`
- `infra/orbitone-web/docker-compose.yml`
- `infra/touchorbit-admin-web/docker-compose.yml` — new
- `infra/touchorbit-employee-web/docker-compose.yml` — new
- `infra/touchorbit-api/docker-compose.yml` — updated in Phase 4
- `infra/scripts/deploy.sh`
- `infra/scripts/health-check.sh`
- `package.json` workspaces
- `docs/MIGRATION_PLAN_ORBITONE_TOUCHORBIT.md` (this file) — updated as work progresses

---

## 7. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| OrbitOne Express-to-NestJS rewrite breaks routes | Migrate domain by domain; keep Express middleware patterns where possible; test each module. |
| Vite-to-Next.js routing mismatch | Map `src/routes.tsx` 1-to-1 to `app/` pages; verify all client-side state uses `'use client'`. |
| TouchOrbit admin API routes rely on Supabase RLS | Phase 4 must carefully replicate RLS as service-layer checks in `apps/touchorbit-api`. |
| Supabase migration loses data | Take a full dump before migration; validate row counts and key queries after import. |
| Long build times / dependency conflicts | Build apps one at a time; resolve peer dependency mismatches incrementally. |
| DNS/SSL issues | Verify Cloudflare tokens and A records before merge; use `curl` health checks after deploy. |

---

## 8. Open Items

- [x] Confirm exact list of OrbitOne module keys to gate.
- [ ] Confirm exact list of TouchOrbit module keys to gate.
- [ ] Obtain Supabase URL + service role key before Phase 4.
- [ ] Decide whether to keep TouchOrbit shared UI as separate package or merge into `packages/ui`.
- [x] Decide whether OrbitOne migrations stay raw SQL or move to Prisma. → Kept raw SQL for Phase 1; defer Prisma migration.

---

## 9. How to Start

When you are ready, say:

> **“Start Phase 1”**

I will then:
1. Create branch `migration/orbitone-touchorbit`.
2. Begin converting the OrbitOne Express backend into NestJS.

Do **not** modify the `_incoming` folders until the migration is complete, so we can re-copy if anything goes wrong.
