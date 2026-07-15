import { NextResponse, type NextRequest } from 'next/server'

const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL

interface MeData {
  id: string
  email: string
  fullName: string
  role: string
  organizationId: string
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/signup')
  const isResetPage = pathname.startsWith('/reset-password')

  let me: MeData | null = null
  let lastStatus: number | null = null

  if (API_URL) {
    try {
      const cookie = request.headers.get('cookie') || ''
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Cookie: cookie },
        credentials: 'include',
      })
      lastStatus = response.status

      if (response.ok) {
        const body = await response.json()
        if (body?.ok && body.data) {
          me = body.data as MeData
        }
      }
    } catch (error) {
      console.error('Auth middleware check failed:', error)
    }
  }

  const hasSessionCookie = request.cookies.has('touchorbit_session')
  const isDefinitelyUnauthenticated = lastStatus === 401 || lastStatus === 403
  const shouldRedirectToLogin = !hasSessionCookie || isDefinitelyUnauthenticated || !API_URL

  if (!me && !isAuthPage && !isResetPage && shouldRedirectToLogin) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (me && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icons).*)'],
}
