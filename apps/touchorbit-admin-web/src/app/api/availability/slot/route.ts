import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-auth'

type EmployeeRow = {
  id: string
  first_name: string | null
  last_name: string | null
  department_id: string | null
  branch_id: string | null
}

type RosterRow = {
  id: string
  employee_id: string
  date: string
  shift_id: string | null
}

type ShiftRow = {
  id: string
  name: string | null
  start_time: string | null
  end_time: string | null
}

type AvailabilityRow = {
  employee_id: string
  day_of_week: number
  start_time: string | null
  end_time: string | null
  is_available: boolean
  effective_from: string
  effective_until: string | null
  reason: string | null
}

type SlotBody = {
  start?: string
  end?: string
  employeeIds?: unknown
  departmentId?: string
  branchId?: string
}

function normalizeIds(value: unknown) {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string' && id.length > 0) : []
}

function ymd(date: Date) {
  return date.toISOString().slice(0, 10)
}

function dayOfWeek(date: Date) {
  return date.getUTCDay()
}

function toDateTime(date: string, time: string | null) {
  return new Date(`${date}T${time ?? '00:00:00'}Z`)
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json().catch(() => ({}))) as SlotBody
  if (!body.start || !body.end) {
    return NextResponse.json({ error: 'start and end are required' }, { status: 400 })
  }

  const start = new Date(body.start)
  const end = new Date(body.end)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return NextResponse.json({ error: 'start and end must be valid datetimes, with end after start' }, { status: 400 })
  }

  const slotDate = ymd(start)
  const requestedEmployeeIds = [...new Set(normalizeIds(body.employeeIds))]

  let employeeQuery = auth.supabase
    .from('employees')
    .select('id, first_name, last_name, department_id, branch_id')
    .eq('organization_id', auth.profile.organization_id)
    .eq('employment_status', 'active')
    .is('termination_date', null)

  if (requestedEmployeeIds.length) employeeQuery = employeeQuery.in('id', requestedEmployeeIds)
  if (body.departmentId) employeeQuery = employeeQuery.eq('department_id', body.departmentId)
  if (body.branchId) employeeQuery = employeeQuery.eq('branch_id', body.branchId)

  const { data: employees, error: employeeError } = await employeeQuery
  if (employeeError) {
    console.error('[availability/slot POST] employees', employeeError)
    return NextResponse.json({ error: employeeError.message }, { status: 500 })
  }

  const employeeRows = (employees ?? []) as EmployeeRow[]
  if (employeeRows.length === 0) {
    return NextResponse.json({ available: [], blocked: [], meta: { count: 0 } })
  }

  const employeeIds = employeeRows.map((employee) => employee.id)
  const [leaveResult, rosterResult, availabilityResult] = await Promise.all([
    auth.supabase
      .from('leave_records')
      .select('id, employee_id, leave_type, start_date, end_date, status')
      .eq('organization_id', auth.profile.organization_id)
      .eq('status', 'approved')
      .lte('start_date', slotDate)
      .gte('end_date', slotDate)
      .in('employee_id', employeeIds),
    auth.supabase
      .from('roster_assignments')
      .select('id, employee_id, date, shift_id')
      .eq('organization_id', auth.profile.organization_id)
      .eq('date', slotDate)
      .in('employee_id', employeeIds),
    auth.supabase
      .from('employee_availability')
      .select('employee_id, day_of_week, start_time, end_time, is_available, effective_from, effective_until, reason')
      .eq('organization_id', auth.profile.organization_id)
      .eq('day_of_week', dayOfWeek(start))
      .lte('effective_from', slotDate)
      .or(`effective_until.is.null,effective_until.gte.${slotDate}`)
      .in('employee_id', employeeIds),
  ])

  const firstError = [leaveResult.error, rosterResult.error, availabilityResult.error].find(Boolean)
  if (firstError) {
    console.error('[availability/slot POST]', firstError)
    return NextResponse.json({ error: firstError.message }, { status: 500 })
  }

  const rosterRows = (rosterResult.data ?? []) as RosterRow[]
  const shiftIds = [...new Set(rosterRows.map((row) => row.shift_id).filter(Boolean) as string[])]
  const { data: shifts, error: shiftError } = shiftIds.length
    ? await auth.supabase.from('shifts').select('id, name, start_time, end_time').in('id', shiftIds)
    : { data: [], error: null }

  if (shiftError) {
    console.error('[availability/slot POST] shifts', shiftError)
    return NextResponse.json({ error: shiftError.message }, { status: 500 })
  }

  const shiftMap = new Map(((shifts ?? []) as ShiftRow[]).map((shift) => [shift.id, shift]))
  const blocked: Record<string, unknown>[] = []
  const available: EmployeeRow[] = []

  for (const employee of employeeRows) {
    const reasons: Record<string, unknown>[] = []
    const leave = (leaveResult.data ?? []).find((row) => row.employee_id === employee.id)
    if (leave) reasons.push({ type: 'leave', source_id: leave.id, label: `${leave.leave_type} leave` })

    for (const roster of rosterRows.filter((row) => row.employee_id === employee.id)) {
      const shift = roster.shift_id ? shiftMap.get(roster.shift_id) : null
      if (!shift?.start_time || !shift?.end_time) continue
      const shiftStart = toDateTime(roster.date, shift.start_time)
      const shiftEnd = toDateTime(roster.date, shift.end_time)
      if (shiftEnd <= shiftStart) shiftEnd.setUTCDate(shiftEnd.getUTCDate() + 1)
      if (overlaps(start, end, shiftStart, shiftEnd)) {
        reasons.push({ type: 'roster_assignment', source_id: roster.id, label: shift.name ?? 'Assigned shift' })
      }
    }

    for (const availability of ((availabilityResult.data ?? []) as AvailabilityRow[]).filter((row) => row.employee_id === employee.id)) {
      if (availability.is_available) continue
      if (!availability.start_time || !availability.end_time) {
        reasons.push({ type: 'unavailable', label: availability.reason ?? 'Unavailable' })
        continue
      }
      const unavailableStart = toDateTime(slotDate, availability.start_time)
      const unavailableEnd = toDateTime(slotDate, availability.end_time)
      if (unavailableEnd <= unavailableStart) unavailableEnd.setUTCDate(unavailableEnd.getUTCDate() + 1)
      if (overlaps(start, end, unavailableStart, unavailableEnd)) {
        reasons.push({ type: 'unavailable', label: availability.reason ?? 'Unavailable' })
      }
    }

    if (reasons.length) blocked.push({ employee, reasons })
    else available.push(employee)
  }

  return NextResponse.json({
    available,
    blocked,
    meta: {
      count: available.length,
      total_checked: employeeRows.length,
      start: body.start,
      end: body.end,
    },
  })
}
