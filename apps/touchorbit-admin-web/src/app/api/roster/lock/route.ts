import { NextRequest, NextResponse } from 'next/server'
import { verifyPermission } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  const auth = await verifyPermission(request, 'roster.lock')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json()
  if (!body.week_start) {
    return NextResponse.json({ error: 'week_start is required' }, { status: 400 })
  }

  const { data, error } = await auth.supabase.rpc('set_roster_week_status', {
    p_week_start: body.week_start,
    p_status: 'locked',
  })

  if (error) {
    console.error('[roster/lock POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: { status: data, week_start: body.week_start } })
}
