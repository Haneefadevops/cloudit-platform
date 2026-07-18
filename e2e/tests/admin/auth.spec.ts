import { test, expect } from '@playwright/test'

test.describe('Authentication & onboarding — authenticated', () => {
  test.beforeEach(async ({ page }) => {
    // Block Next.js speculative RSC prefetches to avoid API throttle exhaustion.
    await page.route(/\?_rsc=/, route => route.abort())
  })

  test('1.6 direct access to login while authenticated redirects to dashboard', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/Loading dashboard|Loading…/i)).toHaveCount(0, { timeout: 15000 })

    await page.goto('/login')
    await page.waitForURL(/\/$/, { timeout: 15000 })
    await expect(
      page.getByRole('heading', { name: /good afternoon|good morning|good evening|dashboard/i }).first()
    ).toBeVisible()
  })

  test('1.10 spoofing review page loads flagged clock-ins', async ({ page }) => {
    await page.goto('/spoofing-review')

    // Wait for the page loading state to disappear.
    await expect(page.getByText(/Loading dashboard|Loading…/i)).toHaveCount(0, { timeout: 15000 })

    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible()

    const hasListRow = await page.locator('table tbody tr, [role="row"]').first().isVisible().catch(() => false)
    const hasEmptyState = await page
      .locator('body')
      .getByText(/no spoofing|no flagged|no records|empty/i)
      .first()
      .isVisible()
      .catch(() => false)

    expect(hasListRow || hasEmptyState).toBe(true)
  })
})
