import { expect, test, type APIRequestContext } from '@playwright/test'
import { apiGet, apiPost, loginToApi } from '../helpers/touchorbit-api'

type PayrollRun = {
  id: string
  month: number
  year: number
  status: string
  total_employees?: number
}

async function createUniquePayrollRun(request: APIRequestContext, token: string) {
  const runs = await apiGet<PayrollRun[]>(request, token, '/payroll/runs')
  const used = new Set(runs.map(run => `${run.year}-${run.month}`))

  for (const year of [2099, 2100]) {
    for (let month = 1; month <= 12; month++) {
      if (!used.has(`${year}-${month}`)) {
        return apiPost<PayrollRun>(request, token, '/payroll/runs', {
          month,
          year,
          pay_date: `${year}-${String(month).padStart(2, '0')}-28`,
        })
      }
    }
  }

  throw new Error('No unused E2E payroll run period is available between 2099 and 2100')
}

test.describe('Admin payroll functional workflows', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\?_rsc=/, route => route.abort())
  })

  test('F15.1 creates a salary component from the admin UI', async ({ page }) => {
    const name = `E2E Payroll Component ${Date.now()}`

    await page.goto('/payroll/salary-components')
    await expect(page.getByText(/Salary Components/i)).toBeVisible({
      timeout: 15000,
    })

    await page.getByRole('button', { name: /add component/i }).click()
    await expect(page.getByText(/New Component/i)).toBeVisible()
    await page.getByPlaceholder(/transport allowance/i).fill(name)
    await page.locator('select').nth(0).selectOption('earning')
    await page.locator('select').nth(1).selectOption('fixed')
    await page.getByPlaceholder('0.00').fill('1234')
    await page.getByPlaceholder(/optional description/i).fill('Created by frontend E2E')

    const createResponse = page.waitForResponse(
      response =>
        response.url().includes('/api/payroll/salary-components') &&
        response.request().method() === 'POST',
    )
    await page.getByRole('button', { name: /^create$/i }).click()
    const response = await createResponse

    expect(response.ok(), `create response status ${response.status()}`).toBe(true)
    await expect(page.getByText(/Component created successfully/i)).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByText(name)).toBeVisible({ timeout: 15000 })
  })

  test('F15.2 processes a payroll run and shows calculated payroll items', async ({ page, request }) => {
    const token = await loginToApi(request)
    const run = await createUniquePayrollRun(request, token)

    await page.goto(`/payroll/${run.id}/process`)
    await expect(page.getByRole('heading', { name: /Process Payroll/i })).toBeVisible({
      timeout: 15000,
    })

    const processResponse = page.waitForResponse(response =>
      response.url().includes(`/api/payroll/runs/${run.id}/process`) &&
      response.request().method() === 'POST',
    )
    await page.getByRole('button', { name: /Start Processing/i }).click()
    const response = await processResponse

    expect(response.ok(), `process response status ${response.status()}`).toBe(true)
    await expect(page.getByText(/Payroll processed successfully/i)).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByText(/Payroll Summary/i)).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/TOTAL \(/i)).toBeVisible({ timeout: 15000 })

    const updatedRun = await apiGet<PayrollRun>(request, token, `/payroll/runs/${run.id}`)
    expect(updatedRun.total_employees ?? 0).toBeGreaterThan(0)
  })
})
