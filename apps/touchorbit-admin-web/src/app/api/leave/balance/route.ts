import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const searchParams = new URL(request.url).searchParams
  const employeeId = searchParams.get('employee_id') ?? searchParams.get('employeeId')
  const year = Number(searchParams.get('year') ?? new Date().getFullYear())

  if (!employeeId) {
    return NextResponse.json({ error: 'employee_id is required' }, { status: 400 })
  }
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'year must be a valid year' }, { status: 400 })
  }

  const { data: employee, error: employeeError } = await auth.supabase
    .from('employees')
    .select('id')
    .eq('organization_id', auth.profile.organization_id)
    .eq('id', employeeId)
    .single()

  if (employeeError || !employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
  }

  const { data, error } = await auth.supabase
    .from('leave_balances')
    .select('leave_type, entitled_days, used_days, remaining_days')
    .eq('organization_id', auth.profile.organization_id)
    .eq('employee_id', employeeId)
    .eq('year', year)
    .order('leave_type', { ascending: true })

  if (error) {
    console.error('[leave/balance GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const balances = Object.fromEntries((data ?? []).map((row) => [
    row.leave_type,
    {
      entitled: Number(row.entitled_days ?? 0),
      used: Number(row.used_days ?? 0),
      remaining: Number(row.remaining_days ?? 0),
    },
  ]))

  return NextResponse.json({
    employee_id: employeeId,
    year,
    balances,
    annual: balances.annual?.remaining ?? 0,
    casual: balances.casual?.remaining ?? 0,
    sick: balances.sick?.remaining ?? 0,
  })
}
