import { test, expect } from '@playwright/test'
import { expectProtectedPageLoaded } from '../helpers/page-load'

test.describe('Assets', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\?_rsc=/, route => route.abort())
  })

  test('9.1 assets page loads', async ({ page }) => {
    await page.goto('/assets')
    await expectProtectedPageLoaded(page, /asset|assets|no records|empty/i)
  })
})
