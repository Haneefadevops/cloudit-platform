import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-auth'

type RouteContext = {
  params: Promise<{ id: string }>
}

function combineDateTime(date?: string, time?: string) {
  if (!date) return null
  return `${date}T${time || '00:00:00'}`
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await verifyAdmin(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await context.params
  const status = new URL(request.url).searchParams.get('status')
  let query = auth.supabase
    .from('event_attendees')
    .select(`
      *,
      event:calendar_events(id, title, start_at, end_at, event_date, start_time, end_time),
      employee:employees(id, first_name, last_name, email)
    `)
    .eq('organization_id', auth.profile.organization_id)
    .eq('event_id', id)
    .eq('reschedule_requested', true)
    .order('updated_at', { ascending: false })

  if (status === 'pending') query = query.not('proposed_new_start', 'is', null)

  const { data, error } = await query
  if (error) {
    console.error('[calendar/reschedule GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [], meta: { count: data?.length ?? 0 } })
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await verifyAdmin(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const { id } = await context.params
    const body = await request.json()
    const action = body.action ?? 'manager'

    if (action === 'reject') {
      const { data, error } = await auth.supabase
        .from('event_attendees')
        .update({
          reschedule_requested: false,
          reschedule_reason: body.reason ?? body.rejection_reason ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('event_id', id)
        .eq('employee_id', body.employee_id)
        .eq('organization_id', auth.profile.organization_id)
        .select('*')
        .single()

      if (error) throw error
      return NextResponse.json({ data })
    }

    const proposedStart = body.proposed_new_start ?? combineDateTime(body.new_date, body.new_start_time)
    const proposedEnd = body.proposed_new_end ?? combineDateTime(body.new_date, body.new_end_time) ?? proposedStart
    if (!proposedStart || !proposedEnd) {
      return NextResponse.json({ error: 'new_date/proposed_new_start is required' }, { status: 400 })
    }

    const { data: currentEvent, error: currentError } = await auth.supabase
      .from('calendar_events')
      .select('start_at, end_at, event_date, start_time, end_time')
      .eq('id', id)
      .eq('organization_id', auth.profile.organization_id)
      .single()

    if (currentError) throw currentError

    const originalStart = currentEvent.start_at
      ?? (currentEvent.event_date && currentEvent.start_time ? `${currentEvent.event_date}T${currentEvent.start_time}` : currentEvent.event_date)
    const originalEnd = currentEvent.end_at
      ?? (currentEvent.event_date && currentEvent.end_time ? `${currentEvent.event_date}T${currentEvent.end_time}` : originalStart)

    const { data: event, error: updateError } = await auth.supabase
      .from('calendar_events')
      .update({
        start_at: proposedStart,
        end_at: proposedEnd,
        event_date: proposedStart.slice(0, 10),
        start_time: body.all_day ? null : proposedStart.slice(11, 19),
        end_time: body.all_day ? null : proposedEnd.slice(11, 19),
        all_day: body.all_day ?? false,
        status: 'rescheduled',
        original_start_time: originalStart,
        original_end_time: originalEnd,
        reschedule_reason: body.reason ?? body.reschedule_reason ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('organization_id', auth.profile.organization_id)
      .select('*')
      .single()

    if (updateError) throw updateError

    if (body.employee_id) {
      await auth.supabase
        .from('event_attendees')
        .update({
          reschedule_requested: false,
          proposed_new_start: proposedStart,
          proposed_new_end: proposedEnd,
          updated_at: new Date().toISOString(),
        })
        .eq('event_id', id)
        .eq('employee_id', body.employee_id)
        .eq('organization_id', auth.profile.organization_id)
    }

    return NextResponse.json({ data: event })
  } catch (error: any) {
    console.error('[calendar/reschedule POST]', error)
    return NextResponse.json({ error: error.message || 'Failed to reschedule event' }, { status: 500 })
  }
}
