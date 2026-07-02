import { NextRequest, NextResponse } from 'next/server'
import { isCalendarAuth, verifyCalendarUser } from '../../../../../_lib'

type RouteContext = {
  params: Promise<{ id: string; employee_id: string }>
}

function combineDateTime(date?: string, time?: string) {
  if (!date) return null
  return `${date}T${time || '00:00:00'}`
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await verifyCalendarUser()
  if (!isCalendarAuth(auth)) return auth

  try {
    const { id, employee_id: employeeId } = await context.params
    const body = await request.json()
    const proposedStart = body.proposed_new_start ?? combineDateTime(body.new_date, body.new_start_time)
    const proposedEnd = body.proposed_new_end ?? combineDateTime(body.new_date, body.new_end_time) ?? proposedStart

    if (!proposedStart) {
      return NextResponse.json({ error: 'proposed_new_start or new_date is required' }, { status: 400 })
    }

    const { data: employee } = await auth.supabase
      .from('employees')
      .select('id, user_id')
      .eq('id', employeeId)
      .eq('organization_id', auth.profile.organization_id)
      .single()

    const isAdmin = auth.profile.role !== 'employee'
    if (!employee || (!isAdmin && employee.user_id !== auth.user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await auth.supabase
      .from('event_attendees')
      .upsert({
        organization_id: auth.profile.organization_id,
        event_id: id,
        employee_id: employeeId,
        reschedule_requested: true,
        proposed_new_start: proposedStart,
        proposed_new_end: proposedEnd,
        reschedule_reason: body.reason ?? body.reschedule_reason ?? null,
      }, { onConflict: 'event_id,employee_id' })
      .select('*')
      .single()

    if (error) {
      console.error('[calendar/reschedule-request PATCH]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('[calendar/reschedule-request PATCH]', error)
    return NextResponse.json({ error: error.message || 'Failed to request reschedule' }, { status: 500 })
  }
}
