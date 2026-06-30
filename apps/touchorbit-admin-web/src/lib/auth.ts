import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { User, Session } from '@supabase/supabase-js'

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
  user: User | null
  userProfile: any
  userRole: string | undefined
  signOut: () => Promise<void>
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      setSession(session)
      if (session) loadUserProfile(session.user.id)
      else setIsLoaded(true)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: string, session: Session | null) => {
        setSession(session)
        if (session) loadUserProfile(session.user.id)
        else { setUserProfile(null); setIsLoaded(true) }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function loadUserProfile(userId: string) {
    const { data } = await supabase
      .from('users')
      .select('organization_id, role, first_name, last_name')
      .eq('id', userId)
      .single()
    setUserProfile(data)
    setIsLoaded(true)
  }

  const role = userProfile?.role

  return {
    userId: session?.user?.id ?? null,
    organizationId: userProfile?.organization_id,
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
    isSignedIn: !!session,
    user: session?.user ?? null,
    userProfile,
    userRole: role,
    signOut: async () => { 
      await supabase.auth.signOut()
      window.location.href = '/login'
    },
  }
}

export type AuthUser = ReturnType<typeof useAuth>
