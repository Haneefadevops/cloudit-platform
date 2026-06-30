import { NextRequest, NextResponse } from 'next/server'
import { isWorkforceAuth, verifyWorkforceUser } from '../../_lib/workforce'
import { sanitizeProvider } from '../_lib'

export async function GET(_request: NextRequest) {
  const auth = await verifyWorkforceUser()
  if (!isWorkforceAuth(auth)) return auth

  const { data, error } = await auth.supabase
    .from('user_meeting_providers')
    .select('*')
    .eq('organization_id', auth.profile.organization_id)
    .eq('user_id', auth.user.id)
    .order('provider', { ascending: true })

  if (error) {
    console.error('[meeting-providers/user GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data ?? []).map(sanitizeProvider)
  return NextResponse.json({ data: rows, meta: { count: rows.length } })
}
