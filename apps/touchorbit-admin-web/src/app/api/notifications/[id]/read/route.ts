import { NextRequest, NextResponse } from 'next/server'
import { isWorkforceAuth, verifyWorkforceUser } from '../../../_lib/workforce'

type RouteContext = {
  params: Promise<{ id: string }>
}

async function markNotificationRead(context: RouteContext) {
  const auth = await verifyWorkforceUser()
  if (!isWorkforceAuth(auth)) return auth

  const { id } = await context.params
  const { data, error } = await auth.supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id)
    .eq('organization_id', auth.profile.organization_id)
    .eq('user_id', auth.user.id)
    .select('*')
    .single()

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500
    console.error('[notifications read]', error)
    return NextResponse.json({ error: status === 404 ? 'Notification not found' : error.message }, { status })
  }

  return NextResponse.json({ data })
}

export async function PATCH(_request: NextRequest, context: RouteContext) {
  return markNotificationRead(context)
}

export async function POST(_request: NextRequest, context: RouteContext) {
  return markNotificationRead(context)
}
