import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-auth'
import { toCSV, csvResponse, CsvColumn } from '@/lib/reports/csv'

const COLS: CsvColumn[] = [
  { key: 'employee_name',    label: 'Employee' },
  { key: 'department_name',  label: 'Department' },
  { key: 'overtime_date',    label: 'Date' },
  { key: 'overtime_hours',   label: 'Hours' },
  { key: 'overtime_status',  label: 'Status' },
  { key: 'had_roster_shift', label: 'Rostered' },
  { key: 'shift_name',       label: 'Shift' },
  { key: 'scheduled_start',  label: 'Shift Start' },
  { key: 'scheduled_end',    label: 'Shift End' },
  { key: 'flag',             label: 'Audit Flag' },
]

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const sp           = new URL(request.url).searchParams
  const startDate    = sp.get('startDate')
  const endDate      = sp.get('endDate')
  const departmentId = sp.get('departmentId') || null
  const employeeIds  = sp.get('employeeIds')?.split(',').filter(Boolean) || null
  const format       = sp.get('format') || 'json'

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 })
  }

  const { data, error } = await auth.supabase.rpc('get_overtime_fraud_report', {
    p_start_date:    startDate,
    p_end_date:      endDate,
    p_department_id: departmentId,
    p_employee_ids:  employeeIds,
  })

  if (error) {
    console.error('[reports/overtime]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows        = (data ?? []) as Record<string, unknown>[]
  const unscheduled = rows.filter(r => r.flag === 'unscheduled_day').length
  const scheduled   = rows.filter(r => r.flag === 'scheduled_day').length
  const totalHours  = rows.reduce((s, r) => s + Number(r.overtime_hours || 0), 0)

  if (format === 'csv') {
    return csvResponse(toCSV(rows, COLS), `overtime-report-${startDate}-${endDate}.csv`)
  }

  return NextResponse.json({
    data: rows,
    meta: { count: rows.length, unscheduled, scheduled, totalHours: Math.round(totalHours * 10) / 10 },
  })
}
