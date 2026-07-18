import { expect, test, type Page } from '@playwright/test'
import {
  apiGet,
  apiPost,
  ensureSeedEmployee,
  loginToApi,
  type SeedEmployee,
} from '../helpers/touchorbit-api'

type PerformanceReview = {
  id: string
  employee_id: string
  status: 'pending_self' | 'pending_manager' | 'under_review' | 'completed'
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

function isoDatePlus(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

test.describe('Employee performance functional workflows', () => {
  let seedEmployee: SeedEmployee

  test.beforeEach(async ({ page, request }) => {
    seedEmployee = (await ensureSeedEmployee(request)).employee
    await loginEmployee(page)
  })

  test('EF27.1 employee submits a pending self performance review', async ({ page, request }) => {
    const token = await loginToApi(request)
    const review = await apiPost<PerformanceReview>(request, token, '/performance/reviews', {
      employee_id: seedEmployee.id,
      review_period_start: isoDatePlus(-30),
      review_period_end: isoDatePlus(0),
      status: 'pending_self',
    })

    await page.goto('/profile')
    await expect(page.getByText(/Self Review Pending/i)).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: /^Submit$/i }).click()
    await expect(page.getByText(/Self Performance Review/i)).toBeVisible({ timeout: 15000 })
    await page.getByPlaceholder(/achievements and areas/i).fill('E2E self review submission')
    await page.getByRole('button', { name: /Submit Self Review/i }).click()
    await expect(page.getByText(/Self review submitted/i)).toBeVisible({ timeout: 15000 })

    const reviews = await apiGet<PerformanceReview[]>(
      request,
      token,
      `/performance/reviews/employee/${seedEmployee.id}`,
    )
    const updated = reviews.find(row => row.id === review.id)
    expect(updated?.status).toBe('pending_manager')
  })
})
