import { expect, test } from '@playwright/test'

test.describe('Admin expenses functional workflows', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\?_rsc=/, route => route.abort())
  })

  test('F8.1 creates and edits an E2E expense category', async ({ page }) => {
    const stamp = Date.now()
    const category = `E2E Expense Category ${stamp}`
    const edited = `${category} Edited`

    await page.goto('/expenses')
    await expect(page.getByText(/Expense Management/i)).toBeVisible({
      timeout: 15000,
    })

    await page.getByRole('button', { name: /categories/i }).click()
    await page.getByRole('button', { name: /add category|create first category/i }).first().click()
    await expect(page.getByText(/New Category/i)).toBeVisible()
    await page.getByPlaceholder(/Travel|Business Meals/i).fill(category)
    await page.getByPlaceholder(/5000/i).fill('2500')
    await page.getByPlaceholder(/claim eligibility/i).fill('E2E category for expense workflow')
    await page.getByRole('button', { name: /save changes/i }).click()

    await expect(page.getByText(/Category added/i)).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(category)).toBeVisible({ timeout: 15000 })

    const card = page.locator('div').filter({ hasText: category }).first()
    await card.hover()
    await card.locator('button').click()
    await expect(page.getByText(/Edit Category/i)).toBeVisible()
    await page.getByPlaceholder(/Travel|Business Meals/i).fill(edited)
    await page.getByRole('button', { name: /save changes/i }).click()

    await expect(page.getByText(/Category updated/i)).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(edited)).toBeVisible({ timeout: 15000 })
  })
})
