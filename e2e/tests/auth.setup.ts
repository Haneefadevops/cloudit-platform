import { test as setup, expect } from '@playwright/test'
import { resolve } from 'node:path'

const adminFile = resolve(__dirname, '../.auth/admin.json')

setup('authenticate as admin', async ({ page }) => {
  // Allow time for the live API throttle window to reset if a previous run
  // exhausted its request budget.
  setup.setTimeout(180000)

  const email = process.env.E2E_ADMIN_EMAIL
  const password = process.env.E2E_ADMIN_PASSWORD

  if (!email || !password) {
    throw new Error(
      'E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD must be set in e2e/.env'
    )
  }

  let attempts = 0
  const maxAttempts = 3

  while (attempts < maxAttempts) {
    attempts++

    await page.goto('/login')

    // Wait for the branded login form
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()

    const emailInput = page.getByPlaceholder(/you@company\.lk/i)
    const passwordInput = page.locator('input[type="password"]')
    const submitButton = page.getByRole('button', { name: /sign in/i })

    await emailInput.fill(email)
    await passwordInput.fill(password)

    // Ensure the submit button is interactive before clicking
    await expect(submitButton).toBeVisible()
    await expect(submitButton).toBeEnabled()

    await submitButton.click()

    try {
      await page.waitForURL(/\/$/, { timeout: 15000 })
      break
    } catch {
      const bodyText = await page.locator('body').textContent().catch(() => '')
      const throttled = bodyText?.includes('Too Many Requests') ?? false
      if (throttled && attempts < maxAttempts) {
        // Wait for the throttle window to roll over before retrying.
        await page.waitForTimeout(65000)
      }
    }
  }

  if (!page.url().endsWith('/')) {
    throw new Error('Failed to authenticate as admin')
  }

  // Dashboard should render
  await expect(
    page.getByRole('heading', { name: /good afternoon|good morning|dashboard/i }).first()
  ).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('Loading…')).toHaveCount(0, { timeout: 15000 })

  await page.context().storageState({ path: adminFile })
})
