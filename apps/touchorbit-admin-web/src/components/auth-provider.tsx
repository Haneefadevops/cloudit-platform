'use client'

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'

interface MeData {
  id: string
  email: string
  fullName: string
  role: string
  organizationId: string
  organization?: { id: string; name: string }
}

interface AuthContextValue {
  profile: MeData | null
  isLoaded: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const POLL_INTERVAL_MS = 60_000
const BACKOFF_INTERVAL_MS = 120_000

async function fetchMe(): Promise<{
  data: MeData | null
  status: number | null
}> {
  try {
    const res = await fetch('/api/auth/me', {
      credentials: 'include',
    })

    if (!res.ok) {
      return { data: null, status: res.status }
    }

    const body = (await res.json()) as {
      ok: boolean
      data?: MeData
      error?: string
    }

    if (body?.ok && body.data) {
      return { data: body.data, status: res.status }
    }

    return { data: null, status: res.status }
  } catch {
    return { data: null, status: null }
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<MeData | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const isBackingOffRef = useRef(false)

  useEffect(() => {
    let mounted = true

    function clearAuthInterval() {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    function scheduleInterval(backoff: boolean) {
      clearAuthInterval()
      isBackingOffRef.current = backoff
      intervalRef.current = setInterval(
        checkSession,
        backoff ? BACKOFF_INTERVAL_MS : POLL_INTERVAL_MS,
      )
    }

    async function checkSession() {
      const { data, status } = await fetchMe()

      if (!mounted) return

      setProfile(data)
      setIsLoaded(true)

      if (data) {
        // Authenticated: normal poll interval.
        if (isBackingOffRef.current) {
          scheduleInterval(false)
        }
        return
      }

      if (status === 401 || status === 403) {
        // Unauthenticated: stop polling. The user must log in again.
        clearAuthInterval()
        return
      }

      if (status === 429) {
        // Rate limited: back off.
        scheduleInterval(true)
        return
      }

      // Other errors (network, 500, etc.): keep current interval.
    }

    checkSession()
    intervalRef.current = setInterval(checkSession, POLL_INTERVAL_MS)

    return () => {
      mounted = false
      clearAuthInterval()
    }
  }, [])

  async function signOut() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
    } catch {
      // ignore
    }
    setProfile(null)
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider value={{ profile, isLoaded, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuthContext must be used within AuthProvider')
  }
  return ctx
}
