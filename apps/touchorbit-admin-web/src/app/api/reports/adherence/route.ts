import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-auth'
import { toCSV, csvResponse, CsvColumn } from '@/lib/reports/csv'

const COLS: CsvColumn[] = [
  { key: 'employee_name',         label: 'Employee' },
  { key: 'department_name',       label: 'Department' },
  { key: 'total_scheduled',       label: 'Scheduled' },
  { key: 'on_time_count',         label: 'On Time' },
  { key: 'late_count',            label: 'Late' },
  { key: 'early_departure_count', label: 'Early Out' },
  { key: 'late_early_count',      label: 'Late + Early' },
  { key: 'absent_count',          label: 'Absent' },
  { key: 'adherence_rate',        label: 'Adherence %' },
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

  const { data, error } = await auth.supabase.rpc('get_adherence_summary', {
    p_start_date:    startDate,
    p_end_date:      endDate,
    p_department_id: departmentId,
    p_employee_ids:  employeeIds,
  })

  if (error) {
    console.error('[reports/adherence]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data ?? []) as Record<string, unknown>[]

  const avgAdherence = rows.length > 0
    ? Math.round(rows.reduce((s, r) => s + Number(r.adherence_rate || 0), 0) / rows.length * 10) / 10
    : 0
  const totalAbsent = rows.reduce((s, r) => s + Number(r.absent_count || 0), 0)
  const totalLate   = rows.reduce((s, r) => s + Number(r.late_count || 0) + Number(r.late_early_count || 0), 0)

  if (format === 'csv') {
    return csvResponse(toCSV(rows, COLS), `adherence-report-${startDate}-${endDate}.csv`)
  }

  return NextResponse.json({
    data: rows,
    meta: { count: rows.length, avgAdherence, totalAbsent, totalLate },
  })
}
