import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export type TaskAuth = {
  user: { id: string }
  profile: {
    role: string
    organization_id: string
  }
  supabase: ReturnType<typeof createServerClient>
}

export type TaskBody = {
  employee_id?: string | null
  title?: string
  description?: string | null
  category?: string
  due_date?: string | null
  reminder_minutes?: number | null
  is_recurring?: boolean
  recurrence_rule?: string | null
  status?: string
}

export async function verifyTaskUser(): Promise<TaskAuth | NextResponse> {
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

export function isTaskAuth(value: TaskAuth | NextResponse): value is TaskAuth {
  return !(value instanceof NextResponse)
}

export function isAdminRole(role: string) {
  return ['owner', 'super_admin', 'admin', 'manager', 'hr_admin', 'dept_manager', 'branch_manager'].includes(role)
}

export async function getOwnEmployeeId(auth: TaskAuth) {
  const { data, error } = await auth.supabase
    .from('employees')
    .select('id')
    .eq('organization_id', auth.profile.organization_id)
    .eq('user_id', auth.user.id)
    .single()

  if (error || !data) return null
  return data.id as string
}

export async function canAccessEmployee(auth: TaskAuth, employeeId: string) {
  if (isAdminRole(auth.profile.role)) return true

  const ownEmployeeId = await getOwnEmployeeId(auth)
  return ownEmployeeId === employeeId
}

export function reminderAt(dueDate?: string | null, reminderMinutes?: number | null) {
  if (!dueDate || reminderMinutes === null || reminderMinutes === undefined) return null
  return new Date(new Date(dueDate).getTime() - reminderMinutes * 60000).toISOString()
}

export function normalizeTaskBody(auth: TaskAuth, body: TaskBody, employeeId: string) {
  return {
    organization_id: auth.profile.organization_id,
    employee_id: employeeId,
    assigned_by: isAdminRole(auth.profile.role) ? auth.user.id : null,
    title: body.title?.trim(),
    description: body.description ?? null,
    category: body.category ?? 'work',
    due_date: body.due_date || null,
    reminder_minutes: body.reminder_minutes ?? null,
    reminder_at: reminderAt(body.due_date, body.reminder_minutes),
    is_recurring: body.is_recurring ?? false,
    recurrence_rule: body.recurrence_rule ?? null,
    status: body.status ?? 'pending',
  }
}

export function taskSelect() {
  return `
    *,
    employee:employees(id, first_name, last_name, email, department, department_id, branch_id),
    assigner:users!employee_tasks_assigned_by_fkey(id, first_name, last_name, email)
  `
}
