import { expect, test, type APIRequestContext } from '@playwright/test'
import {
  apiGet,
  apiPost,
  ensureSeedEmployee,
  loginToApi,
  type SeedEmployee,
} from '../helpers/touchorbit-api'

type EncashmentRequest = {
  id: string
  employee_id: string
  year: number
  days_requested: number
  status: string
}

async function seedEncashment(
  request: APIRequestContext,
  token: string,
  employee: SeedEmployee,
): Promise<EncashmentRequest> {
  const year = new Date().getFullYear()
  await apiPost(request, token, `/leave/balances/${employee.id}/adjust`, {
    leave_type: 'annual',
    days: 5,
    reason: 'E2E encashment setup',
  })

  return apiPost<EncashmentRequest>(request, token, '/leave/encashment', {
    employee_id: employee.id,
    year,
    days_requested: 0.5,
    amount: 1000,
    reason: `E2E admin encashment ${Date.now()}`,
  })
}

test.describe('Admin encashment functional workflows', () => {
  let token: string
  let employee: SeedEmployee

  test.beforeAll(async ({ request }) => {
    token = await loginToApi(request)
    employee = (await ensureSeedEmployee(request)).employee
  })

  test.beforeEach(async ({ page }) => {
    await page.route(/\?_rsc=/, route => route.abort())
  })

  test('F7.3 approves a seeded encashment request from the admin UI', async ({ page, request }) => {
    const seeded = await seedEncashment(request, token, employee)

    await page.goto('/encashment')
    await expect(page.getByText(/Leave Encashment/i)).toBeVisible({ timeout: 15000 })
    await page.getByPlaceholder('Search employee...').fill('E2E')
    await expect(page.getByText('E2E Employee').first()).toBeVisible({ timeout: 15000 })

    const decisionResponse = page.waitForResponse(
      response =>
        response.url().includes(`/api/leave/encashment/${seeded.id}`) &&
        response.request().method() === 'POST',
    )
    const row = page.locator('tr').filter({ hasText: 'E2E Employee' }).filter({ hasText: 'pending' }).first()
    await row.locator('button').first().click()
    const response = await decisionResponse

    expect(response.ok(), `approve response status ${response.status()}`).toBe(true)
    await expect(page.getByText(/Request approved successfully/i)).toBeVisible({
      timeout: 15000,
    })

    const refreshed = (await apiGet<EncashmentRequest[]>(request, token, '/leave/encashment'))
      .find(row => row.id === seeded.id)
    expect(refreshed?.status).toBe('approved')
  })

  test('F7.4 rejects a seeded encashment request from the admin UI', async ({ page, request }) => {
    const seeded = await seedEncashment(request, token, employee)

    await page.goto('/encashment')
    await expect(page.getByText(/Leave Encashment/i)).toBeVisible({ timeout: 15000 })
    await page.getByPlaceholder('Search employee...').fill('E2E')
    await expect(page.getByText('E2E Employee').first()).toBeVisible({ timeout: 15000 })

    const decisionResponse = page.waitForResponse(
      response =>
        response.url().includes(`/api/leave/encashment/${seeded.id}`) &&
        response.request().method() === 'POST',
    )
    const row = page.locator('tr').filter({ hasText: 'E2E Employee' }).filter({ hasText: 'pending' }).first()
    await row.locator('button').nth(1).click()
    const response = await decisionResponse

    expect(response.ok(), `reject response status ${response.status()}`).toBe(true)
    await expect(page.getByText(/Request rejected successfully/i)).toBeVisible({
      timeout: 15000,
    })

    const refreshed = (await apiGet<EncashmentRequest[]>(request, token, '/leave/encashment'))
      .find(row => row.id === seeded.id)
    expect(refreshed?.status).toBe('rejected')
  })
})
