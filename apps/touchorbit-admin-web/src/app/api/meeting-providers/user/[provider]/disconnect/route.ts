import { NextRequest, NextResponse } from 'next/server'
import { isWorkforceAuth, verifyWorkforceUser } from '../../../../_lib/workforce'
import { providerError, safeProvider, sanitizeProvider } from '../../../_lib'

type RouteContext = {
  params: Promise<{ provider: string }>
}

export async function POST(_request: NextRequest, context: RouteContext) {
  const auth = await verifyWorkforceUser()
  if (!isWorkforceAuth(auth)) return auth

  try {
    const { provider: providerParam } = await context.params
    const provider = safeProvider(providerParam)
    const { data, error } = await auth.supabase
      .from('user_meeting_providers')
      .update({
        encrypted_credentials: null,
        is_active: false,
        connection_status: 'disconnected',
        error_message: null,
      })
      .eq('organization_id', auth.profile.organization_id)
      .eq('user_id', auth.user.id)
      .eq('provider', provider)
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data: sanitizeProvider(data) })
  } catch (error) {
    console.error('[meeting-providers/user disconnect POST]', error)
    return providerError(error, 'Failed to disconnect provider')
  }
}
