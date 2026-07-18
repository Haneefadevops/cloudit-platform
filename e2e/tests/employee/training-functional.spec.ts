import { expect, test, type Page } from '@playwright/test'
import {
  apiDel,
  apiGet,
  ensureSeedEmployee,
  loginToApi,
  type SeedEmployee,
} from '../helpers/touchorbit-api'

type EmployeeTrainingPayload = {
  personal?: Array<{ id: string; training_name: string }>
}

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

function dateOffset(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

test.describe('Employee training functional workflows', () => {
  let seedEmployee: SeedEmployee

  async function deleteE2ETrainingLogs(request: Parameters<typeof apiGet>[0]) {
    const token = await loginToApi(request)
    seedEmployee = seedEmployee || (await ensureSeedEmployee(request)).employee
    const payload = await apiGet<EmployeeTrainingPayload>(
      request,
      token,
      `/training/employee/${seedEmployee.id}`,
    ).catch(() => ({ personal: [] }))
    const records = payload.personal || []
    for (const record of records) {
      if (record.training_name.startsWith('E2E Personal Training')) {
        await apiDel<{ id: string }>(
          request,
          token,
          `/training/employee-records/${record.id}`,
        ).catch(() => undefined)
      }
    }
  }

  test.beforeEach(async ({ page }) => {
    await loginEmployee(page)
  })

  test('EF13.1 employee creates, edits, and deletes a personal training log', async ({ page, request }) => {
    const stamp = Date.now()
    const originalName = `E2E Personal Training ${stamp}`
    const updatedName = `E2E Personal Training Updated ${stamp}`

    await deleteE2ETrainingLogs(request)

    try {
      await page.goto('/training')
      await expect(page).not.toHaveURL(/\/login/)
      await expect(page.getByText(/Personal Log/i)).toBeVisible({ timeout: 15000 })

      await page.getByRole('button', { name: /log new/i }).click()
      await expect(page.getByText(/Add Learning/i)).toBeVisible()
      await page.getByPlaceholder(/aws cloud practitioner/i).fill(originalName)
      await page.locator('input[type="date"]').nth(0).fill(dateOffset(-14))
      await page.locator('input[type="date"]').nth(1).fill(dateOffset(-7))
      await page.getByPlaceholder(/briefly describe/i).fill('Created by frontend E2E')
      await page.getByRole('button', { name: /confirm entry/i }).click()

      await expect(page.getByText(/Record saved/i).first()).toBeVisible({
        timeout: 15000,
      })
      await expect(page.getByText(originalName)).toBeVisible({ timeout: 15000 })

      const card = page
        .getByText(originalName)
        .locator('xpath=ancestor::div[contains(@class, "group")][1]')
      await card.locator('button').first().click()
      await expect(page.getByText(/Edit Learning/i)).toBeVisible()
      await page.getByPlaceholder(/aws cloud practitioner/i).fill(updatedName)
      await page.getByRole('button', { name: /confirm entry/i }).click()

      await expect(page.getByText(/Record saved/i).first()).toBeVisible({
        timeout: 15000,
      })
      await expect(page.getByText(updatedName)).toBeVisible({ timeout: 15000 })

      const updatedCard = page
        .getByText(updatedName)
        .locator('xpath=ancestor::div[contains(@class, "group")][1]')
      page.once('dialog', dialog => dialog.accept())
      await updatedCard.locator('button').last().click()

      await expect(page.getByText(/Deleted/i).first()).toBeVisible({ timeout: 15000 })
      await expect(page.getByText(updatedName)).toHaveCount(0)
    } finally {
      await deleteE2ETrainingLogs(request)
    }
  })
})
