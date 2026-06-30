import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-auth'
import { toCSV, csvResponse, CsvColumn } from '@/lib/reports/csv'

const COLS: CsvColumn[] = [
  { key: 'employee_name',   label: 'Employee' },
  { key: 'department_name', label: 'Department' },
  { key: 'claim_date',      label: 'Date' },
  { key: 'category_name',   label: 'Category' },
  { key: 'amount',          label: 'Amount' },
  { key: 'currency',        label: 'Currency' },
  { key: 'description',     label: 'Description' },
  { key: 'status',          label: 'Status' },
]

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const sp           = new URL(request.url).searchParams
  const startDate    = sp.get('startDate')
  const endDate      = sp.get('endDate')
  const departmentId = sp.get('departmentId') || null
  const employeeIds  = sp.get('employeeIds')?.split(',').filter(Boolean) || null
  const status       = sp.get('status') || null
  const format       = sp.get('format') || 'json'
  const orgId        = auth.profile.organization_id

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 })
  }

  let q = auth.supabase
    .from('expense_claims')
    .select(`
      id, employee_id, amount, currency, claim_date, description, status,
      category:expense_categories(name),
      employee:employees!inner(first_name, last_name, department_id, department:departments!department_id(name))
    `)
    .eq('organization_id', orgId)
    .gte('claim_date', startDate)
    .lte('claim_date', endDate)
    .order('claim_date', { ascending: false })

  if (status)      q = q.eq('status', status)
  if (employeeIds) q = q.in('employee_id', employeeIds)

  const { data: claims, error } = await q
  if (error) {
    console.error('[reports/expense]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = ((claims ?? []) as any[])
    .filter(c => !departmentId || c.employee?.department_id === departmentId)
    .map(c => ({
      id:              c.id,
      employee_name:   c.employee ? `${c.employee.first_name} ${c.employee.last_name}` : '—',
      department_name: c.employee?.department?.name ?? '—',
      claim_date:      c.claim_date,
      category_name:   c.category?.name ?? '—',
      amount:          c.amount,
      currency:        c.currency,
      description:     c.description,
      status:          c.status,
    }))

  const totalApproved = rows
    .filter(r => r.status === 'approved' || r.status === 'reimbursed')
    .reduce((s, r) => s + Number(r.amount || 0), 0)
  const totalPending  = rows
    .filter(r => r.status === 'pending')
    .reduce((s, r) => s + Number(r.amount || 0), 0)

  if (format === 'csv') {
    return csvResponse(toCSV(rows, COLS), `expense-report-${startDate}-${endDate}.csv`)
  }

  return NextResponse.json({
    data: rows,
    meta: { count: rows.length, totalApproved: Math.round(totalApproved), totalPending: Math.round(totalPending) },
  })
}
