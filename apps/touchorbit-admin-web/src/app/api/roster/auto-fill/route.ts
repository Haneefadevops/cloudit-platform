import { NextRequest, NextResponse } from 'next/server'
import { verifyPermission } from '@/lib/admin-auth'

type AutoFillBody = {
  week_start?: string
  strategy?: 'fair' | 'availability' | 'seniority'
  maxWeeklyHours?: number
  departmentId?: string
  branchId?: string
  shiftIds?: unknown
}

type EmployeeRow = {
  id: string
  first_name: string | null
  last_name: string | null
  department_id: string | null
  branch_id: string | null
  hire_date: string | null
}

type ShiftRow = {
  id: string
  name: string | null
  start_time: string
  end_time: string
  break_minutes: number | null
  department_id: string | null
  branch_id: string | null
}

type AssignmentRow = {
  id: string
  employee_id: string
  date: string
  shift_id: string | null
}

type Candidate = EmployeeRow & {
  weeklyHours: number
  assignments: number
  explicitAvailability: number
}

const DAY_MS = 86_400_000

function normalizeIds(value: unknown) {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string' && id.length > 0) : []
}

function weekDates(weekStart: string) {
  const start = new Date(`${weekStart}T00:00:00.000Z`)
  return Array.from({ length: 7 }, (_, index) => new Date(start.getTime() + index * DAY_MS).toISOString().slice(0, 10))
}

function shiftHours(shift: ShiftRow) {
  const start = new Date(`2000-01-01T${shift.start_time}Z`)
  const end = new Date(`2000-01-01T${shift.end_time}Z`)
  if (end <= start) end.setUTCDate(end.getUTCDate() + 1)
  return Math.max(0, (end.getTime() - start.getTime()) / 3_600_000 - Number(shift.break_minutes ?? 0) / 60)
}

function employeeName(employee: EmployeeRow) {
  return [employee.first_name, employee.last_name].filter(Boolean).join(' ').trim() || 'Employee'
}

function dayOfWeek(date: string) {
  return new Date(`${date}T00:00:00.000Z`).getUTCDay()
}

function timeOverlaps(aStart: string, aEnd: string, bStart: string | null, bEnd: string | null) {
  if (!bStart || !bEnd) return true
  const aStartDate = new Date(`2000-01-01T${aStart}Z`)
  const aEndDate = new Date(`2000-01-01T${aEnd}Z`)
  const bStartDate = new Date(`2000-01-01T${bStart}Z`)
  const bEndDate = new Date(`2000-01-01T${bEnd}Z`)
  if (aEndDate <= aStartDate) aEndDate.setUTCDate(aEndDate.getUTCDate() + 1)
  if (bEndDate <= bStartDate) bEndDate.setUTCDate(bEndDate.getUTCDate() + 1)
  return aStartDate < bEndDate && bStartDate < aEndDate
}

export async function POST(request: NextRequest) {
  const auth = await verifyPermission(request, 'roster.edit')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json().catch(() => ({}))) as AutoFillBody
  if (!body.week_start) {
    return NextResponse.json({ error: 'week_start is required' }, { status: 400 })
  }

  const dates = weekDates(body.week_start)
  const weekEnd = dates[6]
  const maxWeeklyHours = Number.isFinite(body.maxWeeklyHours) ? Number(body.maxWeeklyHours) : 40
  const strategy = body.strategy ?? 'fair'
  const requestedShiftIds = normalizeIds(body.shiftIds)

  let employeeQuery = auth.supabase
    .from('employees')
    .select('id, first_name, last_name, department_id, branch_id, hire_date')
    .eq('organization_id', auth.profile.organization_id)
    .eq('employment_status', 'active')
    .is('termination_date', null)

  if (body.departmentId) employeeQuery = employeeQuery.eq('department_id', body.departmentId)
  if (body.branchId) employeeQuery = employeeQuery.eq('branch_id', body.branchId)

  let shiftQuery = auth.supabase
    .from('shifts')
    .select('id, name, start_time, end_time, break_minutes, department_id, branch_id')
    .eq('organization_id', auth.profile.organization_id)
    .eq('status', 'active')

  if (requestedShiftIds.length) shiftQuery = shiftQuery.in('id', requestedShiftIds)

  const [employeesResult, shiftsResult, assignmentsResult, leaveResult, availabilityResult] = await Promise.all([
    employeeQuery,
    shiftQuery,
    auth.supabase
      .from('roster_assignments')
      .select('id, employee_id, date, shift_id')
      .eq('organization_id', auth.profile.organization_id)
      .gte('date', body.week_start)
      .lte('date', weekEnd),
    auth.supabase
      .from('leave_records')
      .select('id, employee_id, start_date, end_date, leave_type, status')
      .eq('organization_id', auth.profile.organization_id)
      .eq('status', 'approved')
      .lte('start_date', weekEnd)
      .gte('end_date', body.week_start),
    auth.supabase
      .from('employee_availability')
      .select('employee_id, day_of_week, start_time, end_time, is_available, effective_from, effective_until, reason')
      .eq('organization_id', auth.profile.organization_id)
      .lte('effective_from', weekEnd)
      .or(`effective_until.is.null,effective_until.gte.${body.week_start}`),
  ])

  const firstError = [employeesResult.error, shiftsResult.error, assignmentsResult.error, leaveResult.error, availabilityResult.error].find(Boolean)
  if (firstError) {
    console.error('[roster/auto-fill POST]', firstError)
    return NextResponse.json({ error: firstError.message }, { status: 500 })
  }

  const employees = (employeesResult.data ?? []) as EmployeeRow[]
  const shifts = (shiftsResult.data ?? []) as ShiftRow[]
  const assignments = (assignmentsResult.data ?? []) as AssignmentRow[]
  const existingByEmployeeDate = new Set(assignments.map((assignment) => `${assignment.employee_id}:${assignment.date}`))
  const coveredShiftDates = new Set(assignments.filter((assignment) => assignment.shift_id).map((assignment) => `${assignment.date}:${assignment.shift_id}`))
  const hoursByEmployee = new Map<string, number>()
  const assignmentsByEmployee = new Map<string, number>()
  const shiftMap = new Map(shifts.map((shift) => [shift.id, shift]))

  for (const assignment of assignments) {
    const shift = assignment.shift_id ? shiftMap.get(assignment.shift_id) : null
    hoursByEmployee.set(assignment.employee_id, (hoursByEmployee.get(assignment.employee_id) ?? 0) + (shift ? shiftHours(shift) : 0))
    assignmentsByEmployee.set(assignment.employee_id, (assignmentsByEmployee.get(assignment.employee_id) ?? 0) + 1)
  }

  const suggestions: Record<string, unknown>[] = []
  const skipped: Record<string, unknown>[] = []

  for (const date of dates) {
    for (const shift of shifts) {
      if (coveredShiftDates.has(`${date}:${shift.id}`)) continue

      const availableCandidates: Candidate[] = []
      for (const employee of employees) {
        if (shift.department_id && shift.department_id !== employee.department_id) continue
        if (shift.branch_id && shift.branch_id !== employee.branch_id) continue
        if (existingByEmployeeDate.has(`${employee.id}:${date}`)) continue

        const onLeave = (leaveResult.data ?? []).some((leave) =>
          leave.employee_id === employee.id &&
          date >= leave.start_date &&
          date <= leave.end_date
        )
        if (onLeave) continue

        const availabilityRows = (availabilityResult.data ?? []).filter((row) =>
          row.employee_id === employee.id &&
          row.day_of_week === dayOfWeek(date) &&
          row.effective_from <= date &&
          (!row.effective_until || row.effective_until >= date)
        )
        const blocked = availabilityRows.some((row) =>
          row.is_available === false &&
          timeOverlaps(shift.start_time, shift.end_time, row.start_time, row.end_time)
        )
        if (blocked) continue

        const explicitAvailability = availabilityRows.filter((row) =>
          row.is_available === true &&
          timeOverlaps(shift.start_time, shift.end_time, row.start_time, row.end_time)
        ).length
        const weeklyHours = hoursByEmployee.get(employee.id) ?? 0
        const nextHours = weeklyHours + shiftHours(shift)
        if (nextHours > maxWeeklyHours) continue

        availableCandidates.push({
          ...employee,
          weeklyHours,
          assignments: assignmentsByEmployee.get(employee.id) ?? 0,
          explicitAvailability,
        })
      }

      const sorted = [...availableCandidates].sort((a, b) => {
        if (strategy === 'availability' && b.explicitAvailability !== a.explicitAvailability) {
          return b.explicitAvailability - a.explicitAvailability
        }
        if (strategy === 'seniority' && a.hire_date !== b.hire_date) {
          return String(a.hire_date ?? '9999-12-31').localeCompare(String(b.hire_date ?? '9999-12-31'))
        }
        if (a.weeklyHours !== b.weeklyHours) return a.weeklyHours - b.weeklyHours
        if (a.assignments !== b.assignments) return a.assignments - b.assignments
        return employeeName(a).localeCompare(employeeName(b))
      })

      const selected = sorted[0]
      if (!selected) {
        skipped.push({ date, shift_id: shift.id, shift_name: shift.name, reason: 'No eligible employee found' })
        continue
      }

      const hours = shiftHours(shift)
      hoursByEmployee.set(selected.id, (hoursByEmployee.get(selected.id) ?? 0) + hours)
      assignmentsByEmployee.set(selected.id, (assignmentsByEmployee.get(selected.id) ?? 0) + 1)
      existingByEmployeeDate.add(`${selected.id}:${date}`)
      coveredShiftDates.add(`${date}:${shift.id}`)

      suggestions.push({
        date,
        employee_id: selected.id,
        employee_name: employeeName(selected),
        shift_id: shift.id,
        shift_name: shift.name,
        projected_weekly_hours: Number((hoursByEmployee.get(selected.id) ?? 0).toFixed(2)),
        confidence: selected.explicitAvailability > 0 ? 0.92 : 0.78,
        reason: strategy,
      })
    }
  }

  return NextResponse.json({
    suggestions,
    skipped,
    meta: {
      week_start: body.week_start,
      week_end: weekEnd,
      strategy,
      max_weekly_hours: maxWeeklyHours,
    },
  })
}
