import { NextRequest, NextResponse } from 'next/server'
import { verifyPermission } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  const auth = await verifyPermission(request, 'attendance.read')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const date = new URL(request.url).searchParams.get('date') ?? new Date().toISOString().slice(0, 10)
  const { data, error } = await auth.supabase.rpc('get_shift_adherence_for_date', {
    p_date: date,
  })

  if (error) {
    console.error('[roster/adherence GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [], meta: { count: data?.length ?? 0, date } })
}
