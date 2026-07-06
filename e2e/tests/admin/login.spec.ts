import { test, expect } from '@playwright/test'

test.describe('Login page', () => {
  test('rejects invalid credentials', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder(/you@company\.lk/i).fill('invalid@cloudit.lk')
    await page.locator('input[type="password"]').fill('wrongpassword')
    await page.getByRole('button', { name: /sign in/i }).click()

    // We should remain on the login page and see some form of error feedback.
    await expect(page).toHaveURL(/\/login/)
    await expect(
      page.locator('body').getByText(/invalid|failed|unable|too many|error/i).first()
    ).toBeVisible({ timeout: 15000 })
  })
})
