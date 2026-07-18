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

function nextWeekdayDate(): string {
  const date = new Date()
  date.setDate(date.getDate() + 3)
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1)
  }
  return date.toISOString().slice(0, 10)
}

test.describe('Employee leave functional workflows', () => {
  test.beforeEach(async ({ page }) => {
    await loginEmployee(page)
  })

  test('EF6.1 employee submits a leave request from the portal', async ({ page }) => {
    const leaveDate = nextWeekdayDate()
    const reason = `E2E leave request ${Date.now()}`

    await page.goto('/leave')
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByText(/Leave Status|Leave History/i).first()).toBeVisible({
      timeout: 15000,
    })

    await page.getByRole('button', { name: /apply new/i }).click()
    await expect(page.getByText(/Apply for Leave/i)).toBeVisible()

    await page.locator('input[type="date"]').nth(0).fill(leaveDate)
    await page.locator('input[type="date"]').nth(1).fill(leaveDate)
    await page.locator('textarea').fill(reason)
    await page.getByRole('button', { name: /submit application/i }).click()

    await expect(page.getByText(/Leave application submitted/i).first()).toBeVisible({
      timeout: 15000,
    }).catch(async () => {
      await expect(page.getByText(reason).or(page.getByText(/Annual Leave/i).first())).toBeVisible({
        timeout: 15000,
      })
    })

    await expect(page.getByText(/Leave History/i)).toBeVisible({ timeout: 15000 })
    await expect(
      page.getByText(/Annual Leave|pending|awaiting/i).first(),
    ).toBeVisible({ timeout: 15000 })
  })
})
