# TouchOrbit Production Readiness Fix Plan

## Current Verdict

TouchOrbit is not ready for production go-live yet. The API and some frontend builds pass, but there are hard blockers around the employee app build, API lint, production environment safety, public API documentation exposure, and limited automated coverage.

## Phase 1: Hard Build Blockers

### 1. Fix `touchorbit-employee-web` font build

Problem:
- `apps/touchorbit-employee-web/src/app/layout.tsx` uses `next/font/google`.
- Production build can fail when deploy or CI cannot fetch Google Fonts.

Fix:
- Replace `next/font/google` with a local/self-hosted font, or use a system font fallback.
- Do not require external network access during `next build`.

Acceptance:
- `npm.cmd run build --workspace=@cloudit/touchorbit-employee-web` passes without internet access.

### 2. Fix API lint errors

Problem:
- `npm.cmd run lint --workspace=@cloudit/touchorbit-api` currently fails.
- Errors include unnecessary `async` methods and unsafe `any` usage.

Fix:
- Remove unnecessary `async` from methods with no `await`.
- Type unsafe values in calendar/auth/service code.
- Keep changes scoped to lint failures.

Acceptance:
- `npm.cmd run lint --workspace=@cloudit/touchorbit-api` exits cleanly.
- `npm.cmd run build --workspace=@cloudit/touchorbit-api` still passes.
- `npm.cmd test --workspace=@cloudit/touchorbit-api` still passes.

## Phase 2: Production Config Safety

### 3. Remove placeholder production defaults

Problem:
- Admin and employee web code still contains legacy Supabase paths, even though TouchOrbit is moving to local Docker/Postgres.
- Placeholder Supabase values can be baked into production images and cause runtime failures.
- Requiring Supabase env vars blocks the intended local-DB deployment.

Fix:
- Remove defaults such as `https://placeholder.supabase.co`, `placeholder-anon-key`, and `placeholder-service-role-key`.
- Do not require Supabase env vars for production TouchOrbit builds.
- Track the remaining Supabase code paths in `docs/TOUCHORBIT_SUPABASE_REMOVAL_PLAN.md`.
- Add explicit validation for required build-time and runtime variables.

Required variables to validate:
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_APP_URL`
- `JWT_SECRET`
- `DATABASE_URL`
- `REDIS_URL` or `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD`
- `INTERNAL_API_TOKEN`

Acceptance:
- Missing production env fails fast with a clear message.
- No production compose or Dockerfile default uses placeholder Supabase values.
- Production deploy does not require Supabase env vars.

### 4. Add production env checklist

Fix:
- Extend `docs/environment-setup.md` or create a dedicated TouchOrbit env checklist.
- Separate build-time variables from runtime variables.
- Include API, public web, admin web, and employee web.

Acceptance:
- A deploy operator can verify all required values before building images.

## Phase 3: Security Hardening

### 5. Protect Swagger docs

Problem:
- `SwaggerModule.setup("api/docs", app, document)` is enabled unconditionally.
- `/api/docs` is skipped by throttling.

Fix:
- Disable Swagger in production unless `ENABLE_SWAGGER=true`, or protect it behind admin/internal auth.
- Do not skip throttling for `/api/docs` in production.

Acceptance:
- `/api/docs` is not publicly accessible in production by default.

### 6. Review public endpoints

Fix:
- Confirm every `@Public()` API route is intentional.
- Expected public routes should be limited to health checks, login/register/set-password, and internal routes protected by internal token or cron secret.
- Confirm task reminder cron secret is required and strong in production.

Acceptance:
- Public route list is documented and approved.

## Phase 4: Staging Validation

### 7. Build all deployable artifacts

Run:
- `npm.cmd run build --workspace=@cloudit/touchorbit-api`
- `npm.cmd run build --workspace=@cloudit/touchorbit-web`
- `npm.cmd run build --workspace=@cloudit/touchorbit-admin-web`
- `npm.cmd run build --workspace=@cloudit/touchorbit-employee-web`

Acceptance:
- All app builds pass from a clean checkout.
- All Docker images build with production env supplied.

### 8. Run migrations against staging

Fix:
- Apply `apps/touchorbit-api/migrations` to a staging database.
- Verify migration ordering and idempotency.
- Confirm a fresh database can be migrated cleanly.

Acceptance:
- Staging database is fully migrated with no manual patching.

### 9. Run staging smoke tests

Minimum workflows:
- Admin login
- Employee login
- Employee clock in/out
- Leave request and approval
- Roster page load and basic action
- Payroll page load and basic action
- Password reset
- Reports page load
- Notifications read/mark-read

Acceptance:
- No critical workflow fails in staging.

## Phase 5: Minimum Launch Test Coverage

### 10. Add launch smoke tests

Add or stabilize:
- API auth/session smoke test.
- API employee/attendance smoke test.
- API leave approval smoke test.
- Admin portal page-load E2E suite.
- Employee clock-in happy path E2E test.

Acceptance:
- Launch smoke tests run in CI before deploy.
- Failures block production deploy.

## Suggested Execution Timeline

### Day 1

- Fix employee app font build.
- Fix API lint.
- Protect Swagger.
- Remove placeholder env defaults, keep local-DB env validation, and stop requiring Supabase env.

### Day 2

- Build all apps and Docker images.
- Deploy to staging.
- Run migrations.
- Run staging smoke tests.
- Fix launch-critical issues found during staging.

## Go-Live Gate

TouchOrbit can be considered launch-candidate only when:

- All app builds pass.
- API lint and tests pass.
- Docker images build with real production-like env.
- Staging deploy boots cleanly.
- Database migrations run cleanly.
- Staging smoke tests pass.
- `/api/docs` is not publicly exposed by default.
- Placeholder Supabase values cannot reach production images.
- Supabase env vars are not required for TouchOrbit production deploys.
