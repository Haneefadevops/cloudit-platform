import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-auth'
import { isCalendarAuth, normalizeEventBody, syncAttendees, verifyCalendarUser } from '../../_lib'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const auth = await verifyCalendarUser()
  if (!isCalendarAuth(auth)) return auth

  const { id } = await context.params
  const { data, error } = await auth.supabase
    .from('calendar_events')
    .select('*, attendees:event_attendees(*), event_attachments(*)')
    .eq('id', id)
    .eq('organization_id', auth.profile.organization_id)
    .single()

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500
    return NextResponse.json({ error: status === 404 ? 'Event not found' : error.message }, { status })
  }

  return NextResponse.json({ data })
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await verifyAdmin(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const { id } = await context.params
    const body = await request.json()
    const eventArgs = normalizeEventBody(body)
    const { data: eventId, error } = await auth.supabase.rpc('update_calendar_event', {
      p_event_id: id,
      ...eventArgs,
    })

    if (error) {
      console.error('[calendar/events PATCH]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (body.attendee_ids || body.team_member_ids) {
      await syncAttendees(auth, id, body.attendee_ids ?? body.team_member_ids, true)
    }

    const { data: event, error: fetchError } = await auth.supabase
      .from('calendar_events')
      .select('*')
      .eq('id', eventId)
      .single()

    if (fetchError) {
      return NextResponse.json({ data: { id: eventId } })
    }

    return NextResponse.json({ data: event })
  } catch (error: any) {
    console.error('[calendar/events PATCH]', error)
    return NextResponse.json({ error: error.message || 'Failed to update event' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await verifyAdmin(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await context.params
  const { error } = await auth.supabase
    .from('calendar_events')
    .delete()
    .eq('id', id)
    .eq('organization_id', auth.profile.organization_id)

  if (error) {
    console.error('[calendar/events DELETE]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
