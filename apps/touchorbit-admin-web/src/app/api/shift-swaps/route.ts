import { NextRequest, NextResponse } from 'next/server'
import { getOwnEmployeeId, isSchedulingAdmin, isWorkforceAuth, verifyWorkforceUser } from '../_lib/workforce'

export async function GET(request: NextRequest) {
  const auth = await verifyWorkforceUser()
  if (!isWorkforceAuth(auth)) return auth

  const searchParams = new URL(request.url).searchParams
  const status = searchParams.get('status')
  const employeeId = searchParams.get('employee_id')

  let query = auth.supabase
    .from('shift_swap_requests')
    .select(`
      *,
      requester:employees!shift_swap_requests_requester_employee_id_fkey(id, first_name, last_name, email),
      target:employees!shift_swap_requests_target_employee_id_fkey(id, first_name, last_name, email)
    `)
    .eq('organization_id', auth.profile.organization_id)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  if (employeeId) {
    query = query.or(`requester_employee_id.eq.${employeeId},target_employee_id.eq.${employeeId}`)
  } else if (!isSchedulingAdmin(auth.profile.role)) {
    const ownEmployeeId = await getOwnEmployeeId(auth)
    if (!ownEmployeeId) return NextResponse.json({ data: [], meta: { count: 0 } })
    query = query.or(`requester_employee_id.eq.${ownEmployeeId},target_employee_id.eq.${ownEmployeeId},target_employee_id.is.null`)
  }

  const { data, error } = await query.limit(100)
  if (error) {
    console.error('[shift-swaps GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [], meta: { count: data?.length ?? 0 } })
}

export async function POST(request: NextRequest) {
  const auth = await verifyWorkforceUser()
  if (!isWorkforceAuth(auth)) return auth

  try {
    const body = await request.json()
    const requesterId = body.requester_employee_id ?? await getOwnEmployeeId(auth)

    if (!requesterId || !body.requester_date) {
      return NextResponse.json({ error: 'requester_employee_id and requester_date are required' }, { status: 400 })
    }

    if (!isSchedulingAdmin(auth.profile.role)) {
      const ownEmployeeId = await getOwnEmployeeId(auth)
      if (ownEmployeeId !== requesterId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const { data, error } = await auth.supabase.rpc('request_shift_swap', {
      p_requester_id: requesterId,
      p_requester_date: body.requester_date,
      p_target_id: body.target_employee_id ?? null,
      p_target_date: body.target_date ?? null,
      p_reason: body.reason ?? null,
    })

    if (error) {
      console.error('[shift-swaps POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: { id: data } }, { status: 201 })
  } catch (error: any) {
    console.error('[shift-swaps POST]', error)
    return NextResponse.json({ error: error.message || 'Failed to create shift swap' }, { status: 500 })
  }
}
