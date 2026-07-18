import { test, expect } from '@playwright/test'
import { expectProtectedPageLoaded } from '../helpers/page-load'

test.describe('Attendance', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\?_rsc=/, route => route.abort())
  })

  test('5.1 attendance page loads', async ({ page }) => {
    await page.goto('/attendance')
    await expectProtectedPageLoaded(page, /attendance|calendar|records|no records|empty/i)
  })
})
