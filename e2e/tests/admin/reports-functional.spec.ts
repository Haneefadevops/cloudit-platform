import { expect, test } from '@playwright/test'

const reports = [
  { route: '/reports/attendance', heading: /attendance report/i, endpoint: '/api/reports/attendance' },
  { route: '/reports/leave', heading: /leave report/i, endpoint: '/api/reports/leave' },
  { route: '/reports/payroll', heading: /payroll summary/i, endpoint: '/api/reports/payroll' },
  { route: '/reports/roster', heading: /adherence report/i, endpoint: '/api/reports/adherence' },
  { route: '/reports/overtime', heading: /overtime report/i, endpoint: '/api/reports/overtime' },
  { route: '/reports/late', heading: /late arrivals/i, endpoint: '/api/reports/late' },
  { route: '/reports/expense', heading: /expense report/i, endpoint: '/api/reports/expense' },
]

test.describe('Admin reports functional workflows', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\?_rsc=/, route => route.abort())
  })

  for (const report of reports) {
    test(`F22 generates ${report.route} without a report error`, async ({ page }) => {
      await page.goto(report.route)
      await expect(page.getByRole('heading', { name: report.heading })).toBeVisible({
        timeout: 15000,
      })

      await page.getByRole('button', { name: /this month/i }).click()
      const reportResponse = page.waitForResponse(response =>
        response.url().includes(report.endpoint) &&
        response.request().method() === 'GET',
      )
      await page.getByRole('button', { name: /^generate$/i }).click()
      const response = await reportResponse

      expect(response.ok(), `${report.endpoint} status ${response.status()}`).toBe(true)
      await expect(page.getByText(/^Error:/i)).toHaveCount(0)
      await expect(page.getByRole('button', { name: /^generate$/i })).toBeEnabled({
        timeout: 15000,
      })
    })
  }
})
