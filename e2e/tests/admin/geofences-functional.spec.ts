import { expect, test } from '@playwright/test'

test.describe('Admin geofences functional workflows', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\?_rsc=/, route => route.abort())
  })

  test('F20.1 creates, edits, filters, and deletes an E2E geofence', async ({ page }) => {
    const stamp = Date.now()
    const zoneName = `E2E Zone ${stamp}`
    const editedName = `${zoneName} Edited`

    const geofencesLoaded = page.waitForResponse(response =>
      response.url().includes('/api/attendance/geofences') &&
      response.request().method() === 'GET',
    )
    await page.goto('/geofences')
    await geofencesLoaded
    await expect(page.getByRole('button', { name: /add zone/i })).toBeVisible({
      timeout: 15000,
    })

    await page.getByRole('button', { name: /add zone/i }).click()
    await expect(page.getByText(/^Add Zone$/i)).toBeVisible()
    await page.getByPlaceholder(/Main Office/i).fill(zoneName)
    await page.getByPlaceholder('6.9271').fill('6.927100')
    await page.getByPlaceholder('79.8612').fill('79.861200')
    await page.getByRole('button', { name: /create zone/i }).click()

    await expect(page.getByText(/Zone created/i)).toBeVisible({ timeout: 15000 })
    await page.getByPlaceholder(/search zones/i).fill(zoneName)
    await expect(page.getByText(zoneName).first()).toBeVisible({ timeout: 15000 })

    await page.getByText(zoneName).first().click()
    await page.getByRole('button', { name: /^edit$/i }).click()
    await page.locator(`input[value="${zoneName}"]`).nth(1).fill(editedName)
    await page.getByRole('button', { name: /^save$/i }).click()

    await expect(page.getByText(/Zone updated/i)).toBeVisible({ timeout: 15000 })
    await page.getByPlaceholder(/search zones/i).fill(editedName)
    await expect(page.getByText(editedName).first()).toBeVisible({ timeout: 15000 })

    page.once('dialog', dialog => dialog.accept())
    await page.getByRole('button', { name: /^delete$/i }).click()
    await expect(page.getByText(/Deleted/i)).toBeVisible({ timeout: 15000 })
    await page.getByPlaceholder(/search zones/i).fill(editedName)
    await expect(page.getByText(/No zones found/i)).toBeVisible({ timeout: 15000 })
  })
})
