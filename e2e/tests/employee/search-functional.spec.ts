import { expect, test, type Page } from '@playwright/test'

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

test('employee search uses the local API and renders an empty state', async ({ page }) => {
  await loginEmployee(page)
  await page.goto('/search')

  const responsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/employees?search=') && response.request().method() === 'GET',
  )
  await page.getByPlaceholder(/search employees/i).fill(`phase11-no-match-${Date.now()}`)
  const response = await responsePromise
  expect(response.status()).toBe(200)
  await expect(page.getByText(/no employees found/i)).toBeVisible()
})
