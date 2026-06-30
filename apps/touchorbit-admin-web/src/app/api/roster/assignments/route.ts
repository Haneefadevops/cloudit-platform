import { NextRequest, NextResponse } from 'next/server'
import { verifyPermission } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  const auth = await verifyPermission(request, 'roster.edit')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await request.json()
    if (!body.employee_id || !body.date) {
      return NextResponse.json({ error: 'employee_id and date are required' }, { status: 400 })
    }

    const { data, error } = await auth.supabase.rpc('upsert_roster_assignment', {
      p_employee_id: body.employee_id,
      p_date: body.date,
      p_shift_template_id: body.shift_id ?? body.shift_template_id ?? null,
      p_notes: body.notes ?? null,
    })

    if (error) {
      console.error('[roster/assignments POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: { id: data } }, { status: 201 })
  } catch (error: any) {
    console.error('[roster/assignments POST]', error)
    return NextResponse.json({ error: error.message || 'Failed to upsert roster assignment' }, { status: 500 })
  }
}
