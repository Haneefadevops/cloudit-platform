import { test, expect } from '@playwright/test'
import { expectProtectedPageLoaded } from '../helpers/page-load'

test.describe('Reports', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\?_rsc=/, route => route.abort())
  })

  test('16.1 reports hub loads', async ({ page }) => {
    await page.goto('/reports')
    await expectProtectedPageLoaded(page, /report|reports|attendance|leave|payroll/i)
  })
})
