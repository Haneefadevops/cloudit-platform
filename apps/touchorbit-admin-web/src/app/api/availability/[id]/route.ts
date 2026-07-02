import { NextRequest, NextResponse } from 'next/server'
import { canAccessEmployee, isWorkforceAuth, verifyWorkforceUser } from '../../_lib/workforce'

type RouteContext = {
  params: Promise<{ id: string }>
}

async function loadAvailability(auth: any, id: string) {
  return auth.supabase
    .from('employee_availability')
    .select('*')
    .eq('id', id)
    .eq('organization_id', auth.profile.organization_id)
    .single()
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await verifyWorkforceUser()
  if (!isWorkforceAuth(auth)) return auth

  try {
    const { id } = await context.params
    const existing = await loadAvailability(auth, id)
    if (existing.error) {
      const status = existing.error.code === 'PGRST116' ? 404 : 500
      return NextResponse.json({ error: status === 404 ? 'Availability not found' : existing.error.message }, { status })
    }

    if (!(await canAccessEmployee(auth, existing.data.employee_id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const update: Record<string, unknown> = {}
    for (const key of ['day_of_week', 'start_time', 'end_time', 'is_available', 'is_recurring', 'effective_from', 'effective_until', 'reason']) {
      if (body[key] !== undefined) update[key] = body[key]
    }

    const { data, error } = await auth.supabase
      .from('employee_availability')
      .update(update)
      .eq('id', id)
      .eq('organization_id', auth.profile.organization_id)
      .select('*')
      .single()

    if (error) {
      console.error('[availability PATCH]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('[availability PATCH]', error)
    return NextResponse.json({ error: error.message || 'Failed to update availability' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const auth = await verifyWorkforceUser()
  if (!isWorkforceAuth(auth)) return auth

  const { id } = await context.params
  const existing = await loadAvailability(auth, id)
  if (existing.error) {
    const status = existing.error.code === 'PGRST116' ? 404 : 500
    return NextResponse.json({ error: status === 404 ? 'Availability not found' : existing.error.message }, { status })
  }

  if (!(await canAccessEmployee(auth, existing.data.employee_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await auth.supabase
    .from('employee_availability')
    .delete()
    .eq('id', id)
    .eq('organization_id', auth.profile.organization_id)

  if (error) {
    console.error('[availability DELETE]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
