import { NextRequest, NextResponse } from 'next/server'
import { verifyPermission } from '@/lib/admin-auth'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await verifyPermission(request, 'roster.approve_swap')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await context.params
  const body = await request.json().catch(() => ({}))
  const { data, error } = await auth.supabase.rpc('reject_shift_swap', {
    p_swap_id: id,
    p_reason: body.reason ?? body.rejection_reason ?? null,
  })

  if (error) {
    console.error('[shift-swaps reject POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: { status: data } })
}
