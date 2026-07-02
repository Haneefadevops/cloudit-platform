import { NextRequest, NextResponse } from 'next/server'
import {
  canAccessEmployee,
  getOwnEmployeeId,
  isAdminRole,
  isTaskAuth,
  normalizeTaskBody,
  taskSelect,
  verifyTaskUser,
} from './_lib'

export async function GET(request: NextRequest) {
  const auth = await verifyTaskUser()
  if (!isTaskAuth(auth)) return auth

  const searchParams = new URL(request.url).searchParams
  const employeeId = searchParams.get('employee_id')
  const status = searchParams.get('status')
  const dueBefore = searchParams.get('due_before')
  const includeCompleted = searchParams.get('include_completed') === 'true'

  if (employeeId) {
    if (!(await canAccessEmployee(auth, employeeId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await auth.supabase.rpc('get_employee_tasks', {
      p_employee_id: employeeId,
      p_status: status,
      p_due_before: dueBefore,
      p_include_completed: includeCompleted,
    })

    if (error) {
      console.error('[tasks GET rpc]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data ?? [], meta: { count: data?.length ?? 0 } })
  }

  let query = auth.supabase
    .from('employee_tasks')
    .select(taskSelect())
    .eq('organization_id', auth.profile.organization_id)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (!isAdminRole(auth.profile.role)) {
    const ownEmployeeId = await getOwnEmployeeId(auth)
    if (!ownEmployeeId) return NextResponse.json({ data: [], meta: { count: 0 } })
    query = query.eq('employee_id', ownEmployeeId)
  }

  if (status) query = query.eq('status', status)
  if (dueBefore) query = query.lte('due_date', dueBefore)
  if (!includeCompleted) query = query.neq('status', 'completed')

  const { data, error } = await query.limit(100)
  if (error) {
    console.error('[tasks GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [], meta: { count: data?.length ?? 0 } })
}

export async function POST(request: NextRequest) {
  const auth = await verifyTaskUser()
  if (!isTaskAuth(auth)) return auth

  try {
    const body = await request.json()
    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }

    const employeeId = body.employee_id || await getOwnEmployeeId(auth)
    if (!employeeId) {
      return NextResponse.json({ error: 'employee_id is required' }, { status: 400 })
    }

    if (!(await canAccessEmployee(auth, employeeId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (body.employee_id && !isAdminRole(auth.profile.role)) {
      return NextResponse.json({ error: 'Only admins can assign tasks to other employees' }, { status: 403 })
    }

    const payload = normalizeTaskBody(auth, body, employeeId)
    const { data, error } = await auth.supabase
      .from('employee_tasks')
      .insert(payload)
      .select(taskSelect())
      .single()

    if (error) {
      console.error('[tasks POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error: any) {
    console.error('[tasks POST]', error)
    return NextResponse.json({ error: error.message || 'Failed to create task' }, { status: 500 })
  }
}
