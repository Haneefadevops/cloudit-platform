# TouchOrbit Broken Functions Report

Last updated: 2026-07-15

## Purpose

This document tracks every frontend function that fails, is skipped, is incomplete, or cannot be verified during E2E testing.

Nothing should be ignored. If a function is broken, flaky, blocked by missing seed data, blocked by missing backend support, or not yet covered by an automated test, it must be recorded here until fixed or explicitly accepted as a known risk.

## Status Definitions

- **Open:** Broken or unverified and still requires a fix.
- **In Progress:** Fix is being implemented.
- **Ready For Retest:** Fix is implemented and waiting for E2E rerun.
- **Fixed:** E2E retest passed.
- **Accepted Risk:** Product owner accepted the remaining risk for go-live.

## Severity Definitions

- **Critical:** Blocks login, core navigation, data creation, payroll/attendance/leave core workflow, or can corrupt data.
- **High:** Major user-facing workflow broken with no usable workaround.
- **Medium:** Workflow partially broken or has a workaround.
- **Low:** Cosmetic, minor validation, copy, or non-blocking UI issue.

## Current Summary

Module 0 foundation test has passed after stabilizing the test setup authentication path. Deep module testing is now underway and has found multiple create/update/approval workflow gaps, especially where frontend pages still call Supabase directly instead of the local API.

| Severity | Open | In Progress | Ready For Retest | Fixed | Accepted Risk |
| --- | ---: | ---: | ---: | ---: | ---: |
| Critical | 0 | 0 | 0 | 2 | 0 |
| High | 32 | 0 | 1 | 9 | 0 |
| Medium | 6 | 0 | 0 | 2 | 0 |
| Low | 0 | 0 | 0 | 0 | 0 |

## Broken Function Entries

### BF-0001 - Admin Login Does Not Reach Authenticated Dashboard In E2E Setup

- **Status:** Fixed
- **Severity:** Critical
- **Portal:** Admin
- **Module:** Authentication and seed foundation
- **Route:** `/login` -> `/`
- **Function:** Admin login/session establishment
- **Test file:** `e2e/tests/auth.setup.ts`
- **Test name:** `authenticate as admin`
- **Expected:** Valid admin credentials should log in, verify `/api/auth/me`, redirect to `/`, and render the authenticated dashboard.
- **Actual:** The test reached `/` but rendered the unauthenticated gate: `TouchOrbit Admin / Sign in to access your dashboard / Sign In to Continue`.
- **Evidence:** `e2e/test-results/auth.setup.ts-authenticate-as-admin-setup-retry2/test-failed-1.png`, `e2e/test-results/auth.setup.ts-authenticate-as-admin-setup-retry2/error-context.md`, and Playwright output from `npm run e2e:seed`.
- **Likely cause:** The production login flow is not leaving the browser with a usable `touchorbit_session` for the admin app, or the setup assertion is racing a session refresh. Needs investigation before continuing module tests.
- **Fix plan:** Completed. The setup harness now authenticates through the admin auth proxy, verifies `/api/auth/me`, saves browser storage state, and keeps visible UI login validation in Module 1.
- **Owner:** Unassigned
- **Retest command:** `npm run e2e:seed`
- **Last tested:** 2026-07-14
- **Notes:** Initial sandbox run failed with `net::ERR_NETWORK_ACCESS_DENIED`; rerun with network access reached production and exposed setup instability. Retest passed with `npm run e2e:seed`.

Add every failed/skipped/unverified function below using this template.

### BF-0002 - Admin UI Valid Login Lands On Unauthenticated Gate

- **Status:** Fixed
- **Severity:** Critical
- **Portal:** Admin
- **Module:** Authentication and onboarding
- **Route:** `/login` -> `/`
- **Function:** Valid admin UI login
- **Test file:** `e2e/tests/admin/login.spec.ts`
- **Test name:** `1.1 valid login redirects to dashboard`
- **Expected:** Entering valid admin credentials should redirect to `/` and render the authenticated dashboard.
- **Actual:** The browser redirects to `/`, but the page renders the unauthenticated gate: `TouchOrbit Admin / Sign in to access your dashboard / Sign In to Continue`.
- **Evidence:** `e2e/test-results/admin-login-Authentication-bf307-ogin-redirects-to-dashboard-chromium-no-auth-retry2/test-failed-1.png`, `e2e/test-results/admin-login-Authentication-bf307-ogin-redirects-to-dashboard-chromium-no-auth-retry2/error-context.md`.
- **Likely cause:** The UI login flow is not leaving the client dashboard with a usable authenticated state, even though direct API login and admin auth proxy diagnostics both return a valid owner session. Possible causes include auth-provider handling of transient `/api/auth/me` failures, rate limiting during login verification, or cookie/session timing after `router.replace('/')`.
- **Fix plan:** Investigate browser-side login flow, add resilient session verification before dashboard render, avoid showing the unauthenticated gate on transient `429`/auth refresh states, and retest Module 1.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts tests/admin/login.spec.ts tests/admin/auth.spec.ts`
- **Last tested:** 2026-07-15
- **Notes:** Fixed by reloading the root auth provider after login and preserving session state during transient auth failures. The deployed production retest passed on its first attempt.

### BF-0003 - Admin Logout Flow Blocked Because UI Login Does Not Reach Dashboard

- **Status:** Fixed
- **Severity:** High
- **Portal:** Admin
- **Module:** Authentication and onboarding
- **Route:** `/login` -> `/` -> `/login`
- **Function:** Logout clears session
- **Test file:** `e2e/tests/admin/login.spec.ts`
- **Test name:** `1.5 logout redirects to login and clears session`
- **Expected:** A valid login should render the dashboard, clicking logout should redirect to `/login`, and the session cookie should be cleared.
- **Actual:** Login and redirect now succeed, but logout leaves the parent-domain `touchorbit_session` cookie in the browser.
- **Evidence:** `e2e/test-results/admin-login-Authentication-cfa71-to-login-and-clears-session-chromium-no-auth-retry2/test-failed-1.png`, `e2e/test-results/admin-login-Authentication-cfa71-to-login-and-clears-session-chromium-no-auth-retry2/error-context.md`.
- **Likely cause:** Multiple same-name cookie deletions collapse to the last response entry. Production emitted only `Domain=to-admin.cloudit.lk`, while the live cookie uses `Domain=.cloudit.lk`.
- **Fix plan:** Emit exactly one deletion using the same canonical domain computed by login, deploy, and rerun the logout test.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts tests/admin/login.spec.ts`
- **Last tested:** 2026-07-15
- **Notes:** Fixed by emitting one deletion using the same canonical cookie domain as login. The deployed logout retest passed and confirmed the session cookie is removed.

### BF-0004 - Dashboard Widget Remove Does Not Persist Or Hide Removed Widget

- **Status:** Open
- **Severity:** Medium
- **Portal:** Admin
- **Module:** Dashboard
- **Route:** `/`
- **Function:** Remove dashboard widget and save layout
- **Test file:** `e2e/tests/admin/dashboard.spec.ts`
- **Test name:** `2.6 remove widget from dashboard`
- **Expected:** In customize mode, removing the `Recent Clock-Ins` widget and clicking Save should hide the widget from the dashboard.
- **Actual:** After Remove and Save, `Recent Clock-Ins` remains visible.
- **Evidence:** `e2e/test-results/admin-dashboard-Dashboard-2-6-remove-widget-from-dashboard-chromium-retry2/test-failed-1.png`, `e2e/test-results/admin-dashboard-Dashboard-2-6-remove-widget-from-dashboard-chromium-retry2/error-context.md`.
- **Likely cause:** Widget layout removal is not persisted, save action is not calling the backend successfully, or the test target is not the correct remove button for the widget card.
- **Fix plan:** Inspect dashboard customize mode, verify save API request and payload, add stable accessible labels/data hooks if needed, fix persistence/render refresh, then rerun the dashboard module.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts tests/admin/dashboard.spec.ts`
- **Last tested:** 2026-07-14
- **Notes:** Other dashboard functions in this module passed.

### BF-0005 - Employee Detail Page Stays On Loading Profile

- **Status:** Fixed
- **Severity:** High
- **Portal:** Admin
- **Module:** Employees
- **Route:** `/employees/:id`
- **Function:** Employee detail page load
- **Test file:** `e2e/tests/admin/employees.spec.ts`
- **Test name:** `3.13 employee detail page loads`
- **Expected:** Opening `/employees/{seedEmployeeId}` should render the employee profile/detail tabs or equivalent profile content.
- **Actual:** The page remains on `Loading Profile...` and never renders detail content within the test timeout.
- **Evidence:** `e2e/test-results/admin-employees-Employees-3-13-employee-detail-page-loads-chromium-retry2/test-failed-1.png`, `e2e/test-results/admin-employees-Employees-3-13-employee-detail-page-loads-chromium-retry2/error-context.md`.
- **Likely cause:** Frontend employee detail loading/rendering issue. API diagnostic confirmed `GET /api/employees/{id}` returns `200` with the seeded employee record, so the blocker is likely client-side data loading, an additional route/API dependency, or a leftover Supabase-dependent check.
- **Fix plan:** Inspect employee detail page data dependencies, especially any route that still uses legacy Supabase helpers or `/api/check-user-status`; fix loading/error handling and retest Module 3.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts tests/admin/employees.spec.ts`
- **Last tested:** 2026-07-15
- **Notes:** Deployed `3.13 employee detail page loads` retest passed. Core profile content renders and the semantic tab/tab-panel contract is present.

### BF-0006 - Employee Documents Route Redirects To Login

- **Status:** Fixed
- **Severity:** High
- **Portal:** Employee
- **Module:** Documents
- **Route:** `/documents`
- **Function:** Employee documents page load
- **Test file:** `e2e/tests/employee/pages.spec.ts`
- **Test name:** `E2 page loads: /documents`
- **Expected:** An authenticated employee should be able to open the documents page and see documents, signature state, empty state, or file-related content.
- **Actual:** The route redirects to `https://to-employee.cloudit.lk/login`.
- **Evidence:** `e2e/test-results/employee-pages-Employee-pr-cce21-ges-E2-page-loads-documents-employee-chromium-retry2/test-failed-1.png`, related error context in the same folder.
- **Likely cause:** Employee document route/session handling is rejecting a valid employee session, or an internal API dependency returns unauthorized and sends the client to login.
- **Fix plan:** Inspect employee documents page API calls, middleware behavior, and `/documents` backend permissions; fix auth/session handling and retest Employee Module E2.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts --project=employee-chromium tests/employee/pages.spec.ts`
- **Last tested:** 2026-07-15
- **Notes:** Fixed by preventing feature-endpoint `401` responses from globally redirecting and centralizing employee session polling. The deployed `/documents` retest passed without retry.

### BF-0007 - Employee Org Chart Shows Skeleton Without Content

- **Status:** Open
- **Severity:** High
- **Portal:** Employee
- **Module:** Org Chart
- **Route:** `/org-chart`
- **Function:** Employee org chart page load/render
- **Test file:** `e2e/tests/employee/pages.spec.ts`
- **Test name:** `E2 page loads: /org-chart`
- **Expected:** The org chart should render organization/employee content, an empty state, or a meaningful error state.
- **Actual:** The route stays on skeleton placeholder cards and does not expose org chart, organization, or employee content within the timeout.
- **Evidence:** `e2e/test-results/employee-pages-Employee-pr-4dcd0-ges-E2-page-loads-org-chart-employee-chromium-retry2/test-failed-1.png`, `e2e/test-results/employee-pages-Employee-pr-4dcd0-ges-E2-page-loads-org-chart-employee-chromium-retry2/error-context.md`.
- **Likely cause:** Org chart data request is hanging/failing or the page lacks a proper empty/error state when no hierarchy data exists.
- **Fix plan:** Inspect employee org chart data hook/API response, add empty/error handling, verify seeded employee appears or a clear empty state renders, and retest Employee Module E2.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts --project=employee-chromium tests/employee/pages.spec.ts`
- **Last tested:** 2026-07-14
- **Notes:** The page remained authenticated; this is a render/data issue rather than direct login redirect.

### BF-0008 - Employee Payslips Route Is Flaky And Sometimes Redirects To Login

- **Status:** Fixed
- **Severity:** Medium
- **Portal:** Employee
- **Module:** Payslips
- **Route:** `/payslips`
- **Function:** Employee payslips page load
- **Test file:** `e2e/tests/employee/pages.spec.ts`
- **Test name:** `E2 page loads: /payslips`
- **Expected:** Authenticated employee should consistently open payslips and see payslip/payroll/salary content or an empty state.
- **Actual:** First attempts redirected to `/login`; a later retry passed.
- **Evidence:** `e2e/test-results/employee-pages-Employee-pr-13c84-ages-E2-page-loads-payslips-employee-chromium-retry1/test-failed-1.png`, related trace and error context.
- **Likely cause:** Session/auth timing, rate limiting, or payslip route-specific auth/API dependency flakiness.
- **Fix plan:** Inspect payslips API calls and employee auth polling behavior, stabilize route auth handling, then retest repeatedly without retries.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts --project=employee-chromium tests/employee/pages.spec.ts`
- **Last tested:** 2026-07-15
- **Notes:** Employee middleware and auth polling now distinguish transient failures from explicit session rejection. The deployed `/payslips` retest passed without retry.

### BF-0009 - Admin Add Employee Submit Does Not Complete

- **Status:** Open
- **Severity:** High
- **Portal:** Admin
- **Module:** Employees
- **Route:** `/employees`
- **Function:** Create employee from Add Employee dialog
- **Test file:** `e2e/tests/admin/employees-functional.spec.ts`
- **Test name:** `F3.1 creates employee from Add Employee dialog and finds it in the list`
- **Expected:** Filling required employee fields and submitting the Add Employee dialog should create the employee, close the dialog, and make the new employee searchable in the list.
- **Actual:** After clicking `Add Employee`, the dialog remains open for the full timeout. The employee is not verified in the list.
- **Evidence:** `e2e/test-results/admin-employees-functional-4eb3f-og-and-finds-it-in-the-list-chromium-retry2/test-failed-1.png`, `e2e/test-results/admin-employees-functional-4eb3f-og-and-finds-it-in-the-list-chromium-retry2/error-context.md`.
- **Likely cause:** Unknown until inspected. Possibilities include frontend submit handler/API failure not surfaced in the dialog, validation state not visible, stale department/custom-field dependency, or backend create failure.
- **Fix plan:** Add network/error diagnostics around the create submit, inspect API response and toast/console errors, fix the create flow or visible error handling, then rerun the Employees functional module.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts tests/admin/employees-functional.spec.ts`
- **Last tested:** 2026-07-14
- **Notes:** This deeper functional test is intentionally separate from the Employees smoke/list module.

### BF-0010 - Employee Leave Submit Does Not Complete

- **Status:** Open
- **Severity:** High
- **Portal:** Employee
- **Module:** Leave
- **Route:** `/leave`
- **Function:** Submit leave request from employee portal
- **Test file:** `e2e/tests/employee/leave-functional.spec.ts`
- **Test name:** `EF6.1 employee submits a leave request from the portal`
- **Expected:** An authenticated employee should open Apply for Leave, submit a valid annual leave request, see success feedback, return to the leave history/list view, and see pending leave request state.
- **Actual:** After clicking `Submit Application`, the page remains on the application form and never returns to `Leave History` within the timeout.
- **Evidence:** `e2e/test-results/employee-leave-functional--e943a-ave-request-from-the-portal-employee-chromium-retry2/test-failed-1.png`, `e2e/test-results/employee-leave-functional--e943a-ave-request-from-the-portal-employee-chromium-retry2/error-context.md`.
- **Likely cause:** Employee leave submit API call may be failing without a durable visible error, or the frontend submit handler is not reaching the success path that calls `setShowApplyForm(false)`, resets the form, and reloads leave data.
- **Fix plan:** Add network/error diagnostics around the employee leave submit request, inspect the `/api/leave/requests` response and toast state, fix the API payload/backend validation or frontend error handling, then rerun the employee leave functional module.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts --project=employee-chromium tests/employee/leave-functional.spec.ts`
- **Last tested:** 2026-07-14
- **Notes:** The leave page component is expected to close the form on success; the failed state proves that success path did not complete.

### BF-0011 - Admin Leave Approve Calls Missing Endpoint

- **Status:** Ready For Retest
- **Severity:** High
- **Portal:** Admin
- **Module:** Leave
- **Route:** `/leave`
- **Function:** Approve leave request from admin UI
- **Test file:** `e2e/tests/admin/leave-functional.spec.ts`
- **Test name:** `F6.1 approves a seeded leave request from the admin UI`
- **Expected:** Clicking `Approve Request` for a pending seeded leave request should call a successful backend decision endpoint, show `Request approved successfully`, and persist the request status as `approved`.
- **Actual:** The UI sends a POST decision request that returns `404`; the request is not approved.
- **Evidence:** `e2e/test-results/admin-leave-functional-Adm-1ea23-e-request-from-the-admin-UI-chromium-retry2/test-failed-1.png`, `e2e/test-results/admin-leave-functional-Adm-1ea23-e-request-from-the-admin-UI-chromium-retry2/error-context.md`.
- **Likely cause:** Frontend endpoint mismatch. The admin page calls `/leave/requests/{id}/approved`, while the backend controller exposes `/leave/requests/{id}/approve`.
- **Fix plan:** Change the admin leave decision handler to call `/approve` for approved decisions, rerun the admin Leave functional module, and verify persisted backend status.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts tests/admin/leave-functional.spec.ts`
- **Last tested:** 2026-07-15
- **Notes:** The admin decision handler now maps the `approved` UI state to the backend `/approve` action. TypeScript validation passed; deployment retest is pending.

### BF-0012 - Admin Leave Reject Calls Missing Endpoint

- **Status:** Fixed
- **Severity:** High
- **Portal:** Admin
- **Module:** Leave
- **Route:** `/leave`
- **Function:** Reject leave request from admin UI
- **Test file:** `e2e/tests/admin/leave-functional.spec.ts`
- **Test name:** `F6.2 rejects a seeded leave request from the admin UI`
- **Expected:** Entering a rejection note and clicking `Reject` should call a successful backend decision endpoint, show `Request rejected successfully`, and persist the request status as `rejected`.
- **Actual:** The UI sends a POST decision request that returns `404`; the request is not rejected.
- **Evidence:** `e2e/test-results/admin-leave-functional-Adm-b3761-e-request-from-the-admin-UI-chromium-retry2/test-failed-1.png`, `e2e/test-results/admin-leave-functional-Adm-b3761-e-request-from-the-admin-UI-chromium-retry2/error-context.md`.
- **Likely cause:** Frontend endpoint mismatch. The admin page calls `/leave/requests/{id}/rejected`, while the backend controller exposes `/leave/requests/{id}/reject`.
- **Fix plan:** Change the admin leave decision handler to call `/reject` for rejected decisions, rerun the admin Leave functional module, and verify persisted backend status.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts tests/admin/leave-functional.spec.ts`
- **Last tested:** 2026-07-15
- **Notes:** Deployed F6.2 retest passed. The admin decision handler maps the `rejected` UI state to `/reject`, and the request persists as rejected.

Add every failed/skipped/unverified function below using this template.

### BF-0013 - Admin Announcement Create Does Not Complete

- **Status:** Open
- **Severity:** High
- **Portal:** Admin
- **Module:** Announcements
- **Route:** `/announcements`
- **Function:** Create and delete announcement
- **Test file:** `e2e/tests/admin/announcements-functional.spec.ts`
- **Test name:** `F18.1 creates and deletes an E2E announcement`
- **Expected:** Filling the New Announcement form and clicking `Post Update` should show success, close the modal, display the announcement, and allow deleting the E2E announcement.
- **Actual:** After clicking `Post Update`, the modal remains open and no `Announcement posted` success state appears within the timeout. Delete cannot be verified because creation does not complete.
- **Evidence:** `e2e/test-results/admin-announcements-functi-c37e0-deletes-an-E2E-announcement-chromium-retry2/test-failed-1.png`, `e2e/test-results/admin-announcements-functi-c37e0-deletes-an-E2E-announcement-chromium-retry2/error-context.md`.
- **Likely cause:** The announcements page still writes directly through the legacy Supabase client (`supabase.from('announcements').insert/delete`) instead of the local DB API path. This likely fails after the move away from Supabase.
- **Fix plan:** Replace announcement list/create/delete with local DB-backed API endpoints, surface failed submit errors in the modal, then rerun the announcements functional module and cross-portal employee announcement visibility test.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts tests/admin/announcements-functional.spec.ts`
- **Last tested:** 2026-07-14
- **Notes:** This blocks announcement broadcast and the related cross-portal workflow.

Add every failed/skipped/unverified function below using this template.

### BF-0014 - Admin Geofence Create Causes Client-Side Exception

- **Status:** Open
- **Severity:** High
- **Portal:** Admin
- **Module:** Geofences
- **Route:** `/geofences`
- **Function:** Create, edit, filter, and delete geofence
- **Test file:** `e2e/tests/admin/geofences-functional.spec.ts`
- **Test name:** `F20.1 creates, edits, filters, and deletes an E2E geofence`
- **Expected:** Creating a valid geofence should show success, refresh the zone list, allow filtering for the new zone, then allow edit/delete.
- **Actual:** After a successful create toast, the page crashes to `Application error: a client-side exception has occurred`; the created zone cannot be verified or edited/deleted from the UI.
- **Evidence:** `e2e/test-results/admin-geofences-functional-6ee59-and-deletes-an-E2E-geofence-chromium/test-failed-1.png`, retry artifacts in the same geofences functional result folders.
- **Likely cause:** Client-side render crash after geofence create/reload. Likely candidates are geofence map/list handling of the newly returned record, dynamic Leaflet map state, or an unexpected API response shape after create.
- **Fix plan:** Inspect browser console/trace for the client exception, harden geofence create response mapping and map/list rendering, then rerun the geofences functional module and clean up any E2E zones created during failed attempts.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts tests/admin/geofences-functional.spec.ts`
- **Last tested:** 2026-07-14
- **Notes:** The create API appears to reach success, but the frontend crashes immediately afterward.

Add every failed/skipped/unverified function below using this template.

### BF-0015 - Employee Comp-Off Submit Does Not Complete

- **Status:** Open
- **Severity:** High
- **Portal:** Employee
- **Module:** Comp-Off
- **Route:** `/comp-off`
- **Function:** Submit comp-off request
- **Test file:** `e2e/tests/employee/requests-functional.spec.ts`
- **Test name:** `EF7.1 employee submits a comp-off request`
- **Expected:** Filling a valid worked date and note should submit the comp-off request, close the modal, show success, and display the pending request in history.
- **Actual:** After clicking `Submit Request`, the modal remains open with the filled data and no `Comp-off request submitted` success state appears.
- **Evidence:** `e2e/test-results/employee-requests-function-ac041--submits-a-comp-off-request-employee-chromium-retry2/test-failed-1.png`, `e2e/test-results/employee-requests-function-ac041--submits-a-comp-off-request-employee-chromium-retry2/error-context.md`.
- **Likely cause:** Employee comp-off submit API call fails or the frontend does not surface the returned error durably. The page remains in the form state after submit.
- **Fix plan:** Add response diagnostics around `/api/leave/comp-off`, verify payload and backend validation, show the API error in the form, fix submit path, and rerun the employee request functional module.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts --project=employee-chromium tests/employee/requests-functional.spec.ts`
- **Last tested:** 2026-07-14
- **Notes:** This blocks employee comp-off request creation.

### BF-0016 - Employee Encashment Submit Does Not Complete

- **Status:** Open
- **Severity:** High
- **Portal:** Employee
- **Module:** Encashment
- **Route:** `/encashment`
- **Function:** Submit leave encashment request
- **Test file:** `e2e/tests/employee/requests-functional.spec.ts`
- **Test name:** `EF7.2 employee submits an encashment request`
- **Expected:** Filling days and reason should submit the request, show success, clear the form, and display a pending encashment log item.
- **Actual:** After clicking `Submit Request`, the form remains filled, no `Request submitted` success state appears, and the history area remains on `Fetching History...`.
- **Evidence:** `e2e/test-results/employee-requests-function-b3083-bmits-an-encashment-request-employee-chromium-retry2/test-failed-1.png`, `e2e/test-results/employee-requests-function-b3083-bmits-an-encashment-request-employee-chromium-retry2/error-context.md`.
- **Likely cause:** Encashment page still depends on legacy Supabase employee/org loading and/or the `/leave/encashment` submit response fails without durable visible error handling.
- **Fix plan:** Move encashment employee/org lookup fully to local DB API, add submit response diagnostics and form-level error handling, then rerun the employee request functional module.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts --project=employee-chromium tests/employee/requests-functional.spec.ts`
- **Last tested:** 2026-07-14
- **Notes:** This blocks employee leave encashment requests.

Add every failed/skipped/unverified function below using this template.

### BF-0017 - Admin Comp-Off Pending Filter Shows Approved Rows

- **Status:** Open
- **Severity:** Medium
- **Portal:** Admin
- **Module:** Comp-Off
- **Route:** `/comp-off`
- **Function:** Status filter
- **Test file:** `e2e/tests/admin/comp-off-functional.spec.ts`
- **Test name:** Observed while running `F7.2 rejects a seeded comp-off request from the admin UI`
- **Expected:** Selecting the `Pending` filter should show only pending comp-off requests.
- **Actual:** The `Pending` tab displayed an `Approved` E2E row above pending rows.
- **Evidence:** `e2e/test-results/admin-comp-off-functional--2c443-f-request-from-the-admin-UI-chromium-retry2/test-failed-1.png` from the earlier Comp-Off functional run.
- **Likely cause:** The admin page sends a `status` query parameter, but the backend `findCompOffRecords` controller/service currently accepts only `employee_id` and does not apply a status filter.
- **Fix plan:** Add status query support to the comp-off API and service, then add an explicit filter assertion to the Comp-Off functional spec.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts tests/admin/comp-off-functional.spec.ts`
- **Last tested:** 2026-07-14
- **Notes:** Approve and reject actions passed after test targeting was corrected.

Add every failed/skipped/unverified function below using this template.

### BF-0018 - Leave Balance Adjustment API Fails With Parameter Type Error

- **Status:** Fixed
- **Severity:** High
- **Portal:** Admin/API
- **Module:** Leave / Encashment
- **Route:** `/api/leave/balances/:employeeId/adjust`
- **Function:** Adjust annual leave balance for E2E employee
- **Test file:** `e2e/tests/admin/encashment-functional.spec.ts`
- **Test name:** `F7.3 approves a seeded encashment request from the admin UI`, `F7.4 rejects a seeded encashment request from the admin UI`
- **Expected:** The test setup should be able to add annual leave balance through the supported API so an encashment request can be created and then approved/rejected from the admin UI.
- **Actual:** The balance adjustment API returns `500` with `could not determine data type of parameter $6`, so encashment requests cannot be seeded through the public API.
- **Evidence:** Playwright output from `npx playwright test --config=e2e/playwright.config.ts tests/admin/encashment-functional.spec.ts`; failure occurs in `apiPost('/leave/balances/{employeeId}/adjust')`.
- **Likely cause:** SQL parameter typing bug in the leave balance adjustment service, likely around an optional audit/log value or nullable parameter in the local DB implementation.
- **Fix plan:** Inspect `leave.service.adjustBalance`, add explicit SQL casts for nullable parameters, verify API adjustment succeeds, then rerun admin encashment functional tests.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts tests/admin/encashment-functional.spec.ts`
- **Last tested:** 2026-07-15
- **Notes:** Deployed encashment setup successfully adjusted balances and seeded approval/rejection requests, confirming the SQL parameter error is resolved. Later UI assertions were blocked by an ambiguous test selector unrelated to balance adjustment.

Add every failed/skipped/unverified function below using this template.

### BF-0019 - Admin Expense Category Create Does Not Complete

- **Status:** Open
- **Severity:** High
- **Portal:** Admin
- **Module:** Expenses
- **Route:** `/expenses`
- **Function:** Create/edit expense category
- **Test file:** `e2e/tests/admin/expenses-functional.spec.ts`
- **Test name:** `F8.1 creates and edits an E2E expense category`
- **Expected:** Saving a valid new expense category should show success, close the modal, display the category, and allow editing it.
- **Actual:** After clicking `Save Changes`, the category modal remains open and no `Category added` success state appears.
- **Evidence:** `e2e/test-results/admin-expenses-functional--56399-its-an-E2E-expense-category-chromium-retry2/test-failed-1.png`, related error context in the same folder.
- **Likely cause:** The admin expenses page still uses the legacy Supabase client for categories and claims, while the local expenses API is currently only a read stub returning an empty list.
- **Fix plan:** Implement local DB-backed expense categories/claims APIs, move the admin expenses page off Supabase, then rerun the admin expenses functional module.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts tests/admin/expenses-functional.spec.ts`
- **Last tested:** 2026-07-14
- **Notes:** This also blocks employee expense claim testing unless categories are already present.

Add every failed/skipped/unverified function below using this template.

### BF-0020 - Employee Expense Claim Has No Category Options

- **Status:** Open
- **Severity:** High
- **Portal:** Employee
- **Module:** Expenses
- **Route:** `/expenses`
- **Function:** Submit expense claim
- **Test file:** `e2e/tests/employee/expenses-functional.spec.ts`
- **Test name:** `EF8.1 employee submits an expense claim`
- **Expected:** Opening New Expense Claim should load at least one active expense category so the employee can submit a valid claim.
- **Actual:** The category dropdown contains only the placeholder option; the employee cannot proceed with a valid claim submission.
- **Evidence:** `e2e/test-results/employee-expenses-function-04cb7-ee-submits-an-expense-claim-employee-chromium-retry2/test-failed-1.png`, related error context in the same folder.
- **Likely cause:** Expense categories are still loaded through the legacy Supabase client, and admin category creation is also broken. The local expenses API is not implemented beyond an empty list stub.
- **Fix plan:** Implement local DB expense category APIs, migrate employee expenses page to those APIs, seed at least one active category, then rerun employee expense claim functional testing.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts --project=employee-chromium tests/employee/expenses-functional.spec.ts`
- **Last tested:** 2026-07-14
- **Notes:** This blocks the employee expense claim creation workflow.

Add every failed/skipped/unverified function below using this template.

### BF-0021 - Admin Calendar Task Create Does Not Complete

- **Status:** Open
- **Severity:** High
- **Portal:** Admin
- **Module:** Calendar / Tasks
- **Route:** `/calendar`
- **Function:** Create task from calendar task panel
- **Test file:** `e2e/tests/admin/calendar-functional.spec.ts`
- **Test name:** `F11.1 creates an E2E task from the calendar task panel`
- **Expected:** Filling New Task and clicking `Create Task` should show `Task created`, close the modal, and display the task in the Tasks panel.
- **Actual:** After submit, the form fields reset but the New Task modal remains open and no `Task created` success state appears.
- **Evidence:** `e2e/test-results/admin-calendar-functional--72b6e-rom-the-calendar-task-panel-chromium-retry2/test-failed-1.png`, related error context in the same folder.
- **Likely cause:** The calendar task submit path likely catches an API failure without rethrowing to `TaskForm`, causing the form to reset while the modal remains open. The task sidebar is also not explicitly refreshed after creation.
- **Fix plan:** Inspect `/api/employee-tasks` response from the submit, surface API errors in the modal, only reset on success, close/refetch the task list after successful create, then rerun the calendar functional module.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts tests/admin/calendar-functional.spec.ts`
- **Last tested:** 2026-07-14
- **Notes:** This blocks admin-created employee task workflows and related notification coverage.

Add every failed/skipped/unverified function below using this template.

### BF-0022 - Admin Manual Overtime Entry Has No Employee Options

- **Status:** Open
- **Severity:** High
- **Portal:** Admin
- **Module:** Overtime
- **Route:** `/overtime`
- **Function:** Create manual overtime record
- **Test file:** `e2e/tests/admin/overtime-functional.spec.ts`
- **Test name:** `F7.3 creates a manual overtime record from the admin UI`
- **Expected:** Opening Manual Entry should load active employees, allow selecting the seeded E2E employee, create the overtime record, show `Overtime record created`, and display the new pending record.
- **Actual:** The Manual Entry dialog opens, but the employee select stays at `Select Employee` and never includes `E2E Employee`.
- **Evidence:** `e2e/test-results/admin-overtime-functional--282a5-me-record-from-the-admin-UI-chromium-retry2/test-failed-1.png`, related retry trace and error context in the same folder.
- **Likely cause:** The admin overtime page still loads employees and writes overtime through Supabase client calls; the local API migration only exposes a stubbed `GET /api/overtime` returning an empty array and no create endpoint.
- **Fix plan:** Replace Supabase employee loading/manual overtime insert with local API endpoints, implement overtime create/list support in `apps/touchorbit-api`, refresh the table after create, and rerun the admin overtime functional module.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts --project=chromium tests/admin/overtime-functional.spec.ts`
- **Last tested:** 2026-07-14
- **Notes:** This blocks admin-side manual overtime creation and prevents downstream approval/rejection testing for overtime records.

### BF-0023 - Employee Overtime Submit Does Not Complete

- **Status:** Open
- **Severity:** High
- **Portal:** Employee
- **Module:** Overtime
- **Route:** `/overtime`
- **Function:** Submit overtime request
- **Test file:** `e2e/tests/employee/overtime-functional.spec.ts`
- **Test name:** `EF7.3 employee submits an overtime request`
- **Expected:** Filling the overtime request form and clicking `Submit Request` should show `Overtime request submitted`, close the form, and display the pending request.
- **Actual:** The form can be filled and submitted, but no success message appears and the submitted request is not shown.
- **Evidence:** `e2e/test-results/employee-overtime-function-3ec6e-submits-an-overtime-request-employee-chromium-retry2/test-failed-1.png`, related retry trace and error context in the same folder.
- **Likely cause:** The employee overtime page still looks up the employee and inserts overtime records through Supabase client calls instead of the local API. The local API does not yet provide employee overtime create/list endpoints.
- **Fix plan:** Add employee-scoped overtime list/create endpoints to the local API, migrate the employee overtime page to those endpoints, surface API errors visibly, and rerun the employee overtime functional module.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts --project=employee-chromium tests/employee/overtime-functional.spec.ts`
- **Last tested:** 2026-07-14
- **Notes:** This blocks employee overtime request creation.

Add every failed/skipped/unverified function below using this template.

### BF-0024 - Admin Shift Template Status Toggle Does Not Complete

- **Status:** Fixed
- **Severity:** Medium
- **Portal:** Admin
- **Module:** Roster / Shift Templates
- **Route:** `/shifts`
- **Function:** Toggle shift template active/inactive status
- **Test file:** `e2e/tests/admin/shifts-functional.spec.ts`
- **Test name:** `F12.2 toggles a shift template active status from the admin UI`
- **Expected:** Clicking the active/inactive icon should update the shift status, show `Status updated`, reload the shift list, and display the shift as inactive.
- **Actual:** Clicking the status icon does not show `Status updated` and the card does not change to inactive.
- **Evidence:** `e2e/test-results/admin-shifts-functional-Ad-af2d2-ve-status-from-the-admin-UI-chromium-retry2/test-failed-1.png`, related retry trace and error context in the same folder.
- **Likely cause:** The `/shifts` page still toggles status through a Supabase client update. The local API has shift create/update/delete support but does not expose status in the page's current update path.
- **Fix plan:** Replace the Supabase status toggle with a local API endpoint, either by extending `PATCH /api/shifts/:id` to accept `status` or wiring to the existing roster shift status endpoint, then rerun the shift functional module.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts --project=chromium tests/admin/shifts-functional.spec.ts`
- **Last tested:** 2026-07-15
- **Notes:** Deployed F12.2 retest passed after targeting the toggle by its accessible name. `PATCH /shifts/:id` persists inactive status and the UI shows `Status updated`.

Add every failed/skipped/unverified function below using this template.

### BF-0025 - Employee Personal Training Edit Does Not Complete

- **Status:** Open
- **Severity:** Medium
- **Portal:** Employee
- **Module:** Training
- **Route:** `/training`
- **Function:** Edit personal training log
- **Test file:** `e2e/tests/employee/training-functional.spec.ts`
- **Test name:** `EF13.1 employee creates, edits, and deletes a personal training log`
- **Expected:** Editing a personal training log should preserve the existing dates, allow the title to be changed, close the modal, refresh the Personal Log list, and show the updated title.
- **Actual:** The edit modal opens with the updated title typed in, but the date fields are blank in the modal; after clicking `Confirm Entry`, the list still shows the original title and the modal remains open.
- **Evidence:** `e2e/test-results/employee-training-function-f5743-tes-a-personal-training-log-employee-chromium-retry2/test-failed-1.png`, related retry trace and error context in the same folder.
- **Likely cause:** Existing training dates are passed directly into `input[type="date"]` without normalizing to `YYYY-MM-DD`, so the browser date controls are empty/invalid on edit. The test also saw stale `Record saved` toast text from the create step, making the failed edit less visible to the user.
- **Fix plan:** Normalize `start_date` and `end_date` before setting edit form state, clear stale success toasts or wait on the actual PATCH response, refresh the list after update, then rerun the employee training functional module.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts --project=employee-chromium tests/employee/training-functional.spec.ts`
- **Last tested:** 2026-07-14
- **Notes:** Employee personal training create succeeded. Delete was not reached because edit failed first; the E2E cleanup hook removes leftover `E2E Personal Training` records via API.

Add every failed/skipped/unverified function below using this template.

### BF-0026 - Admin Roster Grid Does Not Show Local DB Seed Employee

- **Status:** Open
- **Severity:** High
- **Portal:** Admin
- **Module:** Roster
- **Route:** `/roster`
- **Function:** Assign and clear roster shift from grid
- **Test file:** `e2e/tests/admin/roster-functional.spec.ts`
- **Test name:** `F12.3 assigns and clears a roster shift from the grid`
- **Expected:** The seeded active E2E employee should appear in the roster grid, the admin should be able to select a shift for a day, the page should call `POST /api/roster/assignments`, and clearing the select should call `DELETE /api/roster/assignments/:id`.
- **Actual:** The roster page renders the week grid header, but the employee table body is empty and `E2E Employee` never appears.
- **Evidence:** `e2e/test-results/admin-roster-functional-Ad-1ec7c--roster-shift-from-the-grid-chromium-retry2/test-failed-1.png`, related retry trace and error context in the same folder.
- **Likely cause:** The roster page still loads employees through Supabase (`supabase.from('employees')`) while E2E seed data is created in the local DB through the local API. The local API roster assignment endpoints exist, but the frontend cannot reach the test employee from its employee source.
- **Fix plan:** Migrate roster employee loading to the local `/api/employees` endpoint, keep manager scope filtering compatible with local API data, then rerun the roster functional module to verify assign and clear.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts --project=chromium tests/admin/roster-functional.spec.ts`
- **Last tested:** 2026-07-14
- **Notes:** The temporary shift seeded for this test is cleaned up in the test `finally` block. This blocks roster assignment, publish-readiness, and employee schedule visibility testing.

Add every failed/skipped/unverified function below using this template.

### BF-0027 - Employee Attendance Correction Submit Does Not Complete

- **Status:** Open
- **Severity:** High
- **Portal:** Employee
- **Module:** Attendance Corrections
- **Route:** `/corrections`
- **Function:** Submit attendance correction request
- **Test file:** `e2e/tests/employee/corrections-functional.spec.ts`
- **Test name:** `EF5.1 employee submits an attendance correction request`
- **Expected:** Filling the correction form and clicking `Send Request` should show `Correction request submitted`, close the form, and show the request in Adjustment History as pending.
- **Actual:** The form can be filled and submitted, but no success message appears and the request is not shown.
- **Evidence:** `e2e/test-results/employee-corrections-funct-0b549-tendance-correction-request-employee-chromium-retry2/test-failed-1.png`, related retry trace and error context in the same folder.
- **Likely cause:** The employee corrections page still uses Supabase to resolve the employee (`supabase.from('employees').select('id')`) before calling the local correction API, so the local DB seeded employee is not found through the page path.
- **Fix plan:** Replace Supabase employee lookup with `/api/employees/me`, submit to `/api/attendance/corrections`, refresh from local API, then rerun the employee corrections functional module.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts --project=employee-chromium tests/employee/corrections-functional.spec.ts`
- **Last tested:** 2026-07-14
- **Notes:** This blocks employee clock-in/out dispute submission.

### BF-0028 - Admin Attendance Correction Approve Does Not Complete

- **Status:** Open
- **Severity:** High
- **Portal:** Admin
- **Module:** Attendance Corrections
- **Route:** `/corrections`
- **Function:** Approve attendance correction request
- **Test file:** `e2e/tests/admin/corrections-functional.spec.ts`
- **Test name:** `F5.1 approves a seeded attendance correction from the admin UI`
- **Expected:** Clicking approve on a pending correction should call the local review endpoint, show `Correction approved`, refresh the list, and update local API status to `approved`.
- **Actual:** The seeded local API correction appears in the admin list, but clicking approve does not show `Correction approved` and the test never reaches an approved status assertion.
- **Evidence:** `e2e/test-results/admin-corrections-function-57bc2-orrection-from-the-admin-UI-chromium-retry2/test-failed-1.png`, related retry trace and error context in the same folder.
- **Likely cause:** The admin corrections page still approves/rejects via Supabase updates even though local API endpoints now exist: `PATCH /api/attendance/corrections/:id/approve` and `/reject`.
- **Fix plan:** Replace Supabase approve/reject handlers with the local PATCH endpoints, preserve rejection reason handling, refresh from `/api/attendance/corrections`, then rerun admin corrections functional tests.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts --project=chromium tests/admin/corrections-functional.spec.ts`
- **Last tested:** 2026-07-14
- **Notes:** This blocks admin attendance dispute review.

Add every failed/skipped/unverified function below using this template.

### BF-0029 - Admin Document Template Create Does Not Submit

- **Status:** Open
- **Severity:** High
- **Portal:** Admin
- **Module:** Documents
- **Route:** `/documents`
- **Function:** Create document template
- **Test file:** `e2e/tests/admin/documents-functional.spec.ts`
- **Test name:** `F21.1 creates a document template from the admin UI`
- **Expected:** Clicking `Save Template` should POST to `/api/document-templates`, show `Template created`, and add the new template to the list.
- **Actual:** Clicking `Save Template` does not trigger the POST request; the modal remains open with no success message.
- **Evidence:** `e2e/test-results/admin-documents-functional-f4632--template-from-the-admin-UI-chromium-retry2/error-context.md`.
- **Likely cause:** The submit button is rendered outside the `<form>` and is not associated with the form, so `handleSaveTemplate` is not invoked.
- **Fix plan:** Move the action buttons into the form or wire `Save Template` to `handleSaveTemplate`, then retest template create and send.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts --project=chromium tests/admin/documents-functional.spec.ts --grep "F21\\.1"`
- **Last tested:** 2026-07-14
- **Notes:** Admin send worked when the template was seeded through the local API.

### BF-0030 - Admin Document Template Edit Does Not Complete

- **Status:** Open
- **Severity:** Medium
- **Portal:** Admin
- **Module:** Documents
- **Route:** `/documents`
- **Function:** Edit document template
- **Test file:** `e2e/tests/admin/documents-functional.spec.ts`
- **Test name:** `F21.3 edits an existing document template from the admin UI`
- **Expected:** Editing an existing template and clicking `Save Template` should persist the update and show a success message.
- **Actual:** The edit modal opens, but clicking `Save Template` shows no success message and does not persist the new template name.
- **Evidence:** `e2e/test-results/admin-documents-functional-b981c--template-from-the-admin-UI-chromium-retry2/error-context.md`.
- **Likely cause:** The frontend explicitly reports that template editing is not supported by the backend, and there is no local API update endpoint for document templates.
- **Fix plan:** Add `PATCH /api/document-templates/:id`, update the admin UI to call it, and retest edit persistence.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts --project=chromium tests/admin/documents-functional.spec.ts --grep "F21\\.3"`
- **Last tested:** 2026-07-14
- **Notes:** This is visible as an edit button in production UI, so it must either work or be removed/disabled.

### BF-0031 - Admin Document Template Delete Does Not Complete

- **Status:** Open
- **Severity:** Medium
- **Portal:** Admin
- **Module:** Documents
- **Route:** `/documents`
- **Function:** Delete document template
- **Test file:** `e2e/tests/admin/documents-functional.spec.ts`
- **Test name:** `F21.4 deletes a document template from the admin UI`
- **Expected:** Confirming delete should remove the template and show `Template deleted`.
- **Actual:** The delete action never shows the success message and the template remains visible.
- **Evidence:** `e2e/test-results/admin-documents-functional-6951e--template-from-the-admin-UI-chromium-retry2/error-context.md`.
- **Likely cause:** The admin UI still deletes through Supabase directly; the local API has no document-template delete endpoint.
- **Fix plan:** Add `DELETE /api/document-templates/:id`, switch the UI to the local API, handle templates with sent documents safely, and retest.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts --project=chromium tests/admin/documents-functional.spec.ts --grep "F21\\.4"`
- **Last tested:** 2026-07-14
- **Notes:** Production has moved away from Supabase for app data, so direct Supabase delete is not acceptable for go-live.

### BF-0032 - Employee Assigned Documents Do Not Display

- **Status:** Open
- **Severity:** High
- **Portal:** Employee
- **Module:** Documents
- **Route:** `/documents`
- **Function:** View assigned document
- **Test file:** `e2e/tests/employee/documents-functional.spec.ts`
- **Test name:** `EF21.1 employee views an assigned document`
- **Expected:** A document assigned to the logged-in seed employee through the local API should appear in `My Documents` and open in the document viewer.
- **Actual:** The employee `/documents` page loads without showing the assigned local-DB document.
- **Evidence:** `e2e/test-results/employee-documents-functio-b28b9--views-an-assigned-document-employee-chromium-retry2/error-context.md`.
- **Likely cause:** Employee document loading is gated by employee auto-link/session state or mismatched employee identity, so local API documents are not surfaced to the logged-in employee.
- **Fix plan:** Align employee auth, `/employees/me`, and document filtering with the local DB employee identity, then retest assigned document visibility.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts --project=employee-chromium tests/employee/documents-functional.spec.ts --grep "EF21\\.1"`
- **Last tested:** 2026-07-14
- **Notes:** This supersedes the earlier smoke-level document route issue with deeper assigned-document evidence.

### BF-0033 - Employee Document Signing Cannot Be Completed

- **Status:** Open
- **Severity:** High
- **Portal:** Employee
- **Module:** Documents
- **Route:** `/documents`
- **Function:** Sign assigned document
- **Test file:** `e2e/tests/employee/documents-functional.spec.ts`
- **Test name:** `EF21.2 employee signs an assigned document`
- **Expected:** The employee should open an assigned pending document, draw a signature, submit it, and see a signed/verified state.
- **Actual:** The assigned document is not visible, so signing cannot start.
- **Evidence:** `e2e/test-results/employee-documents-functio-d54bb--signs-an-assigned-document-employee-chromium-retry2/error-context.md`.
- **Likely cause:** Same visibility/identity problem as BF-0032; after visibility is fixed, the remaining Supabase storage upload in the signing flow must also be replaced with local storage/API handling.
- **Fix plan:** Fix employee document visibility first, then replace signature upload with a local API/storage path and retest the full sign flow.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts --project=employee-chromium tests/employee/documents-functional.spec.ts --grep "EF21\\.2"`
- **Last tested:** 2026-07-14
- **Notes:** Do not mark fixed until the signature is saved and the document status changes to signed.

### BF-0034 - Attendance Report Crashes After Generate

- **Status:** Open
- **Severity:** High
- **Portal:** Admin
- **Module:** Reports
- **Route:** `/reports/attendance`
- **Function:** Generate attendance report
- **Test file:** `e2e/tests/admin/reports-functional.spec.ts`
- **Test name:** `F22 generates /reports/attendance without a report error`
- **Expected:** Selecting `This Month` and clicking `Generate` should render attendance report data or a clean empty state.
- **Actual:** The report API returns, then the page shows `Application error: a client-side exception has occurred`.
- **Evidence:** `e2e/test-results/admin-reports-functional-A-c7613-ance-without-a-report-error-chromium-retry2/error-context.md`.
- **Likely cause:** Client-side report rendering fails after receiving the backend attendance response.
- **Fix plan:** Inspect browser console/trace for the thrown component error, normalize attendance report row/meta shape, and retest generate plus row drill-down.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts --project=chromium tests/admin/reports-functional.spec.ts --grep attendance`
- **Last tested:** 2026-07-14
- **Notes:** This is deeper than the reports hub smoke test.

### BF-0035 - Leave Report Crashes After Generate

- **Status:** Open
- **Severity:** High
- **Portal:** Admin
- **Module:** Reports
- **Route:** `/reports/leave`
- **Function:** Generate leave report
- **Test file:** `e2e/tests/admin/reports-functional.spec.ts`
- **Test name:** `F22 generates /reports/leave without a report error`
- **Expected:** Selecting `This Month` and clicking `Generate` should render leave report data or a clean empty state.
- **Actual:** The report API returns, then the page shows `Application error: a client-side exception has occurred`.
- **Evidence:** `e2e/test-results/admin-reports-functional-A-c6c5e-eave-without-a-report-error-chromium-retry2/error-context.md`.
- **Likely cause:** Client-side report rendering fails after receiving the backend leave response.
- **Fix plan:** Inspect the trace/console exception, align leave report response fields with the table/stat components, and retest.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts --project=chromium tests/admin/reports-functional.spec.ts --grep leave`
- **Last tested:** 2026-07-14
- **Notes:** API status alone is not enough; the page must remain usable after generate.

### BF-0036 - Payroll Report Crashes After Generate

- **Status:** Open
- **Severity:** High
- **Portal:** Admin
- **Module:** Reports
- **Route:** `/reports/payroll`
- **Function:** Generate payroll report
- **Test file:** `e2e/tests/admin/reports-functional.spec.ts`
- **Test name:** `F22 generates /reports/payroll without a report error`
- **Expected:** Selecting `This Month` and clicking `Generate` should render payroll report data or a clean empty state.
- **Actual:** The report API returns, then the page shows `Application error: a client-side exception has occurred`.
- **Evidence:** `e2e/test-results/admin-reports-functional-A-8dc5f-roll-without-a-report-error-chromium-retry2/error-context.md`.
- **Likely cause:** Client-side report rendering fails after receiving the backend payroll response.
- **Fix plan:** Inspect browser console/trace, normalize payroll row values used by stats/table, and retest payroll report generation/export.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts --project=chromium tests/admin/reports-functional.spec.ts --grep payroll`
- **Last tested:** 2026-07-14
- **Notes:** Payroll reporting is a go-live sensitive area.

### BF-0037 - Roster Adherence Report Returns HTTP 500

- **Status:** Open
- **Severity:** High
- **Portal:** Admin
- **Module:** Reports
- **Route:** `/reports/roster`
- **Function:** Generate roster adherence report
- **Test file:** `e2e/tests/admin/reports-functional.spec.ts`
- **Test name:** `F22 generates /reports/roster without a report error`
- **Expected:** Generating the roster adherence report should return `200` and render data or an empty state.
- **Actual:** `/api/reports/adherence` returns HTTP 500 and the page renders `Error: HTTP 500`.
- **Evidence:** `e2e/test-results/admin-reports-functional-A-63f1b-ster-without-a-report-error-chromium-retry1/error-context.md`.
- **Likely cause:** The adherence report route is still using a broken internal/Supabase implementation or an incompatible query.
- **Fix plan:** Migrate adherence reporting to the local API/local DB query path or fix the internal route, then retest generation.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts --project=chromium tests/admin/reports-functional.spec.ts --grep roster`
- **Last tested:** 2026-07-14
- **Notes:** This also affects roster compliance visibility.

### BF-0038 - Overtime Report Returns HTTP 500

- **Status:** Open
- **Severity:** High
- **Portal:** Admin
- **Module:** Reports
- **Route:** `/reports/overtime`
- **Function:** Generate overtime report
- **Test file:** `e2e/tests/admin/reports-functional.spec.ts`
- **Test name:** `F22 generates /reports/overtime without a report error`
- **Expected:** Generating the overtime report should return `200` and render data or an empty state.
- **Actual:** `/api/reports/overtime` returns HTTP 500.
- **Evidence:** `e2e/test-results/admin-reports-functional-A-39328-time-without-a-report-error-chromium-retry2/error-context.md`.
- **Likely cause:** The overtime report route is still using a broken internal/Supabase implementation or an incompatible query.
- **Fix plan:** Migrate overtime reporting to the local API/local DB query path or repair the internal route, then retest.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts --project=chromium tests/admin/reports-functional.spec.ts --grep overtime`
- **Last tested:** 2026-07-14
- **Notes:** Overtime report smoke previously did not exercise generation.

### BF-0039 - Late Arrivals Report Returns HTTP 500

- **Status:** Open
- **Severity:** High
- **Portal:** Admin
- **Module:** Reports
- **Route:** `/reports/late`
- **Function:** Generate late arrivals report
- **Test file:** `e2e/tests/admin/reports-functional.spec.ts`
- **Test name:** `F22 generates /reports/late without a report error`
- **Expected:** Generating the late arrivals report should return `200` and render data or an empty state.
- **Actual:** `/api/reports/late` returns HTTP 500.
- **Evidence:** `e2e/test-results/admin-reports-functional-A-26c07-late-without-a-report-error-chromium-retry2/error-context.md`.
- **Likely cause:** The late arrivals report route is still using a broken internal/Supabase implementation or an incompatible query.
- **Fix plan:** Migrate late reporting to the local API/local DB query path or repair the internal route, then retest.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts --project=chromium tests/admin/reports-functional.spec.ts --grep late`
- **Last tested:** 2026-07-14
- **Notes:** Late arrivals are attendance-adjacent and should be treated as core reporting.

### BF-0040 - Expense Report Returns HTTP 500

- **Status:** Open
- **Severity:** High
- **Portal:** Admin
- **Module:** Reports
- **Route:** `/reports/expense`
- **Function:** Generate expense report
- **Test file:** `e2e/tests/admin/reports-functional.spec.ts`
- **Test name:** `F22 generates /reports/expense without a report error`
- **Expected:** Generating the expense report should return `200` and render data or an empty state.
- **Actual:** `/api/reports/expense` returns HTTP 500.
- **Evidence:** `e2e/test-results/admin-reports-functional-A-261ed-ense-without-a-report-error-chromium-retry2/error-context.md`.
- **Likely cause:** The expense report route is still using a broken internal/Supabase implementation or an incompatible query.
- **Fix plan:** Migrate expense reporting to the local API/local DB query path or repair the internal route, then retest.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts --project=chromium tests/admin/reports-functional.spec.ts --grep expense`
- **Last tested:** 2026-07-14
- **Notes:** Expense report generation is currently not production-ready.

### BF-0041 - Core Settings Save Does Not Persist

- **Status:** Fixed
- **Severity:** High
- **Portal:** Admin
- **Module:** Settings
- **Route:** `/settings`
- **Function:** Save organization/attendance settings
- **Test file:** `e2e/tests/admin/settings-functional.spec.ts`
- **Test name:** `F24.1 saves core organization settings through the local API`
- **Expected:** Changing grace period and clicking `Save Changes` should persist the new value through `/api/organizations/settings`.
- **Actual:** The browser receives an HTTP response, but a follow-up local API read still returns the original `grace_period_minutes`.
- **Evidence:** `e2e/test-results/admin-settings-functional--25ab3-tings-through-the-local-API-chromium-retry2/error-context.md`.
- **Likely cause:** The UI save path returns HTTP 200 without a successful persisted update, likely because the API envelope contains `ok: false` or the payload is not accepted by the settings schema.
- **Fix plan:** Assert and surface API envelope errors in the UI, normalize settings payload types, and retest persistence through a follow-up GET.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts --project=chromium tests/admin/settings-functional.spec.ts --grep "F24\\.1"`
- **Last tested:** 2026-07-15
- **Notes:** Deployed F24.1 retest passed. Numeric policy values are normalized, the grace-period update persists, and the test restores the original value.

### BF-0042 - Leave Approval Chain Save Does Not Complete

- **Status:** Open
- **Severity:** High
- **Portal:** Admin
- **Module:** Settings
- **Route:** `/settings`
- **Function:** Save leave approval chain
- **Test file:** `e2e/tests/admin/settings-functional.spec.ts`
- **Test name:** `F24.2 saves the leave approval chain from settings`
- **Expected:** Clicking `Save Chain` in Leave Policies should persist the approval config and show `Leave approval chain updated`.
- **Actual:** Clicking `Save Chain` does not produce the success state.
- **Evidence:** `e2e/test-results/admin-settings-functional--5c3a0-pproval-chain-from-settings-chromium-retry2/error-context.md`.
- **Likely cause:** This settings path still writes directly through Supabase instead of the local API/local DB migration.
- **Fix plan:** Add local API endpoints for leave approval config, migrate the UI off Supabase, and retest.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts --project=chromium tests/admin/settings-functional.spec.ts --grep "F24\\.2"`
- **Last tested:** 2026-07-14
- **Notes:** Applies to new leave approval routing, so it is go-live sensitive.

### BF-0043 - Branch Create Does Not Complete

- **Status:** Open
- **Severity:** High
- **Portal:** Admin
- **Module:** Settings
- **Route:** `/settings`
- **Function:** Create branch
- **Test file:** `e2e/tests/admin/settings-functional.spec.ts`
- **Test name:** `F24.3 creates a branch from settings`
- **Expected:** Filling required branch fields and clicking `Save Branch` should create the branch and show `Branch created`.
- **Actual:** The modal remains without the success state; the branch is not visible in the list.
- **Evidence:** `e2e/test-results/admin-settings-functional--b9fbb-ates-a-branch-from-settings-chromium-retry2/error-context.md`.
- **Likely cause:** Branch create still uses direct Supabase insert while branch list reads from the local API.
- **Fix plan:** Add local API create/update/delete branch endpoints, switch settings UI to them, and retest branch create/edit/delete.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts --project=chromium tests/admin/settings-functional.spec.ts --grep "F24\\.3"`
- **Last tested:** 2026-07-14
- **Notes:** This blocks managing office/location structure from production UI.

### BF-0044 - Department Create Does Not Complete

- **Status:** Open
- **Severity:** High
- **Portal:** Admin
- **Module:** Settings
- **Route:** `/settings`
- **Function:** Create department
- **Test file:** `e2e/tests/admin/settings-functional.spec.ts`
- **Test name:** `F24.4 creates a department from settings`
- **Expected:** Filling required department fields and clicking `Save Department` should create the department and show `Department created`.
- **Actual:** The modal remains without the success state; the department is not visible in the list.
- **Evidence:** `e2e/test-results/admin-settings-functional--aedca--a-department-from-settings-chromium-retry2/error-context.md`.
- **Likely cause:** Department create still uses direct Supabase insert while department list reads from the local API.
- **Fix plan:** Add local API create/update/delete department endpoints, switch settings UI to them, and retest department create/edit/delete.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts --project=chromium tests/admin/settings-functional.spec.ts --grep "F24\\.4"`
- **Last tested:** 2026-07-14
- **Notes:** This blocks managing organization structure from production UI.

### BF-0045 - Employee Profile Phone Update Cannot Start

- **Status:** Fixed
- **Severity:** High
- **Portal:** Employee
- **Module:** Profile
- **Route:** `/profile`
- **Function:** Update employee profile phone number
- **Test file:** `e2e/tests/employee/profile-functional.spec.ts`
- **Test name:** `EF24.1 employee updates profile phone number from the profile page`
- **Expected:** The employee profile should load, entering edit mode should expose the phone input, saving should PATCH `/api/employees/:id`, and the updated phone should appear.
- **Actual:** The route remains on the centered loading spinner and never renders profile/contact content, so the update flow cannot start.
- **Evidence:** `e2e/test-results/employee-profile-functiona-b4f41-umber-from-the-profile-page-employee-chromium-retry2/error-context.md`, `e2e/test-results/employee-profile-functiona-b4f41-umber-from-the-profile-page-employee-chromium-retry2/test-failed-1.png`.
- **Likely cause:** The profile page still depends on multiple direct Supabase reads after `/employees/me`; one of those legacy calls or the employee auto-link state is leaving the page stuck in loading after the local DB migration.
- **Fix plan:** Migrate profile summary stats, assigned assets, trainings, and pending self-review reads to local API endpoints; add failure-safe empty states so optional sections cannot block the profile shell; then retest phone update persistence.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts --project=employee-chromium tests/employee/profile-functional.spec.ts --grep "EF24\\.1"`
- **Last tested:** 2026-07-15
- **Notes:** Deployed EF24.1 retest passed. Employee identity resolves through `/employees/me`, the profile renders, and the phone update workflow persists successfully.

### BF-0046 - Employee Profile Emergency Contacts Do Not Render

- **Status:** Fixed
- **Severity:** High
- **Portal:** Employee
- **Module:** Profile
- **Route:** `/profile`
- **Function:** Display employee emergency contacts
- **Test file:** `e2e/tests/employee/profile-functional.spec.ts`
- **Test name:** `EF24.2 employee profile displays local emergency contacts`
- **Expected:** A local DB emergency contact created through `/api/employees/:id/emergency-contacts` should appear in the employee profile Emergency Contacts section.
- **Actual:** The route remains on the centered loading spinner and never renders the Emergency Contacts section.
- **Evidence:** `e2e/test-results/employee-profile-functiona-7a605-ys-local-emergency-contacts-employee-chromium-retry2/error-context.md`, `e2e/test-results/employee-profile-functiona-7a605-ys-local-emergency-contacts-employee-chromium-retry2/test-failed-1.png`.
- **Likely cause:** Same profile loading blocker as BF-0045. The emergency contact API can be seeded by the test, but the page does not complete rendering.
- **Fix plan:** Fix BF-0045 profile loading first, verify the local emergency contacts endpoint is called from the employee page, and retest seeded contact visibility.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts --project=employee-chromium tests/employee/profile-functional.spec.ts --grep "EF24\\.2"`
- **Last tested:** 2026-07-15
- **Notes:** Deployed EF24.2 retest passed. Emergency contacts load independently from the local employee API and render after the core profile shell.

### BF-0047 - Employee Calendar Task Create Crashes Page

- **Status:** Open
- **Severity:** High
- **Portal:** Employee
- **Module:** Calendar
- **Route:** `/calendar`
- **Function:** Create personal task from employee calendar
- **Test file:** `e2e/tests/employee/calendar-functional.spec.ts`
- **Test name:** `EF25.1 employee creates a task from the calendar and sees it in My Tasks`
- **Expected:** Creating a task from the Calendar My Tasks panel should POST `/api/employee-tasks`, show `Task created`, close the modal, and display the task in My Tasks.
- **Actual:** After submitting the task form, the page shows `Application error: a client-side exception has occurred`; the expected POST response is not observed before timeout.
- **Evidence:** `e2e/test-results/employee-calendar-function-2b461-dar-and-sees-it-in-My-Tasks-employee-chromium-retry1/error-context.md`, `e2e/test-results/employee-calendar-function-2b461-dar-and-sees-it-in-My-Tasks-employee-chromium-retry1/test-failed-1.png`.
- **Likely cause:** Employee calendar task submit or task list refresh has a client-side runtime exception. The calendar page also has several date/event transforms that should be guarded against unexpected local API response shapes.
- **Fix plan:** Inspect the browser console/trace for the thrown exception, harden employee calendar task submit/list refresh, reload My Tasks after successful create, and retest task creation visibility.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts --project=employee-chromium tests/employee/calendar-functional.spec.ts --grep "EF25\\.1"`
- **Last tested:** 2026-07-14
- **Notes:** The module command timed out after Playwright retries, but artifacts captured the page error.

### BF-0048 - Employee Calendar Pending Task Cannot Be Completed

- **Status:** Open
- **Severity:** High
- **Portal:** Employee
- **Module:** Calendar
- **Route:** `/calendar`
- **Function:** Complete a pending task from My Tasks
- **Test file:** `e2e/tests/employee/calendar-functional.spec.ts`
- **Test name:** `EF25.2 employee completes a pending task from My Tasks`
- **Expected:** A pending task seeded for the logged-in employee should appear in My Tasks; clicking its checkbox should PATCH `/api/employee-tasks/:id/complete`, show `Task completed`, and persist status `completed`.
- **Actual:** The seeded task is not visible because the calendar page renders `Application error: a client-side exception has occurred`; completion cannot start.
- **Evidence:** `e2e/test-results/employee-calendar-function-3a827--pending-task-from-My-Tasks-employee-chromium/error-context.md`, `e2e/test-results/employee-calendar-function-3a827--pending-task-from-My-Tasks-employee-chromium/test-failed-1.png`.
- **Likely cause:** Same employee calendar runtime error as BF-0047 blocks My Tasks rendering. Completion endpoint still needs a clean retest after the page crash is fixed.
- **Fix plan:** Fix BF-0047 first, verify seeded local DB tasks render in My Tasks, then retest task completion and API persistence.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts --project=employee-chromium tests/employee/calendar-functional.spec.ts --grep "EF25\\.2"`
- **Last tested:** 2026-07-14
- **Notes:** The seeded task was cleaned up through the local API after the failed UI check.

### BF-0049 - Employee Availability Save Does Not Complete

- **Status:** Open
- **Severity:** High
- **Portal:** Employee
- **Module:** Roster
- **Route:** `/roster`
- **Function:** Add and remove employee availability slot
- **Test file:** `e2e/tests/employee/roster-functional.spec.ts`
- **Test name:** `EF26.1 employee adds and removes an availability slot`
- **Expected:** Filling the My Availability form and clicking Save should persist the availability slot, show `Availability updated`, render the new time range, and allow removal.
- **Actual:** After Save, no success toast appears, the form remains open, and the new slot does not render.
- **Evidence:** `e2e/test-results/employee-roster-functional-0f1b0-emoves-an-availability-slot-employee-chromium-retry2/error-context.md`, `e2e/test-results/employee-roster-functional-0f1b0-emoves-an-availability-slot-employee-chromium-retry2/test-failed-1.png`.
- **Likely cause:** Employee availability still reads/writes directly through Supabase (`employee_availability`) instead of a local API/local DB endpoint, so production local-DB-only availability management is not completing.
- **Fix plan:** Add local API endpoints for employee availability create/list/delete, migrate `AvailabilitySetter` off Supabase, surface API errors, and retest add/remove.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts --project=employee-chromium tests/employee/roster-functional.spec.ts`
- **Last tested:** 2026-07-14
- **Notes:** The delete half of the workflow could not be reached because create did not complete.

### BF-0050 - Payroll Process Page Crashes

- **Status:** Open
- **Severity:** High
- **Portal:** Admin
- **Module:** Payroll
- **Route:** `/payroll/:id/process`
- **Function:** Process payroll run and show calculated payroll items
- **Test file:** `e2e/tests/admin/payroll-functional.spec.ts`
- **Test name:** `F15.2 processes a payroll run and shows calculated payroll items`
- **Expected:** Opening a draft payroll run's process page should show `Process Payroll`, clicking `Start Processing` should POST `/api/payroll/runs/:id/process`, show success, and render calculated payroll items.
- **Actual:** Opening the process route renders `Application error: a client-side exception has occurred`; the process button is never available.
- **Evidence:** `e2e/test-results/admin-payroll-functional-A-6f335-ws-calculated-payroll-items-chromium-retry2/error-context.md`, `e2e/test-results/admin-payroll-functional-A-6f335-ws-calculated-payroll-items-chromium-retry2/test-failed-1.png`.
- **Likely cause:** Client-side payroll process page crash when loading a local DB payroll run, likely due to an unguarded run/employee response shape or a route component runtime exception.
- **Fix plan:** Inspect the browser console/trace for the thrown exception, harden payroll process page data loading, verify active employee list handling, and retest processing plus item rendering.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts --project=chromium tests/admin/payroll-functional.spec.ts --grep "F15\\.2"`
- **Last tested:** 2026-07-14
- **Notes:** The test seeded a unique future payroll run through the local API to avoid duplicate current-month production state.

### BF-0051 - Employee Self Performance Review Cannot Be Submitted

- **Status:** Fixed
- **Severity:** High
- **Portal:** Employee
- **Module:** Performance
- **Route:** `/profile`
- **Function:** Submit pending self performance review
- **Test file:** `e2e/tests/employee/performance-functional.spec.ts`
- **Test name:** `EF27.1 employee submits a pending self performance review`
- **Expected:** A local DB performance review with status `pending_self` should appear on the employee profile as `Self Review Pending`; the employee should submit rating/comments and the review should move to `pending_manager`.
- **Actual:** The self-review prompt never appears; the profile page does not render the pending review flow.
- **Evidence:** `e2e/test-results/employee-performance-funct-e15f4-ing-self-performance-review-employee-chromium-retry2/error-context.md`, `e2e/test-results/employee-performance-funct-e15f4-ing-self-performance-review-employee-chromium-retry2/test-failed-1.png`.
- **Likely cause:** Employee profile still reads pending reviews directly from Supabase instead of `/api/performance/reviews/employee/:id` or a dedicated local API endpoint; it is also affected by the broader profile loading blocker in BF-0045.
- **Fix plan:** Migrate pending self-review lookup and submit action to the local performance API (`POST /performance/reviews/:id/self`), ensure profile loads with optional review data, and retest self-review status transition.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts --project=employee-chromium tests/employee/performance-functional.spec.ts`
- **Last tested:** 2026-07-15
- **Notes:** Deployed EF27.1 retest passed. Pending reviews load, the dialog stays above mobile navigation, submission succeeds, and the review advances to `pending_manager`.

### BF-0052 - Employee Attendance Page Is Flaky And Renders No Content

- **Status:** Open
- **Severity:** Medium
- **Portal:** Employee
- **Module:** Attendance
- **Route:** `/attendance`
- **Function:** Employee attendance page load
- **Test file:** `e2e/tests/employee/pages.spec.ts`
- **Test name:** `E2 page loads: /attendance`
- **Expected:** The attendance page should render attendance, history, or clock content within 15 seconds.
- **Actual:** The first attempt rendered only the notification region and alert; the retry passed in 2.4 seconds.
- **Evidence:** `e2e/test-results/employee-pages-Employee-pr-d46f0-es-E2-page-loads-attendance-employee-chromium/error-context.md`, screenshot and video in the same directory.
- **Likely cause:** A transient client render or data-loading failure; the page did not redirect to login.
- **Fix plan:** Inspect attendance page initialization and API timing, add an explicit durable error/empty state, and rerun without retries.
- **Owner:** Unassigned
- **Retest command:** `npx playwright test --config=e2e/playwright.config.ts --project=employee-chromium tests/employee/pages.spec.ts --grep attendance`
- **Last tested:** 2026-07-15
- **Notes:** Classified as flaky because the Playwright retry passed; still tracked because a blank page is a production risk.

## Run History

| Date | Environment | Command | Result | Report/Artifact | Notes |
| --- | --- | --- | --- | --- | --- |
| 2026-07-14 | Production TouchOrbit | `npm run e2e:seed` | Failed | `e2e/test-results/auth.setup.ts-authenticate-as-admin-setup-retry2/` | Admin login reached `/` but dashboard session was not usable; seed did not run. |
| 2026-07-14 | Production TouchOrbit | `npm run e2e:seed` | Passed | Playwright list output | Auth setup and seed setup passed. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts tests/admin/login.spec.ts tests/admin/auth.spec.ts` | Failed | `e2e/test-results/admin-login-Authentication-bf307-ogin-redirects-to-dashboard-chromium-no-auth-retry2/`, `e2e/test-results/admin-login-Authentication-cfa71-to-login-and-clears-session-chromium-no-auth-retry2/` | Module 1: 11 passed, 2 failed. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts tests/admin/dashboard.spec.ts` | Failed | `e2e/test-results/admin-dashboard-Dashboard-2-6-remove-widget-from-dashboard-chromium-retry2/` | Module 2: 12 passed, 1 failed. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts tests/admin/employees.spec.ts` | Failed | `e2e/test-results/admin-employees-Employees-3-13-employee-detail-page-loads-chromium-retry2/` | Module 3 retest after selector fixes: 13 passed, 1 failed. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts tests/admin/org-chart.spec.ts` | Passed | Playwright output | Module 4: 4 passed, 0 failed. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts tests/admin/attendance.spec.ts` | Passed | Playwright output | Module 5: 4 passed, 0 failed. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts tests/admin/leave.spec.ts` | Passed | Playwright output | Module 6: 4 passed, 0 failed. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts tests/admin/overtime.spec.ts` | Passed | Playwright output | Module 7: 6 passed, 0 failed. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts tests/admin/expenses.spec.ts` | Passed | Playwright output | Module 8: 4 passed, 0 failed. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts tests/admin/assets.spec.ts` | Passed | Playwright output | Module 9: 4 passed, 0 failed. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts tests/admin/documents.spec.ts` | Passed | Playwright output | Module 10: 4 passed, 0 failed. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts tests/admin/calendar.spec.ts` | Passed | Playwright output | Module 11: 4 passed, 0 failed. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts tests/admin/roster.spec.ts` | Passed | Playwright output | Module 12: 5 passed, 0 failed. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts tests/admin/training.spec.ts` | Passed | Playwright output | Module 13: 4 passed, 0 failed. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts tests/admin/performance.spec.ts` | Passed | Playwright output | Module 14: 4 passed, 0 failed. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts tests/admin/payroll.spec.ts` | Passed | Playwright output | Module 15: 4 passed, 0 failed. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts tests/admin/reports.spec.ts` | Passed | Playwright output | Module 16: 4 passed, 0 failed. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts tests/admin/requests.spec.ts` | Passed | Playwright output | Module 17: 4 passed, 0 failed. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts tests/admin/announcements.spec.ts` | Passed | Playwright output | Module 18: 4 passed, 0 failed. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts tests/admin/settings.spec.ts` | Passed | Playwright output | Module 19: 4 passed, 0 failed. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts tests/admin/geofences.spec.ts` | Passed | Playwright output | Module 20: 4 passed, 0 failed. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts tests/admin/notifications.spec.ts` | Passed | Playwright output | Module 21: 4 passed, 0 failed. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts tests/admin/audit.spec.ts` | Passed | Playwright output | Module 22: 4 passed, 0 failed. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts --project=employee-chromium tests/employee/login.spec.ts` | Passed | Playwright output | Employee Module E1: 5 passed, 0 failed. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts --project=employee-chromium tests/employee/pages.spec.ts` | Failed | `e2e/test-results/employee-pages-Employee-pr-cce21-ges-E2-page-loads-documents-employee-chromium-retry2/`, `e2e/test-results/employee-pages-Employee-pr-4dcd0-ges-E2-page-loads-org-chart-employee-chromium-retry2/`, `e2e/test-results/employee-pages-Employee-pr-13c84-ages-E2-page-loads-payslips-employee-chromium-retry1/` | Employee Module E2: 18 passed, 2 failed, 1 flaky. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts tests/admin/employees-functional.spec.ts` | Failed | `e2e/test-results/admin-employees-functional-4eb3f-og-and-finds-it-in-the-list-chromium-retry2/` | Employees functional module: 3 passed, 1 failed. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts --project=employee-chromium tests/employee/leave-functional.spec.ts` | Failed | `e2e/test-results/employee-leave-functional--e943a-ave-request-from-the-portal-employee-chromium-retry2/` | Employee Leave functional module: 4 passed, 1 failed. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts tests/admin/leave-functional.spec.ts` | Failed | `e2e/test-results/admin-leave-functional-Adm-1ea23-e-request-from-the-admin-UI-chromium-retry2/`, `e2e/test-results/admin-leave-functional-Adm-b3761-e-request-from-the-admin-UI-chromium-retry2/` | Admin Leave functional module: 3 passed, 2 failed. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts tests/admin/announcements-functional.spec.ts` | Failed | `e2e/test-results/admin-announcements-functi-c37e0-deletes-an-E2E-announcement-chromium-retry2/` | Announcements functional module: 3 passed, 1 failed. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts tests/admin/assets-functional.spec.ts` | Passed | Playwright output | Assets functional module: category create, asset create, edit, and delete passed. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts tests/admin/geofences-functional.spec.ts` | Failed | `e2e/test-results/admin-geofences-functional-6ee59-and-deletes-an-E2E-geofence-chromium/` | Geofences functional module: 3 passed, 1 failed. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts --project=employee-chromium tests/employee/requests-functional.spec.ts` | Failed | `e2e/test-results/employee-requests-function-ac041--submits-a-comp-off-request-employee-chromium-retry2/`, `e2e/test-results/employee-requests-function-b3083-bmits-an-encashment-request-employee-chromium-retry2/` | Employee requests functional module: 3 passed, 2 failed. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts tests/admin/comp-off-functional.spec.ts` | Passed | Playwright output | Admin Comp-Off functional module: approve and reject passed; filter issue recorded separately as BF-0017. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts tests/admin/encashment-functional.spec.ts` | Failed | Playwright output | Admin Encashment functional module blocked during setup by leave balance adjustment API 500. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts tests/admin/expenses-functional.spec.ts` | Failed | `e2e/test-results/admin-expenses-functional--56399-its-an-E2E-expense-category-chromium-retry2/` | Admin Expenses functional module: category create/edit failed. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts --project=employee-chromium tests/employee/expenses-functional.spec.ts` | Failed | `e2e/test-results/employee-expenses-function-04cb7-ee-submits-an-expense-claim-employee-chromium-retry2/` | Employee Expenses functional module: claim submission blocked by missing category options. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts tests/admin/calendar-functional.spec.ts` | Failed | `e2e/test-results/admin-calendar-functional--72b6e-rom-the-calendar-task-panel-chromium-retry2/` | Calendar functional module: task create failed. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts --project=chromium tests/admin/overtime-functional.spec.ts` | Failed | `e2e/test-results/admin-overtime-functional--282a5-me-record-from-the-admin-UI-chromium-retry2/` | Admin Overtime functional module: manual entry blocked because employee options do not load. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts --project=employee-chromium tests/employee/overtime-functional.spec.ts` | Failed | `e2e/test-results/employee-overtime-function-3ec6e-submits-an-overtime-request-employee-chromium-retry2/` | Employee Overtime functional module: request submit does not complete. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts --project=chromium tests/admin/shifts-functional.spec.ts` | Passed | Playwright output | Shift Templates functional module: create, edit, and delete passed. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts --project=chromium tests/admin/shifts-functional.spec.ts` | Failed | `e2e/test-results/admin-shifts-functional-Ad-af2d2-ve-status-from-the-admin-UI-chromium-retry2/` | Shift Templates functional module: status toggle failed; CRUD still passed. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts --project=chromium tests/admin/training-functional.spec.ts` | Passed | Playwright output | Admin Training functional module: program create and edit passed with API cleanup. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts --project=employee-chromium tests/employee/training-functional.spec.ts` | Failed | `e2e/test-results/employee-training-function-f5743-tes-a-personal-training-log-employee-chromium-retry2/` | Employee Training functional module: personal log create passed; edit did not complete. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts --project=chromium tests/admin/roster-functional.spec.ts` | Failed | `e2e/test-results/admin-roster-functional-Ad-1ec7c--roster-shift-from-the-grid-chromium-retry2/` | Admin Roster functional module: seeded local DB employee did not appear in the grid, blocking assignment/clear coverage. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts --project=employee-chromium tests/employee/corrections-functional.spec.ts` | Failed | `e2e/test-results/employee-corrections-funct-0b549-tendance-correction-request-employee-chromium-retry2/` | Employee Attendance Corrections functional module: submit did not complete. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts --project=chromium tests/admin/corrections-functional.spec.ts` | Failed | `e2e/test-results/admin-corrections-function-57bc2-orrection-from-the-admin-UI-chromium-retry2/` | Admin Attendance Corrections functional module: approve did not complete. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts --project=chromium tests/admin/payroll-functional.spec.ts` | Passed | Playwright output | Payroll functional module: salary component create passed; no UI cleanup/delete function exists for components. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts --project=chromium tests/admin/performance-functional.spec.ts` | Passed | Playwright output | Performance functional module: employee goal assignment passed with API cleanup. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts --project=chromium tests/admin/documents-functional.spec.ts --grep "F21\\.2"` | Passed | Playwright output | Admin Documents functional module: seeded template send to seed employee passed with API cleanup. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts --project=chromium tests/admin/documents-functional.spec.ts --grep "F21\\.3"` | Failed | `e2e/test-results/admin-documents-functional-b981c--template-from-the-admin-UI-chromium-retry2/` | Admin Documents functional module: template edit did not complete. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts --project=chromium tests/admin/documents-functional.spec.ts --grep "F21\\.4"` | Failed | `e2e/test-results/admin-documents-functional-6951e--template-from-the-admin-UI-chromium-retry2/` | Admin Documents functional module: template delete did not complete. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts --project=employee-chromium tests/employee/documents-functional.spec.ts` | Failed | `e2e/test-results/employee-documents-functio-b28b9--views-an-assigned-document-employee-chromium-retry2/`, `e2e/test-results/employee-documents-functio-d54bb--signs-an-assigned-document-employee-chromium-retry2/` | Employee Documents functional module: assigned document visibility and signing failed. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts --project=chromium tests/admin/reports-functional.spec.ts` | Failed | `e2e/test-results/admin-reports-functional-A-c7613-ance-without-a-report-error-chromium-retry2/`, `e2e/test-results/admin-reports-functional-A-c6c5e-eave-without-a-report-error-chromium-retry2/`, `e2e/test-results/admin-reports-functional-A-8dc5f-roll-without-a-report-error-chromium-retry2/`, `e2e/test-results/admin-reports-functional-A-63f1b-ster-without-a-report-error-chromium-retry1/` | Reports functional module: attendance/leave/payroll crashed after generate; roster adherence returned HTTP 500 before full run timed out. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts --project=chromium tests/admin/reports-functional.spec.ts --grep overtime` | Failed | `e2e/test-results/admin-reports-functional-A-39328-time-without-a-report-error-chromium-retry2/` | Reports functional module: overtime report returned HTTP 500. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts --project=chromium tests/admin/reports-functional.spec.ts --grep late` | Failed | `e2e/test-results/admin-reports-functional-A-26c07-late-without-a-report-error-chromium-retry2/` | Reports functional module: late arrivals report returned HTTP 500. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts --project=chromium tests/admin/reports-functional.spec.ts --grep expense` | Failed | `e2e/test-results/admin-reports-functional-A-261ed-ense-without-a-report-error-chromium-retry2/` | Reports functional module: expense report returned HTTP 500. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts --project=chromium tests/admin/notifications-functional.spec.ts` | Passed | Playwright output | Admin Notifications functional module: mark-all-read and delete-read-notification passed. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts --project=chromium tests/admin/settings-functional.spec.ts --grep "F24\\.1"` | Failed | `e2e/test-results/admin-settings-functional--25ab3-tings-through-the-local-API-chromium-retry2/` | Settings functional module: core settings PATCH did not persist changed grace period. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts --project=chromium tests/admin/settings-functional.spec.ts --grep "F24\\.2"` | Failed | `e2e/test-results/admin-settings-functional--5c3a0-pproval-chain-from-settings-chromium-retry2/` | Settings functional module: leave approval-chain save did not complete. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts --project=chromium tests/admin/settings-functional.spec.ts --grep "F24\\.3"` | Failed | `e2e/test-results/admin-settings-functional--b9fbb-ates-a-branch-from-settings-chromium-retry2/` | Settings functional module: branch create did not complete. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts --project=chromium tests/admin/settings-functional.spec.ts --grep "F24\\.4"` | Failed | `e2e/test-results/admin-settings-functional--aedca--a-department-from-settings-chromium-retry2/` | Settings functional module: department create did not complete. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts --project=employee-chromium tests/employee/profile-functional.spec.ts` | Failed | `e2e/test-results/employee-profile-functiona-b4f41-umber-from-the-profile-page-employee-chromium-retry2/`, `e2e/test-results/employee-profile-functiona-7a605-ys-local-emergency-contacts-employee-chromium-retry2/` | Employee Profile functional module: phone update and emergency-contact display blocked by profile loading spinner. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts --project=employee-chromium tests/employee/calendar-functional.spec.ts` | Failed | `e2e/test-results/employee-calendar-function-2b461-dar-and-sees-it-in-My-Tasks-employee-chromium-retry1/`, `e2e/test-results/employee-calendar-function-3a827--pending-task-from-My-Tasks-employee-chromium/` | Employee Calendar functional module: task create crashed page; seeded pending task could not be completed because page was in application-error state. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts --project=employee-chromium tests/employee/roster-functional.spec.ts` | Failed | `e2e/test-results/employee-roster-functional-0f1b0-emoves-an-availability-slot-employee-chromium-retry2/` | Employee Roster functional module: availability save did not complete. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts --project=chromium tests/admin/payroll-functional.spec.ts --grep "F15\\.2"` | Failed | `e2e/test-results/admin-payroll-functional-A-6f335-ws-calculated-payroll-items-chromium-retry2/` | Payroll functional module: process page crashed before Start Processing was available. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts --project=chromium tests/admin/performance-functional.spec.ts --grep "F14\\.2"` | Passed | Playwright output | Performance functional module: review cycle create passed after test selector was aligned to the actual modal title. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts --project=employee-chromium tests/employee/performance-functional.spec.ts` | Failed | `e2e/test-results/employee-performance-funct-e15f4-ing-self-performance-review-employee-chromium-retry2/` | Employee Performance functional module: seeded pending self-review was not visible/submittable from profile. |
| 2026-07-14 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts --project=employee-chromium tests/employee/notifications-functional.spec.ts` | Passed | Playwright output | Employee Notifications functional module: mark-read and delete-read-notification passed. |
| 2026-07-15 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts tests/admin/login.spec.ts tests/admin/auth.spec.ts` | Failed | `e2e/test-results/admin-login-Authentication-bf307-ogin-redirects-to-dashboard-chromium-no-auth-retry2/`, `e2e/test-results/admin-login-Authentication-cfa71-to-login-and-clears-session-chromium-no-auth-retry2/` | Pre-deployment Phase 1 retest: 11 passed, 2 failed on the unchanged production deployment. Local admin and employee auth patches pass TypeScript checks and production builds; BF-0002/BF-0003 remain open pending deployment. |
| 2026-07-15 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts tests/admin/login.spec.ts tests/admin/auth.spec.ts` | Failed | `e2e/test-results/admin-login-Authentication-cfa71-to-login-and-clears-session-chromium-no-auth-retry2/` | Post-deployment Phase 1 admin retest: 12 passed, 1 failed. BF-0002 is fixed; BF-0003 now reaches logout but leaves a host-only session cookie. |
| 2026-07-15 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts --project=employee-chromium tests/employee/pages.spec.ts` | Failed | `e2e/test-results/employee-pages-Employee-pr-4dcd0-ges-E2-page-loads-org-chart-employee-chromium-retry2/`, `e2e/test-results/employee-pages-Employee-pr-d46f0-es-E2-page-loads-attendance-employee-chromium/` | Phase 1 targets `/documents` and `/payslips` passed without retry, fixing BF-0006/BF-0008. BF-0007 remains open; attendance was flaky and is tracked as BF-0052. |
| 2026-07-15 | Production TouchOrbit | `npx playwright test --config=e2e/playwright.config.ts tests/admin/login.spec.ts --grep 1.5` | Passed | Playwright list output | Canonical-domain logout fix passed; BF-0003 is fixed and Phase 1 exit criteria are complete. |

## Open Items By Portal

### Admin Portal

- BF-0004 - Dashboard widget remove does not persist or hide removed widget.
- BF-0005 - Employee detail page stays on Loading Profile.
- BF-0009 - Admin Add Employee submit does not complete.
- BF-0011 - Admin leave approve calls missing endpoint.
- BF-0012 - Admin leave reject calls missing endpoint.
- BF-0013 - Admin announcement create does not complete.
- BF-0014 - Admin geofence create causes client-side exception.
- BF-0017 - Admin comp-off pending filter shows approved rows.
- BF-0018 - Leave balance adjustment API fails with parameter type error.
- BF-0019 - Admin expense category create does not complete.
- BF-0021 - Admin calendar task create does not complete.
- BF-0022 - Admin manual overtime entry has no employee options.
- BF-0024 - Admin shift template status toggle does not complete.
- BF-0026 - Admin roster grid does not show local DB seed employee.
- BF-0028 - Admin attendance correction approve does not complete.
- BF-0029 - Admin document template create does not submit.
- BF-0030 - Admin document template edit does not complete.
- BF-0031 - Admin document template delete does not complete.
- BF-0034 - Attendance report crashes after generate.
- BF-0035 - Leave report crashes after generate.
- BF-0036 - Payroll report crashes after generate.
- BF-0037 - Roster adherence report returns HTTP 500.
- BF-0038 - Overtime report returns HTTP 500.
- BF-0039 - Late arrivals report returns HTTP 500.
- BF-0040 - Expense report returns HTTP 500.
- BF-0041 - Core settings save does not persist.
- BF-0042 - Leave approval chain save does not complete.
- BF-0043 - Branch create does not complete.
- BF-0044 - Department create does not complete.
- BF-0050 - Payroll process page crashes.

### Employee Portal

- BF-0007 - Employee org chart shows skeleton without content.
- BF-0010 - Employee leave submit does not complete.
- BF-0015 - Employee comp-off submit does not complete.
- BF-0016 - Employee encashment submit does not complete.
- BF-0020 - Employee expense claim has no category options.
- BF-0023 - Employee overtime submit does not complete.
- BF-0025 - Employee personal training edit does not complete.
- BF-0027 - Employee attendance correction submit does not complete.
- BF-0032 - Employee assigned documents do not display.
- BF-0033 - Employee document signing cannot be completed.
- BF-0045 - Employee profile phone update cannot start.
- BF-0046 - Employee profile emergency contacts do not render.
- BF-0047 - Employee calendar task create crashes page.
- BF-0048 - Employee calendar pending task cannot be completed.
- BF-0049 - Employee availability save does not complete.
- BF-0051 - Employee self performance review cannot be submitted.
- BF-0052 - Employee attendance page is flaky and renders no content.

### Cross-Portal Workflows

No broken cross-portal workflows recorded yet.

## Rules For Updating This Report

1. Every failed E2E test gets a `BF-####` entry.
2. Every skipped test gets a `BF-####` entry unless the skip is temporary and already linked to a fixed test-data setup.
3. Every manual blocker found during testing gets a `BF-####` entry.
4. A function can move to `Fixed` only after a retest passes.
5. Do not delete fixed entries until after go-live; they are release evidence.
6. Do not mark production ready with open Critical or High items.
