import { expect, test, type Page } from '@playwright/test'
import {
  apiDel,
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
}

async function loginEmployee(page: Page) {
  const email =
    process.env.E2E_EMPLOYEE_EMAIL || process.env.E2E_SEED_EMPLOYEE_EMAIL
  const password =
    process.env.E2E_EMPLOYEE_PASSWORD || process.env.E2E_SEED_EMPLOYEE_PASSWORD
  const apiUrl = process.env.E2E_API_URL

  if (!email || !password || !apiUrl) {
    throw new Error('Employee credentials and E2E_API_URL must be set')
  }

  const response = await page.context().request.post(`${apiUrl}/api/auth/login`, {
    data: { email, password },
  })
  const body = (await response.json().catch(() => null)) as {
    ok?: boolean
    data?: { user?: { role?: string } }
    error?: string
    message?: string
  } | null

  if (!response.ok() || !body?.ok) {
    throw new Error(body?.error || body?.message || 'Employee login failed')
  }

  expect(body.data?.user?.role).toBe('employee')
}

test.describe('Employee documents functional workflows', () => {
  let seedEmployee: SeedEmployee

  async function seedPendingDocument(request: Parameters<typeof apiPost>[0], title: string) {
    const token = await loginToApi(request)
    seedEmployee = (await ensureSeedEmployee(request)).employee
    const template = await apiPost<DocumentTemplate>(request, token, '/document-templates', {
      name: title,
      description: 'Created by frontend E2E',
      content: 'Please review and sign this E2E document.',
    })
    const document = await apiPost<SentDocument>(request, token, '/documents', {
      template_id: template.id,
      employee_id: seedEmployee.id,
      title: template.name,
      content: template.content,
      notes: 'Created by frontend E2E',
    })

    return { token, document }
  }

  test.beforeEach(async ({ page }) => {
    await loginEmployee(page)
  })

  test('EF21.1 employee views an assigned document', async ({ page, request }) => {
    const title = `E2E Employee Document ${Date.now()}`
    const { token, document } = await seedPendingDocument(request, title)

    try {
      await page.goto('/documents')
      await expect(page).not.toHaveURL(/\/login/)
      await expect(page.getByText(title)).toBeVisible({ timeout: 15000 })
      await page.getByText(title).click()
      await expect(page.getByRole('heading', { name: title })).toBeVisible()
      await expect(page.getByText(/Please review and sign/i)).toBeVisible()
    } finally {
      await apiDel<{ id: string }>(request, token, `/documents/${document.id}`).catch(() => undefined)
    }
  })

  test('EF21.2 employee signs an assigned document', async ({ page, request }) => {
    const title = `E2E Employee Sign Document ${Date.now()}`
    const { token, document } = await seedPendingDocument(request, title)

    try {
      await page.goto('/documents')
      await expect(page.getByText(title)).toBeVisible({ timeout: 15000 })
      await page.getByText(title).click()
      await page.getByRole('button', { name: /start signing process/i }).click()

      const canvas = page.locator('canvas')
      const box = await canvas.boundingBox()
      if (!box) throw new Error('Signature canvas did not render')
      await page.mouse.move(box.x + 30, box.y + 40)
      await page.mouse.down()
      await page.mouse.move(box.x + 180, box.y + 90)
      await page.mouse.up()

      await page.getByRole('button', { name: /complete.*secure document/i }).click()
      await expect(page.getByText(/Document signed/i).first()).toBeVisible({ timeout: 15000 })
      await expect(page.getByText(/Verified.*Signed/i)).toBeVisible({ timeout: 15000 })
    } finally {
      await apiDel<{ id: string }>(request, token, `/documents/${document.id}`).catch(() => undefined)
    }
  })
})
