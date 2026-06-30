import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-auth'
import { isCalendarAuth, syncAttendees, verifyCalendarUser } from '../../../_lib'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const auth = await verifyCalendarUser()
  if (!isCalendarAuth(auth)) return auth

  const { id } = await context.params
  const { data, error } = await auth.supabase
    .from('event_attendees')
    .select(`
      *,
      employee:employees(id, first_name, last_name, email, department, department_id, branch_id, user_id)
    `)
    .eq('event_id', id)
    .eq('organization_id', auth.profile.organization_id)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[calendar/event attendees GET]', error)
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
    await syncAttendees(auth, id, body.employee_ids ?? [], body.replace ?? true)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[calendar/event attendees POST]', error)
    return NextResponse.json({ error: error.message || 'Failed to update attendees' }, { status: 500 })
  }
}
