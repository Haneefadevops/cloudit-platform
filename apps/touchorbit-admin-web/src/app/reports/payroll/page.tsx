'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/lib/auth'
import { ChevronLeft, Users, DollarSign, Wallet, Receipt, XCircle } from 'lucide-react'
import Link from 'next/link'
import { ReportFilterBar } from '@/components/reports/ReportFilterBar'
import { StatCards } from '@/components/reports/StatCards'
import { ReportTable } from '@/components/reports/ReportTable'
import { DrillDownPanel } from '@/components/reports/DrillDownPanel'
import { useReportFilters } from '@/hooks/use-report-filters'
import { useReportData } from '@/hooks/use-report-data'
import { reportFetch, triggerExport } from '@/lib/reports/fetch'
import type { PayrollRow, ReportFilters } from '@/lib/reports/fetch'

const DETAIL_COLUMNS = [
  { key: 'component', header: 'Component' },
  { key: 'amount', header: 'Amount (LKR)' },
  { key: 'type', header: 'Type' },
]

function fmtLKR(n: number) {
  return 'LKR ' + n.toLocaleString('en-LK')
}

export default function PayrollReportPage() {
  const { isLoaded, isOwner, isManager, isHrAdmin, organizationId } = useAuth()
  const [startDate, setStartDate] = useState('2026-05-01')
  const [endDate, setEndDate] = useState('2026-05-31')
  const [selectedDept, setSelectedDept] = useState<string | null>(null)
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [drillOpen, setDrillOpen] = useState(false)
  const [drillTitle, setDrillTitle] = useState('')
  const [drillPayrollRow, setDrillPayrollRow] = useState<PayrollRow | null>(null)

  const { departments, employees } = useReportFilters(organizationId)
  const { data: rawData, loading, hasData, generated, error, generate } = useReportData(reportFetch.payroll)
  const data = rawData as PayrollRow[]

  const canAccess = isOwner || isManager || isHrAdmin

  const activeFilters: ReportFilters = {
    startDate,
    endDate,
    departmentId: selectedDept,
    employeeIds: selectedEmployees.length ? selectedEmployees : null,
  }

  const handleGenerate = () => generate(activeFilters)

  const handleRowClick = (row: Record<string, unknown>) => {
    setDrillPayrollRow(row as unknown as PayrollRow)
    setDrillTitle(String(row.employee_name ?? 'Payroll Details'))
    setDrillOpen(true)
  }

  const drillRows: Record<string, unknown>[] = drillPayrollRow
    ? [
        { component: 'Basic Salary',     amount: fmtLKR(drillPayrollRow.basic_salary),     type: 'Earning' },
        { component: 'Gross Salary',     amount: fmtLKR(drillPayrollRow.gross_salary),     type: 'Earning' },
        { component: 'EPF (Employee)',   amount: fmtLKR(drillPayrollRow.epf_employee),     type: 'Deduction' },
        { component: 'ETF',              amount: fmtLKR(drillPayrollRow.etf),              type: 'Deduction' },
        { component: 'PAYE Tax',         amount: fmtLKR(drillPayrollRow.paye_tax),         type: 'Deduction' },
        { component: 'Total Deductions', amount: fmtLKR(drillPayrollRow.total_deductions), type: 'Deduction' },
        { component: 'Net Salary',       amount: fmtLKR(drillPayrollRow.net_salary),       type: 'Net' },
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

  const employeeCount = data.length
  const totalGross = data.reduce((s, r) => s + r.gross_salary, 0)
  const totalNet = data.reduce((s, r) => s + r.net_salary, 0)
  const totalDeductions = data.reduce((s, r) => s + r.total_deductions, 0)

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full bg-[#F8F7F9]">
        <div className="bg-white border-b border-[#F1F0F4] px-8 py-4 flex items-center gap-3 shrink-0">
          <Link href="/reports" className="p-2 rounded-lg hover:bg-[#F8F7F9] transition-all text-[#9CA3AF]">
            <ChevronLeft size={18} />
          </Link>
          <div>
            <h1 className="text-[15px] font-bold text-[#1A1727]">Payroll Summary</h1>
            <p className="text-[11px] text-[#9CA3AF]">Monthly pay runs with gross, deductions, and net pay</p>
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
            onExport={() => triggerExport('payroll', activeFilters)}
            loading={loading}
            hasData={hasData}
          />

          {hasData && generated && (
            <StatCards
              cards={[
                { label: 'Employees', value: employeeCount, tone: 'purple', icon: Users },
                { label: 'Total Gross', value: fmtLKR(totalGross), tone: 'green', icon: DollarSign },
                { label: 'Total Net', value: fmtLKR(totalNet), tone: 'blue', icon: Wallet },
                { label: 'Total Deductions', value: fmtLKR(totalDeductions), tone: 'red', icon: Receipt },
              ]}
            />
          )}

          <ReportTable
            columns={[
              { key: 'employee_name', header: 'Employee', type: 'text' },
              { key: 'department_name', header: 'Department', type: 'text' },
              { key: 'month_label', header: 'Month', type: 'text' },
              { key: 'run_status', header: 'Status', type: 'status' },
              { key: 'days_worked', header: 'Days', type: 'number', align: 'center' },
              { key: 'basic_salary', header: 'Basic', type: 'text', align: 'right' },
              { key: 'gross_salary', header: 'Gross', type: 'text', align: 'right' },
              { key: 'epf_employee', header: 'EPF', type: 'text', align: 'right' },
              { key: 'etf', header: 'ETF', type: 'text', align: 'right' },
              { key: 'paye_tax', header: 'PAYE', type: 'text', align: 'right' },
              { key: 'total_deductions', header: 'Deductions', type: 'text', align: 'right' },
              { key: 'net_salary', header: 'Net Salary', type: 'text', align: 'right' },
            ]}
            rows={data.map(r => ({
              ...r,
              basic_salary:     fmtLKR(r.basic_salary),
              gross_salary:     fmtLKR(r.gross_salary),
              epf_employee:     fmtLKR(r.epf_employee),
              etf:              fmtLKR(r.etf),
              paye_tax:         fmtLKR(r.paye_tax),
              total_deductions: fmtLKR(r.total_deductions),
              net_salary:       fmtLKR(r.net_salary),
            }))}
            summary={[
              { value: 'TOTAL', colSpan: 5 },
              { value: fmtLKR(data.reduce((s, r) => s + r.basic_salary, 0)), align: 'right' },
              { value: fmtLKR(totalGross), align: 'right' },
              { value: fmtLKR(data.reduce((s, r) => s + r.epf_employee, 0)), align: 'right' },
              { value: fmtLKR(data.reduce((s, r) => s + r.etf, 0)), align: 'right' },
              { value: fmtLKR(data.reduce((s, r) => s + r.paye_tax, 0)), align: 'right' },
              { value: fmtLKR(totalDeductions), align: 'right' },
              { value: fmtLKR(totalNet), align: 'right' },
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
        subtitle="Salary component breakdown"
        columns={DETAIL_COLUMNS}
        rows={drillRows}
      />
    </DashboardLayout>
  )
}
