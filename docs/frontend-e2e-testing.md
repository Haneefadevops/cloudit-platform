# Frontend E2E Testing Plan

This document outlines the Playwright-based end-to-end testing setup for the CloudIT platform frontends.

## Goals

- Verify real browser flows (login, navigation, widget rendering, form submissions).
- Catch frontend-only issues that API tests miss: JavaScript errors, hydration failures, middleware redirects, CORS/cookie behavior in the browser, and layout regressions.
- Provide a reusable foundation for testing `touchorbit-admin-web`, `touchorbit-employee-web`, and `touchorbit-web`.

## Stack

- **Runner:** [Playwright](https://playwright.dev/) (`@playwright/test`)
- **Browser:** Chromium (default). Firefox/WebKit can be added later.
- **Config:** `e2e/playwright.config.ts`
- **Secrets:** `e2e/.env` (gitignored)

## Project Layout

```
e2e/
├── .env                  # Real credentials (DO NOT COMMIT)
├── .env.example          # Template for credentials
├── .gitignore            # Ignores .env, .auth/, test-results/, playwright-report/
├── playwright.config.ts  # Playwright configuration
├── tests/
│   ├── auth.setup.ts     # Logs in once and saves storage state
│   ├── auth.teardown.ts  # Removes saved storage state
│   └── admin/
│       ├── login.spec.ts      # Invalid login validation
│       └── dashboard.spec.ts  # Dashboard greeting & widgets
```

## Setup

1. Install dependencies (already done at root):

   ```bash
   npm install
   ```

2. Install Playwright browsers:

   ```bash
   npm run e2e:install
   ```

3. Create your local environment file:

   ```bash
   cp e2e/.env.example e2e/.env
   ```

   Fill in the real credentials:

   ```env
   E2E_BASE_URL=https://to-admin.cloudit.lk
   E2E_ADMIN_EMAIL=pltadmin@cloudit.lk
   E2E_ADMIN_PASSWORD=<your-password>
   ```

4. Run the tests:

   ```bash
   npm run e2e:test
   ```

   To run in headed mode (see the browser):

   ```bash
   E2E_HEADED=true npm run e2e:test
   ```

5. Open the HTML report:

   ```bash
   npm run e2e:report
   ```

## Current Test Coverage

### Authentication (`auth.setup.ts` + `auth.teardown.ts`)

- Logs in as the configured admin user.
- Asserts the dashboard finishes loading (no endless spinner).
- Saves the authenticated browser state so other tests skip re-login.

### Login (`tests/admin/login.spec.ts`)

- Invalid credentials show an error and stay on `/login`.

### Dashboard (`tests/admin/dashboard.spec.ts`)

- Dashboard loads and shows the user's greeting and key widgets: Today's Attendance, Headcount, Pending Leave.

## Recommended Next Tests

1. **Invite / set-password flow**
   - Trigger an invite from the platform admin.
   - Open the invite link in an incognito context.
   - Set a password and land on the dashboard.

2. **Employee CRUD**
   - Add an employee from `/employees`.
   - Verify the employee appears in the list.
   - Clean up the test employee via API or UI.

3. **Attendance clock-in simulation**
   - Use a mock/fixed geolocation if needed.
   - Verify clock-in button and recent clock-ins widget.

4. **Cross-portal tests**
   - `touchorbit-employee-web`: login, profile, leave request.
   - `touchorbit-web`: placeholder landing page.

5. **Responsive / mobile**
   - Add a `Mobile Safari` project in `playwright.config.ts`.
   - Verify sidebar and widgets on small viewports.

6. **Visual regression**
   - Enable Playwright screenshots and compare against baselines.

## CI Integration

A GitHub Actions workflow can be added later:

```yaml
name: E2E Tests
on:
  workflow_dispatch:
  schedule:
    - cron: '0 6 * * *'
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run e2e:install
      - run: npm run e2e:test
        env:
          E2E_BASE_URL: ${{ vars.E2E_BASE_URL }}
          E2E_ADMIN_EMAIL: ${{ secrets.E2E_ADMIN_EMAIL }}
          E2E_ADMIN_PASSWORD: ${{ secrets.E2E_ADMIN_PASSWORD }}
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: e2e/playwright-report/
```

## Notes

- Tests run sequentially (`workers: 1`) because they share the saved auth state.
- If you change the admin password, delete `e2e/.auth/admin.json` and re-run `auth.setup.ts`.
- The `e2e/.env` file is gitignored. Never commit real credentials.
- The dashboard test blocks Next.js speculative RSC prefetches (`?_rsc=`) to avoid hammering the live API throttle with auth checks for routes we are not testing.
- `auth.setup.ts` retries the UI login and waits out a `429 Too Many Requests` throttle window when necessary.
