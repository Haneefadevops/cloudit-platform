import { NextRequest, NextResponse } from 'next/server'
import { isWorkforceAuth, verifyWorkforceUser } from '../../_lib/workforce'

export async function POST(_request: NextRequest) {
  const auth = await verifyWorkforceUser()
  if (!isWorkforceAuth(auth)) return auth

  const { data, error } = await auth.supabase
    .from('notifications')
    .update({ read: true })
    .eq('organization_id', auth.profile.organization_id)
    .eq('user_id', auth.user.id)
    .eq('read', false)
    .select('id')

  if (error) {
    console.error('[notifications mark-all-read POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    data: {
      updated: data?.length ?? 0,
    },
  })
}
