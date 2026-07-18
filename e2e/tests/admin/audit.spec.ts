import { test, expect } from '@playwright/test'
import { expectProtectedPageLoaded } from '../helpers/page-load'

test.describe('Audit log', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\?_rsc=/, route => route.abort())
  })

  test('22.1 audit page loads', async ({ page }) => {
    await page.goto('/audit')
    await expectProtectedPageLoaded(page, /audit|log|activity|no records|empty/i)
  })
})
