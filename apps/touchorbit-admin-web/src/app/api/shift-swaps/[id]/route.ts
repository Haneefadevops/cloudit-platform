import { NextRequest, NextResponse } from 'next/server'
import { getOwnEmployeeId, isSchedulingAdmin, isWorkforceAuth, verifyWorkforceUser } from '../../_lib/workforce'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const auth = await verifyWorkforceUser()
  if (!isWorkforceAuth(auth)) return auth

  const { id } = await context.params
  const { data: swap, error: fetchError } = await auth.supabase
    .from('shift_swap_requests')
    .select('id, requester_employee_id, status')
    .eq('id', id)
    .eq('organization_id', auth.profile.organization_id)
    .single()

  if (fetchError) {
    const status = fetchError.code === 'PGRST116' ? 404 : 500
    return NextResponse.json({ error: status === 404 ? 'Shift swap not found' : fetchError.message }, { status })
  }

  if (!isSchedulingAdmin(auth.profile.role)) {
    const ownEmployeeId = await getOwnEmployeeId(auth)
    if (ownEmployeeId !== swap.requester_employee_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  if (!['pending', 'claimed'].includes(swap.status)) {
    return NextResponse.json({ error: 'Only pending or claimed requests can be cancelled' }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .from('shift_swap_requests')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('organization_id', auth.profile.organization_id)
    .select('*')
    .single()

  if (error) {
    console.error('[shift-swaps DELETE]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}
