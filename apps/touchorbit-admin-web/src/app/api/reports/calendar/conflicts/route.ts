import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-auth'
import { toCSV, csvResponse, CsvColumn } from '@/lib/reports/csv'

const CONFLICT_COLS: CsvColumn[] = [
  { key: 'conflict_type', label: 'Conflict Type' },
  { key: 'severity', label: 'Severity' },
  { key: 'employee_name', label: 'Employee' },
  { key: 'department_name', label: 'Department' },
  { key: 'conflict_date', label: 'Date' },
  { key: 'start_time', label: 'Start' },
  { key: 'end_time', label: 'End' },
  { key: 'source_title', label: 'Source' },
]

function parseFilters(searchParams: URLSearchParams) {
  return {
    startDate: searchParams.get('startDate'),
    endDate: searchParams.get('endDate'),
    departmentId: searchParams.get('departmentId') || null,
    branchId: searchParams.get('branchId') || null,
    severity: searchParams.get('severity') || null,
    type: searchParams.get('type') || null,
    format: searchParams.get('format') || 'json',
  }
}

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const filters = parseFilters(new URL(request.url).searchParams)
  if (!filters.startDate || !filters.endDate) {
    return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 })
  }

  const { data, error } = await auth.supabase.rpc('get_conflict_report', {
    p_org_id: auth.profile.organization_id,
    p_start_date: filters.startDate,
    p_end_date: filters.endDate,
    p_department_id: filters.departmentId,
    p_branch_id: filters.branchId,
  })

  if (error) {
    console.error('[reports/calendar/conflicts]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = ((data ?? []) as Record<string, unknown>[])
    .filter((row) => !filters.severity || row.severity === filters.severity)
    .filter((row) => !filters.type || row.conflict_type === filters.type)

  if (filters.format === 'csv') {
    return csvResponse(toCSV(rows, CONFLICT_COLS), `calendar-conflicts-${filters.startDate}-${filters.endDate}.csv`)
  }

  const bySeverity = rows.reduce<Record<string, number>>((acc, row) => {
    const severity = String(row.severity ?? 'unknown')
    acc[severity] = (acc[severity] ?? 0) + 1
    return acc
  }, {})

  return NextResponse.json({
    data: rows,
    meta: {
      count: rows.length,
      bySeverity,
      filters,
    },
  })
}
