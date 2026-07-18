import { test, expect } from '@playwright/test'
import { expectProtectedPageLoaded } from '../helpers/page-load'

test.describe('Training', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\?_rsc=/, route => route.abort())
  })

  test('13.1 training page loads', async ({ page }) => {
    await page.goto('/training')
    await expectProtectedPageLoaded(page, /training|course|no records|empty/i)
  })
})
