import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-auth'

type EmployeeRow = {
  id: string
  first_name: string | null
  last_name: string | null
  department_id: string | null
  branch_id: string | null
}

type CalendarEvent = {
  id: string
  event_scope: string | null
  branch_id: string | null
  department_id: string | null
  secondary_branch_id: string | null
  secondary_department_id: string | null
  team_member_ids: string[] | null
  [key: string]: unknown
}

function parseEmployeeIds(searchParams: URLSearchParams) {
  const csv = searchParams.get('employeeIds') ?? searchParams.get('employee_ids')
  const repeated = searchParams.getAll('employeeId')
  return [
    ...(csv ? csv.split(',') : []),
    ...repeated,
  ].map((id) => id.trim()).filter(Boolean)
}

function eventMatchesEmployee(event: CalendarEvent, employee: EmployeeRow, attendeeEventIds: Set<string>) {
  return (
    event.event_scope === 'organization' ||
    attendeeEventIds.has(event.id) ||
    (event.team_member_ids ?? []).includes(employee.id) ||
    event.branch_id === employee.branch_id ||
    event.secondary_branch_id === employee.branch_id ||
    event.department_id === employee.department_id ||
    event.secondary_department_id === employee.department_id
  )
}

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const searchParams = new URL(request.url).searchParams
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const employeeIds = [...new Set(parseEmployeeIds(searchParams))]

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 })
  }
  if (endDate < startDate) {
    return NextResponse.json({ error: 'endDate must be on or after startDate' }, { status: 400 })
  }
  if (employeeIds.length === 0) {
    return NextResponse.json({ error: 'At least one employee id is required' }, { status: 400 })
  }

  const { data: employees, error: employeeError } = await auth.supabase
    .from('employees')
    .select('id, first_name, last_name, department_id, branch_id')
    .eq('organization_id', auth.profile.organization_id)
    .in('id', employeeIds)

  if (employeeError) {
    console.error('[calendar/multi-employee GET] employees', employeeError)
    return NextResponse.json({ error: employeeError.message }, { status: 500 })
  }

  const scopedEmployees = (employees ?? []) as EmployeeRow[]
  if (scopedEmployees.length === 0) {
    return NextResponse.json({ events: [], by_employee: {}, employees: [] })
  }

  const { data: events, error: eventsError } = await auth.supabase.rpc('get_calendar_events', {
    p_start_date: startDate,
    p_end_date: endDate,
    p_scope: null,
    p_department_id: null,
    p_branch_id: null,
  })

  if (eventsError) {
    console.error('[calendar/multi-employee GET] events', eventsError)
    return NextResponse.json({ error: eventsError.message }, { status: 500 })
  }

  const eventRows = (events ?? []) as CalendarEvent[]
  const eventIds = eventRows.map((event) => event.id)
  const { data: attendees, error: attendeesError } = eventIds.length
    ? await auth.supabase
        .from('event_attendees')
        .select('event_id, employee_id, status')
        .eq('organization_id', auth.profile.organization_id)
        .in('employee_id', scopedEmployees.map((employee) => employee.id))
        .in('event_id', eventIds)
        .neq('status', 'declined')
    : { data: [], error: null }

  if (attendeesError) {
    console.error('[calendar/multi-employee GET] attendees', attendeesError)
    return NextResponse.json({ error: attendeesError.message }, { status: 500 })
  }

  const attendeeEventIdsByEmployee = new Map<string, Set<string>>()
  for (const attendee of attendees ?? []) {
    const existing = attendeeEventIdsByEmployee.get(attendee.employee_id) ?? new Set<string>()
    existing.add(attendee.event_id)
    attendeeEventIdsByEmployee.set(attendee.employee_id, existing)
  }

  const byEmployee: Record<string, CalendarEvent[]> = {}
  const flatEvents = new Map<string, CalendarEvent>()

  for (const employee of scopedEmployees) {
    const attendeeEventIds = attendeeEventIdsByEmployee.get(employee.id) ?? new Set<string>()
    const employeeEvents = eventRows.filter((event) => eventMatchesEmployee(event, employee, attendeeEventIds))
    byEmployee[employee.id] = employeeEvents
    for (const event of employeeEvents) flatEvents.set(event.id, event)
  }

  return NextResponse.json({
    events: [...flatEvents.values()],
    by_employee: byEmployee,
    employees: scopedEmployees,
  })
}
