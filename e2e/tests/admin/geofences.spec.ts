import { test, expect } from '@playwright/test'

test.describe('Geofences', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\?_rsc=/, route => route.abort())
  })

  test('20.1 geofences page loads', async ({ page }) => {
    await page.goto('/geofences')
    await expect(page).not.toHaveURL(/\/login/)
    await page.getByText(/zones|geofence|No zones found|ADD ZONE/i).first().waitFor({ state: 'visible', timeout: 15000 })
    await expect(page.locator('body').getByText(/zones|geofence|No zones found|ADD ZONE/i).first()).toBeVisible()
  })
})
