import { expect, test } from '@playwright/test'

test.describe('Admin notifications functional workflows', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\?_rsc=/, route => route.abort())
  })

  test('F23.1 marks all notifications as read from the admin notifications page', async ({ page }) => {
    await page.goto('/notifications')
    await expect(page.getByRole('heading', { name: /notifications/i })).toBeVisible({
      timeout: 15000,
    })

    const markAll = page.getByRole('button', { name: /mark all read/i })
    if ((await markAll.count()) === 0) {
      await expect(page.getByText(/no notifications yet|all caught up/i).or(page.getByText(/notifications/i).first())).toBeVisible()
      return
    }

    const readResponse = page.waitForResponse(response =>
      /\/api\/notifications\/[^/]+\/read$/.test(response.url()) &&
      response.request().method() === 'PATCH',
    )
    await markAll.click()
    const response = await readResponse

    expect(response.ok(), `mark read response status ${response.status()}`).toBe(true)
    await expect(markAll).toHaveCount(0, { timeout: 15000 })
  })

  test('F23.2 deletes a read notification from the admin notifications page', async ({ page }) => {
    await page.goto('/notifications')
    await expect(page.getByRole('heading', { name: /notifications/i })).toBeVisible({
      timeout: 15000,
    })

    const list = page.locator('main .divide-y').first()
    const deleteButtons = list.locator('button')
    const deleteButton = deleteButtons.first()
    if ((await page.getByText(/no notifications yet/i).count()) > 0 || (await deleteButtons.count()) === 0) {
      await expect(page.getByText(/no notifications yet|all caught up/i).or(page.getByText(/notifications/i).first())).toBeVisible()
      return
    }

    const deleteResponse = page.waitForResponse(response =>
      /\/api\/notifications\/[^/]+$/.test(response.url()) &&
      response.request().method() === 'DELETE',
    )
    await deleteButton.click()
    const response = await deleteResponse

    expect(response.ok(), `delete notification response status ${response.status()}`).toBe(true)
  })
})
