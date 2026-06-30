import { NextRequest, NextResponse } from 'next/server'
import { verifyPermission } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  const auth = await verifyPermission(request, 'attendance.read')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const date = new URL(request.url).searchParams.get('date')
  const rpc = date ? 'get_no_shows_for_date' : 'get_todays_no_shows'
  const args = date ? { p_date: date } : {}
  const { data, error } = await auth.supabase.rpc(rpc, args)

  if (error) {
    console.error('[roster/no-shows GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [], meta: { count: data?.length ?? 0, date: date ?? new Date().toISOString().slice(0, 10) } })
}
