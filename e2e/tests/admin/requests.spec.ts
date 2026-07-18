import { test, expect } from '@playwright/test'
import { expectProtectedPageLoaded } from '../helpers/page-load'

test.describe('Requests', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\?_rsc=/, route => route.abort())
  })

  test('17.1 requests page loads', async ({ page }) => {
    await page.goto('/requests')
    await expectProtectedPageLoaded(page, /request|requests|pending|approval|no records|empty/i)
  })
})
