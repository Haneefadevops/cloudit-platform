import { test, expect } from '@playwright/test'
import { expectProtectedPageLoaded } from '../helpers/page-load'

test.describe('Leave', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\?_rsc=/, route => route.abort())
  })

  test('6.1 leave page loads', async ({ page }) => {
    await page.goto('/leave')
    await expectProtectedPageLoaded(page, /leave|requests|pending|approved|rejected|no records|empty/i)
  })
})
