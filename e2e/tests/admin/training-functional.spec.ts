import { expect, test } from '@playwright/test'
import { apiDel, apiGet, loginToApi } from '../helpers/touchorbit-api'

type TrainingProgram = {
  id: string
  title: string
}

test.describe('Admin training functional workflows', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\?_rsc=/, route => route.abort())
  })

  test('F13.1 creates and edits a training program from the admin UI', async ({ page, request }) => {
    const token = await loginToApi(request)
    const stamp = Date.now()
    const originalTitle = `E2E Training Program ${stamp}`
    const updatedTitle = `E2E Training Updated ${stamp}`

    try {
      await page.goto('/training')
      await expect(page.getByRole('heading', { name: /advanced training/i })).toBeVisible({
        timeout: 15000,
      })

      await page.getByRole('button', { name: /new program|create first program/i }).first().click()
      await expect(page.getByRole('heading', { name: /new program/i })).toBeVisible()
      await page.getByPlaceholder(/cybersecurity essentials/i).fill(originalTitle)
      await page.getByPlaceholder(/what will participants learn/i).fill('Created by frontend E2E')
      await page.locator('input[type="number"]').fill('2')

      const createResponse = page.waitForResponse(
        response =>
          response.url().includes('/api/training/programs') &&
          response.request().method() === 'POST',
      )
      await page.getByRole('button', { name: /save program/i }).click()
      const created = await createResponse

      expect(created.ok(), `create response status ${created.status()}`).toBe(true)
      await expect(page.getByText(/Program saved/i).first()).toBeVisible({ timeout: 15000 })
      await expect(page.getByText(originalTitle)).toBeVisible({ timeout: 15000 })

      const card = page.getByText(originalTitle).locator('xpath=ancestor::div[contains(@class, "group")][1]')
      await card.locator('button').click()
      await expect(page.getByRole('heading', { name: /edit program/i })).toBeVisible()
      await page.getByPlaceholder(/cybersecurity essentials/i).fill(updatedTitle)

      const updateResponse = page.waitForResponse(
        response =>
          /\/api\/training\/programs\/[^/]+$/.test(response.url()) &&
          response.request().method() === 'PATCH',
      )
      await page.getByRole('button', { name: /save program/i }).click()
      const updated = await updateResponse

      expect(updated.ok(), `update response status ${updated.status()}`).toBe(true)
      await expect(page.getByText(/Program saved/i).first()).toBeVisible({ timeout: 15000 })
      await expect(page.getByText(updatedTitle)).toBeVisible({ timeout: 15000 })
    } finally {
      const programs = await apiGet<TrainingProgram[]>(request, token, '/training').catch(() => [])
      const leftovers = programs.filter(
        program => program.title === originalTitle || program.title === updatedTitle,
      )
      for (const program of leftovers) {
        await apiDel<{ id: string }>(request, token, `/training/programs/${program.id}`).catch(() => undefined)
      }
    }
  })
})
