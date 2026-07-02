import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-auth'
import { toCSV, csvResponse, CsvColumn } from '@/lib/reports/csv'

const COLS: CsvColumn[] = [
  { key: 'employee_name',    label: 'Employee' },
  { key: 'department_name',  label: 'Department' },
  { key: 'month_label',      label: 'Month' },
  { key: 'run_status',       label: 'Run Status' },
  { key: 'basic_salary',     label: 'Basic Salary' },
  { key: 'gross_salary',     label: 'Gross' },
  { key: 'epf_employee',     label: 'EPF (Employee)' },
  { key: 'epf_employer',     label: 'EPF (Employer)' },
  { key: 'etf',              label: 'ETF' },
  { key: 'paye_tax',         label: 'PAYE Tax' },
  { key: 'total_deductions', label: 'Total Deductions' },
  { key: 'net_salary',       label: 'Net Salary' },
  { key: 'days_worked',      label: 'Days Worked' },
  { key: 'days_absent',      label: 'Days Absent' },
  { key: 'overtime_hours',   label: 'OT Hours' },
]

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const sp           = new URL(request.url).searchParams
  const startDate    = sp.get('startDate')
  const endDate      = sp.get('endDate')
  const departmentId = sp.get('departmentId') || null
  const employeeIds  = sp.get('employeeIds')?.split(',').filter(Boolean) || null
  const format       = sp.get('format') || 'json'
  const orgId        = auth.profile.organization_id

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 })
  }

  // Derive year/month bounds from date range
  const start = new Date(startDate)
  const end   = new Date(endDate)
  const startYM = start.getFullYear() * 100 + (start.getMonth() + 1)
  const endYM   = end.getFullYear()   * 100 + (end.getMonth() + 1)

  let q = auth.supabase
    .from('payroll_items')
    .select(`
      employee_id, basic_salary, gross_salary, total_deductions,
      epf_employee, epf_employer, etf, paye_tax,
      days_worked, days_absent, overtime_hours, overtime_amount,
      employee:employees!inner(first_name, last_name, department_id, department:departments!department_id(name)),
      run:payroll_runs!inner(month, year, status)
    `)
    .eq('organization_id', orgId)

  if (employeeIds) q = q.in('employee_id', employeeIds)

  const { data: items, error } = await q
  if (error) {
    console.error('[reports/payroll]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = ((items ?? []) as any[])
    .filter(item => {
      const ym = item.run.year * 100 + item.run.month
      if (ym < startYM || ym > endYM) return false
      if (departmentId && item.employee?.department_id !== departmentId) return false
      return true
    })
    .map(item => ({
      employee_id:    item.employee_id,
      employee_name:  item.employee ? `${item.employee.first_name} ${item.employee.last_name}` : '—',
      department_name: item.employee?.department?.name ?? '—',
      month_label:    `${MONTH_NAMES[item.run.month - 1]} ${item.run.year}`,
      run_status:     item.run.status,
      basic_salary:   item.basic_salary,
      gross_salary:   item.gross_salary,
      epf_employee:   item.epf_employee,
      epf_employer:   item.epf_employer,
      etf:            item.etf,
      paye_tax:       item.paye_tax,
      total_deductions: item.total_deductions,
      net_salary:     Number(item.gross_salary) - Number(item.total_deductions),
      days_worked:    item.days_worked,
      days_absent:    item.days_absent,
      overtime_hours: item.overtime_hours,
    }))
    .sort((a, b) => a.month_label.localeCompare(b.month_label) || a.employee_name.localeCompare(b.employee_name))

  const totalGross = rows.reduce((s, r) => s + Number(r.gross_salary  || 0), 0)
  const totalNet   = rows.reduce((s, r) => s + Number(r.net_salary    || 0), 0)

  if (format === 'csv') {
    return csvResponse(toCSV(rows, COLS), `payroll-report-${startDate}-${endDate}.csv`)
  }

  return NextResponse.json({
    data: rows,
    meta: { count: rows.length, totalGross: Math.round(totalGross), totalNet: Math.round(totalNet) },
  })
}
