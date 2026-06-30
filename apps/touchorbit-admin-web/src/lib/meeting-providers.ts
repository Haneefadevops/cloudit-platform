import crypto from 'crypto'

export type MeetingProvider = 'google_meet' | 'zoom' | 'microsoft_teams' | 'manual'

export type MeetingCredentials = {
  access_token?: string
  refresh_token?: string
  client_id?: string
  client_secret?: string
  tenant_id?: string
  account_id?: string
  client_email?: string
  private_key?: string
  calendar_id?: string
  user_id?: string
}

export type MeetingRequest = {
  title: string
  description?: string | null
  start_time: string
  end_time: string
  timezone?: string
  attendee_emails?: string[]
  meeting_url?: string | null
}

export type MeetingResult = {
  provider: MeetingProvider
  meeting_url: string
  meeting_id?: string
}

export async function createMeetingWithProvider(
  provider: MeetingProvider,
  credentials: MeetingCredentials | null,
  request: MeetingRequest
): Promise<MeetingResult> {
  if (provider === 'manual') {
    if (!request.meeting_url) throw new Error('meeting_url is required for manual meetings')
    return { provider, meeting_url: request.meeting_url }
  }

  if (!credentials) {
    throw new Error(`${provider} is not connected`)
  }

  if (provider === 'google_meet') return createGoogleMeet(credentials, request)
  if (provider === 'zoom') return createZoomMeeting(credentials, request)
  if (provider === 'microsoft_teams') return createTeamsMeeting(credentials, request)

  throw new Error(`Unsupported meeting provider: ${provider}`)
}

export async function testMeetingProvider(provider: MeetingProvider, credentials: MeetingCredentials | null) {
  if (provider === 'manual') return { ok: true, message: 'Manual links do not require a provider connection' }
  if (!credentials) return { ok: false, message: 'No credentials configured' }

  if (provider === 'zoom') {
    await getZoomAccessToken(credentials)
    return { ok: true, message: 'Zoom credentials accepted' }
  }

  if (provider === 'google_meet') {
    await getGoogleAccessToken(credentials)
    return { ok: true, message: 'Google Meet credentials accepted' }
  }

  if (provider === 'microsoft_teams') {
    await getTeamsAccessToken(credentials)
    return { ok: true, message: 'Microsoft Teams credentials accepted' }
  }

  return { ok: false, message: 'Unsupported provider' }
}

async function createGoogleMeet(credentials: MeetingCredentials, request: MeetingRequest): Promise<MeetingResult> {
  const accessToken = await getGoogleAccessToken(credentials)
  const calendarId = encodeURIComponent(credentials.calendar_id ?? 'primary')
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?conferenceDataVersion=1`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary: request.title,
      description: request.description ?? undefined,
      start: { dateTime: request.start_time, timeZone: request.timezone ?? 'UTC' },
      end: { dateTime: request.end_time, timeZone: request.timezone ?? 'UTC' },
      attendees: request.attendee_emails?.map((email) => ({ email })),
      conferenceData: {
        createRequest: {
          requestId: crypto.randomUUID(),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    }),
  })

  const data = await readProviderResponse<any>(response, 'Google Calendar create event failed')
  const entryPoint = data.conferenceData?.entryPoints?.find((entry: any) => entry.entryPointType === 'video')
  return {
    provider: 'google_meet',
    meeting_url: entryPoint?.uri ?? data.hangoutLink,
    meeting_id: data.id,
  }
}

async function createZoomMeeting(credentials: MeetingCredentials, request: MeetingRequest): Promise<MeetingResult> {
  const accessToken = await getZoomAccessToken(credentials)
  const userId = encodeURIComponent(credentials.user_id ?? 'me')
  const response = await fetch(`https://api.zoom.us/v2/users/${userId}/meetings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topic: request.title,
      agenda: request.description ?? undefined,
      type: 2,
      start_time: request.start_time,
      duration: Math.max(1, Math.ceil((new Date(request.end_time).getTime() - new Date(request.start_time).getTime()) / 60000)),
      timezone: request.timezone ?? 'UTC',
      settings: {
        join_before_host: false,
        waiting_room: true,
      },
    }),
  })

  const data = await readProviderResponse<any>(response, 'Zoom create meeting failed')
  return { provider: 'zoom', meeting_url: data.join_url, meeting_id: String(data.id) }
}

async function createTeamsMeeting(credentials: MeetingCredentials, request: MeetingRequest): Promise<MeetingResult> {
  const accessToken = await getTeamsAccessToken(credentials)
  const response = await fetch('https://graph.microsoft.com/v1.0/me/onlineMeetings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subject: request.title,
      startDateTime: request.start_time,
      endDateTime: request.end_time,
    }),
  })

  const data = await readProviderResponse<any>(response, 'Microsoft Teams create meeting failed')
  return { provider: 'microsoft_teams', meeting_url: data.joinWebUrl, meeting_id: data.id }
}

async function getGoogleAccessToken(credentials: MeetingCredentials) {
  if (credentials.access_token) return credentials.access_token
  if (!credentials.client_email || !credentials.private_key) {
    throw new Error('Google Meet requires access_token or service account client_email/private_key')
  }

  const now = Math.floor(Date.now() / 1000)
  const assertion = signJwt({
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/calendar.events',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }, credentials.private_key)

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })

  const data = await readProviderResponse<any>(response, 'Google OAuth token exchange failed')
  return data.access_token as string
}

async function getZoomAccessToken(credentials: MeetingCredentials) {
  if (credentials.access_token) return credentials.access_token
  if (!credentials.account_id || !credentials.client_id || !credentials.client_secret) {
    throw new Error('Zoom requires access_token or account_id/client_id/client_secret')
  }

  const response = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(credentials.account_id)}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${credentials.client_id}:${credentials.client_secret}`).toString('base64')}`,
    },
  })

  const data = await readProviderResponse<any>(response, 'Zoom OAuth token exchange failed')
  return data.access_token as string
}

async function getTeamsAccessToken(credentials: MeetingCredentials) {
  if (credentials.access_token) return credentials.access_token
  if (!credentials.tenant_id || !credentials.client_id || !credentials.client_secret) {
    throw new Error('Teams requires access_token or tenant_id/client_id/client_secret')
  }

  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(credentials.tenant_id)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
      grant_type: 'client_credentials',
      scope: 'https://graph.microsoft.com/.default',
    }),
  })

  const data = await readProviderResponse<any>(response, 'Microsoft OAuth token exchange failed')
  return data.access_token as string
}

function signJwt(payload: Record<string, unknown>, privateKey: string) {
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const body = base64Url(JSON.stringify(payload))
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(`${header}.${body}`)
    .sign(privateKey.replace(/\\n/g, '\n'))

  return `${header}.${body}.${base64Url(signature)}`
}

function base64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

async function readProviderResponse<T>(response: Response, fallback: string): Promise<T> {
  const text = await response.text()
  const data = text ? JSON.parse(text) : {}
  if (!response.ok) {
    throw new Error(data.error_description ?? data.message ?? data.error ?? fallback)
  }
  return data as T
}
