import { expect, test } from '@playwright/test'
import { ensureSeedEmployee, type SeedEmployee } from '../helpers/touchorbit-api'

function previousWeekdayDate(): string {
  const date = new Date()
  date.setDate(date.getDate() - 2)
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() - 1)
  }
  return date.toISOString().slice(0, 10)
}

test.describe('Admin overtime functional workflows', () => {
  let employee: SeedEmployee

  test.beforeAll(async ({ request }) => {
    employee = (await ensureSeedEmployee(request)).employee
  })

  test.beforeEach(async ({ page }) => {
    await page.route(/\?_rsc=/, route => route.abort())
  })

  test('F7.3 creates a manual overtime record from the admin UI', async ({ page }) => {
    const reason = `E2E manual overtime ${Date.now()}`

    await page.goto('/overtime')
    await expect(page.getByText(/Overtime & Comp-Off/i)).toBeVisible({
      timeout: 15000,
    })

    await page.getByRole('button', { name: /manual entry/i }).click()
    await expect(page.getByText(/Manual Overtime Entry/i)).toBeVisible()

    const employeeSelect = page.locator('select').first()
    await expect(employeeSelect).toContainText('E2E Employee', { timeout: 15000 })
    await employeeSelect.selectOption(employee.id)
    await page.locator('input[type="date"]').fill(previousWeekdayDate())
    await page.locator('input[type="number"]').fill('1.5')
    await page.getByPlaceholder(/why is this ot/i).fill(reason)

    await page.getByRole('button', { name: /create record/i }).click()

    await expect(page.getByText(/Overtime record created/i)).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByText(reason)).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/pending/i).first()).toBeVisible()
  })
})
