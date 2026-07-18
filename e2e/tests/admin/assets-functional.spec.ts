import { expect, test } from '@playwright/test'

test.describe('Admin assets functional workflows', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\?_rsc=/, route => route.abort())
  })

  test('F9.1 creates, edits, and deletes an E2E asset', async ({ page }) => {
    const stamp = Date.now()
    const category = `E2E Category ${stamp}`
    const assetName = `E2E Asset ${stamp}`
    const editedName = `${assetName} Edited`
    const serial = `E2E-SN-${stamp}`

    await page.goto('/assets')
    await expect(page.getByText(/Asset Registry/i)).toBeVisible({ timeout: 15000 })

    await page.getByRole('button', { name: /^categories$/i }).click()
    await page.getByRole('button', { name: /add category/i }).click()
    await page.getByPlaceholder(/laptop|mobile/i).fill(category)
    await page.getByRole('button', { name: /^create$/i }).click()
    await expect(page.getByText(/Category created/i)).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(category)).toBeVisible({ timeout: 15000 })

    await page.getByRole('button', { name: /^registry$/i }).click()
    await page.getByRole('button', { name: /add asset/i }).click()
    await expect(page.getByText(/Register Asset/i)).toBeVisible()
    await page.getByPlaceholder(/MacBook Pro/i).fill(assetName)
    await page.locator('select').first().selectOption({ label: category })
    await page.getByPlaceholder(/SN-12345/i).fill(serial)
    await page.getByPlaceholder(/A2779/i).fill('E2E-MODEL')
    await page.getByRole('button', { name: /save asset/i }).click()

    await expect(page.getByText(/Asset created/i)).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(assetName)).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(serial)).toBeVisible()

    let row = page.locator('tr').filter({ hasText: assetName }).first()
    await row.hover()
    await row.locator('button').nth(1).click()
    await expect(page.getByText(/Edit Asset/i)).toBeVisible()
    await page.getByPlaceholder(/MacBook Pro/i).fill(editedName)
    await page.getByRole('button', { name: /save asset/i }).click()

    await expect(page.getByText(/Asset updated/i)).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(editedName)).toBeVisible({ timeout: 15000 })

    row = page.locator('tr').filter({ hasText: editedName }).first()
    await row.hover()
    page.once('dialog', dialog => dialog.accept())
    await row.locator('button').nth(2).click()

    await expect(page.getByText(/Asset deleted/i)).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(editedName)).toHaveCount(0)
  })
})
