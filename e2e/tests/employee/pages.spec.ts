import { test, expect, type Page } from '@playwright/test'

async function loginEmployee(page: Page) {
  const email =
    process.env.E2E_EMPLOYEE_EMAIL || process.env.E2E_SEED_EMPLOYEE_EMAIL
  const password =
    process.env.E2E_EMPLOYEE_PASSWORD || process.env.E2E_SEED_EMPLOYEE_PASSWORD
  const apiUrl = process.env.E2E_API_URL

  if (!email || !password || !apiUrl) {
    throw new Error('Employee credentials and E2E_API_URL must be set')
  }

  const response = await page.context().request.post(`${apiUrl}/api/auth/login`, {
    data: { email, password },
  })
  const body = (await response.json().catch(() => null)) as {
    ok?: boolean
    data?: { user?: { role?: string } }
    error?: string
    message?: string
  } | null

  if (!response.ok() || !body?.ok) {
    throw new Error(body?.error || body?.message || 'Employee login failed')
  }

  expect(body.data?.user?.role).toBe('employee')
}

const protectedRoutes = [
  { path: '/', text: /Working Hours Today|Clock In|Announcements|Offline/i },
  { path: '/profile', text: /Profile|Personal|Emergency|Contact/i },
  { path: '/attendance', text: /Attendance|History|Clock/i },
  { path: '/leave', text: /Leave|Balance|Request/i },
  { path: '/overtime', text: /Overtime|Request/i },
  { path: '/comp-off', text: /Comp-Off|Comp Off|Balance/i },
  { path: '/encashment', text: /Encashment|Leave/i },
  { path: '/expenses', text: /Expenses|Claims|Receipt/i },
  { path: '/corrections', text: /Correction|Attendance/i },
  { path: '/calendar', text: /Calendar|Today|Month|Task/i },
  { path: '/roster', text: /Roster|Shift|Week/i },
  { path: '/training', text: /Training|Course|Assigned/i },
  { path: '/documents', text: /Documents|Signature|File/i },
  { path: '/payslips', text: /Payslip|Payroll|Salary/i },
  { path: '/announcements', text: /Announcements|Notice/i },
  { path: '/notifications', text: /Notifications|No notifications|Read/i },
  { path: '/org-chart', text: /Org Chart|Organization|Employee/i },
  { path: '/search', text: /Search|Find/i },
]

test.describe('Employee protected pages', () => {
  test.beforeEach(async ({ page }) => {
    await loginEmployee(page)
  })

  for (const route of protectedRoutes) {
    test(`E2 page loads: ${route.path}`, async ({ page }) => {
      await page.goto(route.path)
      await expect(page).not.toHaveURL(/\/login/)
      await expect(page.locator('body').getByText(route.text).first()).toBeVisible({
        timeout: 15000,
      })
    })
  }
})
