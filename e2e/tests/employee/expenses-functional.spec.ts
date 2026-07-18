import { expect, test, type Page } from '@playwright/test'

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
  const body = await response.json().catch(() => null)

  if (!response.ok() || !body?.ok) {
    throw new Error(body?.error || body?.message || 'Employee login failed')
  }
}

test.describe('Employee expenses functional workflows', () => {
  test.beforeEach(async ({ page }) => {
    await loginEmployee(page)
  })

  test('EF8.1 employee submits an expense claim', async ({ page }) => {
    const description = `E2E expense claim ${Date.now()}`

    await page.goto('/expenses')
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByText(/My Expenses/i)).toBeVisible({ timeout: 15000 })

    await page.getByRole('button', { name: /new expense claim/i }).click()
    await expect(page.getByRole('heading', { name: /New Expense Claim/i })).toBeVisible()

    const categorySelect = page.locator('select').first()
    await expect(categorySelect).toBeVisible()
    await expect.poll(
      () => categorySelect.locator('option').count(),
      { message: 'expense category options', timeout: 15000 },
    ).toBeGreaterThan(1)

    await categorySelect.selectOption({ index: 1 })
    await page.getByPlaceholder('0.00').fill('1234')
    await page.getByPlaceholder(/what was this expense/i).fill(description)
    await page.getByRole('button', { name: /submit claim/i }).click()

    await expect(page.getByText(/Expense claim submitted/i)).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByText(description)).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/pending/i).first()).toBeVisible()
  })
})
