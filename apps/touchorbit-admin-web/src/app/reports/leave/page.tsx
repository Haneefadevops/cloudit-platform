'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/lib/auth'
import { ChevronLeft, FileText, Calendar, Clock, CheckCircle, XCircle } from 'lucide-react'
import Link from 'next/link'
import { ReportFilterBar } from '@/components/reports/ReportFilterBar'
import { StatCards } from '@/components/reports/StatCards'
import { ReportTable } from '@/components/reports/ReportTable'
import { DrillDownPanel } from '@/components/reports/DrillDownPanel'
import { useReportFilters } from '@/hooks/use-report-filters'
import { useReportData } from '@/hooks/use-report-data'
import { reportFetch, triggerExport } from '@/lib/reports/fetch'
import type { LeaveRow, ReportFilters } from '@/lib/reports/fetch'

const DETAIL_COLUMNS = [
  { key: 'date', header: 'Date' },
  { key: 'leave_type', header: 'Leave Type' },
  { key: 'status', header: 'Status' },
]

function getDaysBetween(start: string, end: string): string[] {
  const days: string[] = []
  const d = new Date(start)
  const e = new Date(end)
  while (d <= e) {
    days.push(d.toISOString().split('T')[0])
    d.setDate(d.getDate() + 1)
  }
  return days
}

export default function LeaveReportPage() {
  const { isLoaded, isOwner, isManager, isHrAdmin, organizationId } = useAuth()
  const [startDate, setStartDate] = useState('2026-05-01')
  const [endDate, setEndDate] = useState('2026-05-31')
  const [selectedDept, setSelectedDept] = useState<string | null>(null)
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [drillOpen, setDrillOpen] = useState(false)
  const [drillTitle, setDrillTitle] = useState('')
  const [drillLeaveRow, setDrillLeaveRow] = useState<LeaveRow | null>(null)

  const { departments, employees } = useReportFilters(organizationId)
  const { data: rawData, loading, hasData, generated, error, generate } = useReportData(reportFetch.leave)
  const data = rawData as LeaveRow[]

  const canAccess = isOwner || isManager || isHrAdmin

  const activeFilters: ReportFilters = {
    startDate,
    endDate,
    departmentId: selectedDept,
    employeeIds: selectedEmployees.length ? selectedEmployees : null,
  }

  const handleGenerate = () => generate(activeFilters)

  const handleRowClick = (row: Record<string, unknown>) => {
    setDrillLeaveRow(row as unknown as LeaveRow)
    setDrillTitle(String(row.employee_name ?? 'Leave Details'))
    setDrillOpen(true)
  }

  const drillRows: Record<string, unknown>[] = drillLeaveRow
    ? getDaysBetween(drillLeaveRow.start_date, drillLeaveRow.end_date).map(date => ({
        date,
        leave_type: drillLeaveRow.leave_type,
        status: drillLeaveRow.status,
      }))
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

  const totalRecords = data.length
  const totalDays = data.reduce((s, r) => s + r.days, 0)
  const pendingCount = data.filter(r => r.status === 'pending').length
  const approvedCount = data.filter(r => r.status === 'approved').length

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full bg-[#F8F7F9]">
        <div className="bg-white border-b border-[#F1F0F4] px-8 py-4 flex items-center gap-3 shrink-0">
          <Link href="/reports" className="p-2 rounded-lg hover:bg-[#F8F7F9] transition-all text-[#9CA3AF]">
            <ChevronLeft size={18} />
          </Link>
          <div>
            <h1 className="text-[15px] font-bold text-[#1A1727]">Leave Report</h1>
            <p className="text-[11px] text-[#9CA3AF]">Leave requests by employee and type</p>
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
            onExport={() => triggerExport('leave', activeFilters)}
            loading={loading}
            hasData={hasData}
          />

          {hasData && generated && (
            <StatCards
              cards={[
                { label: 'Total Records', value: totalRecords, tone: 'purple', icon: FileText },
                { label: 'Total Days', value: totalDays, tone: 'blue', icon: Calendar },
                { label: 'Pending', value: pendingCount, tone: 'amber', icon: Clock },
                { label: 'Approved', value: approvedCount, tone: 'green', icon: CheckCircle },
              ]}
            />
          )}

          <ReportTable
            columns={[
              { key: 'employee_name', header: 'Employee', type: 'text' },
              { key: 'department_name', header: 'Department', type: 'text' },
              { key: 'leave_type', header: 'Leave Type', type: 'text' },
              { key: 'start_date', header: 'From', type: 'date' },
              { key: 'end_date', header: 'To', type: 'date' },
              { key: 'days', header: 'Days', type: 'number', align: 'center' },
              { key: 'status', header: 'Status', type: 'status' },
              { key: 'entitled_days', header: 'Entitled', type: 'number', align: 'center' },
              { key: 'used_days', header: 'Used', type: 'number', align: 'center' },
              { key: 'remaining_days', header: 'Remaining', type: 'number', align: 'center' },
            ]}
            rows={data as unknown as Record<string, unknown>[]}
            summary={[
              { value: 'TOTAL', colSpan: 5 },
              { value: totalDays, align: 'center' },
              { value: '' },
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
        subtitle="Leave day-by-day breakdown"
        columns={DETAIL_COLUMNS}
        rows={drillRows}
      />
    </DashboardLayout>
  )
}
