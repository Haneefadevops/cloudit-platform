import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * Verifies that a protected page loaded while authenticated.
 * Fails clearly if the app redirected to /login.
 */
export async function expectProtectedPageLoaded(page: Page, contentRegex: RegExp): Promise<void> {
  await expect(page).not.toHaveURL(/\/login/)
  await page.getByRole('heading').first().waitFor({ state: 'visible', timeout: 15000 })
  await expect(page.locator('body').getByText(contentRegex).first()).toBeVisible()
}
