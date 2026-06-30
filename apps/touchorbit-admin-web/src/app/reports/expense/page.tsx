'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/lib/auth'
import { ChevronLeft, Receipt, CheckCircle, Clock, XCircleIcon, XCircle } from 'lucide-react'
import Link from 'next/link'
import { ReportFilterBar } from '@/components/reports/ReportFilterBar'
import { StatCards } from '@/components/reports/StatCards'
import { ReportTable } from '@/components/reports/ReportTable'
import { DrillDownPanel } from '@/components/reports/DrillDownPanel'
import { useReportFilters } from '@/hooks/use-report-filters'
import { useReportData } from '@/hooks/use-report-data'
import { reportFetch, triggerExport } from '@/lib/reports/fetch'
import type { ExpenseRow, ReportFilters } from '@/lib/reports/fetch'

const DETAIL_COLUMNS = [
  { key: 'field', header: 'Field' },
  { key: 'value', header: 'Value' },
]

export default function ExpenseReportPage() {
  const { isLoaded, isOwner, isManager, isHrAdmin, organizationId } = useAuth()
  const [startDate, setStartDate] = useState('2026-05-01')
  const [endDate, setEndDate] = useState('2026-05-31')
  const [selectedDept, setSelectedDept] = useState<string | null>(null)
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [drillOpen, setDrillOpen] = useState(false)
  const [drillTitle, setDrillTitle] = useState('')
  const [drillExpenseRow, setDrillExpenseRow] = useState<ExpenseRow | null>(null)

  const { departments, employees } = useReportFilters(organizationId)
  const { data: rawData, loading, hasData, generated, error, generate } = useReportData(reportFetch.expense)
  const data = rawData as ExpenseRow[]

  const canAccess = isOwner || isManager || isHrAdmin

  const activeFilters: ReportFilters = {
    startDate,
    endDate,
    departmentId: selectedDept,
    employeeIds: selectedEmployees.length ? selectedEmployees : null,
  }

  const handleGenerate = () => generate(activeFilters)

  const handleRowClick = (row: Record<string, unknown>) => {
    setDrillExpenseRow(row as unknown as ExpenseRow)
    setDrillTitle(String(row.employee_name ?? 'Expense Details'))
    setDrillOpen(true)
  }

  const drillRows: Record<string, unknown>[] = drillExpenseRow
    ? [
        { field: 'Claim Date', value: drillExpenseRow.claim_date },
        { field: 'Category',   value: drillExpenseRow.category_name },
        { field: 'Amount',     value: `${drillExpenseRow.currency} ${drillExpenseRow.amount.toLocaleString()}` },
        { field: 'Status',     value: drillExpenseRow.status },
        { field: 'Description', value: drillExpenseRow.description || '—' },
        { field: 'Department', value: drillExpenseRow.department_name },
      ]
    : []

  if (!isLoaded) return null
  if (!canAccess) {
    return (
      <DashboardLayout>
        <div className="flex flex-col h-full bg-[#F8F7F9] items-center justify-center gap-3">
          <XCircle size={40} className="text-red-400" />
          <p className="text-[16px] font-semibold text-[#1A1727]">Access Denied</p>
          <p className="text-[13px] text-[#9994A8]">You don&apos;t have permission to view this report.</p>
        </div>
      </DashboardLayout>
    )
  }

  const totalClaims = data.length
  const totalApproved = data
    .filter(r => r.status === 'approved')
    .reduce((s, r) => s + r.amount, 0)
  const totalPending = data
    .filter(r => r.status === 'pending')
    .reduce((s, r) => s + r.amount, 0)
  const rejectedCount = data.filter(r => r.status === 'rejected').length

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full bg-[#F8F7F9]">
        <div className="bg-white border-b border-[#F1F0F4] px-8 py-4 flex items-center gap-3 shrink-0">
          <Link href="/reports" className="p-2 rounded-lg hover:bg-[#F8F7F9] transition-all text-[#9CA3AF]">
            <ChevronLeft size={18} />
          </Link>
          <div>
            <h1 className="text-[15px] font-bold text-[#1A1727]">Expense Report</h1>
            <p className="text-[11px] text-[#9CA3AF]">Expense claims by category and status</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-700">
              Error: {error}
            </div>
          )}

          <ReportFilterBar
            startDate={startDate}
            endDate={endDate}
            onDateChange={(s, e) => { setStartDate(s); setEndDate(e) }}
            departments={departments}
            selectedDept={selectedDept}
            onDeptChange={setSelectedDept}
            employees={employees}
            selectedEmployees={selectedEmployees}
            onEmployeeChange={setSelectedEmployees}
            datePresets={['today', 'week', 'month', 'lastMonth', 'custom']}
            onGenerate={handleGenerate}
            onExport={() => triggerExport('expense', activeFilters)}
            loading={loading}
            hasData={hasData}
          />

          {hasData && generated && (
            <StatCards
              cards={[
                { label: 'Total Claims', value: totalClaims, tone: 'purple', icon: Receipt },
                { label: 'Approved Amount', value: `LKR ${totalApproved.toLocaleString()}`, tone: 'green', icon: CheckCircle },
                { label: 'Pending Amount', value: `LKR ${totalPending.toLocaleString()}`, tone: 'amber', icon: Clock },
                { label: 'Rejected', value: rejectedCount, tone: 'red', icon: XCircleIcon },
              ]}
            />
          )}

          <ReportTable
            columns={[
              { key: 'employee_name', header: 'Employee', type: 'text' },
              { key: 'department_name', header: 'Department', type: 'text' },
              { key: 'claim_date', header: 'Date', type: 'date' },
              { key: 'category_name', header: 'Category', type: 'text' },
              { key: 'amount', header: 'Amount', type: 'text', align: 'right' },
              { key: 'currency', header: 'Currency', type: 'text', align: 'center' },
              { key: 'status', header: 'Status', type: 'status' },
              { key: 'description', header: 'Description', type: 'text' },
            ]}
            rows={data.map(r => ({
              ...r,
              amount: `${r.currency} ${r.amount.toLocaleString()}`,
            }))}
            summary={[
              { value: 'TOTAL', colSpan: 4 },
              { value: `LKR ${data.reduce((s, r) => s + r.amount, 0).toLocaleString()}`, align: 'right' },
              { value: '' },
              { value: '' },
              { value: '' },
            ]}
            onRowClick={handleRowClick}
            loading={loading}
          />
        </div>
      </div>

      <DrillDownPanel
        open={drillOpen}
        onClose={() => setDrillOpen(false)}
        title={drillTitle}
        subtitle="Claim details"
        columns={DETAIL_COLUMNS}
        rows={drillRows}
      />
    </DashboardLayout>
  )
}
