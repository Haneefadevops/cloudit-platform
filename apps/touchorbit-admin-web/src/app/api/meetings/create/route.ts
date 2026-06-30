import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-auth'
import { decryptJson } from '@/lib/encryption'
import { createMeetingWithProvider, MeetingCredentials, MeetingProvider } from '@/lib/meeting-providers'

const PROVIDERS = new Set(['google_meet', 'zoom', 'microsoft_teams', 'manual'])

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    const provider = resolveProvider(body)
    if (!PROVIDERS.has(provider)) {
      return NextResponse.json({ error: 'Unsupported meeting provider' }, { status: 400 })
    }

    if (!body.title || !body.start_time || !body.end_time) {
      return NextResponse.json({ error: 'title, start_time, and end_time are required' }, { status: 400 })
    }

    const credentials = provider === 'manual'
      ? null
      : await resolveCredentials(auth, provider as MeetingProvider, body.user_id ?? auth.user.id)

    const meeting = await createMeetingWithProvider(provider as MeetingProvider, credentials, {
      title: body.title,
      description: body.description ?? null,
      start_time: body.start_time,
      end_time: body.end_time,
      timezone: body.timezone ?? 'UTC',
      attendee_emails: body.attendee_emails ?? [],
      meeting_url: body.meeting_url ?? null,
    })

    if (body.event_id) {
      const { data, error } = await auth.supabase.rpc('create_meeting_with_provider', {
        p_event_id: body.event_id,
        p_provider: meeting.provider,
        p_org_id: auth.profile.organization_id,
        p_user_id: auth.user.id,
        p_meeting_url: meeting.meeting_url,
        p_meeting_id: meeting.meeting_id ?? null,
      })

      if (error) {
        console.error('[meetings/create rpc]', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ data })
    }

    return NextResponse.json({ data: meeting })
  } catch (error: any) {
    console.error('[meetings/create POST]', error)
    const status = /not connected|requires|Missing|configured/i.test(error.message ?? '') ? 400 : 500
    return NextResponse.json({ error: error.message || 'Failed to create meeting' }, { status })
  }
}

function resolveProvider(body: any) {
  if (body.provider) return body.provider
  if (body.meeting_provider) return body.meeting_provider
  if (body.meeting_url) return 'manual'
  return 'manual'
}

async function resolveCredentials(auth: any, provider: MeetingProvider, userId: string): Promise<MeetingCredentials | null> {
  const { data: userProvider } = await auth.supabase
    .from('user_meeting_providers')
    .select('*')
    .eq('organization_id', auth.profile.organization_id)
    .eq('user_id', userId)
    .eq('provider', provider)
    .eq('is_active', true)
    .eq('connection_status', 'connected')
    .maybeSingle()

  if (userProvider?.encrypted_credentials) {
    return decryptJson<MeetingCredentials>(userProvider.encrypted_credentials)
  }

  const { data: orgProvider } = await auth.supabase
    .from('organization_meeting_providers')
    .select('*')
    .eq('organization_id', auth.profile.organization_id)
    .eq('provider', provider)
    .eq('is_active', true)
    .eq('connection_status', 'connected')
    .maybeSingle()

  if (orgProvider?.encrypted_credentials) {
    return decryptJson<MeetingCredentials>(orgProvider.encrypted_credentials)
  }

  const { data: defaultProvider } = await auth.supabase
    .from('organization_meeting_providers')
    .select('*')
    .eq('organization_id', auth.profile.organization_id)
    .eq('is_default', true)
    .eq('is_active', true)
    .eq('connection_status', 'connected')
    .maybeSingle()

  if (defaultProvider?.provider === provider && defaultProvider?.encrypted_credentials) {
    return decryptJson<MeetingCredentials>(defaultProvider.encrypted_credentials)
  }

  return null
}
