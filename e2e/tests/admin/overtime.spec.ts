import { test, expect } from '@playwright/test'
import { expectProtectedPageLoaded } from '../helpers/page-load'

test.describe('Overtime, comp-off, encashment', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\?_rsc=/, route => route.abort())
  })

  test('7.1 overtime page loads', async ({ page }) => {
    await page.goto('/overtime')
    await expectProtectedPageLoaded(page, /overtime|records|policy|no records|empty/i)
  })

  test('7.7 comp-off page loads', async ({ page }) => {
    await page.goto('/comp-off')
    await expectProtectedPageLoaded(page, /comp-off|comp off|records|no records|empty/i)
  })

  test('7.9 encashment page loads', async ({ page }) => {
    await page.goto('/encashment')
    await expectProtectedPageLoaded(page, /encashment|records|no records|empty/i)
  })
})
