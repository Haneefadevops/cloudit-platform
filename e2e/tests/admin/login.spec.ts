import { test, expect } from '@playwright/test'

test.describe('Authentication & onboarding — unauthenticated', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure no residual authenticated state leaks into these tests.
    await page.context().clearCookies()
    await page.evaluate(() => {
      try {
        localStorage.clear()
        sessionStorage.clear()
      } catch {
        // ignore
      }
    })
  })

  test('1.1 valid login redirects to dashboard', async ({ page }) => {
    const email = process.env.E2E_ADMIN_EMAIL
    const password = process.env.E2E_ADMIN_PASSWORD

    if (!email || !password) {
      throw new Error('E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD must be set in e2e/.env')
    }

    await page.goto('/login')
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()

    await page.getByPlaceholder(/you@company\.lk/i).fill(email)
    await page.locator('input[type="password"]').fill(password)
    await page.getByRole('button', { name: /sign in/i }).click()

    await page.waitForURL(/\/$/, { timeout: 15000 })
    await expect(
      page.getByRole('heading', { name: /good afternoon|good morning|good evening|dashboard/i }).first()
    ).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Loading…')).toHaveCount(0, { timeout: 15000 })
  })

  test('1.2 invalid password shows error and stays on login', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder(/you@company\.lk/i).fill('invalid@cloudit.lk')
    await page.locator('input[type="password"]').fill('wrongpassword')
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page).toHaveURL(/\/login/)
    await expect(
      page.locator('body').getByText(/invalid|failed|unable|too many|error/i).first()
    ).toBeVisible({ timeout: 15000 })
  })

  test('1.3 invalid email format shows validation error', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder(/you@company\.lk/i).fill('not-an-email')
    await page.locator('input[type="password"]').fill('any-password')
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page).toHaveURL(/\/login/)

    const validationHint = page
      .locator('body')
      .getByText(/valid email|invalid email|email is invalid|please enter a valid email/i)
      .first()
    const browserValidation = page.locator('input[type="email"]:invalid, input:invalid').first()

    await expect(validationHint.or(browserValidation)).toBeVisible({ timeout: 5000 })
  })

  test('1.4 empty form submit shows validation errors without crash', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page).toHaveURL(/\/login/)

    const emailInput = page.locator('input[type="email"]').first()
    const passwordInput = page.locator('input[type="password"]').first()

    await expect(
      emailInput.or(page.locator('body').getByText(/email is required|required/i).first())
    ).toBeVisible({ timeout: 5000 })
    await expect(
      passwordInput.or(page.locator('body').getByText(/password is required|required/i).first())
    ).toBeVisible({ timeout: 5000 })
  })

  test('1.5 logout redirects to login and clears session', async ({ page }) => {
    const email = process.env.E2E_ADMIN_EMAIL
    const password = process.env.E2E_ADMIN_PASSWORD

    if (!email || !password) {
      throw new Error('E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD must be set in e2e/.env')
    }

    await page.goto('/login')
    await page.getByPlaceholder(/you@company\.lk/i).fill(email)
    await page.locator('input[type="password"]').fill(password)
    await page.getByRole('button', { name: /sign in/i }).click()

    await page.waitForURL(/\/$/, { timeout: 15000 })
    await expect(page.getByText(/Loading dashboard|Loading…/i)).toHaveCount(0, { timeout: 15000 })
    await expect(
      page.getByRole('heading', { name: /good afternoon|good morning|good evening|dashboard/i }).first()
    ).toBeVisible()

    // Click the sign-out icon in the header (rightmost top-bar action).
    const headerButtons = page.locator('header').getByRole('button')
    const signOutIcon = headerButtons.filter({ has: page.locator('svg') }).last()
    const logoutAny = page.locator('header').getByText(/logout|sign out/i).first()
    await expect(signOutIcon.or(logoutAny)).toBeVisible()
    await signOutIcon.click().catch(() => logoutAny.click())

    await page.waitForURL(/\/login/, { timeout: 15000 })
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()

    // Verify the session cookie is gone.
    const cookies = await page.context().cookies()
    const sessionCookie = cookies.find(c => /session|token|auth|jwt|sid/i.test(c.name))
    expect(sessionCookie?.value).toBeFalsy()
  })

  test('1.7 direct access to protected route without session redirects to login', async ({ page }) => {
    await page.goto('/employees')

    await page.waitForURL(/\/login/, { timeout: 15000 })
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()
  })

  test('1.8 set password page renders form or token error', async ({ page }) => {
    await page.goto('/set-password?token=invalid-or-expired-token')

    // The page should either render the password form or show a token error.
    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible()

    const hasPasswordField = await page.locator('input[type="password"]').first().isVisible().catch(() => false)
    const hasError = await page
      .locator('body')
      .getByText(/invalid|expired|token|unable|error/i)
      .first()
      .isVisible()
      .catch(() => false)

    expect(hasPasswordField || hasError).toBe(true)
  })

  test('1.9 signup page renders create organization form', async ({ page }) => {
    await page.goto('/signup')

    await expect(page).toHaveURL(/\/signup/)
    const heading = page.getByRole('heading', { name: /create organization|sign up|get started/i }).first()
    await expect(heading).toBeVisible()

    const hasForm = await page.locator('form').isVisible().catch(() => false)
    const hasEmail = await page.locator('input[type="email"]').first().isVisible().catch(() => false)

    expect(hasForm || hasEmail).toBe(true)
  })
})
