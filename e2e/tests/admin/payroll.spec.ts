import { test, expect } from '@playwright/test'
import { expectProtectedPageLoaded } from '../helpers/page-load'

test.describe('Payroll', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\?_rsc=/, route => route.abort())
  })

  test('15.1 payroll page loads', async ({ page }) => {
    await page.goto('/payroll')
    await expectProtectedPageLoaded(page, /payroll|period|salary|no records|empty/i)
  })
})
