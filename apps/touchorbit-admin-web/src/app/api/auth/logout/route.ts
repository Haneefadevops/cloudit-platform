import { NextRequest, NextResponse } from 'next/server'
import { API_URL, getCookieDomain, SESSION_COOKIE } from '../_lib'

export async function POST(request: NextRequest) {
  if (!API_URL) {
    return NextResponse.json(
      { ok: false, error: 'API_URL is not configured' },
      { status: 500 },
    )
  }

  try {
    const cookie = request.headers.get('cookie') || ''
    await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    const host = request.headers.get('host') || ''
    const domain = getCookieDomain(host)
    const res = NextResponse.json(
      { ok: true, data: { loggedOut: true } },
      { status: 200 },
    )

    // Clear the session cookie on every domain it could have been set on.
    // Omitting Domain is required to remove a host-only cookie.
    res.cookies.set(SESSION_COOKIE.name, '', {
      path: SESSION_COOKIE.path,
      maxAge: 0,
      sameSite: 'lax',
    })
    res.cookies.set(SESSION_COOKIE.name, '', {
      domain: '.cloudit.lk',
      path: SESSION_COOKIE.path,
      maxAge: 0,
      sameSite: 'lax',
    })
    if (domain) {
      res.cookies.set(SESSION_COOKIE.name, '', {
        domain,
        path: SESSION_COOKIE.path,
        maxAge: 0,
        sameSite: 'lax',
      })
    }
    if (host && host !== domain) {
      res.cookies.set(SESSION_COOKIE.name, '', {
        domain: host,
        path: SESSION_COOKIE.path,
        maxAge: 0,
        sameSite: 'lax',
      })
    }

    return res
  } catch (error) {
    console.error('Auth logout proxy error:', error)
    return NextResponse.json(
      { ok: false, error: 'Internal error' },
      { status: 500 },
    )
  }
}
