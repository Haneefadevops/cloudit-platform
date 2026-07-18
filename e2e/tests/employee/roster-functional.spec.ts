import { expect, test, type Page } from '@playwright/test'
import { ensureSeedEmployee } from '../helpers/touchorbit-api'

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

test.describe('Employee roster functional workflows', () => {
  test.beforeEach(async ({ page, request }) => {
    await ensureSeedEmployee(request)
    await loginEmployee(page)
  })

  test('EF26.1 employee adds and removes an availability slot', async ({ page }) => {
    const reason = `E2E availability ${Date.now()}`

    await page.goto('/roster')
    await expect(page.getByText(/My Availability/i)).toBeVisible({ timeout: 15000 })

    const availabilityPanel = page.getByText(/When I can work/i).locator(
      'xpath=ancestor::div[contains(@class, "bg-white")][1]',
    )
    await availabilityPanel.locator('button').filter({ has: page.locator('svg') }).first().click()
    await availabilityPanel.locator('select').first().selectOption('2')
    await availabilityPanel.locator('input[type="time"]').first().fill('10:00')
    await availabilityPanel.locator('input[type="time"]').nth(1).fill('14:00')
    await availabilityPanel.getByPlaceholder(/School run/i).fill(reason)
    await availabilityPanel.getByRole('button', { name: /^Save$/i }).click()

    await expect(page.getByText(/Availability updated/i)).toBeVisible({ timeout: 15000 })
    await expect(availabilityPanel.getByText(/10:00-14:00/)).toBeVisible({ timeout: 15000 })

    const slot = availabilityPanel.getByText(/10:00-14:00/).locator(
      'xpath=ancestor::div[contains(@class, "rounded-lg")][1]',
    )
    await slot.locator('button').click()
    await expect(page.getByText(/Removed/i)).toBeVisible({ timeout: 15000 })
    await expect(availabilityPanel.getByText(/10:00-14:00/)).toHaveCount(0)
  })
})
