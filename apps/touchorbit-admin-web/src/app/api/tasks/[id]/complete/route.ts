import { NextRequest, NextResponse } from 'next/server'
import { canAccessEmployee, isTaskAuth, taskSelect, verifyTaskUser } from '../../_lib'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(_request: NextRequest, context: RouteContext) {
  const auth = await verifyTaskUser()
  if (!isTaskAuth(auth)) return auth

  const { id } = await context.params
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

  const { data, error } = await auth.supabase
    .from('employee_tasks')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('organization_id', auth.profile.organization_id)
    .select(taskSelect())
    .single()

  if (error) {
    console.error('[tasks complete POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}
