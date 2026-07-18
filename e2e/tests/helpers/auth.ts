import type { Page } from '@playwright/test'

/**
 * Ensures the page is authenticated as the admin user.
 * Uses the existing session if present; otherwise performs a fresh login.
 */
export async function ensureAuthenticated(page: Page): Promise<void> {
  const email = process.env.E2E_ADMIN_EMAIL
  const password = process.env.E2E_ADMIN_PASSWORD

  if (!email || !password) {
    throw new Error('E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD must be set in e2e/.env')
  }

  await page.goto('/')
  await page.waitForLoadState('networkidle')

  // If already on dashboard, just wait for it to load.
  if (page.url().endsWith('/') || page.url() === process.env.E2E_BASE_URL) {
    await page.getByText(/Loading dashboard|Loading…/i).first().waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {})
    return
  }

  // If redirected to login, authenticate fresh.
  if (page.url().includes('/login')) {
    await page.getByPlaceholder(/you@company\.lk/i).fill(email)
    await page.locator('input[type="password"]').fill(password)
    await page.getByRole('button', { name: /sign in/i }).click()

    await page.waitForURL(/\/$/, { timeout: 30000 })
    await page.getByText(/Loading dashboard|Loading…/i).first().waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {})
    return
  }

  throw new Error(`Unexpected page URL during authentication: ${page.url()}`)
}
