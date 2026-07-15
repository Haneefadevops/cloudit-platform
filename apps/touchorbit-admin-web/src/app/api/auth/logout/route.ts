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

    // ResponseCookies retains only the last same-name Set-Cookie operation.
    // Emit one deletion using the same canonical domain chosen at login.
    res.cookies.set(SESSION_COOKIE.name, '', {
      domain,
      path: SESSION_COOKIE.path,
      maxAge: 0,
      sameSite: 'lax',
    })

    return res
  } catch (error) {
    console.error('Auth logout proxy error:', error)
    return NextResponse.json(
      { ok: false, error: 'Internal error' },
      { status: 500 },
    )
  }
}
