import { NextRequest, NextResponse } from 'next/server'
import { isWorkforceAuth, verifyWorkforceUser } from '../../_lib/workforce'

export async function GET(request: NextRequest) {
  const auth = await verifyWorkforceUser()
  if (!isWorkforceAuth(auth)) return auth

  const weekStart = new URL(request.url).searchParams.get('week_start')
  if (!weekStart) {
    return NextResponse.json({ error: 'week_start is required' }, { status: 400 })
  }

  const { data, error } = await auth.supabase.rpc('get_roster_week_status', {
    p_week_start: weekStart,
  })

  if (error) {
    console.error('[roster/week-status GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: { week_start: weekStart, status: data ?? 'draft' } })
}
