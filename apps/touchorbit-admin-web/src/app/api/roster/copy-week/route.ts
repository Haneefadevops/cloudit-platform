import { NextRequest, NextResponse } from 'next/server'
import { verifyPermission } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  const auth = await verifyPermission(request, 'roster.edit')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json()
  const sourceWeek = body.source_week_start ?? body.source_week
  const targetWeek = body.target_week_start ?? body.target_week

  if (!sourceWeek || !targetWeek) {
    return NextResponse.json({ error: 'source_week_start and target_week_start are required' }, { status: 400 })
  }

  const { data, error } = await auth.supabase.rpc('copy_roster_week_with_conflicts', {
    p_source_week_start: sourceWeek,
    p_target_week_start: targetWeek,
  })

  if (error) {
    console.error('[roster/copy-week POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}
