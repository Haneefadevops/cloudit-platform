import { test, expect } from '@playwright/test'
import { expectProtectedPageLoaded } from '../helpers/page-load'

test.describe('Announcements', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\?_rsc=/, route => route.abort())
  })

  test('18.1 announcements page loads', async ({ page }) => {
    await page.goto('/announcements')
    await expectProtectedPageLoaded(page, /announcement|announcements|no records|empty/i)
  })
})
