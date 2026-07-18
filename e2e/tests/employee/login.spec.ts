import { test, expect } from '@playwright/test'

test.describe('Employee authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/login')
  })

  test('E1.1 valid employee login opens employee dashboard', async ({ page }) => {
    const email =
      process.env.E2E_EMPLOYEE_EMAIL || process.env.E2E_SEED_EMPLOYEE_EMAIL
    const password =
      process.env.E2E_EMPLOYEE_PASSWORD || process.env.E2E_SEED_EMPLOYEE_PASSWORD

    if (!email || !password) {
      throw new Error(
        'E2E_EMPLOYEE_EMAIL/E2E_EMPLOYEE_PASSWORD or seed employee credentials must be set',
      )
    }

    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()
    await page.locator('input[type="email"]').fill(email)
    await page.locator('input[type="password"]').fill(password)
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page).toHaveURL(/\/$/, { timeout: 15000 })
    await expect(
      page.locator('body').getByText(/Working Hours Today|Clock In|Offline|Announcements/i).first(),
    ).toBeVisible({ timeout: 15000 })
  })

  test('E1.2 invalid employee login shows error and stays on login', async ({ page }) => {
    await page.locator('input[type="email"]').fill('invalid.employee@touchorbit.test')
    await page.locator('input[type="password"]').fill('wrong-password')
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page).toHaveURL(/\/login/)
    await expect(
      page.locator('body').getByText(/invalid|failed|unable|too many|error/i).first(),
    ).toBeVisible({ timeout: 15000 })
  })
})
