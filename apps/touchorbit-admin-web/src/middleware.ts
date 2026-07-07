import { NextResponse, type NextRequest } from 'next/server'

const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL

const ADMIN_ROLES = [
  'owner',
  'super_admin',
  'admin',
  'manager',
  'hr_admin',
  'finance',
  'dept_manager',
  'branch_manager',
]

interface MeData {
  id: string
  email: string
  fullName: string
  role: string
  organizationId: string
}

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchMe(cookie: string): Promise<{ me: MeData | null; status: number | null }> {
  if (!API_URL) {
    return { me: null, status: null }
  }

  const response = await fetch(`${API_URL}/api/auth/me`, {
    headers: { Cookie: cookie },
    credentials: 'include',
  })

  if (!response.ok) {
    return { me: null, status: response.status }
  }

  const body = await response.json()
  if (body?.ok && body.data) {
    return { me: body.data as MeData, status: response.status }
  }

  return { me: null, status: response.status }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isAuthPage =
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/set-password')

  let me: MeData | null = null

  if (API_URL) {
    try {
      const cookie = request.headers.get('cookie') || ''
      const firstCheck = await fetchMe(cookie)
      me = firstCheck.me

      if (!me && (firstCheck.status === 401 || firstCheck.status === 403)) {
        await delay(200)
        const secondCheck = await fetchMe(cookie)
        me = secondCheck.me
      }
    } catch (error) {
      console.error('Auth middleware check failed:', error)
    }
  }

  if (!me && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (me && !isAuthPage && !ADMIN_ROLES.includes(me.role)) {
    return NextResponse.redirect(new URL('/login?error=unauthorized', request.url))
  }

  if (me && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icons).*)'],
}
