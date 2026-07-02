import { NextRequest, NextResponse } from 'next/server'
import { isCalendarAuth, verifyCalendarUser } from '../../../../../_lib'

type RouteContext = {
  params: Promise<{ id: string; employee_id: string }>
}

const RSVP_STATUSES = new Set(['pending', 'accepted', 'declined', 'tentative'])

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await verifyCalendarUser()
  if (!isCalendarAuth(auth)) return auth

  try {
    const { id, employee_id: employeeId } = await context.params
    const body = await request.json()
    const status = body.status

    if (!RSVP_STATUSES.has(status)) {
      return NextResponse.json({ error: 'Invalid RSVP status' }, { status: 400 })
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
        status,
        rsvp_at: new Date().toISOString(),
      }, { onConflict: 'event_id,employee_id' })
      .select('*')
      .single()

    if (error) {
      console.error('[calendar/rsvp POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('[calendar/rsvp POST]', error)
    return NextResponse.json({ error: error.message || 'Failed to RSVP' }, { status: 500 })
  }
}
