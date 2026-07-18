import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import {
  apiGet,
  apiPost,
  ensureSeedEmployee,
  loginToApi,
  type SeedEmployee,
} from '../helpers/touchorbit-api'

type LeaveRequest = {
  id: string
  employee_id: string
  leave_type: string
  start_date: string
  end_date: string
  reason: string
  status: string
}

function futureWeekday(offset: number): string {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1)
  }
  return date.toISOString().slice(0, 10)
}

async function createLeaveRequest(
  request: APIRequestContext,
  token: string,
  employee: SeedEmployee,
  reason: string,
  offset: number,
): Promise<LeaveRequest> {
  const leaveDate = futureWeekday(offset)
  return apiPost<LeaveRequest>(request, token, '/leave/requests', {
    employee_id: employee.id,
    leave_type: 'annual',
    start_date: leaveDate,
    end_date: leaveDate,
    reason,
  })
}

async function openSeededLeaveRequest(page: Page, reason: string) {
  await page.goto('/leave')
  await expect(page.getByText(/Leave Management/i)).toBeVisible({ timeout: 15000 })
  const allFilter = page.getByRole('button', { name: /^All$/ })
  await expect(allFilter).toBeVisible({ timeout: 15000 })
  await expect(page.getByText(/No requests found|Working Days|Annual Leave|Pending/i).first()).toBeVisible({
    timeout: 15000,
  })
  await allFilter.click()
  await page.waitForTimeout(500)
  await allFilter.click()

  const employeeRows = page.getByText('E2E Employee')
  await expect(employeeRows.first()).toBeVisible({ timeout: 15000 })

  const count = await employeeRows.count()
  for (let index = 0; index < count; index += 1) {
    await employeeRows.nth(index).click()
    const reasonText = page.getByText(reason)
    if (await reasonText.isVisible().catch(() => false)) {
      return
    }
  }

  throw new Error(`Seeded leave request was not visible in admin leave list: ${reason}`)
}

test.describe('Admin leave functional workflows', () => {
  let token: string
  let employee: SeedEmployee

  test.beforeAll(async ({ request }) => {
    token = await loginToApi(request)
    employee = (await ensureSeedEmployee(request)).employee
  })

  test.beforeEach(async ({ page }) => {
    await page.route(/\?_rsc=/, route => route.abort())
  })

  test('F6.1 approves a seeded leave request from the admin UI', async ({ page, request }) => {
    const reason = `E2E admin approve leave ${Date.now()}`
    const seeded = await createLeaveRequest(request, token, employee, reason, 9)

    await openSeededLeaveRequest(page, reason)

    const decisionResponse = page.waitForResponse(
      response =>
        response.url().includes(`/api/leave/requests/${seeded.id}`) &&
        response.request().method() === 'POST',
    )
    await page.getByRole('button', { name: /approve request/i }).click()
    const response = await decisionResponse
    expect(response.ok(), `approve response status ${response.status()}`).toBe(true)
    await expect(page.getByText(/Request approved successfully/i)).toBeVisible({
      timeout: 15000,
    })

    const refreshed = await apiGet<LeaveRequest>(request, token, `/leave/requests/${seeded.id}`)
    expect(refreshed.status).toBe('approved')
  })

  test('F6.2 rejects a seeded leave request from the admin UI', async ({ page, request }) => {
    const reason = `E2E admin reject leave ${Date.now()}`
    const seeded = await createLeaveRequest(request, token, employee, reason, 12)

    await openSeededLeaveRequest(page, reason)

    await page
      .getByPlaceholder(/rejection reason|internal notes/i)
      .fill('E2E rejection validation')
    const decisionResponse = page.waitForResponse(
      response =>
        response.url().includes(`/api/leave/requests/${seeded.id}`) &&
        response.request().method() === 'POST',
    )
    await page.getByRole('button', { name: /^reject$/i }).click()
    const response = await decisionResponse

    expect(response.ok(), `reject response status ${response.status()}`).toBe(true)
    await expect(page.getByText(/Request rejected successfully/i)).toBeVisible({
      timeout: 15000,
    })

    const refreshed = await apiGet<LeaveRequest>(request, token, `/leave/requests/${seeded.id}`)
    expect(refreshed.status).toBe('rejected')
  })
})
