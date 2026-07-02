import { NextRequest, NextResponse } from 'next/server'
import { testMeetingProvider } from '@/lib/meeting-providers'
import { decryptCredentials, providerError, sanitizeProvider, verifyMeetingProviderAdmin } from '../../_lib'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await verifyMeetingProviderAdmin(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const { id } = await context.params
    const { data: row, error } = await auth.supabase
      .from('organization_meeting_providers')
      .select('*')
      .eq('id', id)
      .eq('organization_id', auth.profile.organization_id)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 404 })

    const result = await testMeetingProvider(row.provider, decryptCredentials(row))
    const { data: updated } = await auth.supabase
      .from('organization_meeting_providers')
      .update({
        connection_status: result.ok ? 'connected' : 'error',
        error_message: result.ok ? null : result.message,
      })
      .eq('id', id)
      .select('*')
      .single()

    return NextResponse.json({ data: sanitizeProvider(updated ?? row), test: result })
  } catch (error) {
    console.error('[meeting-providers test POST]', error)
    return providerError(error, 'Failed to test meeting provider')
  }
}
