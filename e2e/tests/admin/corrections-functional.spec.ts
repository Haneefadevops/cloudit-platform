import { expect, test } from '@playwright/test'
import {
  apiGet,
  apiPatch,
  apiPost,
  ensureSeedEmployee,
  loginToApi,
  type SeedEmployee,
} from '../helpers/touchorbit-api'

type AttendanceCorrection = {
  id: string
  employee_id: string
  correction_type: string
  requested_time: string
  reason: string
  status: string
}

function correctionTime(): string {
  const date = new Date()
  date.setDate(date.getDate() - 1)
  date.setHours(9, 15, 0, 0)
  return date.toISOString()
}

test.describe('Admin attendance correction functional workflows', () => {
  let token: string
  let employee: SeedEmployee

  test.beforeAll(async ({ request }) => {
    token = await loginToApi(request)
    employee = (await ensureSeedEmployee(request)).employee
  })

  test.beforeEach(async ({ page }) => {
    await page.route(/\?_rsc=/, route => route.abort())
  })

  test('F5.1 approves a seeded attendance correction from the admin UI', async ({ page, request }) => {
    const reason = `E2E correction approve ${Date.now()}`
    const correction = await apiPost<AttendanceCorrection>(
      request,
      token,
      '/attendance/corrections',
      {
        employeeId: employee.id,
        correctionType: 'forgot_in',
        requestedTime: correctionTime(),
        reason,
      },
    )

    try {
      await page.goto('/corrections')
      await expect(page.getByText(/Attendance Corrections/i)).toBeVisible({
        timeout: 15000,
      })
      await expect(page.getByText('E2E Employee').first()).toBeVisible({
        timeout: 15000,
      })
      await expect(page.getByText(reason)).toBeVisible({ timeout: 15000 })

      const row = page.locator('tr').filter({ hasText: reason }).first()
      await row.locator('button').first().click()

      await expect(page.getByText(/Correction approved/i)).toBeVisible({
        timeout: 15000,
      })
      const refreshed = (await apiGet<AttendanceCorrection[]>(
        request,
        token,
        '/attendance/corrections',
      )).find(item => item.id === correction.id)
      expect(refreshed?.status).toBe('approved')
    } finally {
      await apiPatch<AttendanceCorrection>(
        request,
        token,
        `/attendance/corrections/${correction.id}/reject`,
        { reason: 'E2E cleanup' },
      ).catch(() => undefined)
    }
  })
})
