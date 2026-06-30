import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { isWorkforceAuth, verifyWorkforceUser } from '../../../../_lib/workforce'
import { oauthUrl, providerError, safeProvider, sanitizeProvider } from '../../../_lib'

type RouteContext = {
  params: Promise<{ provider: string }>
}

export async function POST(_request: NextRequest, context: RouteContext) {
  const auth = await verifyWorkforceUser()
  if (!isWorkforceAuth(auth)) return auth

  try {
    const { provider: providerParam } = await context.params
    const provider = safeProvider(providerParam)
    const state = Buffer.from(JSON.stringify({
      organization_id: auth.profile.organization_id,
      user_id: auth.user.id,
      provider,
      nonce: crypto.randomUUID(),
    })).toString('base64url')
    const url = oauthUrl(provider, state)

    const { data, error } = await auth.supabase
      .from('user_meeting_providers')
      .upsert({
        organization_id: auth.profile.organization_id,
        user_id: auth.user.id,
        provider,
        auth_type: 'oauth',
        is_active: false,
        connection_status: url ? 'disconnected' : 'error',
        error_message: url ? null : 'OAuth environment variables are not configured',
      }, { onConflict: 'user_id,provider' })
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data: sanitizeProvider(data), connect_url: url })
  } catch (error) {
    console.error('[meeting-providers/user connect POST]', error)
    return providerError(error, 'Failed to initiate provider connection')
  }
}
