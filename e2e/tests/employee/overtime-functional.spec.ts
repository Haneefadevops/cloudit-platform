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

test.describe('Employee overtime functional workflows', () => {
  test.beforeEach(async ({ page }) => {
    await loginEmployee(page)
  })

  test('EF7.3 employee submits an overtime request', async ({ page }) => {
    const reason = `E2E overtime request ${Date.now()}`

    await page.goto('/overtime')
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByText(/Recent Logs|No overtime logs found/i).first()).toBeVisible({
      timeout: 15000,
    })

    await page.getByRole('button', { name: /new request/i }).click()
    await expect(page.getByText(/Request Overtime/i)).toBeVisible()
    await page.locator('input[type="date"]').fill(previousWeekdayDate())
    await page.locator('input[type="time"]').nth(0).fill('18:00')
    await page.locator('input[type="time"]').nth(1).fill('20:00')
    await page.getByPlaceholder(/briefly describe/i).fill(reason)

    await page.getByRole('button', { name: /submit request/i }).click()

    await expect(page.getByText(/Overtime request submitted/i)).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByText(reason).or(page.getByText(/pending/i).first())).toBeVisible({
      timeout: 15000,
    })
  })
})
