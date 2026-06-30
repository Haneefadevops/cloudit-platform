import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export type CalendarAuth = {
  user: { id: string }
  profile: {
    role: string
    organization_id: string
  }
  supabase: ReturnType<typeof createServerClient>
}

export type CalendarEventBody = {
  title?: string
  description?: string | null
  event_type?: string
  event_scope?: string
  start_time?: string
  end_time?: string
  start_at?: string
  end_at?: string
  event_date?: string
  all_day?: boolean
  branch_id?: string | null
  department_id?: string | null
  secondary_branch_id?: string | null
  secondary_department_id?: string | null
  team_member_ids?: string[] | null
  meeting_provider?: string | null
  meeting_url?: string | null
  meeting_id?: string | null
  requires_rsvp?: boolean
  reminder_minutes?: number
  attachments?: unknown
  status?: string
  location?: string | null
}

export async function verifyCalendarUser(): Promise<CalendarAuth | NextResponse> {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('role, organization_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Forbidden: Profile not found' }, { status: 403 })
  }

  return { user: { id: user.id }, profile, supabase }
}

export function isCalendarAuth(value: CalendarAuth | NextResponse): value is CalendarAuth {
  return !(value instanceof NextResponse)
}

export function parseDateRange(request: NextRequest) {
  const searchParams = new URL(request.url).searchParams
  const today = new Date()
  const start = searchParams.get('start') ?? searchParams.get('startDate')
    ?? new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
  const end = searchParams.get('end') ?? searchParams.get('endDate')
    ?? new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10)

  return {
    start,
    end,
    scope: searchParams.get('scope'),
    departmentId: searchParams.get('department_id'),
    branchId: searchParams.get('branch_id'),
  }
}

export function normalizeEventBody(body: CalendarEventBody) {
  const eventDate = body.event_date ?? body.start_at?.slice(0, 10) ?? body.start_time?.slice(0, 10)
  const allDay = body.all_day ?? false
  const startAt = body.start_at ?? buildDateTime(eventDate, body.start_time, allDay ? '00:00:00' : undefined)
  const endAt = body.end_at ?? buildDateTime(eventDate, body.end_time, allDay ? '23:59:59' : undefined) ?? startAt

  return {
    p_title: body.title,
    p_description: body.description ?? null,
    p_event_type: normalizeEventType(body.event_type),
    p_event_scope: body.event_scope ?? 'organization',
    p_start_time: startAt,
    p_end_time: endAt,
    p_all_day: allDay,
    p_branch_id: body.branch_id || null,
    p_department_id: body.department_id || null,
    p_secondary_branch_id: body.secondary_branch_id || null,
    p_secondary_department_id: body.secondary_department_id || null,
    p_team_member_ids: body.team_member_ids?.length ? body.team_member_ids : [],
    p_meeting_provider: body.meeting_provider || null,
    p_meeting_url: body.meeting_url || null,
    p_meeting_id: body.meeting_id || null,
    p_requires_rsvp: body.requires_rsvp ?? false,
    p_reminder_minutes: body.reminder_minutes ?? 30,
    p_attachments: body.attachments ?? [],
    p_status: body.status ?? 'confirmed',
    p_location: body.location || null,
  }
}

export function normalizeEventType(type?: string) {
  if (type === 'announcement') return 'company_event'
  return type ?? 'meeting'
}

function buildDateTime(date?: string, time?: string | null, fallbackTime?: string) {
  if (!date) return undefined
  const chosenTime = time || fallbackTime
  return chosenTime ? `${date}T${chosenTime}` : `${date}T00:00:00`
}

export async function syncAttendees(
  auth: CalendarAuth,
  eventId: string,
  employeeIds: string[] | null | undefined,
  replace = true
) {
  const uniqueIds = [...new Set(employeeIds ?? [])].filter(Boolean)

  if (replace) {
    const { error: deleteError } = await auth.supabase
      .from('event_attendees')
      .delete()
      .eq('event_id', eventId)

    if (deleteError) throw deleteError
  }

  if (!uniqueIds.length) return

  const rows = uniqueIds.map((employee_id) => ({
    organization_id: auth.profile.organization_id,
    event_id: eventId,
    employee_id,
    status: 'pending',
  }))

  const { error } = await auth.supabase
    .from('event_attendees')
    .upsert(rows, { onConflict: 'event_id,employee_id', ignoreDuplicates: true })

  if (error) throw error
}
