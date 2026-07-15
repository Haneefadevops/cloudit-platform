import { createContext, createElement, useContext, useEffect, useRef, useState } from 'react'
import { api } from './api'

interface MeData {
  id: string
  email: string
  fullName: string
  role: string
  organizationId: string
  organization?: { id: string; name: string }
}

interface ApiUser {
  id: string
  email: string
  fullName?: string
  role?: string
  organizationId?: string
}

interface AuthState {
  userId: string | null
  organizationId: string | undefined
  role: string | undefined
  isEmployee: boolean
  isAdmin: boolean
  isLoaded: boolean
  isSignedIn: boolean
  user: ApiUser | null
  userProfile: any
  signOut: () => Promise<void>
}

interface AuthContextState {
  profile: MeData | null
  isLoaded: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextState | undefined>(undefined)
const POLL_INTERVAL_MS = 30_000
const RETRY_INTERVALS_MS = [500, 1_000, 2_000, 5_000]

function splitName(fullName?: string) {
  const parts = (fullName || '').trim().split(/\s+/)
  return {
    first_name: parts[0] || '',
    last_name: parts.slice(1).join(' ') || '',
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<MeData | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    let mounted = true

    function schedule(delay: number, attempt = 0) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => fetchMe(attempt), delay)
    }

    async function fetchMe(attempt = 0) {
      const result = await api.get<MeData>('/auth/me')
      if (!mounted) return
      if (result.ok && result.data) {
        setProfile(result.data)
        setIsLoaded(true)
        hasLoadedRef.current = true
        schedule(POLL_INTERVAL_MS)
      } else if (result.status === 401 || result.status === 403) {
        setProfile(null)
        setIsLoaded(true)
        hasLoadedRef.current = true
      } else {
        const retryIndex = Math.min(attempt, RETRY_INTERVALS_MS.length - 1)
        schedule(
          hasLoadedRef.current ? POLL_INTERVAL_MS : RETRY_INTERVALS_MS[retryIndex],
          attempt + 1,
        )
      }
    }

    fetchMe()

    return () => {
      mounted = false
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  async function signOut() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    await api.post('/auth/logout', {})
    setProfile(null)
    window.location.href = '/login'
  }

  return createElement(
    AuthContext.Provider,
    { value: { profile, isLoaded, signOut } },
    children,
  )
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  const { profile, isLoaded, signOut } = context

  const role = profile?.role
  const names = splitName(profile?.fullName)

  const userProfile = profile
    ? {
        ...profile,
        organization_id: profile.organizationId,
        first_name: names.first_name,
        last_name: names.last_name,
      }
    : null

  return {
    userId: profile?.id ?? null,
    organizationId: profile?.organizationId,
    role,
    isEmployee: role === 'employee',
    isAdmin: ['owner', 'manager', 'hr_admin'].includes(role as string),
    isLoaded,
    isSignedIn: !!profile,
    user: profile
      ? {
          id: profile.id,
          email: profile.email,
          fullName: profile.fullName,
          role: profile.role,
          organizationId: profile.organizationId,
        }
      : null,
    userProfile,
    signOut,
  }
}

export type AuthUser = ReturnType<typeof useAuth>
