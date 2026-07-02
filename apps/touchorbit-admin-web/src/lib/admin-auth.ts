import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

export const ADMIN_ROLES = ['owner', 'super_admin', 'admin', 'manager', 'hr_admin', 'finance', 'dept_manager', 'branch_manager']

type VerifyAdminOptions = {
  roles?: string[]
}

export async function verifyAdmin(request: NextRequest, options: VerifyAdminOptions = {}) {
  const cookieStore = cookies()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {}, // Read-only in this context
      },
    }
  )

  // 1. Get the authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return { error: 'Unauthorized', status: 401 }
  }

  // 2. Check the role in the public.users table
  // We rely on RLS allowing users to read their own record in 'users' table
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('role, organization_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    console.error('verifyAdmin: Profile not found for user', user.id, profileError)
    return { error: 'Forbidden: Profile not found', status: 403 }
  }

  // 3. Verify the role is an administrative role
  const allowedRoles = options.roles ?? ADMIN_ROLES
  if (!allowedRoles.includes(profile.role)) {
    return { error: 'Forbidden: Admin access required', status: 403 }
  }

  return { user, profile, supabase }
}

export async function verifyPermission(request: NextRequest, permission: string) {
  const auth = await verifyAdmin(request)
  if ('error' in auth) return auth

  if (auth.profile.role === 'owner' || auth.profile.role === 'super_admin') {
    return auth
  }

  const { data, error } = await auth.supabase.rpc('has_permission', {
    p_permission_key: permission,
  })

  if (error) {
    console.error('verifyPermission: permission check failed', permission, error)
    return { error: 'Forbidden: Permission check failed', status: 403 }
  }

  if (!data) {
    return { error: 'Forbidden: Insufficient permissions', status: 403 }
  }

  return auth
}
