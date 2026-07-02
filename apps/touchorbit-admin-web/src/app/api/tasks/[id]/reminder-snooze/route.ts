import { NextRequest, NextResponse } from 'next/server'
import { canAccessEmployee, isTaskAuth, taskSelect, verifyTaskUser } from '../../_lib'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await verifyTaskUser()
  if (!isTaskAuth(auth)) return auth

  try {
    const { id } = await context.params
    const body = await request.json().catch(() => ({}))
    const minutes = Number(body.minutes ?? 30)

    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 10080) {
      return NextResponse.json({ error: 'minutes must be between 1 and 10080' }, { status: 400 })
    }

    const { data: existing, error: existingError } = await auth.supabase
      .from('employee_tasks')
      .select('id, employee_id')
      .eq('id', id)
      .eq('organization_id', auth.profile.organization_id)
      .single()

    if (existingError) {
      const status = existingError.code === 'PGRST116' ? 404 : 500
      return NextResponse.json({ error: status === 404 ? 'Task not found' : existingError.message }, { status })
    }

    if (!(await canAccessEmployee(auth, existing.employee_id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const snoozedUntil = new Date(Date.now() + minutes * 60000).toISOString()
    const { data, error } = await auth.supabase
      .from('employee_tasks')
      .update({
        reminder_snoozed_until: snoozedUntil,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('organization_id', auth.profile.organization_id)
      .select(taskSelect())
      .single()

    if (error) {
      console.error('[tasks reminder-snooze POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('[tasks reminder-snooze POST]', error)
    return NextResponse.json({ error: error.message || 'Failed to snooze reminder' }, { status: 500 })
  }
}
