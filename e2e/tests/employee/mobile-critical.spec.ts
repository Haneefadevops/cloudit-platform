import { expect, test, type Page } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 } })

async function loginEmployee(page: Page) {
  const email = process.env.E2E_EMPLOYEE_EMAIL || process.env.E2E_SEED_EMPLOYEE_EMAIL
  const password = process.env.E2E_EMPLOYEE_PASSWORD || process.env.E2E_SEED_EMPLOYEE_PASSWORD
  const apiUrl = process.env.E2E_API_URL
  if (!email || !password || !apiUrl) throw new Error('Employee credentials and E2E_API_URL must be set')

  const response = await page.context().request.post(`${apiUrl}/api/auth/login`, {
    data: { email, password },
  })
  expect(response.ok()).toBeTruthy()
}

for (const route of ['/', '/leave', '/roster', '/training', '/org-chart', '/search']) {
  test(`employee critical route is usable at mobile width: ${route}`, async ({ page }) => {
    await loginEmployee(page)
    await page.goto(route)
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.locator('body')).toBeVisible()
    await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  })
}
