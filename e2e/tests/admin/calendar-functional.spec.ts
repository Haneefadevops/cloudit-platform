import { expect, test } from '@playwright/test'

function futureDate(): string {
  const date = new Date()
  date.setDate(date.getDate() + 5)
  return date.toISOString().slice(0, 10)
}

test.describe('Admin calendar functional workflows', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\?_rsc=/, route => route.abort())
  })

  test('F11.1 creates an E2E task from the calendar task panel', async ({ page }) => {
    const title = `E2E Calendar Task ${Date.now()}`

    await page.goto('/calendar')
    await expect(page.getByText(/Calendar/i).first()).toBeVisible({ timeout: 15000 })
    const manageTrack = page.getByText(/Manage & Track/i)
    await manageTrack.scrollIntoViewIfNeeded()
    await expect(manageTrack).toBeVisible({ timeout: 15000 })

    const tasksPanel = manageTrack.locator('xpath=ancestor::div[contains(@class, "bg-white")][1]')
    await tasksPanel.locator('button').filter({ has: page.locator('svg') }).first().click()

    await expect(page.getByRole('heading', { name: /New Task/i })).toBeVisible({
      timeout: 15000,
    })
    await page.getByPlaceholder(/Complete Q3 expense report/i).fill(title)
    await page.locator('input[type="date"]').fill(futureDate())
    await page.getByRole('button', { name: /^Training$/i }).click()
    await page.getByPlaceholder(/Add details about this task/i).fill('E2E calendar task coverage')
    await page.getByRole('button', { name: /Create Task/i }).click()

    await expect(page.getByText(/Task created/i)).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('heading', { name: /New Task/i })).toHaveCount(0)
    await expect(page.getByText(title)).toBeVisible({ timeout: 15000 })
  })
})
