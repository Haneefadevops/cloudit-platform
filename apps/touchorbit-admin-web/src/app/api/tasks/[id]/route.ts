import { NextRequest, NextResponse } from 'next/server'
import {
  canAccessEmployee,
  isAdminRole,
  isTaskAuth,
  reminderAt,
  taskSelect,
  verifyTaskUser,
} from '../_lib'

type RouteContext = {
  params: Promise<{ id: string }>
}

async function loadTask(auth: any, id: string) {
  return auth.supabase
    .from('employee_tasks')
    .select(taskSelect())
    .eq('id', id)
    .eq('organization_id', auth.profile.organization_id)
    .single()
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const auth = await verifyTaskUser()
  if (!isTaskAuth(auth)) return auth

  const { id } = await context.params
  const { data, error } = await loadTask(auth, id)

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500
    return NextResponse.json({ error: status === 404 ? 'Task not found' : error.message }, { status })
  }

  if (!(await canAccessEmployee(auth, data.employee_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ data })
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await verifyTaskUser()
  if (!isTaskAuth(auth)) return auth

  try {
    const { id } = await context.params
    const existing = await loadTask(auth, id)
    if (existing.error) {
      const status = existing.error.code === 'PGRST116' ? 404 : 500
      return NextResponse.json({ error: status === 404 ? 'Task not found' : existing.error.message }, { status })
    }

    if (!(await canAccessEmployee(auth, existing.data.employee_id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    if (body.employee_id && body.employee_id !== existing.data.employee_id && !isAdminRole(auth.profile.role)) {
      return NextResponse.json({ error: 'Only admins can reassign tasks' }, { status: 403 })
    }

    const dueDate = body.due_date !== undefined ? body.due_date : existing.data.due_date
    const reminderMinutes = body.reminder_minutes !== undefined ? body.reminder_minutes : existing.data.reminder_minutes
    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    for (const key of ['title', 'description', 'category', 'due_date', 'reminder_minutes', 'is_recurring', 'recurrence_rule', 'status', 'employee_id']) {
      if (body[key] !== undefined) update[key] = key === 'title' ? body[key]?.trim() : body[key]
    }

    if (body.due_date !== undefined || body.reminder_minutes !== undefined) {
      update.reminder_at = reminderAt(dueDate, reminderMinutes)
      update.last_reminded_at = null
    }

    if (body.status === 'completed') {
      update.completed_at = new Date().toISOString()
    } else if (body.status && body.status !== 'completed') {
      update.completed_at = null
    }

    const { data, error } = await auth.supabase
      .from('employee_tasks')
      .update(update)
      .eq('id', id)
      .eq('organization_id', auth.profile.organization_id)
      .select(taskSelect())
      .single()

    if (error) {
      console.error('[tasks PATCH]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('[tasks PATCH]', error)
    return NextResponse.json({ error: error.message || 'Failed to update task' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const auth = await verifyTaskUser()
  if (!isTaskAuth(auth)) return auth

  const { id } = await context.params
  const existing = await loadTask(auth, id)
  if (existing.error) {
    const status = existing.error.code === 'PGRST116' ? 404 : 500
    return NextResponse.json({ error: status === 404 ? 'Task not found' : existing.error.message }, { status })
  }

  if (!(await canAccessEmployee(auth, existing.data.employee_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await auth.supabase
    .from('employee_tasks')
    .delete()
    .eq('id', id)
    .eq('organization_id', auth.profile.organization_id)

  if (error) {
    console.error('[tasks DELETE]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
