import { NextRequest, NextResponse } from 'next/server'
import { API_URL, parseJsonBody } from '../_lib'

export async function GET(request: NextRequest) {
  if (!API_URL) {
    return NextResponse.json(
      { ok: false, error: 'API_URL is not configured' },
      { status: 500 },
    )
  }

  try {
    const cookie = request.headers.get('cookie') || ''
    const upstream = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Cookie: cookie },
    })

    const upstreamText = await upstream.text()
    const payload = parseJsonBody(upstreamText) as
      | { ok?: boolean; data?: unknown; error?: string; message?: string }
      | null

    if (!upstream.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            payload?.error || payload?.message || 'Unauthorized',
        },
        { status: upstream.status },
      )
    }

    return NextResponse.json(payload, { status: 200 })
  } catch (error) {
    console.error('Auth me proxy error:', error)
    return NextResponse.json(
      { ok: false, error: 'Internal error' },
      { status: 500 },
    )
  }
}
