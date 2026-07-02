import { NextRequest, NextResponse } from 'next/server'
import { isWorkforceAuth, verifyWorkforceUser } from '../_lib/workforce'

export async function GET(request: NextRequest) {
  const auth = await verifyWorkforceUser()
  if (!isWorkforceAuth(auth)) return auth

  const searchParams = new URL(request.url).searchParams
  const unreadOnly = searchParams.get('unread_only') === 'true'
  const limitParam = Number(searchParams.get('limit') ?? 50)
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 50

  let query = auth.supabase
    .from('notifications')
    .select('*')
    .eq('organization_id', auth.profile.organization_id)
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (unreadOnly) {
    query = query.eq('read', false)
  }

  const { data, error } = await query
  if (error) {
    console.error('[notifications GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { count, error: countError } = await auth.supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', auth.profile.organization_id)
    .eq('user_id', auth.user.id)
    .eq('read', false)

  if (countError) {
    console.error('[notifications GET unread count]', countError)
  }

  return NextResponse.json({
    data: data ?? [],
    meta: {
      count: data?.length ?? 0,
      unread_count: count ?? 0,
    },
  })
}
