import { expect, test } from '@playwright/test'
import {
  apiDel,
  apiGet,
  ensureSeedEmployee,
  loginToApi,
  type SeedEmployee,
} from '../helpers/touchorbit-api'

type Goal = {
  id: string
  employee_id: string
  title: string
}

function isoDatePlus(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

test.describe('Admin performance functional workflows', () => {
  let token: string
  let employee: SeedEmployee

  test.beforeAll(async ({ request }) => {
    token = await loginToApi(request)
    employee = (await ensureSeedEmployee(request)).employee
  })

  test.beforeEach(async ({ page }) => {
    await page.route(/\?_rsc=/, route => route.abort())
  })

  test('F14.1 assigns an employee goal from the admin UI', async ({ page, request }) => {
    const title = `E2E Performance Goal ${Date.now()}`

    try {
      await page.goto('/performance')
      await expect(page.getByText(/Performance & Goals/i)).toBeVisible({
        timeout: 15000,
      })

      await page.getByRole('button', { name: /^goals$/i }).click()
      await expect(page.getByRole('button', { name: /assign goal/i })).toBeVisible({
        timeout: 15000,
      })
      await page.getByRole('button', { name: /assign goal|assign first goal/i }).first().click()
      await expect(page.getByText(/Assign New Goal/i)).toBeVisible()

      const employeeSelect = page.locator('select').first()
      await expect(employeeSelect).toContainText('E2E Employee', { timeout: 15000 })
      await employeeSelect.selectOption(employee.id)
      await page.getByPlaceholder(/increase system uptime/i).fill(title)
      await page.getByPlaceholder(/percent, total/i).fill('Tickets')
      await page.locator('input[type="number"]').fill('5')

      const createResponse = page.waitForResponse(
        response =>
          response.url().includes('/api/performance/goals') &&
          response.request().method() === 'POST',
      )
      await page.locator('form').getByRole('button', { name: /^assign goal$/i }).click()
      const response = await createResponse

      expect(response.ok(), `goal create response status ${response.status()}`).toBe(true)
      await expect(page.getByText(/Goal assigned/i)).toBeVisible({ timeout: 15000 })
      await expect(page.getByText(title)).toBeVisible({ timeout: 15000 })
    } finally {
      const goals = await apiGet<Goal[]>(request, token, '/performance/goals').catch(() => [])
      for (const goal of goals) {
        if (goal.employee_id === employee.id && goal.title === title) {
          await apiDel<{ id: string }>(request, token, `/performance/goals/${goal.id}`).catch(() => undefined)
        }
      }
    }
  })

  test('F14.2 creates a performance review cycle from the admin UI', async ({ page }) => {
    const title = `E2E Performance Cycle ${Date.now()}`

    await page.goto('/performance')
    await expect(page.getByText(/Performance & Goals/i)).toBeVisible({
      timeout: 15000,
    })

    await page.getByRole('button', { name: /^cycles$/i }).click()
    await page.getByRole('button', { name: /new cycle|create first cycle/i }).first().click()
    await expect(page.getByText(/New Review Cycle/i)).toBeVisible({
      timeout: 15000,
    })

    await page.getByPlaceholder(/Annual Performance Review/i).fill(title)
    await page.locator('input[type="date"]').first().fill(isoDatePlus(1))
    await page.locator('input[type="date"]').nth(1).fill(isoDatePlus(31))

    const createResponse = page.waitForResponse(response =>
      response.url().includes('/api/performance/cycles') &&
      response.request().method() === 'POST',
    )
    await page.locator('form').getByRole('button', { name: /create cycle/i }).click()
    const response = await createResponse

    expect(response.ok(), `cycle create response status ${response.status()}`).toBe(true)
    await expect(page.getByText(/Review cycle created/i)).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByText(title)).toBeVisible({ timeout: 15000 })
  })
})
