import { test, expect } from '@playwright/test'
import { expectProtectedPageLoaded } from '../helpers/page-load'

test.describe('Org chart', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\?_rsc=/, route => route.abort())
  })

  test('4.1 org chart page loads', async ({ page }) => {
    await page.goto('/employees/org-chart')
    await expectProtectedPageLoaded(page, /org chart|organization|hierarchy|no employees|empty/i)
  })
})
