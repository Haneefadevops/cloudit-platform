# TouchOrbit Broken Functions Ordered Fix Plan

Last updated: 2026-07-14

## Purpose

This plan orders the fixes for all open items in `docs/testing/TOUCHORBIT_BROKEN_FUNCTIONS_REPORT.md`.

The rule for this work is simple: fix in dependency order, retest immediately after each fix group, then update the broken-functions report before moving to the next group. Do not mark any item fixed until its listed Playwright retest passes.

## Current Go-Live Position

TouchOrbit is not production-ready while the report contains open Critical or High items.

Current open count from the report:

| Severity | Open |
| --- | ---: |
| Critical | 1 |
| High | 42 |
| Medium | 7 |

## Fix Principles

1. Finish the Supabase-to-local-DB migration for every broken screen.
2. Fix shared identity/session loading before individual employee-page symptoms.
3. Fix backend/API contract mismatches before UI polish.
4. Keep E2E tests module-by-module.
5. Retest immediately after each phase and update `TOUCHORBIT_BROKEN_FUNCTIONS_REPORT.md`.
6. Do not widen scope into visual redesign unless needed to make the function work.

## Phase 1 - Authentication And Session Stability

**Goal:** Make admin and employee sessions reliable enough that all later retests are trustworthy.

**Fix items:**

- `BF-0002` Admin UI valid login lands on unauthenticated gate.
- `BF-0003` Admin logout blocked by login issue.
- `BF-0006` Employee documents route redirects to login.
- `BF-0008` Employee payslips route is flaky and sometimes redirects to login.

**Work order:**

1. Inspect admin and employee auth providers, middleware, `/api/auth/login`, `/api/auth/me`, cookie handling, and redirect timing.
2. Fix UI login so browser login leaves a usable `touchorbit_session`.
3. Add graceful loading/retry handling for transient `/api/auth/me` failures and rate limiting.
4. Fix employee route guards so valid employee sessions are not redirected away from `/documents` or `/payslips`.
5. Retest admin login/logout and employee page access.

**Retest commands:**

```powershell
npx.cmd playwright test --config=e2e\playwright.config.ts tests/admin/login.spec.ts tests/admin/auth.spec.ts
npx.cmd playwright test --config=e2e\playwright.config.ts --project=employee-chromium tests/employee/pages.spec.ts
```

**Exit criteria:**

- Admin UI login reaches dashboard.
- Logout clears session.
- Employee `/documents` and `/payslips` no longer redirect unexpectedly.

## Phase 2 - Employee Identity And Profile Loading

**Goal:** Fix the shared employee identity/profile path that blocks multiple employee modules.

**Fix items:**

- `BF-0005` Admin employee detail page stays on loading profile.
- `BF-0045` Employee profile phone update cannot start.
- `BF-0046` Employee profile emergency contacts do not render.
- `BF-0051` Employee self performance review cannot be submitted.
- Related risk: employee local DB identity mismatch affecting documents and roster.

**Work order:**

1. Audit `/employees/me`, employee auto-linking, admin employee detail data dependencies, and route loaders.
2. Remove or isolate Supabase reads from employee profile page.
3. Add local API reads for profile stats, emergency contacts, assigned assets, active trainings, and pending self-review.
4. Make optional profile sections fail independently with empty states, not a full-page spinner.
5. Migrate self-review submit to `POST /api/performance/reviews/:id/self`.
6. Retest profile and performance self-review before moving to documents.

**Retest commands:**

```powershell
npx.cmd playwright test --config=e2e\playwright.config.ts tests/admin/employees.spec.ts
npx.cmd playwright test --config=e2e\playwright.config.ts --project=employee-chromium tests/employee/profile-functional.spec.ts
npx.cmd playwright test --config=e2e\playwright.config.ts --project=employee-chromium tests/employee/performance-functional.spec.ts
```

**Exit criteria:**

- Admin employee detail renders.
- Employee profile renders and phone update persists.
- Emergency contacts display from local API.
- Pending self-review appears and submits to `pending_manager`.

## Phase 3 - Local API Contract Mismatches

**Goal:** Fix clear endpoint/payload mismatches where backend support already exists or should be straightforward.

**Fix items:**

- `BF-0011` Admin leave approve calls missing endpoint.
- `BF-0012` Admin leave reject calls missing endpoint.
- `BF-0018` Leave balance adjustment API parameter type error.
- `BF-0024` Admin shift template status toggle does not complete.
- `BF-0041` Core settings save does not persist.

**Work order:**

1. Change admin leave decision routes from `/approved` and `/rejected` style calls to the backend-supported `/approve` and `/reject` routes.
2. Fix leave balance adjustment parameter types and schema conversion.
3. Inspect shift-template status toggle API response envelope and payload.
4. Fix settings save so the API response only returns success after persistence.
5. Add UI error surfacing for non-OK API envelopes.

**Retest commands:**

```powershell
npx.cmd playwright test --config=e2e\playwright.config.ts tests/admin/leave-functional.spec.ts
npx.cmd playwright test --config=e2e\playwright.config.ts tests/admin/encashment-functional.spec.ts
npx.cmd playwright test --config=e2e\playwright.config.ts --project=chromium tests/admin/shifts-functional.spec.ts
npx.cmd playwright test --config=e2e\playwright.config.ts --project=chromium tests/admin/settings-functional.spec.ts --grep "F24\.1"
```

**Exit criteria:**

- Admin leave approve/reject persists.
- Encashment setup no longer fails on balance adjustment.
- Shift status toggle persists.
- Core settings value changes survive a follow-up GET.

## Phase 4 - Employee Request Submission Workflows

**Goal:** Make employee-originated operational requests create and transition correctly.

**Fix items:**

- `BF-0010` Employee leave submit does not complete.
- `BF-0015` Employee comp-off submit does not complete.
- `BF-0016` Employee encashment submit does not complete.
- `BF-0023` Employee overtime submit does not complete.
- `BF-0027` Employee attendance correction submit does not complete.
- `BF-0020` Employee expense claim has no category options.

**Work order:**

1. Add network/error diagnostics around each employee submit handler.
2. Normalize payloads to the local API schemas.
3. Ensure required dropdown data is loaded from local DB, especially expense categories.
4. Close forms and refresh lists only after confirmed API success.
5. Ensure each failed submit displays durable error feedback.

**Retest commands:**

```powershell
npx.cmd playwright test --config=e2e\playwright.config.ts --project=employee-chromium tests/employee/leave-functional.spec.ts
npx.cmd playwright test --config=e2e\playwright.config.ts --project=employee-chromium tests/employee/requests-functional.spec.ts
npx.cmd playwright test --config=e2e\playwright.config.ts --project=employee-chromium tests/employee/overtime-functional.spec.ts
npx.cmd playwright test --config=e2e\playwright.config.ts --project=employee-chromium tests/employee/corrections-functional.spec.ts
npx.cmd playwright test --config=e2e\playwright.config.ts --project=employee-chromium tests/employee/expenses-functional.spec.ts
```

**Exit criteria:**

- Every employee submit creates a local DB record.
- Employee UI shows pending/success state.
- No form silently hangs.

## Phase 5 - Admin Approval And Admin Create Workflows

**Goal:** Fix admin-side CRUD and approval flows used daily by HR/admin users.

**Fix items:**

- `BF-0009` Admin add employee submit does not complete.
- `BF-0013` Admin announcement create does not complete.
- `BF-0014` Admin geofence create causes client-side exception.
- `BF-0017` Admin comp-off pending filter shows approved rows.
- `BF-0019` Admin expense category create does not complete.
- `BF-0021` Admin calendar task create does not complete.
- `BF-0022` Admin manual overtime entry has no employee options.
- `BF-0028` Admin attendance correction approve does not complete.

**Work order:**

1. Fix employee create form validation, department/custom-field dependencies, and create API response handling.
2. Migrate announcement/geofence/expense category/calendar task writes fully to local API.
3. Fix employee option loading for overtime and roster-related selectors.
4. Fix comp-off filter query or UI state mapping.
5. Fix attendance correction approve endpoint/payload.

**Retest commands:**

```powershell
npx.cmd playwright test --config=e2e\playwright.config.ts tests/admin/employees-functional.spec.ts
npx.cmd playwright test --config=e2e\playwright.config.ts tests/admin/announcements-functional.spec.ts
npx.cmd playwright test --config=e2e\playwright.config.ts tests/admin/geofences-functional.spec.ts
npx.cmd playwright test --config=e2e\playwright.config.ts tests/admin/expenses-functional.spec.ts
npx.cmd playwright test --config=e2e\playwright.config.ts tests/admin/calendar-functional.spec.ts
npx.cmd playwright test --config=e2e\playwright.config.ts --project=chromium tests/admin/overtime-functional.spec.ts
npx.cmd playwright test --config=e2e\playwright.config.ts --project=chromium tests/admin/corrections-functional.spec.ts
npx.cmd playwright test --config=e2e\playwright.config.ts tests/admin/comp-off-functional.spec.ts
```

**Exit criteria:**

- Admin CRUD/approval actions complete and persist.
- Admin selectors include local DB seed employees.
- Filters show correct statuses.

## Phase 6 - Documents And Signing

**Goal:** Complete document-template CRUD and employee assigned-document signing without Supabase storage dependency.

**Fix items:**

- `BF-0029` Admin document template create does not submit.
- `BF-0030` Admin document template edit does not complete.
- `BF-0031` Admin document template delete does not complete.
- `BF-0032` Employee assigned documents do not display.
- `BF-0033` Employee document signing cannot be completed.

**Work order:**

1. Add or fix local API endpoints for document template create/edit/delete.
2. Migrate admin document template UI off Supabase.
3. Align assigned-document filtering with `/employees/me` local DB identity.
4. Replace signature upload/storage path with local API/storage handling.
5. Verify signed status persists and appears in both portals.

**Retest commands:**

```powershell
npx.cmd playwright test --config=e2e\playwright.config.ts --project=chromium tests/admin/documents-functional.spec.ts
npx.cmd playwright test --config=e2e\playwright.config.ts --project=employee-chromium tests/employee/documents-functional.spec.ts
```

**Exit criteria:**

- Template create/edit/delete works from admin UI.
- Employee can view assigned document.
- Employee can sign assigned document and status changes to signed.

## Phase 7 - Roster, Availability, And Shift Swaps

**Goal:** Finish local DB migration for roster employee visibility, availability, and shift workflows.

**Fix items:**

- `BF-0026` Admin roster grid does not show local DB seed employee.
- `BF-0049` Employee availability save does not complete.
- Remaining deeper area: shift swap create/claim/approve/reject cross-portal flow.
- Remaining deeper area: roster publish, employee acknowledge, and conflict flag flow.

**Work order:**

1. Fix roster grid employee query and local DB employee normalization.
2. Add local API endpoints for employee availability list/create/delete if missing.
3. Migrate `AvailabilitySetter` off Supabase.
4. Migrate roster acknowledge/flag conflict off Supabase RPC.
5. Add deep tests for shift swap create, claim, approve, and reject.

**Retest commands:**

```powershell
npx.cmd playwright test --config=e2e\playwright.config.ts --project=chromium tests/admin/roster-functional.spec.ts
npx.cmd playwright test --config=e2e\playwright.config.ts --project=employee-chromium tests/employee/roster-functional.spec.ts
```

**Exit criteria:**

- Seed employee appears in admin roster.
- Employee availability add/delete works.
- Shift-swap and acknowledge/conflict flows have passing E2E coverage.

## Phase 8 - Payroll And Payslips

**Goal:** Make payroll processing and employee payslips safe enough for go-live.

**Fix items:**

- `BF-0050` Payroll process page crashes.
- `BF-0036` Payroll report crashes after generate.
- `BF-0008` Employee payslips flaky route, if not already resolved by Phase 1.
- Remaining deeper area: payroll finalization/payment state.
- Remaining deeper area: payslip email send.
- Remaining deeper area: bank file download.
- Remaining deeper area: employee payslip view/download.

**Work order:**

1. Inspect payroll process page console error and harden run/employee response handling.
2. Verify `POST /payroll/runs/:id/process` works from UI and renders items.
3. Add or fix payroll finalize/status transition if product expects it.
4. Verify payslip email request payload and user feedback.
5. Verify bank file download behavior.
6. Fix employee payslip route/data loading and add download/view coverage.

**Retest commands:**

```powershell
npx.cmd playwright test --config=e2e\playwright.config.ts --project=chromium tests/admin/payroll-functional.spec.ts
npx.cmd playwright test --config=e2e\playwright.config.ts --project=chromium tests/admin/reports-functional.spec.ts --grep payroll
npx.cmd playwright test --config=e2e\playwright.config.ts --project=employee-chromium tests/employee/pages.spec.ts --grep payslips
```

**Exit criteria:**

- Payroll process page renders.
- Payroll run can be processed from UI.
- Payroll report renders.
- Employee payslips page is stable and covered by deep tests.

## Phase 9 - Reports

**Goal:** Make all report generation routes render cleanly or return meaningful empty states.

**Fix items:**

- `BF-0034` Attendance report crashes after generate.
- `BF-0035` Leave report crashes after generate.
- `BF-0036` Payroll report crashes after generate.
- `BF-0037` Roster adherence report returns HTTP 500.
- `BF-0038` Overtime report returns HTTP 500.
- `BF-0039` Late arrivals report returns HTTP 500.
- `BF-0040` Expense report returns HTTP 500.

**Work order:**

1. Fix server-side report endpoints returning HTTP 500.
2. Normalize report response shapes used by frontend tables/stats.
3. Add empty-state handling for zero records.
4. Retest report pages one by one to avoid masking failures.

**Retest commands:**

```powershell
npx.cmd playwright test --config=e2e\playwright.config.ts --project=chromium tests/admin/reports-functional.spec.ts --grep attendance
npx.cmd playwright test --config=e2e\playwright.config.ts --project=chromium tests/admin/reports-functional.spec.ts --grep leave
npx.cmd playwright test --config=e2e\playwright.config.ts --project=chromium tests/admin/reports-functional.spec.ts --grep payroll
npx.cmd playwright test --config=e2e\playwright.config.ts --project=chromium tests/admin/reports-functional.spec.ts --grep roster
npx.cmd playwright test --config=e2e\playwright.config.ts --project=chromium tests/admin/reports-functional.spec.ts --grep overtime
npx.cmd playwright test --config=e2e\playwright.config.ts --project=chromium tests/admin/reports-functional.spec.ts --grep late
npx.cmd playwright test --config=e2e\playwright.config.ts --project=chromium tests/admin/reports-functional.spec.ts --grep expense
```

**Exit criteria:**

- No report route returns HTTP 500.
- No report page shows `Application error`.
- Generated reports render data or a clean empty state.

## Phase 10 - Settings And Organization Structure

**Goal:** Complete settings migration and persistence for organization administration.

**Fix items:**

- `BF-0042` Leave approval chain save does not complete.
- `BF-0043` Branch create does not complete.
- `BF-0044` Department create does not complete.
- Remaining deeper area: roles/permissions.
- Remaining deeper area: notification preferences.

**Work order:**

1. Add local API endpoints for leave approval chain config.
2. Add local API create/update/delete for branches and departments if missing.
3. Migrate settings UI writes off Supabase.
4. Add role/permission persistence tests.
5. Add notification preference persistence tests.

**Retest commands:**

```powershell
npx.cmd playwright test --config=e2e\playwright.config.ts --project=chromium tests/admin/settings-functional.spec.ts
```

**Exit criteria:**

- Core, approval-chain, branch, department, role, and notification preference settings persist through local API.

## Phase 11 - Training, Org Chart, Dashboard, And Medium-Risk Items

**Goal:** Close remaining non-payroll/non-request gaps after core workflows are stable.

**Fix items:**

- `BF-0004` Dashboard widget remove does not persist.
- `BF-0007` Employee org chart skeleton/no content.
- `BF-0025` Employee personal training edit does not complete.
- Remaining deeper area: search/global navigation.
- Remaining deeper area: audit filtering/export.
- Remaining deeper area: mobile/responsive checks for critical flows.

**Work order:**

1. Fix dashboard layout persistence.
2. Add org chart empty/error states and local DB data source.
3. Fix employee training edit payload/local API handling.
4. Add deeper search and audit tests.
5. Run mobile/responsive E2E for employee critical paths.

**Retest commands:**

```powershell
npx.cmd playwright test --config=e2e\playwright.config.ts tests/admin/dashboard.spec.ts
npx.cmd playwright test --config=e2e\playwright.config.ts --project=employee-chromium tests/employee/pages.spec.ts --grep "org-chart"
npx.cmd playwright test --config=e2e\playwright.config.ts --project=employee-chromium tests/employee/training-functional.spec.ts
npx.cmd playwright test --config=e2e\playwright.config.ts tests/admin/audit.spec.ts
```

**Exit criteria:**

- Remaining Medium items are either fixed or explicitly accepted as go-live risk.
- Search/audit/mobile coverage is documented.

## Phase 12 - Cross-Portal Regression And Go-Live Gate

**Goal:** Prove the fixed application works end-to-end across admin and employee portals.

**Cross-portal flows to run:**

- Employee leave submit -> admin approve/reject -> employee notification/history update.
- Employee overtime submit -> admin review -> employee notification/history update.
- Employee correction submit -> admin approve/reject -> attendance/history update.
- Admin document send -> employee view/sign -> admin sees signed status.
- Admin roster publish -> employee acknowledge/flag -> admin sees state.
- Admin payroll process -> employee payslip available.

**Final retest commands:**

```powershell
npm run e2e:seed
npm run e2e:test:admin
npm run e2e:test:employee
```

Run any new cross-portal specs added during the phases as part of the final gate.

**Go-live criteria:**

- `BF-0002` Critical login item is fixed.
- All High items are fixed or explicitly accepted by the product owner.
- All payroll, attendance, leave, employee profile, and document-signing workflows pass.
- `docs/testing/TOUCHORBIT_BROKEN_FUNCTIONS_REPORT.md` has been updated with final statuses and run history.

## Suggested Implementation Sequence

Use this exact order unless a blocker forces a narrower patch:

1. Phase 1 authentication/session.
2. Phase 2 employee identity/profile.
3. Phase 3 API contract mismatches.
4. Phase 4 employee request submits.
5. Phase 5 admin create/approval flows.
6. Phase 6 documents/signing.
7. Phase 7 roster/availability/shift swaps.
8. Phase 8 payroll/payslips.
9. Phase 9 reports.
10. Phase 10 settings.
11. Phase 11 medium-risk and remaining deeper areas.
12. Phase 12 cross-portal regression and go-live gate.

## Reporting Rules While Fixing

After every phase:

1. Run the phase retests.
2. Update each affected BF entry status.
3. Add a run-history row with command, result, and artifact path.
4. If a retest exposes a new broken function, add a new BF entry before continuing.
5. If a test was wrong rather than the product, fix the test and rerun before recording a product bug.
