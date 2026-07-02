import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-auth'
import { toCSV, csvResponse, CsvColumn } from '@/lib/reports/csv'

const COLS: CsvColumn[] = [
  { key: 'employee_name',   label: 'Employee' },
  { key: 'department_name', label: 'Department' },
  { key: 'work_date',       label: 'Date' },
  { key: 'day_of_week',     label: 'Day' },
  { key: 'shift_name',      label: 'Shift' },
  { key: 'scheduled_start', label: 'Scheduled Start' },
  { key: 'actual_clock_in', label: 'Actual Clock In' },
  { key: 'minutes_late',    label: 'Minutes Late' },
  { key: 'severity',        label: 'Severity' },
  { key: 'repeat_count',    label: 'Times Late (in range)' },
]

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const sp = new URL(request.url).searchParams
  const startDate    = sp.get('startDate')
  const endDate      = sp.get('endDate')
  const departmentId = sp.get('departmentId') || null
  const employeeIds  = sp.get('employeeIds')?.split(',').filter(Boolean) || null
  const format       = sp.get('format') || 'json'

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 })
  }

  const { data, error } = await auth.supabase.rpc('get_late_arrivals', {
    p_start_date:    startDate,
    p_end_date:      endDate,
    p_department_id: departmentId,
    p_employee_ids:  employeeIds,
  })

  if (error) {
    console.error('[reports/late]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data ?? []) as Record<string, unknown>[]

  // Summary stats
  const severe   = rows.filter(r => r.severity === 'severe').length
  const moderate = rows.filter(r => r.severity === 'moderate').length
  const mild     = rows.filter(r => r.severity === 'mild').length
  const avgMins  = rows.length > 0
    ? Math.round(rows.reduce((s, r) => s + (Number(r.minutes_late) || 0), 0) / rows.length)
    : 0

  if (format === 'csv') {
    return csvResponse(toCSV(rows, COLS), `late-arrivals-${startDate}-${endDate}.csv`)
  }

  return NextResponse.json({
    data: rows,
    meta: { count: rows.length, severe, moderate, mild, avgMinutesLate: avgMins },
  })
}
