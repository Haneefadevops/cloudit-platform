import { expect, test, type Page } from '@playwright/test'
import {
  apiGet,
  apiPatch,
  apiPut,
  ensureSeedEmployee,
  loginToApi,
  type SeedEmployee,
} from '../helpers/touchorbit-api'

type EmergencyContact = {
  name: string
  relationship: string
  phone: string
  email?: string | null
  is_primary?: boolean
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

test.describe('Employee profile functional workflows', () => {
  let seedEmployee: SeedEmployee

  test.beforeEach(async ({ page, request }) => {
    seedEmployee = (await ensureSeedEmployee(request)).employee
    await loginEmployee(page)
  })

  test('EF24.1 employee updates profile phone number from the profile page', async ({ page, request }) => {
    const token = await loginToApi(request)
    const originalPhone = seedEmployee.phone || '+94770000001'
    const updatedPhone = `+9477${String(Date.now()).slice(-7)}`

    try {
      await page.goto('/profile')
      await expect(page).not.toHaveURL(/\/login/)
      await expect(page.getByText(/Email/i).first()).toBeVisible({ timeout: 15000 })

      await page.locator('button').filter({ has: page.locator('svg') }).first().click()
      await page.getByPlaceholder(/enter phone number/i).fill(updatedPhone)

      const updateResponse = page.waitForResponse(response =>
        /\/api\/employees\/[^/]+$/.test(response.url()) &&
        response.request().method() === 'PATCH',
      )
      await page.getByRole('button', { name: /^save$/i }).click()
      const response = await updateResponse

      expect(response.ok(), `profile update response status ${response.status()}`).toBe(true)
      await expect(page.getByText(updatedPhone)).toBeVisible({ timeout: 15000 })
    } finally {
      await apiPatch<SeedEmployee>(request, token, `/employees/${seedEmployee.id}`, {
        phone: originalPhone,
      }).catch(() => undefined)
    }
  })

  test('EF24.2 employee profile displays local emergency contacts', async ({ page, request }) => {
    const token = await loginToApi(request)
    const originalContacts = await apiGet<EmergencyContact[]>(
      request,
      token,
      `/employees/${seedEmployee.id}/emergency-contacts`,
    ).catch(() => [])
    const contact: EmergencyContact = {
      name: `E2E Emergency ${Date.now()}`,
      relationship: 'Sibling',
      phone: '+94770009999',
      email: 'e2e.emergency@touchorbit.test',
      is_primary: true,
    }

    try {
      await apiPut<EmergencyContact[]>(
        request,
        token,
        `/employees/${seedEmployee.id}/emergency-contacts`,
        [contact],
      )

      await page.goto('/profile')
      await expect(page.getByText(/Emergency Contacts/i)).toBeVisible({ timeout: 15000 })
      await expect(page.getByText(contact.name)).toBeVisible({ timeout: 15000 })
      await expect(page.getByText(contact.phone)).toBeVisible({ timeout: 15000 })
    } finally {
      await apiPut<EmergencyContact[]>(
        request,
        token,
        `/employees/${seedEmployee.id}/emergency-contacts`,
        originalContacts,
      ).catch(() => undefined)
    }
  })
})
