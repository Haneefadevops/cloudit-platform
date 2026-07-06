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
| 1.1 | Valid login | Go to `/login`, enter valid credentials, submit | Redirected to `/`, dashboard loads, greeting visible |
| 1.2 | Invalid password | Enter wrong password, submit | Stays on `/login`, error message shown |
| 1.3 | Invalid email format | Enter malformed email, submit | Validation error before submit or clear API error |
| 1.4 | Empty form submit | Click Sign In with empty fields | Validation errors, no crash |
| 1.5 | Logout | From dashboard, click logout in header | Redirected to `/login`, cookie cleared |
| 1.6 | Direct access to auth page while logged in | Go to `/login` with valid session | Redirected to `/` |
| 1.7 | Direct access to protected page without session | Clear storage, go to `/employees` | Redirected to `/login` |
| 1.8 | Set password page | Visit `/set-password?token=...` with valid/invalid token | Form renders; invalid token shows error |
| 1.9 | Signup / create organization | Visit `/signup`, fill form, submit | Organization and owner created or clear error |
| 1.10 | Spoofing review | Visit `/spoofing-review` | List of flagged clock-ins loads, can approve/reject |

---

## 2. Dashboard

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 2.1 | Dashboard loads | Go to `/` | Greeting, widgets, sidebar render without spinner |
| 2.2 | Today's Attendance widget | Verify widget on dashboard | Shows present/late/absent counts |
| 2.3 | Headcount widget | Verify widget | Shows total active staff count |
| 2.4 | Pending Leave widget | Verify widget | Shows pending leave requests count |
| 2.5 | Add Widget drawer | Click "Customize"/"Add Widget" | Drawer opens, widget list shown |
| 2.6 | Reorder/remove widgets | Drag widget, remove widget | Layout updates and persists on refresh |
| 2.7 | Sidebar navigation | Click each sidebar link | Navigates to correct route |
| 2.8 | Notification bell | Click bell icon | Panel opens, notifications load |
| 2.9 | Mark notification read | Click a notification / mark read | Count decreases, item marked |
| 2.10 | User menu / profile | Click user avatar/name in header | Menu opens with profile/sign-out options |

---

## 3. Employees

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 3.1 | Employees list loads | Go to `/employees` | Grid/table of employees renders |
| 3.2 | Search employees | Type in search box | List filters by name/email/number |
| 3.3 | Filter by status | Click status tabs (All/Active/On Leave/Terminated) | List filters correctly |
| 3.4 | Filter by department | Select department | List filters correctly |
| 3.5 | View mode toggle | Switch grid/table/compact | Layout changes |
| 3.6 | Add employee dialog | Click Add Employee, fill required fields, save | New employee appears in list |
| 3.7 | Add employee validation | Submit empty form | Validation errors shown |
| 3.8 | Import employees CSV | Open import, upload valid CSV | Preview shown, import succeeds |
| 3.9 | Export employees CSV | Click Export | CSV download starts |
| 3.10 | KPI strip filters | Click a KPI chip | Status filter updates |
| 3.11 | Employee preview drawer | Click an employee card | Drawer opens with summary |
| 3.12 | Bulk select | Select multiple employees, use bulk actions | Actions apply to selected |
| 3.13 | Employee detail page | Click View/employee card → `/employees/:id` | Profile tabs load |
| 3.14 | Overview tab | On detail page, view Overview | Personal info, job info visible |
| 3.15 | Employment tab | View Employment tab | Hire date, status, department, branch visible |
| 3.16 | Bank tab | View Bank tab | Bank details visible/editable |
| 3.17 | Emergency tab | View Emergency tab | Emergency contacts visible/editable |
| 3.18 | Leave tab | View Leave tab | Leave balances and history visible |
| 3.19 | Attendance tab | View Attendance tab | Attendance records/heatmap visible |
| 3.20 | Documents tab | View Documents tab | Documents list/upload visible |
| 3.21 | Salary tab | View Salary tab | Salary info visible/editable |
| 3.22 | Skills tab | View Skills tab | Skills list visible/editable |
| 3.23 | Performance tab | View Performance tab | Reviews visible |
| 3.24 | Activity tab | View Activity tab | Activity feed visible |
| 3.25 | History tab | View History tab | Change history visible |
| 3.26 | Terminate employee | Click terminate, fill reason/date, confirm | Employee status changes to terminated |
| 3.27 | Reset employee password | Reset password from detail page | Success message or email sent |
| 3.28 | Employee leave balances | Go to `/employees/:id/leave-balances` | Balances table loads |

---

## 4. Org chart

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 4.1 | Org chart loads | Go to `/employees/org-chart` | Hierarchy renders |
| 4.2 | Click employee node | Click a node | Side panel opens with employee details |
| 4.3 | Search/filter | Use search or filters | Chart updates |

---

## 5. Attendance

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 5.1 | Attendance page loads | Go to `/attendance` | Calendar/records load |
| 5.2 | View by date | Select a date | Records for that date shown |
| 5.3 | Filter by employee | Select employee | Records filter |
| 5.4 | Filter by status | Select present/late/absent | Records filter |
| 5.5 | Manual attendance entry | Add clock-in/clock-out | Record saved |
| 5.6 | Edit attendance | Edit existing record | Changes saved |
| 5.7 | Delete attendance | Delete record | Record removed |
| 5.8 | Attendance map | Open location/map view | Map markers render |
| 5.9 | Live attendance | Go to `/live-attendance` (sidebar) | Real-time list loads |

---

## 6. Leave

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 6.1 | Leave page loads | Go to `/leave` | Leave requests list loads |
| 6.2 | Filter by status | Click pending/approved/rejected | List filters |
| 6.3 | Filter by employee | Select employee | List filters |
| 6.4 | Filter by date range | Pick dates | List filters |
| 6.5 | Approve leave | Select pending request, approve | Status changes to approved |
| 6.6 | Reject leave | Select pending request, reject with reason | Status changes to rejected |
| 6.7 | Bulk approve/reject | Select multiple, bulk action | Status changes for all |
| 6.8 | View leave details | Click request | Details modal/drawer opens |

---

## 7. Overtime, comp-off, encashment

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 7.1 | Overtime page loads | Go to `/overtime` | Records and policy section load |
| 7.2 | Filter overtime | Use status/role filters | List filters |
| 7.3 | Approve overtime | Approve pending request | Status changes |
| 7.4 | Reject overtime | Reject with reason | Status changes |
| 7.5 | Manual overtime entry | Add overtime record | Record saved |
| 7.6 | Overtime policy settings | Open policy settings | Form loads, can save |
| 7.7 | Comp-off page loads | Go to `/comp-off` | Comp-off records load |
| 7.8 | Grant comp-off | Open grant dialog, fill, save | Record created |
| 7.9 | Encashment page loads | Go to `/encashment` | Encashment requests load |
| 7.10 | Process encashment | Approve/reject request | Status updates |

---

## 8. Expenses

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 8.1 | Expenses page loads | Go to `/expenses` | Claims and categories load |
| 8.2 | Filter claims | Use status/employee filters | List filters |
| 8.3 | Approve expense | Approve pending claim | Status changes |
| 8.4 | Reject expense | Reject with reason | Status changes |
| 8.5 | Reimburse expense | Mark as reimbursed | Status changes |
| 8.6 | View receipt | Click claim with receipt | Receipt image/modal opens |
| 8.7 | Expense categories | Switch to Categories tab | Categories list shown |
| 8.8 | Add category | Add new expense category | Category appears |
| 8.9 | Edit category | Edit existing category | Changes saved |
| 8.10 | Delete category | Delete category | Removed from list |

---

## 9. Assets

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 9.1 | Assets page loads | Go to `/assets` | Asset list loads |
| 9.2 | Add asset | Click Add, fill form, save | Asset appears |
| 9.3 | Assign asset | Assign to employee | Assignment shown |
| 9.4 | Return asset | Mark as returned | Status updated |
| 9.5 | Filter assets | By status/employee/type | List filters |
| 9.6 | Asset details | Click asset | Details/edit panel opens |

---

## 10. Documents

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 10.1 | Documents page loads | Go to `/documents` | Document list loads |
| 10.2 | Upload document | Upload file, fill metadata | Document appears |
| 10.3 | Sign document | Send/request signature | Signature request created |
| 10.4 | Pending signatures widget | Verify dashboard widget | Count shown |
| 10.5 | Filter documents | By status/type/employee | List filters |
| 10.6 | Download document | Click download | File downloads |
| 10.7 | Delete document | Delete document | Removed from list |

---

## 11. Calendar

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 11.1 | Calendar page loads | Go to `/calendar` | Calendar grid renders |
| 11.2 | Create event | Click date, fill event, save | Event appears on calendar |
| 11.3 | Edit event | Click event, edit | Changes saved |
| 11.4 | Delete event | Delete event | Removed |
| 11.5 | Switch views | Day/week/month/agenda | View changes |
| 11.6 | Multi-employee view | Toggle employees | Events filter |
| 11.7 | Birthdays widget | Verify upcoming birthdays | Birthdays shown |
| 11.8 | Conflict detection | Create conflicting event | Conflict indicator shown |
| 11.9 | Meeting provider connect | Connect Zoom/Teams | OAuth/connect flow starts |
| 11.10 | Share calendar | Open share, copy link | Public link generated |

---

## 12. Roster & shifts

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 12.1 | Roster page loads | Go to `/roster` | Roster grid loads |
| 12.2 | Create roster | Add shifts for employees | Shifts appear |
| 12.3 | Edit shift | Change shift time | Updated |
| 12.4 | Delete shift | Remove shift | Removed |
| 12.5 | Auto-fill roster | Click auto-fill | Shifts generated |
| 12.6 | Swap approval queue | View swap requests | List loads, can approve/reject |
| 12.7 | Adherence view | Switch to adherence | Metrics load |
| 12.8 | No-shows alert | Verify alert panel | Alerts shown |
| 12.9 | Shifts page | Go to `/shifts` | Shift patterns list loads |
| 12.10 | Add shift pattern | Create pattern | Pattern saved |

---

## 13. Training

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 13.1 | Training page loads | Go to `/training` | Training list/overview loads |
| 13.2 | Add training | Create training record | Appears in list |
| 13.3 | Assign training | Assign to employee | Assignment shown |
| 13.4 | Mark complete | Mark training complete | Status updated |
| 13.5 | Training overview widget | Verify dashboard widget | Count shown |

---

## 14. Performance

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 14.1 | Performance page loads | Go to `/performance` | Reviews list loads |
| 14.2 | Start review | Create new review | Review created |
| 14.3 | Submit review | Fill review, submit | Status updated |
| 14.4 | Performance reviews widget | Verify dashboard widget | Pending reviews count shown |

---

## 15. Payroll

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 15.1 | Payroll page loads | Go to `/payroll` | Payroll periods list loads |
| 15.2 | Create payroll period | Add new period | Period created |
| 15.3 | Process payroll | Open `/payroll/:id/process` | Calculation screen loads |
| 15.4 | Finalize payroll | Click finalize | Status finalized |
| 15.5 | Salary components | Go to `/payroll/salary-components` | Components list loads |
| 15.6 | Add salary component | Create component | Component saved |
| 15.7 | Payroll summary widget | Verify dashboard widget | Summary shown |

---

## 16. Reports

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 16.1 | Reports hub loads | Go to `/reports` | Report cards/links load |
| 16.2 | Attendance report | Go to `/reports/attendance` | Report data loads |
| 16.3 | Late report | Go to `/reports/late` | Report data loads |
| 16.4 | Leave report | Go to `/reports/leave` | Report data loads |
| 16.5 | Overtime report | Go to `/reports/overtime` | Report data loads |
| 16.6 | Expense report | Go to `/reports/expense` | Report data loads |
| 16.7 | Payroll report | Go to `/reports/payroll` | Report data loads |
| 16.8 | Roster report | Go to `/reports/roster` | Report data loads |
| 16.9 | Apply date filters | Pick range, run report | Data updates |
| 16.10 | Export report | Click export | CSV/PDF download starts |
| 16.11 | Drill-down panel | Click a stat | Drill-down details open |

---

## 17. Requests

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 17.1 | Requests page loads | Go to `/requests` | Pending requests list loads |
| 17.2 | Bulk approve | Select multiple, approve | Status updated |
| 17.3 | Bulk reject | Select multiple, reject | Status updated |
| 17.4 | Filter by request type | Leave/overtime/expense/etc. | List filters |

---

## 18. Announcements

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 18.1 | Announcements page loads | Go to `/announcements` | List loads |
| 18.2 | Create announcement | Fill title/body, save | Announcement appears |
| 18.3 | Edit announcement | Edit existing | Changes saved |
| 18.4 | Delete announcement | Delete | Removed |
| 18.5 | Announcements widget | Verify dashboard widget | Latest announcements shown |

---

## 19. Settings

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 19.1 | Settings page loads | Go to `/settings` | Settings tabs load |
| 19.2 | Organization settings | Update org name/address | Saved |
| 19.3 | Branches | Add/edit/delete branch | List updates |
| 19.4 | Departments | Add/edit/delete department | List updates |
| 19.5 | Designations | Add/edit/delete designation | List updates |
| 19.6 | Leave types | Add/edit/delete leave type | List updates |
| 19.7 | Holiday calendar | Add/edit/delete holiday | Calendar updates |
| 19.8 | Notification preferences | Toggle preferences | Saved |
| 19.9 | Meeting providers | Connect/disconnect providers | Status updates |
| 19.10 | Custom fields | Add custom field | Field appears in forms |
| 19.11 | White-label / branding | Update colors/logo | Preview updates |

---

## 20. Geofences

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 20.1 | Geofences page loads | Go to `/geofences` | Map and list load |
| 20.2 | Add geofence | Draw/select area, save | Geofence saved |
| 20.3 | Edit geofence | Change radius/location | Updated |
| 20.4 | Delete geofence | Delete | Removed |

---

## 21. Notifications page

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 21.1 | Notifications page loads | Go to `/notifications` | List loads |
| 21.2 | Mark all read | Click mark all read | All read, count zero |
| 21.3 | Delete notification | Delete single | Removed |
| 21.4 | Preferences | Update preferences | Saved |

---

## 22. Audit log

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 22.1 | Audit page loads | Go to `/audit` | Audit log table loads |
| 22.2 | Filter audit | By user/action/date | List filters |
| 22.3 | Export audit | Export CSV | Download starts |

---

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
