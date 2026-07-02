import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-auth'
import { decryptJson, encryptJson } from '@/lib/encryption'
import { MeetingCredentials, MeetingProvider } from '@/lib/meeting-providers'

export const PROVIDERS = new Set(['google_meet', 'zoom', 'microsoft_teams'])

export function safeProvider(value: string): MeetingProvider {
  if (!PROVIDERS.has(value)) throw new Error('Unsupported meeting provider')
  return value as MeetingProvider
}

export function sanitizeProvider(row: any) {
  if (!row) return row
  const { encrypted_credentials, ...safe } = row
  return {
    ...safe,
    connection_status: row.connection_status ?? (encrypted_credentials ? 'connected' : 'disconnected'),
    has_credentials: Boolean(encrypted_credentials),
  }
}

export async function verifyMeetingProviderAdmin(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if ('error' in auth) return auth
  return auth
}

export function credentialsFromBody(body: any) {
  return body.credentials ?? body.api_credentials ?? null
}

export function encryptCredentials(body: any) {
  const credentials = credentialsFromBody(body)
  return credentials ? encryptJson(credentials) : undefined
}

export function decryptCredentials<T = MeetingCredentials>(row: any) {
  return decryptJson<T>(row?.encrypted_credentials)
}

export function providerError(error: unknown, fallback: string, status = 500) {
  const message = error instanceof Error ? error.message : fallback
  return NextResponse.json({ error: message }, { status })
}

export function oauthUrl(provider: MeetingProvider, state: string) {
  if (provider === 'google_meet') {
    const clientId = process.env.GOOGLE_MEET_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID
    const redirectUri = process.env.GOOGLE_MEET_REDIRECT_URI
    if (!clientId || !redirectUri) return null
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/calendar.events',
      access_type: 'offline',
      prompt: 'consent',
      state,
    })
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  }

  if (provider === 'zoom') {
    const clientId = process.env.ZOOM_CLIENT_ID
    const redirectUri = process.env.ZOOM_REDIRECT_URI
    if (!clientId || !redirectUri) return null
    const params = new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: redirectUri, state })
    return `https://zoom.us/oauth/authorize?${params.toString()}`
  }

  const clientId = process.env.TEAMS_CLIENT_ID ?? process.env.MICROSOFT_CLIENT_ID
  const tenantId = process.env.TEAMS_TENANT_ID ?? process.env.MICROSOFT_TENANT_ID ?? 'common'
  const redirectUri = process.env.TEAMS_REDIRECT_URI ?? process.env.MICROSOFT_REDIRECT_URI
  if (!clientId || !redirectUri) return null
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: 'offline_access OnlineMeetings.ReadWrite',
    state,
  })
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`
}
