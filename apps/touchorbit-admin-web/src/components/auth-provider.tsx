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
const RETRY_INTERVALS_MS = [500, 1_000, 2_000, 5_000]

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
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    let mounted = true

    function clearAuthTimeout() {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }

    function scheduleCheck(delay: number, attempt = 0) {
      clearAuthTimeout()
      timeoutRef.current = setTimeout(() => checkSession(attempt), delay)
    }

    async function checkSession(attempt = 0) {
      const { data, status } = await fetchMe()

      if (!mounted) return

      if (data) {
        setProfile(data)
        setIsLoaded(true)
        hasLoadedRef.current = true
        scheduleCheck(POLL_INTERVAL_MS)
        return
      }

      if (status === 401 || status === 403) {
        setProfile(null)
        setIsLoaded(true)
        hasLoadedRef.current = true
        clearAuthTimeout()
        return
      }

      // A rate limit, network failure, or server error is not proof that the
      // session ended. Preserve known-good auth and retry quickly on startup.
      const retryIndex = Math.min(attempt, RETRY_INTERVALS_MS.length - 1)
      scheduleCheck(
        hasLoadedRef.current ? POLL_INTERVAL_MS : RETRY_INTERVALS_MS[retryIndex],
        attempt + 1,
      )
    }

    checkSession()

    return () => {
      mounted = false
      clearAuthTimeout()
    }
  }, [])

  async function signOut() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
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
