import { NextRequest, NextResponse } from 'next/server'
import { verifyMeetingProviderAdmin } from '../_lib'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await verifyMeetingProviderAdmin(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await context.params
  const { error } = await auth.supabase
    .from('organization_meeting_providers')
    .delete()
    .eq('id', id)
    .eq('organization_id', auth.profile.organization_id)

  if (error) {
    console.error('[meeting-providers DELETE]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
