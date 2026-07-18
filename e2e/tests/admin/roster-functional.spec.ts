import { expect, test, type APIRequestContext } from '@playwright/test'
import {
  apiDel,
  apiGet,
  apiPost,
  ensureSeedEmployee,
  loginToApi,
  type SeedEmployee,
} from '../helpers/touchorbit-api'

type Shift = {
  id: string
  name: string
}

type RosterAssignment = {
  id: string
  employee_id: string
  date: string
  shift_id?: string | null
  shift_template_id?: string | null
}

function currentMonday(): string {
  const date = new Date()
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  date.setHours(0, 0, 0, 0)
  return date.toISOString().slice(0, 10)
}

function addDays(dateString: string, days: number): string {
  const date = new Date(`${dateString}T00:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

async function deleteRosterAssignment(
  request: APIRequestContext,
  token: string,
  employee: SeedEmployee,
  weekStart: string,
  date: string,
) {
  const assignments = await apiGet<RosterAssignment[]>(
    request,
    token,
    `/roster/week?week_start=${weekStart}`,
  ).catch(() => [])
  for (const assignment of assignments) {
    if (assignment.employee_id === employee.id && assignment.date === date) {
      await apiDel<{ deleted: boolean; id: string }>(
        request,
        token,
        `/roster/assignments/${assignment.id}`,
      ).catch(() => undefined)
    }
  }
}

test.describe('Admin roster functional workflows', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\?_rsc=/, route => route.abort())
  })

  test('F12.3 assigns and clears a roster shift from the grid', async ({ page, request }) => {
    const token = await loginToApi(request)
    const employee = (await ensureSeedEmployee(request)).employee
    const weekStart = currentMonday()
    const assignmentDate = addDays(weekStart, 2)
    const shift = await apiPost<Shift>(request, token, '/shifts', {
      name: `E2E Roster Shift ${Date.now()}`,
      start_time: '08:00',
      end_time: '16:00',
      break_duration: 30,
      color: '#10B981',
    })

    try {
      await apiPost(request, token, '/roster/week/unlock', { week_start: weekStart }).catch(() => undefined)
      await deleteRosterAssignment(request, token, employee, weekStart, assignmentDate)

      await page.goto('/roster')
      await expect(page.getByText(/Roster Planning/i)).toBeVisible({ timeout: 15000 })
      await expect(page.getByText(/Week of/i)).toBeVisible({ timeout: 15000 })
      await expect(page.getByText('E2E Employee')).toBeVisible({ timeout: 15000 })

      const row = page.locator('tr').filter({ hasText: 'E2E Employee' }).first()
      const targetSelect = row.locator('select').nth(2)
      await expect(targetSelect).toContainText(shift.name, { timeout: 15000 })

      const assignResponse = page.waitForResponse(
        response =>
          response.url().includes('/api/roster/assignments') &&
          response.request().method() === 'POST',
      )
      await targetSelect.selectOption(shift.id)
      const assigned = await assignResponse

      expect(assigned.ok(), `assignment response status ${assigned.status()}`).toBe(true)
      await expect(targetSelect).toHaveValue(shift.id, { timeout: 15000 })

      const weekAfterAssign = await apiGet<RosterAssignment[]>(
        request,
        token,
        `/roster/week?week_start=${weekStart}`,
      )
      const created = weekAfterAssign.find(
        assignment =>
          assignment.employee_id === employee.id &&
          assignment.date === assignmentDate &&
          (assignment.shift_id === shift.id || assignment.shift_template_id === shift.id),
      )
      expect(created, 'created roster assignment should exist').toBeTruthy()

      const clearResponse = page.waitForResponse(
        response =>
          /\/api\/roster\/assignments\/[^/]+$/.test(response.url()) &&
          response.request().method() === 'DELETE',
      )
      await targetSelect.selectOption('')
      const cleared = await clearResponse

      expect(cleared.ok(), `clear response status ${cleared.status()}`).toBe(true)
      await expect(targetSelect).toHaveValue('', { timeout: 15000 })
    } finally {
      await deleteRosterAssignment(request, token, employee, weekStart, assignmentDate)
      await apiDel<{ deleted: boolean; id: string }>(request, token, `/shifts/${shift.id}`).catch(() => undefined)
    }
  })
})
