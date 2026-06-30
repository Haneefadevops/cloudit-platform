import { NextRequest, NextResponse } from 'next/server'
import { encryptCredentials, providerError, safeProvider, sanitizeProvider, verifyMeetingProviderAdmin } from './_lib'

export async function GET(request: NextRequest) {
  const auth = await verifyMeetingProviderAdmin(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await auth.supabase
    .from('organization_meeting_providers')
    .select('*')
    .eq('organization_id', auth.profile.organization_id)
    .order('is_default', { ascending: false })
    .order('provider', { ascending: true })

  if (error) {
    console.error('[meeting-providers GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data ?? []).map(sanitizeProvider)
  return NextResponse.json({ data: rows, meta: { count: rows.length } })
}

export async function POST(request: NextRequest) {
  const auth = await verifyMeetingProviderAdmin(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    const provider = safeProvider(body.provider)
    const encrypted = encryptCredentials(body)

    const payload: Record<string, unknown> = {
      organization_id: auth.profile.organization_id,
      provider,
      auth_type: body.auth_type ?? 'api_key',
      is_active: body.is_active ?? true,
      is_default: body.is_default ?? false,
      connection_status: encrypted ? 'connected' : 'disconnected',
      error_message: null,
      created_by: auth.user.id,
    }

    if (encrypted !== undefined) payload.encrypted_credentials = encrypted

    const { data, error } = await auth.supabase
      .from('organization_meeting_providers')
      .upsert(payload, { onConflict: 'organization_id,provider' })
      .select('*')
      .single()

    if (error) {
      console.error('[meeting-providers POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: sanitizeProvider(data) }, { status: 201 })
  } catch (error) {
    console.error('[meeting-providers POST]', error)
    return providerError(error, 'Failed to save meeting provider')
  }
}
