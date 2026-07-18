import { test, expect } from '@playwright/test'
import { expectProtectedPageLoaded } from '../helpers/page-load'

test.describe('Calendar', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\?_rsc=/, route => route.abort())
  })

  test('11.1 calendar page loads', async ({ page }) => {
    await page.goto('/calendar')
    await expectProtectedPageLoaded(page, /calendar|event|no events|empty/i)
  })
})
