import { test, expect } from '@playwright/test'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Block Next.js speculative RSC prefetches for routes we are not testing.
    // The dashboard eagerly prefetches many sidebar items, and each prefetch
    // triggers an auth check on the live API, quickly exhausting its throttle.
    await page.route(/\?_rsc=/, route => route.abort())

    await page.goto('/')
    // Wait for the global loading spinner to disappear
    await expect(page.getByText('Loading…')).toHaveCount(0, { timeout: 15000 })
  })

  test('displays dashboard heading and key widgets', async ({ page }) => {
    // The dashboard greets the signed-in user
    await expect(
      page.getByRole('heading', { name: /good afternoon|good morning|dashboard/i }).first()
    ).toBeVisible()

    // Default owner widgets should render (API-backed, no Supabase)
    await expect(page.getByText(/Today's Attendance/i).first()).toBeVisible()
    await expect(page.getByText(/Headcount/i).first()).toBeVisible()
    await expect(page.getByText(/Pending Leave/i).first()).toBeVisible()
  })
})
