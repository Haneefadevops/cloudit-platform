import { NextRequest, NextResponse } from 'next/server'
import { getOwnEmployeeId, isWorkforceAuth, verifyWorkforceUser } from '../../../_lib/workforce'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await verifyWorkforceUser()
  if (!isWorkforceAuth(auth)) return auth

  const { id } = await context.params
  const body = await request.json().catch(() => ({}))
  const claimerId = body.employee_id ?? await getOwnEmployeeId(auth)

  if (!claimerId) {
    return NextResponse.json({ error: 'employee_id is required' }, { status: 400 })
  }

  const { data, error } = await auth.supabase.rpc('claim_open_shift', {
    p_swap_id: id,
    p_claimer_id: claimerId,
    p_target_date: body.target_date ?? null,
  })

  if (error) {
    console.error('[shift-swaps claim POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: { status: data } })
}
