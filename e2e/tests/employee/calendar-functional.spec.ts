import { expect, test, type Page } from '@playwright/test'
import {
  apiDel,
  apiGet,
  apiPost,
  ensureSeedEmployee,
  loginToApi,
  type SeedEmployee,
} from '../helpers/touchorbit-api'

type EmployeeTask = {
  id: string
  title: string
  status: 'pending' | 'in_progress' | 'completed' | 'overdue'
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

function futureDate(): string {
  const date = new Date()
  date.setDate(date.getDate() + 7)
  return date.toISOString().slice(0, 10)
}

test.describe('Employee calendar task workflows', () => {
  let seedEmployee: SeedEmployee

  test.beforeEach(async ({ page, request }) => {
    seedEmployee = (await ensureSeedEmployee(request)).employee
    await loginEmployee(page)
  })

  test('EF25.1 employee creates a task from the calendar and sees it in My Tasks', async ({ page, request }) => {
    const token = await loginToApi(request)
    const title = `E2E Employee Calendar Task ${Date.now()}`
    let createdTaskId: string | undefined

    try {
      await page.goto('/calendar')
      await expect(page.getByText(/My Tasks/i)).toBeVisible({ timeout: 15000 })

      const tasksPanel = page.getByText(/Track & Complete/i).locator(
        'xpath=ancestor::div[contains(@class, "bg-white")][1]',
      )
      await tasksPanel.locator('button').filter({ has: page.locator('svg') }).first().click()

      await expect(page.getByRole('heading', { name: /New Task/i })).toBeVisible({
        timeout: 15000,
      })
      await page.getByPlaceholder(/Complete Q3 expense report/i).fill(title)
      await page.locator('input[type="date"]').fill(futureDate())
      await page.getByRole('button', { name: /^Personal$/i }).click()
      await page.getByPlaceholder(/Add details about this task/i).fill('E2E employee calendar task coverage')

      const createResponse = page.waitForResponse(response =>
        /\/api\/employee-tasks$/.test(response.url()) &&
        response.request().method() === 'POST',
      )
      await page.getByRole('button', { name: /Create Task/i }).click()
      const response = await createResponse
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean
        data?: EmployeeTask
      } | null
      createdTaskId = payload?.data?.id

      expect(response.ok(), `task create response status ${response.status()}`).toBe(true)
      expect(payload?.ok).toBe(true)
      await expect(page.getByText(/Task created/i)).toBeVisible({ timeout: 15000 })
      await expect(page.getByText(title)).toBeVisible({ timeout: 15000 })
    } finally {
      if (createdTaskId) {
        await apiDel(request, token, `/employee-tasks/${createdTaskId}`).catch(() => undefined)
      }
    }
  })

  test('EF25.2 employee completes a pending task from My Tasks', async ({ page, request }) => {
    const token = await loginToApi(request)
    const title = `E2E Complete Employee Task ${Date.now()}`
    const task = await apiPost<EmployeeTask>(request, token, '/employee-tasks', {
      employee_id: seedEmployee.id,
      title,
      description: 'Seeded for employee calendar complete coverage',
      category: 'work',
      due_date: futureDate(),
      reminder_minutes: 0,
      is_recurring: false,
    })

    try {
      await page.goto('/calendar')
      await expect(page.getByText(title)).toBeVisible({ timeout: 15000 })

      const taskRow = page.getByText(title).locator(
        'xpath=ancestor::div[contains(@class, "rounded-2xl")][1]',
      )
      await taskRow.locator('button').first().click()
      await expect(page.getByText(/Task completed/i)).toBeVisible({ timeout: 15000 })

      const tasks = await apiGet<EmployeeTask[]>(request, token, '/employee-tasks?limit=100')
      const updated = tasks.find(row => row.id === task.id)
      expect(updated?.status).toBe('completed')
    } finally {
      await apiDel(request, token, `/employee-tasks/${task.id}`).catch(() => undefined)
    }
  })
})
