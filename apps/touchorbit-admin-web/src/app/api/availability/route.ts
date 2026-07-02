import { NextRequest, NextResponse } from 'next/server'
import { canAccessEmployee, getOwnEmployeeId, isWorkforceAuth, verifyWorkforceUser } from '../_lib/workforce'

export async function GET(request: NextRequest) {
  const auth = await verifyWorkforceUser()
  if (!isWorkforceAuth(auth)) return auth

  const searchParams = new URL(request.url).searchParams
  const employeeId = searchParams.get('employee_id') ?? await getOwnEmployeeId(auth)
  if (!employeeId) return NextResponse.json({ data: [], meta: { count: 0 } })

  if (!(await canAccessEmployee(auth, employeeId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await auth.supabase
    .from('employee_availability')
    .select('*')
    .eq('organization_id', auth.profile.organization_id)
    .eq('employee_id', employeeId)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true })

  if (error) {
    console.error('[availability GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [], meta: { count: data?.length ?? 0 } })
}

export async function POST(request: NextRequest) {
  const auth = await verifyWorkforceUser()
  if (!isWorkforceAuth(auth)) return auth

  try {
    const body = await request.json()
    const employeeId = body.employee_id ?? await getOwnEmployeeId(auth)
    if (!employeeId || body.day_of_week === undefined) {
      return NextResponse.json({ error: 'employee_id and day_of_week are required' }, { status: 400 })
    }

    if (!(await canAccessEmployee(auth, employeeId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await auth.supabase
      .from('employee_availability')
      .insert({
        organization_id: auth.profile.organization_id,
        employee_id: employeeId,
        day_of_week: body.day_of_week,
        start_time: body.start_time ?? null,
        end_time: body.end_time ?? null,
        is_available: body.is_available ?? true,
        is_recurring: body.is_recurring ?? true,
        effective_from: body.effective_from ?? new Date().toISOString().slice(0, 10),
        effective_until: body.effective_until ?? null,
        reason: body.reason ?? null,
        created_by: auth.user.id,
      })
      .select('*')
      .single()

    if (error) {
      console.error('[availability POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error: any) {
    console.error('[availability POST]', error)
    return NextResponse.json({ error: error.message || 'Failed to create availability' }, { status: 500 })
  }
}
