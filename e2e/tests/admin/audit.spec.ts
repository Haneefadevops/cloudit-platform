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

  test('22.2 audit filters can be applied and cleared', async ({ page }) => {
    await page.goto('/audit')
    await expectProtectedPageLoaded(page, /audit|log|activity|no records|empty/i)

    const search = page.getByPlaceholder(/actor, target, action, module/i)
    await expect(search).toBeVisible()
    await search.fill('phase-11-no-match')
    await page.getByRole('combobox').first().selectOption('employees')
    await expect(page.getByRole('button', { name: /clear \(2\)/i })).toBeVisible()

    await page.getByRole('button', { name: /clear/i }).click()
    await expect(search).toHaveValue('')
    await expect(page.getByRole('combobox').first()).toHaveValue('')
  })

  test('22.3 audit export reflects permission and loaded rows', async ({ page }) => {
    await page.goto('/audit')
    await expectProtectedPageLoaded(page, /audit|log|activity|no records|empty/i)

    const exportButton = page.getByRole('button', { name: /export/i })
    await expect(exportButton).toBeVisible()
    const resultText = (await page.getByText(/\d+ results/i).textContent()) || '0'
    const resultCount = Number(resultText.match(/\d+/)?.[0] || '0')
    if (resultCount > 0) await expect(exportButton).toBeEnabled()
    else await expect(exportButton).toBeDisabled()
  })
})
