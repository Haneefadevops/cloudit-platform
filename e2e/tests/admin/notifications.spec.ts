import { test, expect } from '@playwright/test'
import { expectProtectedPageLoaded } from '../helpers/page-load'

test.describe('Notifications page', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\?_rsc=/, route => route.abort())
  })

  test('21.1 notifications page loads', async ({ page }) => {
    await page.goto('/notifications')
    await expectProtectedPageLoaded(page, /notification|notifications|no records|empty/i)
  })
})
