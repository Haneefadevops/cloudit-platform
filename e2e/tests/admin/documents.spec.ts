import { test, expect } from '@playwright/test'
import { expectProtectedPageLoaded } from '../helpers/page-load'

test.describe('Documents', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\?_rsc=/, route => route.abort())
  })

  test('10.1 documents page loads', async ({ page }) => {
    await page.goto('/documents')
    await expectProtectedPageLoaded(page, /document|documents|no records|empty/i)
  })
})
