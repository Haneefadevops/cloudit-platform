import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-auth'
import {
  isCalendarAuth,
  normalizeEventBody,
  parseDateRange,
  syncAttendees,
  verifyCalendarUser,
} from '../_lib'

export async function GET(request: NextRequest) {
  const auth = await verifyCalendarUser()
  if (!isCalendarAuth(auth)) return auth

  const filters = parseDateRange(request)
  const { data, error } = await auth.supabase.rpc('get_calendar_events', {
    p_start_date: filters.start,
    p_end_date: filters.end,
    p_scope: filters.scope,
    p_department_id: filters.departmentId,
    p_branch_id: filters.branchId,
  })

  if (error) {
    console.error('[calendar/events GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [], meta: { count: data?.length ?? 0 } })
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }

    const eventArgs = normalizeEventBody(body)
    if (!eventArgs.p_start_time || !eventArgs.p_end_time) {
      return NextResponse.json({ error: 'start_time/end_time or event_date is required' }, { status: 400 })
    }

    const { data: eventId, error } = await auth.supabase.rpc('create_calendar_event', eventArgs)
    if (error) {
      console.error('[calendar/events POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await syncAttendees(auth, eventId, body.attendee_ids ?? body.team_member_ids, false)

    const { data: event, error: fetchError } = await auth.supabase
      .from('calendar_events')
      .select('*')
      .eq('id', eventId)
      .single()

    if (fetchError) {
      return NextResponse.json({ data: { id: eventId } }, { status: 201 })
    }

    return NextResponse.json({ data: event }, { status: 201 })
  } catch (error: any) {
    console.error('[calendar/events POST]', error)
    return NextResponse.json({ error: error.message || 'Failed to create event' }, { status: 500 })
  }
}
