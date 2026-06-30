import { randomBytes, createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-auth'

type ShareBody = {
  name?: string
  expires_at?: string | null
  expiresAt?: string | null
  allowed_start_date?: string | null
  allowedStartDate?: string | null
  allowed_end_date?: string | null
  allowedEndDate?: string | null
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function absoluteShareUrl(request: NextRequest, token: string) {
  const url = new URL(request.url)
  return `${url.origin}/api/calendar/public/${token}`
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json().catch(() => ({}))) as ShareBody
  const token = randomBytes(32).toString('base64url')
  const expiresAt = body.expires_at ?? body.expiresAt ?? null
  const allowedStartDate = body.allowed_start_date ?? body.allowedStartDate ?? null
  const allowedEndDate = body.allowed_end_date ?? body.allowedEndDate ?? null

  if (expiresAt && Number.isNaN(new Date(expiresAt).getTime())) {
    return NextResponse.json({ error: 'expires_at must be a valid datetime' }, { status: 400 })
  }
  if (allowedStartDate && allowedEndDate && allowedEndDate < allowedStartDate) {
    return NextResponse.json({ error: 'allowed_end_date must be on or after allowed_start_date' }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .from('public_calendar_tokens')
    .insert({
      organization_id: auth.profile.organization_id,
      token_hash: sha256(token),
      name: body.name?.trim() || 'Public calendar share',
      created_by: auth.user.id,
      expires_at: expiresAt,
      allowed_start_date: allowedStartDate,
      allowed_end_date: allowedEndDate,
    })
    .select('id, name, expires_at, allowed_start_date, allowed_end_date, created_at')
    .single()

  if (error) {
    console.error('[calendar/public POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(
    {
      token,
      share_url: absoluteShareUrl(request, token),
      data,
    },
    { status: 201 },
  )
}
