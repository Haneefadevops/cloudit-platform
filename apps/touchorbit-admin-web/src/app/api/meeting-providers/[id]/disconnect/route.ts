import { NextRequest, NextResponse } from 'next/server'
import { sanitizeProvider, verifyMeetingProviderAdmin } from '../../_lib'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await verifyMeetingProviderAdmin(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await context.params
  const { data, error } = await auth.supabase
    .from('organization_meeting_providers')
    .update({
      encrypted_credentials: null,
      connection_status: 'disconnected',
      is_active: false,
      is_default: false,
      error_message: null,
    })
    .eq('id', id)
    .eq('organization_id', auth.profile.organization_id)
    .select('*')
    .single()

  if (error) {
    console.error('[meeting-providers disconnect POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: sanitizeProvider(data) })
}
