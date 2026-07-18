import { test, expect } from '@playwright/test'
import { expectProtectedPageLoaded } from '../helpers/page-load'

test.describe('Expenses', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\?_rsc=/, route => route.abort())
  })

  test('8.1 expenses page loads', async ({ page }) => {
    await page.goto('/expenses')
    await expectProtectedPageLoaded(page, /expense|claims|categories|no records|empty/i)
  })
})
