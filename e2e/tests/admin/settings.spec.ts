import { test, expect } from '@playwright/test'
import { expectProtectedPageLoaded } from '../helpers/page-load'

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\?_rsc=/, route => route.abort())
  })

  test('19.1 settings page loads', async ({ page }) => {
    await page.goto('/settings')
    await expectProtectedPageLoaded(page, /settings|organization|branches|departments|leave types/i)
  })
})
