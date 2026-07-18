import { expect, test } from '@playwright/test'
import { apiDel, apiPost, loginToApi } from '../helpers/touchorbit-api'

type Shift = {
  id: string
  name: string
  status: string
}

test.describe('Admin shift template functional workflows', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\?_rsc=/, route => route.abort())
  })

  test('F12.1 creates, edits, and deletes a shift template from the admin UI', async ({ page }) => {
    const stamp = Date.now()
    const originalName = `E2E Shift ${stamp}`
    const updatedName = `E2E Shift Updated ${stamp}`

    await page.goto('/shifts')
    await expect(page.getByText(/Shift Templates/i)).toBeVisible({ timeout: 15000 })

    await page.getByRole('button', { name: /add shift|create first shift/i }).first().click()
    await expect(page.getByText(/New Shift/i)).toBeVisible()
    await page.getByPlaceholder(/morning operational/i).fill(originalName)
    await page.locator('input[type="time"]').nth(0).fill('07:30')
    await page.locator('input[type="time"]').nth(1).fill('15:30')
    await page.locator('input[type="number"]').fill('10')

    const createResponse = page.waitForResponse(
      response =>
        response.url().includes('/api/shifts') &&
        response.request().method() === 'POST',
    )
    await page.getByRole('button', { name: /save template/i }).click()
    const created = await createResponse

    expect(created.ok(), `create response status ${created.status()}`).toBe(true)
    await expect(page.getByText(/Shift created/i)).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(originalName)).toBeVisible({ timeout: 15000 })

    const card = page.locator('div').filter({ hasText: originalName }).filter({ hasText: /active/i }).first()
    await card.getByRole('button', { name: /edit/i }).click()
    await expect(page.getByText(/Edit Shift/i)).toBeVisible()
    const label = page.getByPlaceholder(/morning operational/i)
    await label.fill(updatedName)

    const updateResponse = page.waitForResponse(
      response =>
        /\/api\/shifts\/[^/]+$/.test(response.url()) &&
        response.request().method() === 'PATCH',
    )
    await page.getByRole('button', { name: /save template/i }).click()
    const updated = await updateResponse

    expect(updated.ok(), `update response status ${updated.status()}`).toBe(true)
    await expect(page.getByText(/Shift updated/i)).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(updatedName)).toBeVisible({ timeout: 15000 })

    const updatedCard = page.locator('div').filter({ hasText: updatedName }).filter({ hasText: /active/i }).first()
    page.once('dialog', dialog => dialog.accept())
    const deleteResponse = page.waitForResponse(
      response =>
        /\/api\/shifts\/[^/]+$/.test(response.url()) &&
        response.request().method() === 'DELETE',
    )
    await updatedCard.getByRole('button').last().click()
    const deleted = await deleteResponse

    expect(deleted.ok(), `delete response status ${deleted.status()}`).toBe(true)
    await expect(page.getByText(/Shift deleted/i)).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(updatedName)).toHaveCount(0)
  })

  test('F12.2 toggles a shift template active status from the admin UI', async ({ page, request }) => {
    const token = await loginToApi(request)
    const shift = await apiPost<Shift>(request, token, '/shifts', {
      name: `E2E Toggle Shift ${Date.now()}`,
      start_time: '10:00',
      end_time: '18:00',
      break_duration: 0,
      color: '#2563EB',
    })

    try {
      await page.goto('/shifts')
      await expect(page.getByText(/Shift Templates/i)).toBeVisible({ timeout: 15000 })
      await expect(page.getByText(shift.name)).toBeVisible({ timeout: 15000 })

      const card = page.getByTestId(`shift-card-${shift.id}`)
      await page.getByRole('button', { name: `Deactivate ${shift.name}` }).click()

      await expect(page.getByText(/Status updated/i)).toBeVisible({ timeout: 15000 })
      await expect(card.getByText(/inactive/i)).toBeVisible({ timeout: 15000 })
    } finally {
      await apiDel<{ deleted: boolean; id: string }>(request, token, `/shifts/${shift.id}`).catch(() => undefined)
    }
  })
})
