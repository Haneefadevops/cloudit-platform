# TouchOrbit Supabase Removal Plan

## Goal

Move TouchOrbit completely off Supabase and onto the local Docker/Postgres architecture.

The TouchOrbit API and deployment database are already local Postgres based, but the admin and employee web apps still contain Supabase client code. The deployment failure after production hardening exposed this migration gap.

## Current Issue

The deployment failed at `touchorbit-admin-web` because the Docker compose file required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Those variables should not be required if TouchOrbit is fully local DB.

This is not a reason to reintroduce Supabase. It means the remaining Supabase code paths need to be removed or replaced.

## Phase 1: Immediate Deployment Hotfix

### 1. Remove Supabase-required deploy checks

Files:

- `infra/touchorbit-admin-web/docker-compose.yml`
- `infra/touchorbit-employee-web/docker-compose.yml`
- `infra/touchorbit-admin-web/Dockerfile`
- `infra/touchorbit-employee-web/Dockerfile`
- `apps/touchorbit-admin-web/.env.example`
- `apps/touchorbit-employee-web/.env.example`

Fix:

- Remove required Supabase build args from compose.
- Remove Dockerfile validation that fails when Supabase vars are absent.
- Do not restore placeholder defaults such as `https://placeholder.supabase.co`.
- Keep `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_API_URL` as the frontend build/runtime configuration.

Acceptance:

- Deployment no longer fails because Supabase env vars are missing.
- No placeholder Supabase values are baked into images.
- `touchorbit-admin-web` and `touchorbit-employee-web` still build.

## Phase 2: Supabase Usage Audit

### 2. Inventory all Supabase references

Search targets:

- `@supabase/ssr`
- `@supabase/supabase-js`
- `supabase.`
- `supabaseAdmin`
- `createBrowserClient`
- `createServerClient`
- `SUPABASE_`
- `NEXT_PUBLIC_SUPABASE_`

Expected areas:

- `apps/touchorbit-admin-web/src/lib/supabase.ts`
- `apps/touchorbit-admin-web/src/lib/supabase-admin.ts`
- `apps/touchorbit-admin-web/src/app/api/**`
- `apps/touchorbit-admin-web/src/app/**/page.tsx`
- `apps/touchorbit-admin-web/src/components/**`
- `apps/touchorbit-employee-web/src/lib/supabase.ts`
- `apps/touchorbit-employee-web/src/app/**`
- `apps/touchorbit-employee-web/src/components/**`

Acceptance:

- Produce a checklist of every remaining Supabase import/call site.
- Classify each item as:
  - browser data read/write
  - admin server action
  - auth/session flow
  - file/storage flow
  - realtime/notification flow
  - dead/legacy code

## Phase 3: Replacement Strategy

### 3. Replace browser Supabase calls

Target pattern:

- Browser pages/components should not call Supabase directly.

Replacement:

- Use existing TouchOrbit API endpoints where available.
- Add Next API proxy routes only when needed for same-origin browser ergonomics.
- Add missing NestJS API endpoints when the domain action belongs in the backend.

Acceptance:

- No browser code imports `@/lib/supabase`.
- Data access goes through the local TouchOrbit API/session model.

### 4. Replace admin Supabase service-role flows

Known example:

- `apps/touchorbit-admin-web/src/app/api/reset-user-password/route.ts`

Current problem:

- Uses `supabaseAdmin.auth.admin.updateUserById`.

Replacement:

- Add or use a TouchOrbit API endpoint backed by local Postgres and bcrypt.
- Verify the requester has the required local permission.
- Update the local `users.password_hash` and any force-reset metadata in local DB.

Acceptance:

- No code requires `SUPABASE_SERVICE_ROLE_KEY`.
- Admin password/user access flows work against local DB.

### 5. Replace RPC-style Supabase calls

Current pattern:

- `supabase.rpc(...)`

Replacement options:

- Prefer existing NestJS service methods.
- Move SQL function calls behind TouchOrbit API endpoints.
- Keep database functions if useful, but invoke them server-side from the API.

Acceptance:

- No frontend invokes database RPCs directly.
- Authorization remains enforced through backend guards and module permissions.

### 6. Replace table-style Supabase calls

Current pattern:

- `supabase.from("table").select/insert/update/delete`

Replacement:

- Use local API endpoints for CRUD operations.
- If an endpoint does not exist, add it in the matching NestJS module.

Acceptance:

- No frontend directly names local DB tables.
- Multi-tenant filtering remains enforced server-side by organization/session context.

## Phase 4: Dependency and Env Cleanup

### 7. Remove Supabase packages

Once all imports are gone, remove from:

- `apps/touchorbit-admin-web/package.json`
- `apps/touchorbit-employee-web/package.json`

Packages:

- `@supabase/ssr`
- `@supabase/supabase-js`

Then update:

- `package-lock.json`

Acceptance:

- `rg "@supabase|supabase" apps/touchorbit-admin-web apps/touchorbit-employee-web` finds no active code references.
- Admin and employee builds pass.

### 8. Remove Supabase env docs

Remove any required TouchOrbit Supabase entries from:

- app `.env.example` files
- deployment docs
- production-readiness docs
- Docker compose files
- Dockerfiles

Acceptance:

- TouchOrbit deployment only requires local DB/API/session/storage env vars.

## Phase 5: Verification

### 9. Local verification

Run:

- `npm.cmd run build --workspace=@cloudit/touchorbit-api`
- `npm.cmd run lint --workspace=@cloudit/touchorbit-api`
- `npm.cmd test --workspace=@cloudit/touchorbit-api`
- `npm.cmd run build --workspace=@cloudit/touchorbit-admin-web`
- `npm.cmd run build --workspace=@cloudit/touchorbit-employee-web`

Acceptance:

- All commands pass without Supabase env vars.

### 10. Deployment verification

Run a staging deploy with no Supabase variables configured.

Acceptance:

- Docker image builds pass.
- Services start.
- Login/session works.
- Admin dashboard loads.
- Employee portal loads.
- Password reset/user access management works through local DB.
- Attendance, leave, roster, payroll, reports, notifications, and documents smoke tests pass.

## Suggested Execution Order

### Hotfix Commit

1. Remove Supabase-required deploy checks.
2. Remove Supabase vars added to `.env.example`.
3. Update production-readiness docs to say Supabase removal is required.
4. Build admin/employee apps.
5. Push hotfix.

### Migration Cleanup Sprint

1. Inventory Supabase usage.
2. Replace admin service-role flows first.
3. Replace browser table/RPC calls module by module.
4. Remove Supabase packages.
5. Run full staging smoke tests.

## Go-Live Gate

TouchOrbit should be considered fully local-DB ready only when:

- No production deploy step requires Supabase env vars.
- No active admin/employee code imports Supabase clients.
- No browser code reads/writes DB tables directly.
- User management and password reset work through local DB.
- All builds pass without Supabase configuration.
- Staging smoke tests pass using only local Postgres-backed services.
