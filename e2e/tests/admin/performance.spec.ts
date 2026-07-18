import { test, expect } from '@playwright/test'
import { expectProtectedPageLoaded } from '../helpers/page-load'

test.describe('Performance', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\?_rsc=/, route => route.abort())
  })

  test('14.1 performance page loads', async ({ page }) => {
    await page.goto('/performance')
    await expectProtectedPageLoaded(page, /performance|review|no records|empty/i)
  })
})
