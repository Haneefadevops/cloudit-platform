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

test.describe('Employee notification functional workflows', () => {
  test.beforeEach(async ({ page, request }) => {
    await ensureSeedEmployee(request)
    await loginEmployee(page)
  })

  test('EF28.1 employee marks notifications read and deletes a read notification', async ({ page }) => {
    await page.goto('/notifications')
    await expect(page.getByText(/^Notifications$/i)).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/Loading notifications/i)).toHaveCount(0, { timeout: 15000 })

    const emptyState = page.getByText(/No notifications yet/i)
    if (await emptyState.isVisible().catch(() => false)) {
      test.skip(true, 'No employee notifications are available to exercise mark/delete actions')
    }

    const markAll = page.getByRole('button', { name: /Mark all read/i })
    if (await markAll.isVisible().catch(() => false)) {
      const markResponses = page.waitForResponse(response =>
        /\/api\/notifications\/[^/]+\/read$/.test(response.url()) &&
        response.request().method() === 'PATCH',
      )
      await markAll.click()
      const response = await markResponses
      expect(response.ok(), `mark-read response status ${response.status()}`).toBe(true)
      await expect(markAll).toHaveCount(0, { timeout: 15000 })
    }

    const deleteButton = page.locator('button').filter({ has: page.locator('svg') }).last()
    const deleteResponse = page.waitForResponse(response =>
      /\/api\/notifications\/[^/]+$/.test(response.url()) &&
      response.request().method() === 'DELETE',
    )
    await deleteButton.click()
    const response = await deleteResponse

    expect(response.ok(), `delete response status ${response.status()}`).toBe(true)
  })
})
