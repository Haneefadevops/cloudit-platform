import { useEffect, useState } from 'react'
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
  isOwner: boolean
  isHrAdmin: boolean
  isManager: boolean
  isFinance: boolean
  isDeptManager: boolean
  isBranchManager: boolean
  isAdmin: boolean
  isLoaded: boolean
  isSignedIn: boolean
  user: ApiUser | null
  userProfile: any
  userRole: string | undefined
  signOut: () => Promise<void>
}

function splitName(fullName?: string) {
  const parts = (fullName || '').trim().split(/\s+/)
  return {
    first_name: parts[0] || '',
    last_name: parts.slice(1).join(' ') || '',
  }
}

export function useAuth(): AuthState {
  const [profile, setProfile] = useState<MeData | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    let mounted = true

    async function fetchMe() {
      const result = await api.get<MeData>('/auth/me')
      if (!mounted) return
      if (result.ok && result.data) {
        setProfile(result.data)
      } else {
        setProfile(null)
      }
      setIsLoaded(true)
    }

    fetchMe()
    const interval = setInterval(fetchMe, 30000)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

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
    isOwner: role === 'owner',
    isHrAdmin: role === 'hr_admin',
    isManager: role === 'manager',
    isFinance: role === 'finance',
    isDeptManager: role === 'dept_manager',
    isBranchManager: role === 'branch_manager',
    isAdmin: ['owner', 'super_admin', 'admin', 'manager', 'hr_admin', 'finance', 'dept_manager', 'branch_manager'].includes(role as string),
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
    userRole: role,
    signOut: async () => {
      await api.post('/auth/logout', {})
      window.location.href = '/login'
    },
  }
}

export type AuthUser = ReturnType<typeof useAuth>
