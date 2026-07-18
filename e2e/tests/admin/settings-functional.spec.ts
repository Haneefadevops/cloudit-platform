import { expect, test } from '@playwright/test'
import { apiGet, apiPatch, loginToApi } from '../helpers/touchorbit-api'

type OrganizationSettingsPayload = {
  organization?: {
    grace_period_minutes?: number
    late_threshold_minutes?: number
  }
  overtimePolicy?: Record<string, unknown> | null
}

test.describe('Admin settings functional workflows', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\?_rsc=/, route => route.abort())
  })

  test('F24.1 saves core organization settings through the local API', async ({ page, request }) => {
    const token = await loginToApi(request)
    const original = await apiGet<OrganizationSettingsPayload>(request, token, '/organizations/settings')
    const originalGrace = Number(original.organization?.grace_period_minutes ?? 15)
    const updatedGrace = originalGrace === 7 ? 8 : 7

    try {
      await page.goto('/settings')
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible({
        timeout: 15000,
      })
      await page.getByRole('button', { name: /attendance/i }).click()
      await expect(page.getByText(/Attendance & Work Hours/i)).toBeVisible()

      const graceInput = page.locator('input[type="number"]').first()
      await graceInput.fill(String(updatedGrace))

      const saveResponse = page.waitForResponse(response =>
        response.url().includes('/api/organizations/settings') &&
        response.request().method() === 'PATCH',
      )
      await page.getByRole('button', { name: /save changes/i }).click()
      const response = await saveResponse

      expect(response.ok(), `settings save response status ${response.status()}`).toBe(true)
      const saved = await apiGet<OrganizationSettingsPayload>(request, token, '/organizations/settings')
      expect(Number(saved.organization?.grace_period_minutes)).toBe(updatedGrace)
    } finally {
      await apiPatch<{ updated: boolean }>(request, token, '/organizations/settings', {
        grace_period_minutes: originalGrace,
      }).catch(() => undefined)
    }
  })

  test('F24.2 saves the leave approval chain from settings', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible({
      timeout: 15000,
    })
    await page.getByRole('button', { name: /leave policies/i }).click()
    await expect(page.getByText(/Leave Approval Chain/i)).toBeVisible({ timeout: 15000 })

    await page.getByRole('button', { name: /save chain/i }).first().click()
    await expect(page.getByText(/Leave approval chain updated/i).first()).toBeVisible({
      timeout: 15000,
    })
  })

  test('F24.3 creates a branch from settings', async ({ page }) => {
    const stamp = Date.now()
    const branchName = `E2E Branch ${stamp}`

    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible({
      timeout: 15000,
    })
    await page.getByRole('button', { name: /branches/i }).click()
    await expect(page.getByText(/Company Branches/i)).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: /add branch/i }).click()
    await page.getByPlaceholder(/head office/i).fill(branchName)
    await page.getByPlaceholder(/col-01/i).fill(`E2E${String(stamp).slice(-4)}`)
    await page.getByPlaceholder('Colombo', { exact: true }).fill('Colombo')
    await page.getByRole('button', { name: /save branch/i }).click()

    await expect(page.getByText(/Branch created/i).first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(branchName)).toBeVisible({ timeout: 15000 })
  })

  test('F24.4 creates a department from settings', async ({ page }) => {
    const stamp = Date.now()
    const departmentName = `E2E Department ${stamp}`

    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible({
      timeout: 15000,
    })
    await page.getByRole('button', { name: /departments/i }).click()
    await expect(page.getByRole('heading', { name: /^departments$/i })).toBeVisible({
      timeout: 15000,
    })
    await page.getByRole('button', { name: /add department/i }).click()
    await page.getByPlaceholder(/engineering/i).fill(departmentName)
    await page.getByPlaceholder('ENG', { exact: true }).fill(`D${String(stamp).slice(-4)}`)
    await page.getByRole('button', { name: /save department/i }).click()

    await expect(page.getByText(/Department created/i).first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(departmentName)).toBeVisible({ timeout: 15000 })
  })
})
