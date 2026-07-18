import { expect, test } from '@playwright/test'
import {
  apiDel,
  apiGet,
  apiPost,
  ensureSeedEmployee,
  loginToApi,
  type SeedEmployee,
} from '../helpers/touchorbit-api'

type DocumentTemplate = {
  id: string
  name: string
  content: string
}

type SentDocument = {
  id: string
  title: string
  employee_id: string
}

test.describe('Admin documents functional workflows', () => {
  let seedEmployee: SeedEmployee

  test.beforeEach(async ({ page, request }) => {
    seedEmployee = (await ensureSeedEmployee(request)).employee
    await page.route(/\?_rsc=/, route => route.abort())
  })

  test('F21.1 creates a document template from the admin UI', async ({ page }) => {
    const stamp = Date.now()
    const templateName = `E2E Document Template ${stamp}`

    await page.goto('/documents')
    await expect(page.getByRole('heading', { name: /document signing/i })).toBeVisible({
      timeout: 15000,
    })

    await page.getByRole('button', { name: /new template|create first template/i }).first().click()
    await expect(page.getByRole('heading', { name: /new template/i })).toBeVisible()
    await page.getByPlaceholder(/employment contract/i).fill(templateName)
    await page.getByPlaceholder(/short summary/i).fill('Created by frontend E2E')
    await page.getByPlaceholder(/paste your legal text/i).fill('E2E document body for signature testing.')

    const createResponse = page.waitForResponse(
      response =>
        response.url().includes('/api/document-templates') &&
        response.request().method() === 'POST',
      { timeout: 10000 },
    )
    await page.getByRole('button', { name: /save template/i }).click()
    const response = await createResponse

    expect(response.ok(), `create response status ${response.status()}`).toBe(true)
    await expect(page.getByText(/Template created/i).first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(templateName)).toBeVisible({ timeout: 15000 })
  })

  test('F21.2 sends an existing document template to the seed employee', async ({ page, request }) => {
    const token = await loginToApi(request)
    const stamp = Date.now()
    const template = await apiPost<DocumentTemplate>(request, token, '/document-templates', {
      name: `E2E Send Template ${stamp}`,
      description: 'Created by frontend E2E for send test',
      content: 'Please sign this E2E test document.',
    })
    let sentDocumentId: string | undefined

    try {
      await page.goto('/documents')
      await expect(page.getByText(template.name)).toBeVisible({ timeout: 15000 })

      const templateCard = page
        .getByText(template.name)
        .locator('xpath=ancestor::div[contains(@class, "group")][1]')
      await templateCard.getByRole('button', { name: /send to staff/i }).click()
      await expect(page.getByRole('heading', { name: /send document/i })).toBeVisible()
      await page.locator('select').selectOption(seedEmployee.id)
      await page.getByPlaceholder(/please sign by/i).fill('Created by frontend E2E')

      const sendResponse = page.waitForResponse(
        response =>
          response.url().includes('/api/documents') &&
          response.request().method() === 'POST',
      )
      await page.getByRole('button', { name: /send now/i }).click()
      const response = await sendResponse
      expect(response.ok(), `send response status ${response.status()}`).toBe(true)

      const payload = await response.json()
      sentDocumentId = payload?.data?.id
      await expect(page.getByText(/Document sent/i).first()).toBeVisible({ timeout: 15000 })
      await page.getByRole('button', { name: /sent/i }).click()
      await expect(page.getByText(template.name)).toBeVisible({ timeout: 15000 })
      await expect(page.getByText(/E2E Employee/i)).toBeVisible({ timeout: 15000 })
    } finally {
      if (sentDocumentId) {
        await apiDel<{ id: string }>(request, token, `/documents/${sentDocumentId}`).catch(() => undefined)
      } else {
        const documents = await apiGet<SentDocument[]>(request, token, '/documents').catch(() => [])
        for (const document of documents.filter(row => row.title === template.name)) {
          await apiDel<{ id: string }>(request, token, `/documents/${document.id}`).catch(() => undefined)
        }
      }
    }
  })

  test('F21.3 edits an existing document template from the admin UI', async ({ page, request }) => {
    const token = await loginToApi(request)
    const stamp = Date.now()
    const template = await apiPost<DocumentTemplate>(request, token, '/document-templates', {
      name: `E2E Edit Template ${stamp}`,
      description: 'Created by frontend E2E for edit test',
      content: 'Original E2E document body.',
    })
    const updatedName = `E2E Edit Template Updated ${stamp}`

    await page.goto('/documents')
    await expect(page.getByText(template.name)).toBeVisible({ timeout: 15000 })
    const templateCard = page
      .getByText(template.name)
      .locator('xpath=ancestor::div[contains(@class, "group")][1]')
    await templateCard.locator('button').first().click()
    await expect(page.getByRole('heading', { name: 'Edit Template', exact: true })).toBeVisible()
    await page.getByPlaceholder(/employment contract/i).fill(updatedName)
    await page.getByRole('button', { name: /save template/i }).click()

    await expect(page.getByText(/Template created|Template saved|Template updated/i).first()).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByText(updatedName)).toBeVisible({ timeout: 15000 })
  })

  test('F21.4 deletes a document template from the admin UI', async ({ page, request }) => {
    const token = await loginToApi(request)
    const stamp = Date.now()
    const template = await apiPost<DocumentTemplate>(request, token, '/document-templates', {
      name: `E2E Delete Template ${stamp}`,
      description: 'Created by frontend E2E for delete test',
      content: 'Delete me from the UI.',
    })

    await page.goto('/documents')
    await expect(page.getByText(template.name)).toBeVisible({ timeout: 15000 })
    const templateCard = page
      .getByText(template.name)
      .locator('xpath=ancestor::div[contains(@class, "group")][1]')
    page.once('dialog', dialog => dialog.accept())
    await templateCard.locator('button').nth(1).click()

    await expect(page.getByText(/Template deleted/i).first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(template.name)).toHaveCount(0)
  })
})
