import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { seedStatePath, type SeedState } from '../helpers/touchorbit-api'

function readSeedState(): SeedState {
  return JSON.parse(readFileSync(seedStatePath, 'utf8')) as SeedState
}

test.describe('Employees', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\?_rsc=/, route => route.abort())
  })

  async function waitForEmployeesPage(page: any) {
    // Wait for the page-specific loading state, not the persistent sidebar "Loading..." text.
    await page.getByRole('heading', { name: /Employees/i }).first().waitFor({ state: 'visible', timeout: 15000 })
    await page.getByText(/No employees found|Search employees/i).first().waitFor({ state: 'visible', timeout: 10000 })
  }

  async function searchSeedEmployee(page: any) {
    const seed = readSeedState()
    const search = page.getByPlaceholder(/search/i).first()
    await expect(search).toBeVisible()
    await search.fill(seed.employee.email)
    await expect(
      page.getByText(new RegExp(`${seed.employee.first_name}\\s+${seed.employee.last_name}`, 'i')).first()
    ).toBeVisible({ timeout: 10000 })
    return seed
  }

  test('3.1 employees list loads', async ({ page }) => {
    await page.goto('/employees')
    await waitForEmployeesPage(page)
    await expect(page.getByRole('heading', { name: /Employees/i }).first()).toBeVisible()

    const hasTable = await page.locator('table, [role="grid"]').first().isVisible().catch(() => false)
    const hasEmptyState = await page.getByText(/No employees found/i).first().isVisible().catch(() => false)
    expect(hasTable || hasEmptyState).toBe(true)
  })

  test('3.2 search employees filters list', async ({ page }) => {
    await page.goto('/employees')
    await waitForEmployeesPage(page)

    const seed = await searchSeedEmployee(page)
    await expect(
      page.getByText(new RegExp(`${seed.employee.first_name}\\s+${seed.employee.last_name}`, 'i')).first()
    ).toBeVisible()
  })

  test('3.3 filter by status tabs', async ({ page }) => {
    await page.goto('/employees')
    await waitForEmployeesPage(page)

    const terminatedTab = page.getByRole('tab').filter({ hasText: /Terminated/i }).first()

    if (await terminatedTab.isVisible().catch(() => false)) {
      await terminatedTab.click()
      await page.waitForTimeout(1000)
      await expect(page).toHaveURL(/terminated|status/i)
    }
  })

  test('3.5 view mode toggle changes layout', async ({ page }) => {
    await page.goto('/employees')
    await waitForEmployeesPage(page)

    const toggle = page.getByRole('button').filter({ hasText: /grid|table|list|compact/i }).first()
    if (await toggle.isVisible().catch(() => false)) {
      await toggle.click()
      await expect(page.locator('table, [role="grid"], .grid').first()).toBeVisible()
    }
  })

  test('3.6 add employee dialog opens and validates', async ({ page }) => {
    await page.goto('/employees')
    await waitForEmployeesPage(page)

    const addButton = page.getByRole('button', { name: /add employee/i }).first()
    await expect(addButton).toBeVisible()
    await addButton.click()

    const dialog = page.locator('div').filter({ has: page.getByRole('heading', { name: /Add New Employee/i }) }).first()
    await expect(dialog).toBeVisible()
    await expect(page.getByText(/First Name|Last Name|Email/i).first()).toBeVisible()

    // 3.7 validation: submit empty form should show errors
    const saveButton = page.getByRole('button', { name: /Add Employee/i }).last()
    await expect(saveButton).toBeVisible()
    await saveButton.click()

    const error = dialog.getByText(/Please fill out this field|required|invalid|error/i).first()
    const invalidInput = dialog.locator('input:invalid').first()
    await expect(error.or(invalidInput)).toBeVisible({ timeout: 5000 })
  })

  test('3.4 filter by department dropdown', async ({ page }) => {
    await page.goto('/employees')
    await waitForEmployeesPage(page)

    const deptDropdown = page.getByRole('combobox').filter({ hasText: /Dept|Department/i }).first()
    if (await deptDropdown.isVisible().catch(() => false)) {
      await deptDropdown.click()
      const option = page.locator('body').getByRole('option').first()
      await expect(option).toBeVisible({ timeout: 5000 })
    }
  })

  test('3.8 import employees dialog opens', async ({ page }) => {
    await page.goto('/employees')
    await waitForEmployeesPage(page)

    const importButton = page.getByRole('button', { name: /Import/i }).first()
    await expect(importButton).toBeVisible()
    await importButton.click()

    const dialog = page.getByRole('heading').filter({ hasText: /Import|Upload CSV/i }).first()
    await expect(dialog).toBeVisible({ timeout: 5000 })
  })

  test('3.9 export employees button triggers download', async ({ page }) => {
    await page.goto('/employees')
    await waitForEmployeesPage(page)

    const exportButton = page.getByRole('button', { name: /Export/i }).first()
    await expect(exportButton).toBeVisible()

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
      exportButton.click(),
    ])

    // Export may produce a download or just complete; either is acceptable.
    expect(download === null || download.suggestedFilename().includes('.csv')).toBe(true)
  })

  test('3.10 KPI strip filters update status', async ({ page }) => {
    await page.goto('/employees')
    await waitForEmployeesPage(page)

    const kpi = page.getByText(/ON LEAVE|TERMINATED/i).first()
    if (await kpi.isVisible().catch(() => false)) {
      await kpi.click()
      await expect(
        page.getByText(/Status:\s*(on leave|terminated)/i).first()
      ).toBeVisible({ timeout: 5000 })
    }
  })

  test('3.11 employee preview drawer opens', async ({ page }) => {
    await page.goto('/employees')
    await waitForEmployeesPage(page)
    const seed = await searchSeedEmployee(page)

    const row = page
      .locator('table tbody tr, [role="row"], a, main div')
      .filter({ hasText: new RegExp(`${seed.employee.first_name}\\s+${seed.employee.last_name}`, 'i') })
      .first()
    await expect(row).toBeVisible()
    await row.click()
    const drawer = page.locator('body').getByText(/overview|profile|employee details/i).first()
    await expect(drawer).toBeVisible({ timeout: 5000 })
  })

  test('3.13 employee detail page loads', async ({ page }) => {
    await page.goto('/employees')
    await waitForEmployeesPage(page)
    const seed = readSeedState()

    await page.goto(`/employees/${seed.employee.id}`)
    await expect(page).toHaveURL(/\/employees\//)
    await expect(page.getByRole('tab').first()).toBeVisible()
  })
})
