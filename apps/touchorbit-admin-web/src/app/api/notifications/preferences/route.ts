import { NextRequest, NextResponse } from 'next/server'
import { isWorkforceAuth, verifyWorkforceUser } from '../../_lib/workforce'

type PreferenceInput = {
  notification_type?: string
  type?: string
  email_enabled?: boolean
  push_enabled?: boolean
}

function normalizePreferences(body: unknown): PreferenceInput[] {
  if (!body || typeof body !== 'object') return []

  const payload = body as { preferences?: unknown }
  if (Array.isArray(payload.preferences)) {
    return payload.preferences as PreferenceInput[]
  }

  if (Array.isArray(body)) {
    return body as PreferenceInput[]
  }

  return Object.entries(body as Record<string, unknown>)
    .filter(([, value]) => value && typeof value === 'object')
    .map(([type, value]) => ({
      ...(value as Record<string, unknown>),
      notification_type: type,
    })) as PreferenceInput[]
}

export async function GET() {
  const auth = await verifyWorkforceUser()
  if (!isWorkforceAuth(auth)) return auth

  const { data, error } = await auth.supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', auth.user.id)
    .order('notification_type', { ascending: true })

  if (error) {
    console.error('[notification preferences GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}

export async function PATCH(request: NextRequest) {
  const auth = await verifyWorkforceUser()
  if (!isWorkforceAuth(auth)) return auth

  const body = await request.json().catch(() => ({}))
  const preferences = normalizePreferences(body)
    .map((preference) => ({
      user_id: auth.user.id,
      notification_type: preference.notification_type ?? preference.type,
      email_enabled: preference.email_enabled ?? true,
      push_enabled: preference.push_enabled ?? true,
      updated_at: new Date().toISOString(),
    }))
    .filter((preference) => Boolean(preference.notification_type))

  if (preferences.length === 0) {
    return NextResponse.json({ error: 'preferences are required' }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .from('notification_preferences')
    .upsert(preferences, { onConflict: 'user_id,notification_type' })
    .select('*')

  if (error) {
    console.error('[notification preferences PATCH]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}
