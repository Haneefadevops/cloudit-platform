import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-auth'

const VALID_ACTIONS = new Set(['approve', 'reject'])

type BulkBody = {
  action?: string
  leaveIds?: unknown
  swapIds?: unknown
}

function normalizeIds(value: unknown) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && id.length > 0))]
}

function approvalLevel(status: string | null | undefined) {
  if (status === 'awaiting_level2') return 2
  if (status === 'awaiting_level3') return 3
  return 1
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json().catch(() => ({}))) as BulkBody
  const action = body.action
  const leaveIds = normalizeIds(body.leaveIds)
  const swapIds = normalizeIds(body.swapIds)

  if (!action || !VALID_ACTIONS.has(action)) {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 })
  }
  if (leaveIds.length === 0 && swapIds.length === 0) {
    return NextResponse.json({ error: 'At least one leaveIds or swapIds value is required' }, { status: 400 })
  }

  const processed = { leave: 0, swaps: 0 }
  const errors: { type: 'leave' | 'swap'; id: string; error: string }[] = []
  const decision = action === 'approve' ? 'approved' : 'rejected'

  if (leaveIds.length > 0) {
    const { data: leaveRows, error } = await auth.supabase
      .from('leave_records')
      .select('id, status')
      .eq('organization_id', auth.profile.organization_id)
      .in('id', leaveIds)

    if (error) {
      console.error('[requests/bulk POST] leave lookup', error)
      return NextResponse.json({ success: false, processed, errors: [{ type: 'leave', id: '*', error: error.message }] }, { status: 500 })
    }

    const rowsById = new Map((leaveRows ?? []).map((row) => [row.id, row]))
    for (const leaveId of leaveIds) {
      const row = rowsById.get(leaveId)
      if (!row) {
        errors.push({ type: 'leave', id: leaveId, error: 'Leave request not found' })
        continue
      }

      const { error: rpcError } = await auth.supabase.rpc('advance_leave_request', {
        p_request_id: leaveId,
        p_level: approvalLevel(row.status),
        p_status: decision,
        p_notes: `Bulk ${decision} from Calendar Hub`,
      })

      if (rpcError) {
        console.error('[requests/bulk POST] advance_leave_request', rpcError)
        errors.push({ type: 'leave', id: leaveId, error: rpcError.message })
        continue
      }

      processed.leave += 1
    }
  }

  for (const swapId of swapIds) {
    const rpcName = action === 'approve' ? 'approve_shift_swap' : 'reject_shift_swap'
    const args = action === 'approve'
      ? { p_swap_id: swapId }
      : { p_swap_id: swapId, p_reason: 'Bulk rejected from Calendar Hub' }

    const { error } = await auth.supabase.rpc(rpcName, args)
    if (error) {
      console.error('[requests/bulk POST] shift swap action', error)
      errors.push({ type: 'swap', id: swapId, error: error.message })
      continue
    }

    processed.swaps += 1
  }

  const success = errors.length === 0
  return NextResponse.json(
    {
      success,
      processed,
      ...(success ? {} : { errors }),
    },
    { status: success ? 200 : 207 },
  )
}
