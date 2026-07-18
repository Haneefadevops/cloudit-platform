import { expect, test, type APIRequestContext } from '@playwright/test'
import {
  apiGet,
  apiPost,
  ensureSeedEmployee,
  loginToApi,
  type SeedEmployee,
} from '../helpers/touchorbit-api'

type CompOffRecord = {
  id: string
  employee_id: string
  worked_date: string
  notes: string | null
  status: string
}

function pastWeekday(offset: number): string {
  const date = new Date()
  date.setDate(date.getDate() - offset)
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() - 1)
  }
  return date.toISOString().slice(0, 10)
}

async function createCompOff(
  request: APIRequestContext,
  token: string,
  employee: SeedEmployee,
  offset: number,
): Promise<CompOffRecord> {
  return apiPost<CompOffRecord>(request, token, '/leave/comp-off', {
    employee_id: employee.id,
    worked_date: pastWeekday(offset),
    notes: `E2E admin comp-off ${Date.now()}`,
  })
}

test.describe('Admin comp-off functional workflows', () => {
  let token: string
  let employee: SeedEmployee

  test.beforeAll(async ({ request }) => {
    token = await loginToApi(request)
    employee = (await ensureSeedEmployee(request)).employee
  })

  test.beforeEach(async ({ page }) => {
    await page.route(/\?_rsc=/, route => route.abort())
  })

  test('F7.1 approves a seeded comp-off request from the admin UI', async ({ page, request }) => {
    const seeded = await createCompOff(request, token, employee, 5)

    await page.goto('/comp-off')
    await expect(page.getByText(/Compensatory Off/i)).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: /^pending$/i }).click()
    await expect(page.getByText('E2E Employee').first()).toBeVisible({ timeout: 15000 })

    const decisionResponse = page.waitForResponse(
      response =>
        response.url().includes(`/api/leave/comp-off/${seeded.id}/approve`) &&
        response.request().method() === 'POST',
    )
    const row = page.locator('tr').filter({ hasText: 'E2E Employee' }).first()
    await row.getByTitle('Approve').click()
    const response = await decisionResponse

    expect(response.ok(), `approve response status ${response.status()}`).toBe(true)
    await expect(page.getByText(/Comp-off approved/i)).toBeVisible({ timeout: 15000 })
    const refreshed = (await apiGet<CompOffRecord[]>(request, token, '/leave/comp-off'))
      .find(record => record.id === seeded.id)
    expect(refreshed?.status).toBe('approved')
  })

  test('F7.2 rejects a seeded comp-off request from the admin UI', async ({ page, request }) => {
    const seeded = await createCompOff(request, token, employee, 6)

    await page.goto('/comp-off')
    await expect(page.getByText(/Compensatory Off/i)).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: /^pending$/i }).click()
    await expect(page.getByText('E2E Employee').first()).toBeVisible({ timeout: 15000 })

    const decisionResponse = page.waitForResponse(
      response =>
        /\/api\/leave\/comp-off\/[^/]+\/reject$/.test(response.url()) &&
        response.request().method() === 'POST',
    )
    const row = page
      .locator('tr')
      .filter({ hasText: 'E2E Employee' })
      .filter({ hasText: 'Pending' })
      .first()
    page.once('dialog', dialog => dialog.accept())
    await row.getByTitle('Reject').click()
    const response = await decisionResponse

    expect(response.ok(), `reject response status ${response.status()}`).toBe(true)
    await expect(page.getByText(/Comp-off request rejected/i)).toBeVisible({
      timeout: 15000,
    })
    await expect(row.getByTitle('Reject')).toHaveCount(0)
  })
})
