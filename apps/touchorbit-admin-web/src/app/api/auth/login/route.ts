import { NextRequest, NextResponse } from 'next/server'
import {
  API_URL,
  getCookieDomain,
  parseJsonBody,
  SESSION_COOKIE,
} from '../_lib'

export async function POST(request: NextRequest) {
  if (!API_URL) {
    return NextResponse.json(
      { ok: false, error: 'API_URL is not configured' },
      { status: 500 },
    )
  }

  try {
    const body = await request.json()
    const upstream = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const upstreamText = await upstream.text()
    const payload = parseJsonBody(upstreamText) as {
      ok?: boolean
      data?: { token?: string; user?: unknown }
      error?: string
      message?: string
    } | null

    if (!upstream.ok || !payload?.ok || !payload?.data?.token) {
      const status = upstream.status || 400
      return NextResponse.json(
        {
          ok: false,
          error:
            payload?.error || payload?.message || 'Login failed',
        },
        { status },
      )
    }

    const { token, user } = payload.data
    const host = request.headers.get('host') || ''
    const domain = getCookieDomain(host)
    const isSecure = request.nextUrl.protocol === 'https:'

    const res = NextResponse.json({ ok: true, data: user }, { status: 200 })

    // Clear any stale session cookies that may have been set with a
    // different (wrong) domain during earlier deployments.
    res.cookies.set(SESSION_COOKIE.name, '', {
      domain: '.cloudit.lk',
      path: SESSION_COOKIE.path,
      maxAge: 0,
      sameSite: 'lax',
    })
    if (host) {
      res.cookies.set(SESSION_COOKIE.name, '', {
        domain: host,
        path: SESSION_COOKIE.path,
        maxAge: 0,
        sameSite: 'lax',
      })
    }

    // Set the canonical session cookie on the parent domain so it is sent
    // to both the admin app and the API subdomain.
    res.cookies.set(SESSION_COOKIE.name, token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      domain,
      path: SESSION_COOKIE.path,
      maxAge: SESSION_COOKIE.maxAge,
    })

    return res
  } catch (error) {
    console.error('Auth login proxy error:', error)
    return NextResponse.json(
      { ok: false, error: 'Internal error' },
      { status: 500 },
    )
  }
}
