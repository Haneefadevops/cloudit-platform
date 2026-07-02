import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-auth'
import { toCSV, csvResponse, CsvColumn } from '@/lib/reports/csv'

const COLS: CsvColumn[] = [
  { key: 'employee_name',   label: 'Employee' },
  { key: 'department_name', label: 'Department' },
  { key: 'leave_type',      label: 'Leave Type' },
  { key: 'start_date',      label: 'From' },
  { key: 'end_date',        label: 'To' },
  { key: 'days',            label: 'Days' },
  { key: 'status',          label: 'Status' },
  { key: 'entitled_days',   label: 'Entitlement' },
  { key: 'used_days',       label: 'Used (YTD)' },
  { key: 'remaining_days',  label: 'Remaining' },
]

function daysBetween(start: string, end: string): number {
  return Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1)
}

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const sp           = new URL(request.url).searchParams
  const startDate    = sp.get('startDate')
  const endDate      = sp.get('endDate')
  const departmentId = sp.get('departmentId') || null
  const employeeIds  = sp.get('employeeIds')?.split(',').filter(Boolean) || null
  const leaveType    = sp.get('leaveType') || null
  const status       = sp.get('status') || null
  const format       = sp.get('format') || 'json'
  const orgId        = auth.profile.organization_id

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 })
  }

  let q = auth.supabase
    .from('leave_records')
    .select(`
      id, employee_id, leave_type, start_date, end_date, status,
      employee:employees!inner(
        first_name, last_name, department_id,
        department:departments!department_id(name)
      )
    `)
    .eq('organization_id', orgId)
    .gte('start_date', startDate)
    .lte('start_date', endDate)
    .order('start_date', { ascending: false })

  if (leaveType)    q = q.eq('leave_type', leaveType)
  if (status)       q = q.eq('status', status)
  if (employeeIds)  q = q.in('employee_id', employeeIds)

  const { data: leaveRows, error: leaveErr } = await q
  if (leaveErr) {
    console.error('[reports/leave]', leaveErr)
    return NextResponse.json({ error: leaveErr.message }, { status: 500 })
  }

  // Filter by dept (done in JS since nested column filter is cumbersome in PostgREST)
  const filtered = (leaveRows ?? []).filter((r: any) => {
    if (!departmentId) return true
    return r.employee?.department_id === departmentId
  })

  // Fetch leave balances for the employees in the result (current year)
  const year = new Date().getFullYear()
  const empIds = [...new Set(filtered.map((r: any) => r.employee_id))]
  const { data: balances } = empIds.length > 0
    ? await auth.supabase
        .from('leave_balances')
        .select('employee_id, leave_type, entitled_days, used_days, remaining_days')
        .eq('organization_id', orgId)
        .eq('year', year)
        .in('employee_id', empIds)
    : { data: [] }

  const balanceMap = new Map<string, Record<string, any>>()
  for (const b of (balances ?? []) as any[]) {
    balanceMap.set(`${b.employee_id}:${b.leave_type}`, b)
  }

  const rows = filtered.map((r: any) => {
    const bal = balanceMap.get(`${r.employee_id}:${r.leave_type}`)
    return {
      id:              r.id,
      employee_name:   r.employee ? `${r.employee.first_name} ${r.employee.last_name}` : '—',
      department_name: r.employee?.department?.name ?? '—',
      leave_type:      r.leave_type,
      start_date:      r.start_date,
      end_date:        r.end_date,
      days:            daysBetween(r.start_date, r.end_date),
      status:          r.status,
      entitled_days:   bal?.entitled_days ?? null,
      used_days:       bal?.used_days ?? null,
      remaining_days:  bal?.remaining_days ?? null,
    }
  })

  if (format === 'csv') {
    return csvResponse(toCSV(rows, COLS), `leave-report-${startDate}-${endDate}.csv`)
  }

  const totalDays = rows.reduce((s: number, r: any) => s + r.days, 0)
  return NextResponse.json({ data: rows, meta: { count: rows.length, totalDays } })
}
