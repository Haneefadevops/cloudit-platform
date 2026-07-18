import { expect, test, type Page } from '@playwright/test'

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

function previousWeekdayDate(): string {
  const date = new Date()
  date.setDate(date.getDate() - 1)
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() - 1)
  }
  return date.toISOString().slice(0, 10)
}

test.describe('Employee attendance correction functional workflows', () => {
  test.beforeEach(async ({ page }) => {
    await loginEmployee(page)
  })

  test('EF5.1 employee submits an attendance correction request', async ({ page }) => {
    const reason = `E2E attendance correction ${Date.now()}`

    await page.goto('/corrections')
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByText(/Attendance Corrections/i)).toBeVisible({
      timeout: 15000,
    })

    await page.getByRole('button', { name: /request fix/i }).click()
    await expect(page.getByText(/New Correction Request/i)).toBeVisible()
    await page.locator('select').selectOption('forgot_in')
    await page.locator('input[type="date"]').fill(previousWeekdayDate())
    await page.locator('input[type="time"]').fill('09:15')
    await page.getByPlaceholder(/explain what happened/i).fill(reason)
    await page.getByRole('button', { name: /send request/i }).click()

    await expect(page.getByText(/Correction request submitted/i)).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByText(/Forgot to Clock In/i).first()).toBeVisible({
      timeout: 15000,
    })
  })
})
