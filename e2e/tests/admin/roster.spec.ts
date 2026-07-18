import { test, expect } from '@playwright/test'
import { expectProtectedPageLoaded } from '../helpers/page-load'

test.describe('Roster & shifts', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\?_rsc=/, route => route.abort())
  })

  test('12.1 roster page loads', async ({ page }) => {
    await page.goto('/roster')
    await expectProtectedPageLoaded(page, /roster|shift|schedule|no records|empty/i)
  })

  test('12.9 shifts page loads', async ({ page }) => {
    await page.goto('/shifts')
    await expectProtectedPageLoaded(page, /shift|pattern|no records|empty/i)
  })
})
