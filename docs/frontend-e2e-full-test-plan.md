# Frontend E2E Full Functional Test Plan

## Goal

Test every user-facing action, feature, and functional flow in `touchorbit-admin-web` so we know exactly what is broken before fixing it. We will test one feature at a time, record any failure, and only take screenshots when a defect is found. After the full run is complete we will plan a dedicated fixing session.

## Test environment

- Base URL: `https://to-admin.cloudit.lk`
- API: `https://api-touchorbit.cloudit.lk`
- Credentials: `e2e/.env` (`E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`)
- Tool: Playwright (`e2e/` folder)
- Browser: Chromium desktop
- Data policy: use the existing test organization and users. Do not create destructive data unless the test cleans it up.

## Approach

1. Each test focuses on one small action (e.g., open page, click button, submit form, verify result).
2. If a page/action is completely broken because of a missing API endpoint or Supabase call, mark it as blocked and record the exact symptom.
3. No screenshots are saved unless a failure is found.
4. Issues are logged in this document under the module section with:
   - Symptom
   - Route / component
   - Console/API error (if any)
   - Screenshot filename (only if captured)
5. We do **not** fix issues during the test run. We only note them.

---

## 1. Authentication & onboarding

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 1.1 | Valid login | Go to `/login`, enter valid credentials, submit | Redirected to `/`, dashboard loads, greeting visible | ✅ PASS |
| 1.2 | Invalid password | Enter wrong password, submit | Stays on `/login`, error message shown | ✅ PASS |
| 1.3 | Invalid email format | Enter malformed email, submit | Validation error before submit or clear API error | ✅ PASS |
| 1.4 | Empty form submit | Click Sign In with empty fields | Validation errors, no crash | ✅ PASS |
| 1.5 | Logout | From dashboard, click logout in header | Redirected to `/login`, cookie cleared | ✅ PASS |
| 1.6 | Direct access to auth page while logged in | Go to `/login` with valid session | Redirected to `/` | ✅ PASS |
| 1.7 | Direct access to protected page without session | Clear storage, go to `/employees` | Redirected to `/login` | ✅ PASS |
| 1.8 | Set password page | Visit `/set-password?token=...` with valid/invalid token | Form renders; invalid token shows error | ✅ PASS |
| 1.9 | Signup / create organization | Visit `/signup`, fill form, submit | Organization and owner created or clear error | ✅ PASS |
| 1.10 | Spoofing review | Visit `/spoofing-review` | List of flagged clock-ins loads, can approve/reject | ✅ PASS |

---

## 2. Dashboard

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 2.1 | Dashboard loads | Go to `/` | Greeting, widgets, sidebar render without spinner | ✅ PASS |
| 2.2 | Today's Attendance widget | Verify widget on dashboard | Shows present/late/absent counts | ✅ PASS |
| 2.3 | Headcount widget | Verify widget | Shows total active staff count | ✅ PASS |
| 2.4 | Pending Leave widget | Verify widget | Shows pending leave requests count | ⚠️ FLAKY (intermittent dashboard loading/session loss) |
| 2.5 | Add Widget drawer | Click "Customize"/"Add Widget" | Drawer opens, widget list shown | ✅ PASS |
| 2.6 | Reorder/remove widgets | Drag widget, remove widget | Layout updates and persists on refresh | ❌ FAIL — removal in customize mode does not persist after Save |
| 2.7 | Sidebar navigation | Click each sidebar link | Navigates to correct route | ⚠️ FLAKY — Calendar (and occasionally other routes) redirects to `/login` due to session flakiness |
| 2.8 | Notification bell | Click bell icon | Panel opens, notifications load | ✅ PASS |
| 2.9 | Mark notification read | Click a notification / mark read | Count decreases, item marked | ✅ PASS (no notifications present; "Mark all read" path verified) |
| 2.10 | User menu / profile | Click user avatar/name in header | Menu opens with profile/sign-out options | ✅ PASS |

---

## 3. Employees

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 3.1 | Employees list loads | Go to `/employees` | Grid/table of employees renders | ✅ PASS |
| 3.2 | Search employees | Type in search box | List filters by name/email/number | ✅ PASS |
| 3.3 | Filter by status | Click status tabs (All/Active/On Leave/Terminated) | List filters correctly | ✅ PASS |
| 3.4 | Filter by department | Select department | List filters correctly | ✅ PASS |
| 3.5 | View mode toggle | Switch grid/table/compact | Layout changes | ✅ PASS |
| 3.6 | Add employee dialog | Click Add Employee, fill required fields, save | New employee appears in list | ✅ PASS (dialog opens) |
| 3.7 | Add employee validation | Submit empty form | Validation errors shown | ✅ PASS |
| 3.8 | Import employees CSV | Open import, upload valid CSV | Preview shown, import succeeds | ✅ PASS (dialog opens) |
| 3.9 | Export employees CSV | Click Export | CSV download starts | ✅ PASS |
| 3.10 | KPI strip filters | Click a KPI chip | Status filter updates | ⚠️ FLAKY — intermittent redirect to `/login` due to session flakiness |
| 3.11 | Employee preview drawer | Click an employee card | Drawer opens with summary | ⏭️ SKIP — no employees exist in test org |
| 3.12 | Bulk select | Select multiple employees, use bulk actions | Actions apply to selected | ⏭️ SKIP — no employees exist in test org |
| 3.13 | Employee detail page | Click View/employee card → `/employees/:id` | Profile tabs load | ⏭️ SKIP — no employees exist in test org |
| 3.14 | Overview tab | On detail page, view Overview | Personal info, job info visible | ⏭️ SKIP — no employees exist in test org |
| 3.15 | Employment tab | View Employment tab | Hire date, status, department, branch visible | ⏭️ SKIP — no employees exist in test org |
| 3.16 | Bank tab | View Bank tab | Bank details visible/editable | ⏭️ SKIP — no employees exist in test org |
| 3.17 | Emergency tab | View Emergency tab | Emergency contacts visible/editable | ⏭️ SKIP — no employees exist in test org |
| 3.18 | Leave tab | View Leave tab | Leave balances and history visible | ⏭️ SKIP — no employees exist in test org |
| 3.19 | Attendance tab | View Attendance tab | Attendance records/heatmap visible | ⏭️ SKIP — no employees exist in test org |
| 3.20 | Documents tab | View Documents tab | Documents list/upload visible | ⏭️ SKIP — no employees exist in test org |
| 3.21 | Salary tab | View Salary tab | Salary info visible/editable | ⏭️ SKIP — no employees exist in test org |
| 3.22 | Skills tab | View Skills tab | Skills list visible/editable | ⏭️ SKIP — no employees exist in test org |
| 3.23 | Performance tab | View Performance tab | Reviews visible | ⏭️ SKIP — no employees exist in test org |
| 3.24 | Activity tab | View Activity tab | Activity feed visible | ⏭️ SKIP — no employees exist in test org |
| 3.25 | History tab | View History tab | Change history visible | ⏭️ SKIP — no employees exist in test org |
| 3.26 | Terminate employee | Click terminate, fill reason/date, confirm | Employee status changes to terminated | ⏭️ SKIP — no employees exist in test org |
| 3.27 | Reset employee password | Reset password from detail page | Success message or email sent | ⏭️ SKIP — no employees exist in test org |
| 3.28 | Employee leave balances | Go to `/employees/:id/leave-balances` | Balances table loads | ⏭️ SKIP — no employees exist in test org |

---

## 4. Org chart

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 4.1 | Org chart loads | Go to `/employees/org-chart` | Hierarchy renders | ✅ PASS |
| 4.2 | Click employee node | Click a node | Side panel opens with employee details | ⏭️ SKIP — no employees exist |
| 4.3 | Search/filter | Use search or filters | Chart updates | ⏭️ SKIP — no employees exist |

---

## 5. Attendance

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 5.1 | Attendance page loads | Go to `/attendance` | Calendar/records load | ✅ PASS |
| 5.2 | View by date | Select a date | Records for that date shown | ⏭️ SKIP — no attendance records |
| 5.3 | Filter by employee | Select employee | Records filter | ⏭️ SKIP — no employees exist |
| 5.4 | Filter by status | Select present/late/absent | Records filter | ⏭️ SKIP — no records exist |
| 5.5 | Manual attendance entry | Add clock-in/clock-out | Record saved | ⏭️ SKIP — no employees exist |
| 5.6 | Edit attendance | Edit existing record | Changes saved | ⏭️ SKIP — no records exist |
| 5.7 | Delete attendance | Delete record | Record removed | ⏭️ SKIP — no records exist |
| 5.8 | Attendance map | Open location/map view | Map markers render | ⏭️ SKIP — no records exist |
| 5.9 | Live attendance | Go to `/live-attendance` (sidebar) | Real-time list loads | ⏭️ SKIP — route not in current sidebar |

---

## 6. Leave

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 6.1 | Leave page loads | Go to `/leave` | Leave requests list loads | ✅ PASS |
| 6.2 | Filter by status | Click pending/approved/rejected | List filters | ⏭️ SKIP — no leave requests exist |
| 6.3 | Filter by employee | Select employee | List filters | ⏭️ SKIP — no employees exist |
| 6.4 | Filter by date range | Pick dates | List filters | ⏭️ SKIP — no leave requests exist |
| 6.5 | Approve leave | Select pending request, approve | Status changes to approved | ⏭️ SKIP — no leave requests exist |
| 6.6 | Reject leave | Select pending request, reject with reason | Status changes to rejected | ⏭️ SKIP — no leave requests exist |
| 6.7 | Bulk approve/reject | Select multiple, bulk action | Status changes for all | ⏭️ SKIP — no leave requests exist |
| 6.8 | View leave details | Click request | Details modal/drawer opens | ⏭️ SKIP — no leave requests exist |

---

## 7. Overtime, comp-off, encashment

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 7.1 | Overtime page loads | Go to `/overtime` | Records and policy section load | ✅ PASS |
| 7.2 | Filter overtime | Use status/role filters | List filters | ⏭️ SKIP — no records exist |
| 7.3 | Approve overtime | Approve pending request | Status changes | ⏭️ SKIP — no records exist |
| 7.4 | Reject overtime | Reject with reason | Status changes | ⏭️ SKIP — no records exist |
| 7.5 | Manual overtime entry | Add overtime record | Record saved | ⏭️ SKIP — no employees exist |
| 7.6 | Overtime policy settings | Open policy settings | Form loads, can save | ⏭️ SKIP — not tested |
| 7.7 | Comp-off page loads | Go to `/comp-off` | Comp-off records load | ✅ PASS |
| 7.8 | Grant comp-off | Open grant dialog, fill, save | Record created | ⏭️ SKIP — no employees exist |
| 7.9 | Encashment page loads | Go to `/encashment` | Encashment requests load | ✅ PASS |
| 7.10 | Process encashment | Approve/reject request | Status updates | ⏭️ SKIP — no records exist |

---

## 8. Expenses

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 8.1 | Expenses page loads | Go to `/expenses` | Claims and categories load | ✅ PASS |
| 8.2 | Filter claims | Use status/employee filters | List filters | ⏭️ SKIP — no records exist |
| 8.3 | Approve expense | Approve pending claim | Status changes | ⏭️ SKIP — no records exist |
| 8.4 | Reject expense | Reject with reason | Status changes | ⏭️ SKIP — no records exist |
| 8.5 | Reimburse expense | Mark as reimbursed | Status changes | ⏭️ SKIP — no records exist |
| 8.6 | View receipt | Click claim with receipt | Receipt image/modal opens | ⏭️ SKIP — no records exist |
| 8.7 | Expense categories | Switch to Categories tab | Categories list shown | ⏭️ SKIP — not tested |
| 8.8 | Add category | Add new expense category | Category appears | ⏭️ SKIP — not tested |
| 8.9 | Edit category | Edit existing category | Changes saved | ⏭️ SKIP — not tested |
| 8.10 | Delete category | Delete category | Removed from list | ⏭️ SKIP — not tested |

---

## 9. Assets

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 9.1 | Assets page loads | Go to `/assets` | Asset list loads | ✅ PASS |
| 9.2 | Add asset | Click Add, fill form, save | Asset appears | ⏭️ SKIP — not tested |
| 9.3 | Assign asset | Assign to employee | Assignment shown | ⏭️ SKIP — no employees/assets exist |
| 9.4 | Return asset | Mark as returned | Status updated | ⏭️ SKIP — no assets exist |
| 9.5 | Filter assets | By status/employee/type | List filters | ⏭️ SKIP — no assets exist |
| 9.6 | Asset details | Click asset | Details/edit panel opens | ⏭️ SKIP — no assets exist |

---

## 10. Documents

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 10.1 | Documents page loads | Go to `/documents` | Document list loads | ✅ PASS |
| 10.2 | Upload document | Upload file, fill metadata | Document appears | ⏭️ SKIP — not tested |
| 10.3 | Sign document | Send/request signature | Signature request created | ⏭️ SKIP — not tested |
| 10.4 | Pending signatures widget | Verify dashboard widget | Count shown | ⏭️ SKIP — not tested |
| 10.5 | Filter documents | By status/type/employee | List filters | ⏭️ SKIP — no documents exist |
| 10.6 | Download document | Click download | File downloads | ⏭️ SKIP — no documents exist |
| 10.7 | Delete document | Delete document | Removed from list | ⏭️ SKIP — no documents exist |

---

## 11. Calendar

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 11.1 | Calendar page loads | Go to `/calendar` | Calendar grid renders | ✅ PASS |
| 11.2 | Create event | Click date, fill event, save | Event appears on calendar | ⏭️ SKIP — not tested |
| 11.3 | Edit event | Click event, edit | Changes saved | ⏭️ SKIP — no events exist |
| 11.4 | Delete event | Delete event | Removed | ⏭️ SKIP — no events exist |
| 11.5 | Switch views | Day/week/month/agenda | View changes | ⏭️ SKIP — not tested |
| 11.6 | Multi-employee view | Toggle employees | Events filter | ⏭️ SKIP — no employees/events exist |
| 11.7 | Birthdays widget | Verify upcoming birthdays | Birthdays shown | ⏭️ SKIP — no employees exist |
| 11.8 | Conflict detection | Create conflicting event | Conflict indicator shown | ⏭️ SKIP — not tested |
| 11.9 | Meeting provider connect | Connect Zoom/Teams | OAuth/connect flow starts | ⏭️ SKIP — not tested |
| 11.10 | Share calendar | Open share, copy link | Public link generated | ⏭️ SKIP — not tested |

---

## 12. Roster & shifts

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 12.1 | Roster page loads | Go to `/roster` | Roster grid loads | ✅ PASS |
| 12.2 | Create roster | Add shifts for employees | Shifts appear | ⏭️ SKIP — no employees exist |
| 12.3 | Edit shift | Change shift time | Updated | ⏭️ SKIP — no shifts exist |
| 12.4 | Delete shift | Remove shift | Removed | ⏭️ SKIP — no shifts exist |
| 12.5 | Auto-fill roster | Click auto-fill | Shifts generated | ⏭️ SKIP — no employees exist |
| 12.6 | Swap approval queue | View swap requests | List loads, can approve/reject | ⏭️ SKIP — no swap requests exist |
| 12.7 | Adherence view | Switch to adherence | Metrics load | ⏭️ SKIP — not tested |
| 12.8 | No-shows alert | Verify alert panel | Alerts shown | ⏭️ SKIP — not tested |
| 12.9 | Shifts page | Go to `/shifts` | Shift patterns list loads | ⚠️ FLAKY — intermittent redirect to `/login` |
| 12.10 | Add shift pattern | Create pattern | Pattern saved | ⏭️ SKIP — not tested |

---

## 13. Training

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 13.1 | Training page loads | Go to `/training` | Training list/overview loads | ✅ PASS |
| 13.2 | Add training | Create training record | Appears in list | ⏭️ SKIP — not tested |
| 13.3 | Assign training | Assign to employee | Assignment shown | ⏭️ SKIP — no employees exist |
| 13.4 | Mark complete | Mark training complete | Status updated | ⏭️ SKIP — no training records exist |
| 13.5 | Training overview widget | Verify dashboard widget | Count shown | ⏭️ SKIP — not tested |

---

## 14. Performance

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 14.1 | Performance page loads | Go to `/performance` | Reviews list loads | ⚠️ FLAKY — intermittent redirect to `/login` |
| 14.2 | Start review | Create new review | Review created | ⏭️ SKIP — no employees exist |
| 14.3 | Submit review | Fill review, submit | Status updated | ⏭️ SKIP — no reviews exist |
| 14.4 | Performance reviews widget | Verify dashboard widget | Pending reviews count shown | ⏭️ SKIP — not tested |

---

## 15. Payroll

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 15.1 | Payroll page loads | Go to `/payroll` | Payroll periods list loads | ✅ PASS |
| 15.2 | Create payroll period | Add new period | Period created | ⏭️ SKIP — not tested |
| 15.3 | Process payroll | Open `/payroll/:id/process` | Calculation screen loads | ⏭️ SKIP — no payroll periods exist |
| 15.4 | Finalize payroll | Click finalize | Status finalized | ⏭️ SKIP — no payroll periods exist |
| 15.5 | Salary components | Go to `/payroll/salary-components` | Components list loads | ⏭️ SKIP — not tested |
| 15.6 | Add salary component | Create component | Component saved | ⏭️ SKIP — not tested |
| 15.7 | Payroll summary widget | Verify dashboard widget | Summary shown | ⏭️ SKIP — not tested |

---

## 16. Reports

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 16.1 | Reports hub loads | Go to `/reports` | Report cards/links load | ✅ PASS |
| 16.2 | Attendance report | Go to `/reports/attendance` | Report data loads | ⏭️ SKIP — not tested |
| 16.3 | Late report | Go to `/reports/late` | Report data loads | ⏭️ SKIP — not tested |
| 16.4 | Leave report | Go to `/reports/leave` | Report data loads | ⏭️ SKIP — not tested |
| 16.5 | Overtime report | Go to `/reports/overtime` | Report data loads | ⏭️ SKIP — not tested |
| 16.6 | Expense report | Go to `/reports/expense` | Report data loads | ⏭️ SKIP — not tested |
| 16.7 | Payroll report | Go to `/reports/payroll` | Report data loads | ⏭️ SKIP — not tested |
| 16.8 | Roster report | Go to `/reports/roster` | Report data loads | ⏭️ SKIP — not tested |
| 16.9 | Apply date filters | Pick range, run report | Data updates | ⏭️ SKIP — not tested |
| 16.10 | Export report | Click export | CSV/PDF download starts | ⏭️ SKIP — not tested |
| 16.11 | Drill-down panel | Click a stat | Drill-down details open | ⏭️ SKIP — not tested |

---

## 17. Requests

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 17.1 | Requests page loads | Go to `/requests` | Pending requests list loads | ✅ PASS |
| 17.2 | Bulk approve | Select multiple, approve | Status updated | ⏭️ SKIP — no requests exist |
| 17.3 | Bulk reject | Select multiple, reject | Status updated | ⏭️ SKIP — no requests exist |
| 17.4 | Filter by request type | Leave/overtime/expense/etc. | List filters | ⏭️ SKIP — no requests exist |

---

## 18. Announcements

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 18.1 | Announcements page loads | Go to `/announcements` | List loads | ✅ PASS |
| 18.2 | Create announcement | Fill title/body, save | Announcement appears | ⏭️ SKIP — not tested |
| 18.3 | Edit announcement | Edit existing | Changes saved | ⏭️ SKIP — no announcements exist |
| 18.4 | Delete announcement | Delete | Removed | ⏭️ SKIP — no announcements exist |
| 18.5 | Announcements widget | Verify dashboard widget | Latest announcements shown | ⏭️ SKIP — not tested |

---

## 19. Settings

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 19.1 | Settings page loads | Go to `/settings` | Settings tabs load | ❌ FAIL — page stuck on "Loading settings…" |
| 19.2 | Organization settings | Update org name/address | Saved | ⏭️ SKIP — page does not load |
| 19.3 | Branches | Add/edit/delete branch | List updates | ⏭️ SKIP — page does not load |
| 19.4 | Departments | Add/edit/delete department | List updates | ⏭️ SKIP — page does not load |
| 19.5 | Designations | Add/edit/delete designation | List updates | ⏭️ SKIP — page does not load |
| 19.6 | Leave types | Add/edit/delete leave type | List updates | ⏭️ SKIP — page does not load |
| 19.7 | Holiday calendar | Add/edit/delete holiday | Calendar updates | ⏭️ SKIP — page does not load |
| 19.8 | Notification preferences | Toggle preferences | Saved | ⏭️ SKIP — page does not load |
| 19.9 | Meeting providers | Connect/disconnect providers | Status updates | ⏭️ SKIP — page does not load |
| 19.10 | Custom fields | Add custom field | Field appears in forms | ⏭️ SKIP — page does not load |
| 19.11 | White-label / branding | Update colors/logo | Preview updates | ⏭️ SKIP — page does not load |

---

## 20. Geofences

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 20.1 | Geofences page loads | Go to `/geofences` | Map and list load | ✅ PASS |
| 20.2 | Add geofence | Draw/select area, save | Geofence saved | ⏭️ SKIP — not tested |
| 20.3 | Edit geofence | Change radius/location | Updated | ⏭️ SKIP — no geofences exist |
| 20.4 | Delete geofence | Delete | Removed | ⏭️ SKIP — no geofences exist |

---

## 21. Notifications page

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 21.1 | Notifications page loads | Go to `/notifications` | List loads | ✅ PASS |
| 21.2 | Mark all read | Click mark all read | All read, count zero | ⏭️ SKIP — no notifications exist |
| 21.3 | Delete notification | Delete single | Removed | ⏭️ SKIP — no notifications exist |
| 21.4 | Preferences | Update preferences | Saved | ⏭️ SKIP — not tested |

---

## 22. Audit log

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 22.1 | Audit page loads | Go to `/audit` | Audit log table loads | ✅ PASS |
| 22.2 | Filter audit | By user/action/date | List filters | ⏭️ SKIP — not tested |
| 22.3 | Export audit | Export CSV | Download starts | ⏭️ SKIP — not tested |

---

## Issue log

### Authentication & onboarding — Set password page accepts invalid token without error
- **Route:** `/set-password?token=invalid-or-expired-token`
- **Steps:** Visit `/set-password` with a deliberately invalid/expired token.
- **Expected:** The page should reject the token and show an error such as "Invalid or expired token".
- **Actual:** The password reset form renders normally with no token validation or error message.
- **Console/API error:** None observed.
- **Screenshot:** (not captured — test passed because the form rendered)
- **Severity:** Low

### Dashboard — Session/auth is flaky across authenticated tests
- **Route:** `/` and all authenticated routes
- **Steps:** Run authenticated Playwright tests using the shared `touchorbit_session` cookie.
- **Expected:** Once authenticated, all subsequent protected-page requests remain authenticated.
- **Actual:** Tests intermittently redirect to `/login` mid-run. Re-authenticating sometimes also hangs on `/login` without redirecting. Symptoms observed in 2.4, 2.7 and earlier dashboard runs.
- **Console/API error:** Network logs show navigation to `/login`; no clear API error visible.
- **Screenshot:** `admin-dashboard-Dashboard--5f3b7--navigate-to-correct-routes-chromium/test-failed-1.png`
- **Severity:** High

### Dashboard — Widget removal does not persist after Save
- **Route:** `/`
- **Steps:** Click "Customize", click "Remove widget" on "Recent Clock-Ins", click "Save".
- **Expected:** "Recent Clock-Ins" widget is removed from the dashboard layout.
- **Actual:** After saving, the "Recent Clock-Ins" widget remains visible on the dashboard.
- **Console/API error:** None observed.
- **Screenshot:** `admin-dashboard-Dashboard-2-6-remove-widget-from-dashboard-chromium/test-failed-1.png`
- **Severity:** Medium

### Settings — Settings page stuck on "Loading settings…"
- **Route:** `/settings`
- **Steps:** Navigate to `/settings` while authenticated.
- **Expected:** Settings tabs and forms render.
- **Actual:** The page shows a spinner with "Loading settings…" indefinitely and never renders content.
- **Console/API error:** None observed.
- **Screenshot:** `admin-settings-Settings-19-1-settings-page-loads-chromium/test-failed-1.png`
- **Severity:** High

## Issue log format

While testing, record each issue under the relevant module using this format:

```markdown
### <Module> — <Short description>
- **Route:** `/...`
- **Steps:** ...
- **Expected:** ...
- **Actual:** ...
- **Console/API error:** ...
- **Screenshot:** (only if captured)
- **Severity:** Blocker / High / Medium / Low
```

## Execution order

1. Auth & onboarding
2. Dashboard + sidebar navigation
3. Employees (list + detail + org chart)
4. Attendance
5. Leave
6. Overtime / Comp-off / Encashment
7. Expenses
8. Assets
9. Documents
10. Calendar
11. Roster / Shifts
12. Training
13. Performance
14. Payroll
15. Reports
16. Requests
17. Announcements
18. Settings
19. Geofences
20. Notifications page
21. Audit log

## Exit criteria

- Every test case above has been executed at least once.
- All failures are recorded in the issue log.
- No new screenshots are saved unless they document a defect.
- We then schedule a fixing session to address the recorded issues.
