import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const SCHEDULING_ADMIN_ROLES = ['owner', 'super_admin', 'admin', 'manager', 'hr_admin', 'dept_manager', 'branch_manager']

export type WorkforceAuth = {
  user: { id: string }
  profile: {
    role: string
    organization_id: string
  }
  supabase: ReturnType<typeof createServerClient>
}

export async function verifyWorkforceUser(): Promise<WorkforceAuth | NextResponse> {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('role, organization_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Forbidden: Profile not found' }, { status: 403 })
  }

  return { user: { id: user.id }, profile, supabase }
}

export function isWorkforceAuth(value: WorkforceAuth | NextResponse): value is WorkforceAuth {
  return !(value instanceof NextResponse)
}

export function isSchedulingAdmin(role: string) {
  return SCHEDULING_ADMIN_ROLES.includes(role)
}

export async function getOwnEmployeeId(auth: WorkforceAuth) {
  const { data, error } = await auth.supabase
    .from('employees')
    .select('id')
    .eq('organization_id', auth.profile.organization_id)
    .eq('user_id', auth.user.id)
    .single()

  if (error || !data) return null
  return data.id as string
}

export async function canAccessEmployee(auth: WorkforceAuth, employeeId: string) {
  if (isSchedulingAdmin(auth.profile.role)) return true
  const ownEmployeeId = await getOwnEmployeeId(auth)
  return ownEmployeeId === employeeId
}

export function errorResponse(error: unknown, fallback: string, status = 500) {
  const message = error instanceof Error ? error.message : fallback
  return NextResponse.json({ error: message }, { status })
}
