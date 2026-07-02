import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-auth'

type EmployeeSummary = {
  id: string
  first_name: string | null
  last_name: string | null
  department_id: string | null
  branch_id: string | null
  department?: { name: string | null } | null
}

type ShiftSummary = {
  id: string
  name: string | null
  start_time: string | null
  end_time: string | null
}

type RosterAssignment = {
  id: string
  employee_id: string
  date: string
  shift_id: string | null
  notes: string | null
}

type RosterWindow = RosterAssignment & {
  employee: EmployeeSummary
  shift: ShiftSummary
  start: Date
  end: Date
}

function parseFilters(searchParams: URLSearchParams) {
  return {
    startDate: searchParams.get('startDate'),
    endDate: searchParams.get('endDate'),
    departmentId: searchParams.get('departmentId') || null,
    branchId: searchParams.get('branchId') || null,
  }
}

function inclusiveDays(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00.000Z`)
  const end = new Date(`${endDate}T00:00:00.000Z`)
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1)
}

function employeeName(employee: EmployeeSummary) {
  return [employee.first_name, employee.last_name].filter(Boolean).join(' ').trim() || 'Employee'
}

function normalizeEmployee(employee: Record<string, unknown>): EmployeeSummary {
  const department = Array.isArray(employee.department) ? employee.department[0] : employee.department

  return {
    id: String(employee.id),
    first_name: (employee.first_name as string | null) ?? null,
    last_name: (employee.last_name as string | null) ?? null,
    department_id: (employee.department_id as string | null) ?? null,
    branch_id: (employee.branch_id as string | null) ?? null,
    department: department && typeof department === 'object'
      ? { name: ((department as Record<string, unknown>).name as string | null) ?? null }
      : null,
  }
}

function toDateTime(date: string, time: string | null) {
  return new Date(`${date}T${time ?? '00:00:00'}Z`)
}

function buildRosterWindows(
  assignments: RosterAssignment[],
  employees: Map<string, EmployeeSummary>,
  shifts: Map<string, ShiftSummary>,
) {
  return assignments.flatMap((assignment) => {
    if (!assignment.shift_id) return []
    const employee = employees.get(assignment.employee_id)
    const shift = shifts.get(assignment.shift_id)
    if (!employee || !shift?.start_time || !shift?.end_time) return []

    const start = toDateTime(assignment.date, shift.start_time)
    const end = toDateTime(assignment.date, shift.end_time)
    if (end <= start) end.setUTCDate(end.getUTCDate() + 1)

    return [{ ...assignment, employee, shift, start, end }]
  })
}

function deriveRosterOverlapConflicts(windows: RosterWindow[]) {
  const conflicts: Record<string, unknown>[] = []
  const grouped = new Map<string, RosterWindow[]>()

  for (const window of windows) {
    const key = `${window.employee_id}:${window.date}`
    grouped.set(key, [...(grouped.get(key) ?? []), window])
  }

  for (const group of grouped.values()) {
    const sorted = [...group].sort((a, b) => a.start.getTime() - b.start.getTime())
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        const first = sorted[i]
        const second = sorted[j]
        if (second.start >= first.end) break

        conflicts.push({
          conflict_id: `roster-overlap:${first.id}:${second.id}`,
          conflict_type: 'roster_shift_overlap',
          severity: 'high',
          employee_id: first.employee_id,
          employee_name: employeeName(first.employee),
          department_id: first.employee.department_id,
          department_name: first.employee.department?.name ?? null,
          branch_id: first.employee.branch_id,
          conflict_date: first.date,
          start_time: first.start.toISOString(),
          end_time: new Date(Math.min(first.end.getTime(), second.end.getTime())).toISOString(),
          source_id: first.id,
          source_title: 'Overlapping roster shifts',
          details: {
            assignment_ids: [first.id, second.id],
            shifts: [
              { id: first.shift_id, name: first.shift.name, start_time: first.shift.start_time, end_time: first.shift.end_time },
              { id: second.shift_id, name: second.shift.name, start_time: second.shift.start_time, end_time: second.shift.end_time },
            ],
          },
        })
      }
    }
  }

  return conflicts
}

function withinRange(dateValue: string | null | undefined, startDate: string, endDate: string) {
  if (!dateValue) return false
  const date = dateValue.slice(0, 10)
  return date >= startDate && date <= endDate
}

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const filters = parseFilters(new URL(request.url).searchParams)
  if (!filters.startDate || !filters.endDate) {
    return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 })
  }
  if (filters.endDate < filters.startDate) {
    return NextResponse.json({ error: 'endDate must be on or after startDate' }, { status: 400 })
  }

  const { supabase } = auth
  const orgId = auth.profile.organization_id

  const [eventsResult, reportConflictsResult, rosterResult, activeEmployeesResult, leaveResult, swapsResult, reschedulesResult] =
    await Promise.all([
      supabase.rpc('get_calendar_events', {
        p_start_date: filters.startDate,
        p_end_date: filters.endDate,
        p_scope: null,
        p_department_id: filters.departmentId,
        p_branch_id: filters.branchId,
      }),
      supabase.rpc('get_conflict_report', {
        p_org_id: orgId,
        p_start_date: filters.startDate,
        p_end_date: filters.endDate,
        p_department_id: filters.departmentId,
        p_branch_id: filters.branchId,
      }),
      supabase
        .from('roster_assignments')
        .select('id, employee_id, date, shift_id, notes')
        .eq('organization_id', orgId)
        .gte('date', filters.startDate)
        .lte('date', filters.endDate),
      supabase
        .from('employees')
        .select('id', { count: 'exact' })
        .eq('organization_id', orgId)
        .eq('employment_status', 'active')
        .is('termination_date', null)
        .match({
          ...(filters.departmentId ? { department_id: filters.departmentId } : {}),
          ...(filters.branchId ? { branch_id: filters.branchId } : {}),
        }),
      supabase
        .from('leave_records')
        .select('id, employee_id, leave_type, start_date, end_date, days_count, reason, status, created_at, employee:employees(id, first_name, last_name, department_id, branch_id, department:departments(name))')
        .eq('organization_id', orgId)
        .in('status', ['pending', 'awaiting_level1', 'awaiting_level2', 'awaiting_level3'])
        .lte('start_date', filters.endDate)
        .gte('end_date', filters.startDate)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('shift_swap_requests')
        .select('*, requester:employees!shift_swap_requests_requester_employee_id_fkey(id, first_name, last_name, department_id, branch_id), target:employees!shift_swap_requests_target_employee_id_fkey(id, first_name, last_name, department_id, branch_id)')
        .eq('organization_id', orgId)
        .in('status', ['pending', 'claimed'])
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('event_attendees')
        .select('id, event_id, employee_id, status, reschedule_requested, proposed_new_start, proposed_new_end, reschedule_reason, rsvp_at, event:calendar_events(id, title, start_at, end_at, event_date, start_time, end_time), employee:employees(id, first_name, last_name, department_id, branch_id, department:departments(name))')
        .eq('organization_id', orgId)
        .eq('reschedule_requested', true)
        .order('rsvp_at', { ascending: false })
        .limit(100),
    ])

  const firstError = [
    eventsResult.error,
    reportConflictsResult.error,
    rosterResult.error,
    activeEmployeesResult.error,
    leaveResult.error,
    swapsResult.error,
    reschedulesResult.error,
  ].find(Boolean)

  if (firstError) {
    console.error('[calendar/hub GET]', firstError)
    return NextResponse.json({ error: firstError.message }, { status: 500 })
  }

  const assignments = (rosterResult.data ?? []) as RosterAssignment[]
  const employeeIds = [...new Set(assignments.map((assignment) => assignment.employee_id))]
  const shiftIds = [...new Set(assignments.map((assignment) => assignment.shift_id).filter(Boolean) as string[])]

  const [employeesResult, shiftsResult] = await Promise.all([
    employeeIds.length
      ? supabase
          .from('employees')
          .select('id, first_name, last_name, department_id, branch_id, department:departments(name)')
          .in('id', employeeIds)
      : Promise.resolve({ data: [], error: null }),
    shiftIds.length
      ? supabase.from('shifts').select('id, name, start_time, end_time').in('id', shiftIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (employeesResult.error || shiftsResult.error) {
    const error = employeesResult.error ?? shiftsResult.error
    console.error('[calendar/hub GET]', error)
    return NextResponse.json({ error: error?.message ?? 'Failed to load roster conflict data' }, { status: 500 })
  }

  const employeeMap = new Map((employeesResult.data ?? []).map((employee) => [employee.id, normalizeEmployee(employee as Record<string, unknown>)]))
  const shiftMap = new Map((shiftsResult.data ?? []).map((shift) => [shift.id, shift as ShiftSummary]))
  const scopedAssignments = assignments.filter((assignment) => {
    const employee = employeeMap.get(assignment.employee_id)
    return (
      employee &&
      (!filters.departmentId || employee.department_id === filters.departmentId) &&
      (!filters.branchId || employee.branch_id === filters.branchId)
    )
  })
  const rosterWindows = buildRosterWindows(scopedAssignments, employeeMap, shiftMap)
  const derivedConflicts = deriveRosterOverlapConflicts(rosterWindows)
  const conflictsById = new Map<string, Record<string, unknown>>()
  for (const conflict of [...((reportConflictsResult.data ?? []) as Record<string, unknown>[]), ...derivedConflicts]) {
    conflictsById.set(String(conflict.conflict_id), conflict)
  }

  const swaps = ((swapsResult.data ?? []) as Record<string, unknown>[]).filter((swap) => {
    const requesterDate = swap.requester_date as string | null | undefined
    const targetDate = swap.target_date as string | null | undefined
    return withinRange(requesterDate, filters.startDate!, filters.endDate!) || withinRange(targetDate, filters.startDate!, filters.endDate!)
  })

  const reschedules = ((reschedulesResult.data ?? []) as Record<string, unknown>[]).filter((requestRow) => {
    const event = requestRow.event as Record<string, unknown> | null
    const eventDate = (event?.start_at ?? event?.event_date) as string | null | undefined
    return withinRange(eventDate, filters.startDate!, filters.endDate!)
  })

  const assignedShiftDays = new Set(scopedAssignments.map((assignment) => `${assignment.employee_id}:${assignment.date}`)).size
  const activeEmployees = activeEmployeesResult.count ?? activeEmployeesResult.data?.length ?? 0
  const potentialShiftDays = activeEmployees * inclusiveDays(filters.startDate, filters.endDate)
  const rate = potentialShiftDays > 0 ? Math.round((assignedShiftDays / potentialShiftDays) * 100) : 0

  return NextResponse.json({
    events: eventsResult.data ?? [],
    conflicts: [...conflictsById.values()],
    requests: {
      leave: leaveResult.data ?? [],
      swaps,
      reschedules,
    },
    coverage: {
      rate,
      active_employees: activeEmployees,
      assigned_shift_days: assignedShiftDays,
      potential_shift_days: potentialShiftDays,
    },
  })
}
