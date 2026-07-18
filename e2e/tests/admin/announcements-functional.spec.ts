import { expect, test } from '@playwright/test'

test.describe('Admin announcements functional workflows', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\?_rsc=/, route => route.abort())
  })

  test('F18.1 creates and deletes an E2E announcement', async ({ page }) => {
    const title = `E2E Announcement ${Date.now()}`
    const content = `Created by Playwright functional coverage at ${new Date().toISOString()}`

    await page.goto('/announcements')
    await expect(page.getByText(/Company Announcements/i)).toBeVisible({
      timeout: 15000,
    })

    await page.getByRole('button', { name: /post update|create announcement/i }).first().click()
    await expect(page.getByText(/New Announcement/i)).toBeVisible()
    await page.getByPlaceholder(/what's happening/i).fill(title)
    await page.getByRole('button', { name: /important/i }).click()
    await page.getByPlaceholder(/provide more details/i).fill(content)
    await page.locator('form').getByRole('button', { name: /^post update$/i }).click()

    await expect(page.getByText(/Announcement posted/i)).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByText(title)).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(content)).toBeVisible()

    page.once('dialog', dialog => dialog.accept())
    const deleteButton = page.getByRole('button', { name: `Delete ${title}` })
    await deleteButton.hover()
    await deleteButton.click()

    await expect(page.getByText(/Announcement removed/i)).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByText(title)).toHaveCount(0)
  })
})
