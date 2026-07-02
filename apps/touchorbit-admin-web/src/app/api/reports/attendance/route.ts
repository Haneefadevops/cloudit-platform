import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-auth'
import { toCSV, csvResponse, CsvColumn } from '@/lib/reports/csv'

const DETAIL_COLS: CsvColumn[] = [
  { key: 'employee_name',   label: 'Employee' },
  { key: 'department_name', label: 'Department' },
  { key: 'work_date',       label: 'Date' },
  { key: 'status',          label: 'Status' },
  { key: 'shift_name',      label: 'Shift' },
  { key: 'clock_in',        label: 'Clock In' },
  { key: 'clock_out',       label: 'Clock Out' },
  { key: 'hours_worked',    label: 'Hours Worked' },
  { key: 'minutes_late',    label: 'Minutes Late' },
]

const SUMMARY_COLS: CsvColumn[] = [
  { key: 'employee_name',    label: 'Employee' },
  { key: 'department_name',  label: 'Department' },
  { key: 'total_scheduled',  label: 'Scheduled Days' },
  { key: 'present_count',    label: 'Present' },
  { key: 'late_count',       label: 'Late' },
  { key: 'absent_count',     label: 'Absent' },
  { key: 'on_leave_count',   label: 'On Leave' },
  { key: 'avg_hours_worked', label: 'Avg Hours' },
  { key: 'attendance_rate',  label: 'Attendance %' },
]

function parseFilters(searchParams: URLSearchParams) {
  return {
    startDate:    searchParams.get('startDate'),
    endDate:      searchParams.get('endDate'),
    departmentId: searchParams.get('departmentId') || null,
    employeeIds:  searchParams.get('employeeIds')?.split(',').filter(Boolean) || null,
    mode:         searchParams.get('mode') || 'summary',
    format:       searchParams.get('format') || 'json',
  }
}

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const filters = parseFilters(new URL(request.url).searchParams)
  if (!filters.startDate || !filters.endDate) {
    return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 })
  }

  const rpc = filters.mode === 'detail' ? 'get_attendance_detail' : 'get_attendance_summary'
  const { data, error } = await auth.supabase.rpc(rpc, {
    p_start_date:    filters.startDate,
    p_end_date:      filters.endDate,
    p_department_id: filters.departmentId,
    p_employee_ids:  filters.employeeIds,
  })

  if (error) {
    console.error('[reports/attendance]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data ?? []) as Record<string, unknown>[]

  if (filters.format === 'csv') {
    const cols = filters.mode === 'detail' ? DETAIL_COLS : SUMMARY_COLS
    const filename = `attendance-${filters.mode}-${filters.startDate}-${filters.endDate}.csv`
    return csvResponse(toCSV(rows, cols), filename)
  }

  return NextResponse.json({ data: rows, meta: { count: rows.length, mode: filters.mode } })
}
