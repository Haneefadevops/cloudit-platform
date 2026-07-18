import { expect, test, type Page } from '@playwright/test'
import { apiGet, apiPatch, loginToApi } from '../helpers/touchorbit-api'

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
  const body = await response.json().catch(() => null)

  if (!response.ok() || !body?.ok) {
    throw new Error(body?.error || body?.message || 'Employee login failed')
  }
}

function previousWeekdayDate(): string {
  const date = new Date()
  date.setDate(date.getDate() - 3)
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() - 1)
  }
  return date.toISOString().slice(0, 10)
}

test.describe('Employee request functional workflows', () => {
  test.beforeEach(async ({ page }) => {
    await loginEmployee(page)
  })

  test('EF7.1 employee submits a comp-off request', async ({ page }) => {
    const note = `E2E comp-off request ${Date.now()}`

    await page.goto('/comp-off')
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByText(/Comp-Off Balance/i)).toBeVisible({ timeout: 15000 })

    await page.getByRole('button', { name: /request comp-off/i }).click()
    await expect(page.getByText(/^Request Comp-Off$/i)).toBeVisible()
    await page.locator('input[type="date"]').fill(previousWeekdayDate())
    await page.getByPlaceholder(/reason for working/i).fill(note)
    await page.getByRole('button', { name: /submit request/i }).click()

    await expect(page.getByText(/Comp-off request submitted/i)).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByText(note)).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/pending/i).first()).toBeVisible()
  })

  test('EF7.2 employee submits an encashment request', async ({ page, request }) => {
    const reason = `E2E encashment request ${Date.now()}`
    const token = await loginToApi(request)
    const original = await apiGet<{ organization?: { encashment_allowed?: boolean } }>(
      request,
      token,
      '/organizations/settings',
    )

    try {
      await apiPatch<{ updated: boolean }>(request, token, '/organizations/settings', {
        encashment_allowed: true,
      })
      await page.goto('/encashment')
      await expect(page).not.toHaveURL(/\/login/)
      await expect(page.getByText(/New Claim Request/i)).toBeVisible({ timeout: 15000 })

      await page.getByPlaceholder(/number of days/i).fill('0.5')
      await page.getByPlaceholder(/brief reason/i).fill(reason)
      await page.getByRole('button', { name: /submit request/i }).click()

      await expect(page.getByText(/Request submitted/i)).toBeVisible({ timeout: 15000 })
      await expect(page.getByText(/0\.50? Days/i).first()).toBeVisible({ timeout: 15000 })
    } finally {
      await apiPatch<{ updated: boolean }>(request, token, '/organizations/settings', {
        encashment_allowed: original.organization?.encashment_allowed ?? false,
      }).catch(() => undefined)
    }
  })
})
