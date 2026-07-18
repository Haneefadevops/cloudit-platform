# TouchOrbit Frontend E2E Function Test Plan

Last updated: 2026-07-14

## Purpose

This plan defines the full frontend E2E coverage required before TouchOrbit is considered ready for go-live. The goal is not only page-load smoke testing. Every visible function, workflow, form submission, filter, navigation path, and role-specific user action must be tested.

When a function fails, do not ignore it. Record it in `docs/testing/TOUCHORBIT_BROKEN_FUNCTIONS_REPORT.md` with evidence, expected behavior, actual behavior, and the fix owner/status.

## Target Environments

- Admin portal: `E2E_BASE_URL`
- Employee portal: `E2E_EMPLOYEE_BASE_URL`
- API: `E2E_API_URL`
- Admin login: `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`
- Seed employee: `E2E_SEED_EMPLOYEE_EMAIL` / `E2E_SEED_EMPLOYEE_PASSWORD`

Secrets must stay in `e2e/.env`. Do not copy passwords into docs, commits, screenshots, or logs.

## Test Data Strategy

1. The seed setup must create or reuse one stable E2E employee.
2. The seed setup must reset that employee's password before each full run.
3. Seeded records must use obvious names such as `E2E Employee`, `E2E Leave Request`, `E2E Asset`, and `E2E Calendar Event`.
4. Mutating tests must be idempotent. A second run should not fail because records already exist.
5. Any destructive action must operate only on E2E-tagged records.
6. If production has no real customer data, this can run against production. Once real data exists, move the full mutating suite to staging and keep production to smoke/read-only tests.

## Required Test Levels

- **Smoke:** authentication, core layout, protected route redirects, and critical dashboard widgets.
- **Function:** every page function: create, read, update, delete, approve, reject, filter, export, import, upload, and navigation where available.
- **Cross-portal:** admin creates/approves data and employee portal reflects it.
- **Regression:** full suite run after deployment and before go-live approval.
- **Failure report:** every failed or skipped function must be tracked in the broken functions report.

## Execution Order

1. Validate environment variables.
2. Authenticate as admin.
3. Seed employee and required reference data.
4. Run admin portal tests.
5. Authenticate as employee.
6. Run employee portal tests.
7. Run cross-portal workflows.
8. Generate Playwright report and update broken-functions report.

## Commands

```bash
npm run e2e:seed
npm run e2e:test:employees
npm run e2e:test:admin
npm run e2e:test
```

## Admin Portal Function Coverage

### Authentication and Access

- Login page loads.
- Valid admin login redirects to dashboard.
- Invalid password shows error and stays on login.
- Invalid email format shows validation.
- Empty submit shows validation.
- Logout clears session and redirects to login.
- Direct protected route without session redirects to login.
- Direct login route while authenticated redirects to dashboard.
- Set-password page renders valid state or token error.
- Signup/setup pages render without crash.

### Dashboard

- Dashboard loads greeting and widgets.
- Attendance, headcount, leave, activity, payroll, assets, roster, spoofing, documents, announcements, training, corrections, comp-off, expenses, encashment, overtime widgets render when enabled.
- Widget links navigate to correct module.
- Customize/add widget drawer opens.
- Add/remove/save widget layout works.
- Notification bell opens.
- User menu opens and supports profile/logout actions.
- Sidebar navigation reaches all visible modules.

### Employees

- Employee list loads.
- Seed employee appears in search.
- Search filters by name/email/employee number.
- Status tabs filter active/terminated/on leave where available.
- Department and branch filters work.
- Grid/table/compact view toggles work.
- Add employee dialog opens.
- Required field validation works.
- Create employee with basic details works.
- Create employee with app access and temporary password works.
- Reset employee password works.
- Employee preview drawer opens.
- Employee detail page opens.
- Overview tab edits personal/contact fields.
- Employment tab edits job, department, branch, manager, status, hire date.
- Bank tab edits bank data.
- Emergency tab adds/updates/removes emergency contacts.
- Salary tab edits basic salary and salary structure.
- Leave tab displays and adjusts balances.
- Attendance tab displays employee attendance.
- Documents tab displays employee documents.
- Skills, performance, activity, history tabs render and persist changes where forms exist.
- Terminate employee flow works only for E2E employee.
- Import employee dialog opens and validates file type.
- Export employees downloads a file.
- Org chart page loads and displays seeded employee.

### Attendance, Corrections, Geofences, Spoofing

- Attendance page loads.
- Date range filters load attendance data.
- Employee filters work.
- Clock event detail drawer opens.
- Flagged/spoofed event review opens.
- Approve/reject review actions work on E2E records.
- Corrections page loads.
- Correction list filters by status.
- Approve/reject correction works on E2E correction.
- Geofences page loads.
- Create/edit/delete E2E geofence works.
- Map or coordinate fields validate.
- Spoofing review page loads and filters suspicious events.

### Leave, Overtime, Comp-Off, Encashment, Expenses, Requests

- Leave page loads.
- Leave filters by status/type/date work.
- Approve/reject E2E leave request works.
- Leave balance display updates after approval/rejection where applicable.
- Overtime page loads.
- Approve/reject E2E overtime request works.
- Comp-off page loads.
- Grant/approve/reject E2E comp-off works.
- Encashment page loads.
- Approve/reject E2E encashment request works.
- Expenses page loads.
- Create/approve/reject E2E expense claim where UI supports it.
- Requests page loads and displays unified requests.
- Bulk request actions work where available.

### Calendar, Holidays, Tasks, Conflicts

- Calendar page loads month/week/day/list views where available.
- Create E2E calendar event works.
- Edit E2E event works.
- Duplicate E2E event works.
- Reschedule E2E event works.
- Delete E2E event works.
- Add/remove attendees works.
- RSVP/reschedule-request data appears where relevant.
- Create/edit/delete E2E holiday works.
- Sri Lankan holiday import button is guarded and reports result.
- Create/edit/complete/delete E2E task works.
- Calendar conflicts page loads and displays conflict data.
- Calendar analytics panels load without server errors.

### Roster and Shifts

- Roster page loads.
- Week navigation works.
- Week status loads.
- Shift list/page loads.
- Create/edit/delete E2E shift works.
- Assign seeded employee to shift.
- Publish roster where available.
- Auto-fill preview runs and reports result.
- Shift swap list loads.
- Approve/reject E2E shift swap works.

### Payroll

- Payroll page loads.
- Salary components page loads.
- Create/edit/delete E2E salary component works.
- Create E2E payroll run works.
- Payroll run detail page opens.
- Process payroll run works on E2E data.
- Payroll item details render.
- Payroll reports/export/download work where available.

### Assets

- Assets page loads.
- Asset categories load.
- Create/edit/delete E2E asset category works.
- Create/edit/delete E2E asset works.
- Assign asset to seeded employee.
- Return/unassign asset where available.
- Asset filters/search work.

### Documents

- Documents page loads.
- Templates list loads.
- Create E2E document template works.
- Send E2E document to seeded employee.
- Document status updates after employee action where supported.
- Download/view document link works.

### Training and Performance

- Training page loads.
- Create/edit/delete E2E training program works.
- Assign training to seeded employee.
- Mark assignment complete/cancel where available.
- Performance page loads.
- Create/edit/delete E2E performance review works.
- Review filters and detail views work.

### Reports and Audit

- Reports hub loads.
- Attendance, late, leave, overtime, payroll, expense, roster report pages load.
- Report date filters work.
- Report employee filters work.
- Export/download works where available.
- Audit log page loads.
- Audit filters by action/user/date work.
- Recent audited E2E actions appear.

### Announcements, Notifications, Settings

- Announcements page loads.
- Create/edit/delete E2E announcement works.
- Announcement appears in employee portal.
- Notifications page loads.
- Notification bell/panel opens.
- Mark notification read works.
- Mark all read works.
- Delete notification works where available.
- Settings page loads.
- Organization/profile settings render.
- Notification preferences load/save.
- Meeting provider settings load and validation works without real provider secrets.
- Feature flags/custom fields load where available.

## Employee Portal Function Coverage

### Employee Authentication and Home

- Employee login page loads.
- Seed employee can log in using seeded password.
- Invalid employee login shows error.
- Logout clears session.
- Employee home/dashboard loads.
- Quick actions navigate to correct pages.
- Bottom navigation works on desktop/mobile viewport.
- Search page loads and returns relevant results.

### Employee Profile

- Profile page loads.
- Employee personal details render.
- Edit phone/contact details works.
- Emergency contacts render.
- Linked navigation actions work.

### Attendance, Clock, Breaks, Kiosk

- Attendance page loads current employee history.
- Clock status loads.
- Clock in works using mocked geolocation where required.
- Clock out works using mocked geolocation where required.
- Break start/end works.
- Offline sync status renders.
- Flagged punch banner opens detail.
- Kiosk page loads.
- Kiosk employee selection works on E2E employee.
- Kiosk clock action works only on E2E record.

### Leave, Overtime, Comp-Off, Encashment, Expenses, Corrections

- Leave page loads balances and request history.
- Create E2E leave request works.
- Leave request validation works.
- Overtime page loads.
- Create E2E overtime request works.
- Comp-off page loads.
- Create E2E comp-off request works.
- Encashment page loads.
- Create E2E encashment request works.
- Expenses page loads.
- Create E2E expense claim works.
- Corrections page loads.
- Create E2E attendance correction works.

### Calendar, Roster, Tasks, Training

- Calendar page loads.
- Holidays, attendance, leave, training, events, and tasks render.
- Create E2E personal task works.
- Complete E2E task works.
- Event detail panel opens.
- RSVP action works where available.
- Reschedule request works where available.
- Roster page loads.
- Week navigation works.
- Availability setter saves.
- Shift marketplace/swap request works on E2E records.
- Training page loads.
- Employee training record create/edit/delete works where available.
- Assigned training complete/in-progress actions work.

### Documents, Payslips, Announcements, Notifications, Org Chart

- Documents page loads.
- Employee can view assigned E2E document.
- Employee can acknowledge/sign document where available.
- Payslips page loads.
- Payslip list/detail/download works where seeded data exists.
- Announcements page loads and shows E2E announcement.
- Notifications page loads.
- Mark read/delete notification works.
- Org chart page loads and shows seeded employee.

## Cross-Portal Workflows

- Admin creates employee with app access; employee logs in.
- Admin creates announcement; employee sees announcement.
- Employee submits leave; admin approves/rejects; employee sees updated status.
- Employee submits correction; admin approves/rejects; attendance updates.
- Employee submits expense; admin approves/rejects; employee sees updated status.
- Admin assigns document; employee acknowledges/signs; admin sees status.
- Admin assigns training; employee completes; admin sees status.
- Admin creates calendar event; employee sees event and RSVPs.
- Employee requests shift swap; admin approves/rejects; roster updates.
- Employee clock event appears in admin attendance and dashboard widgets.

## Required Failure Handling

For every failed test or unimplemented function:

1. Add an entry to `docs/testing/TOUCHORBIT_BROKEN_FUNCTIONS_REPORT.md`.
2. Include module, function, route, test name, expected result, actual result, severity, evidence, and fix status.
3. Do not mark go-live ready while any Critical or High item remains open.
4. Skipped tests are allowed only when the reason is documented and a follow-up test/fix task exists.

## Go-Live Criteria

- All Smoke tests pass.
- All Authentication tests pass.
- All Employee CRUD and employee portal login tests pass.
- All cross-portal core HR workflows pass.
- No open Critical or High broken function remains.
- Medium/Low issues are documented with accepted risk or scheduled fix.
- Playwright report artifacts are saved from the final run.
