'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/lib/auth'
import { ChevronLeft, Timer, AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react'
import Link from 'next/link'
import { ReportFilterBar } from '@/components/reports/ReportFilterBar'
import { StatCards } from '@/components/reports/StatCards'
import { ReportTable } from '@/components/reports/ReportTable'
import { DrillDownPanel } from '@/components/reports/DrillDownPanel'
import { useReportFilters } from '@/hooks/use-report-filters'
import { useReportData } from '@/hooks/use-report-data'
import { reportFetch, triggerExport } from '@/lib/reports/fetch'
import type { OvertimeRow, ReportFilters } from '@/lib/reports/fetch'

const DETAIL_COLUMNS = [
  { key: 'field', header: 'Field' },
  { key: 'value', header: 'Value' },
]

function FlagBadge({ flag }: { flag: string }) {
  const isUnscheduled = flag === 'unscheduled_day'
  return (
    <span className={`
      inline-flex items-center rounded-full px-2.5 py-[3px] text-[11px] font-bold
      ${isUnscheduled ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}
    `}>
      {isUnscheduled ? 'Unscheduled' : 'Scheduled'}
    </span>
  )
}

export default function OvertimeReportPage() {
  const { isLoaded, isOwner, isManager, isHrAdmin, organizationId } = useAuth()
  const [startDate, setStartDate] = useState('2026-05-01')
  const [endDate, setEndDate] = useState('2026-05-31')
  const [selectedDept, setSelectedDept] = useState<string | null>(null)
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [drillOpen, setDrillOpen] = useState(false)
  const [drillTitle, setDrillTitle] = useState('')
  const [drillOTRow, setDrillOTRow] = useState<OvertimeRow | null>(null)

  const { departments, employees } = useReportFilters(organizationId)
  const { data: rawData, loading, hasData, generated, error, generate } = useReportData(reportFetch.overtime)
  const data = rawData as OvertimeRow[]

  const canAccess = isOwner || isManager || isHrAdmin

  const activeFilters: ReportFilters = {
    startDate,
    endDate,
    departmentId: selectedDept,
    employeeIds: selectedEmployees.length ? selectedEmployees : null,
  }

  const handleGenerate = () => generate(activeFilters)

  const handleRowClick = (row: Record<string, unknown>) => {
    setDrillOTRow(row as unknown as OvertimeRow)
    setDrillTitle(String(row.employee_name ?? 'Overtime Details'))
    setDrillOpen(true)
  }

  const drillRows: Record<string, unknown>[] = drillOTRow
    ? [
        { field: 'Date', value: drillOTRow.overtime_date },
        { field: 'Hours', value: drillOTRow.overtime_hours },
        { field: 'Status', value: drillOTRow.overtime_status },
        { field: 'Shift', value: drillOTRow.shift_name || '—' },
        { field: 'Scheduled Day', value: drillOTRow.had_roster_shift ? 'Yes' : 'No' },
        { field: 'Flag', value: drillOTRow.flag === 'unscheduled_day' ? 'Unscheduled Day' : 'Scheduled Day' },
        { field: 'Department', value: drillOTRow.department_name },
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

  const totalRecords = data.length
  const unscheduledCount = data.filter(r => r.flag === 'unscheduled_day').length
  const totalHours = data.reduce((s, r) => s + r.overtime_hours, 0).toFixed(1)
  const approvedCount = data.filter(r => r.overtime_status === 'approved').length

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full bg-[#F8F7F9]">
        <div className="bg-white border-b border-[#F1F0F4] px-8 py-4 flex items-center gap-3 shrink-0">
          <Link href="/reports" className="p-2 rounded-lg hover:bg-[#F8F7F9] transition-all text-[#9CA3AF]">
            <ChevronLeft size={18} />
          </Link>
          <div>
            <h1 className="text-[15px] font-bold text-[#1A1727]">Overtime Report</h1>
            <p className="text-[11px] text-[#9CA3AF]">Overtime hours and unscheduled day flags</p>
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
            onExport={() => triggerExport('overtime', activeFilters)}
            loading={loading}
            hasData={hasData}
          />

          {hasData && generated && (
            <StatCards
              cards={[
                { label: 'Total OT Records', value: totalRecords, tone: 'purple', icon: Timer },
                { label: 'Unscheduled', value: unscheduledCount, tone: 'red', icon: AlertTriangle },
                { label: 'Total Hours', value: totalHours, tone: 'blue', icon: Clock },
                { label: 'Approved', value: approvedCount, tone: 'green', icon: CheckCircle },
              ]}
            />
          )}

          <ReportTable
            columns={[
              { key: 'employee_name', header: 'Employee', type: 'text' },
              { key: 'department_name', header: 'Department', type: 'text' },
              { key: 'overtime_date', header: 'Date', type: 'date' },
              { key: 'overtime_hours', header: 'Hours', type: 'number', align: 'right' },
              { key: 'overtime_status', header: 'Status', type: 'status' },
              { key: 'had_roster_shift', header: 'Rostered', type: 'text', align: 'center' },
              { key: 'shift_name', header: 'Shift', type: 'text' },
              { key: 'flag', header: 'Flag', type: 'status' },
            ]}
            rows={data.map(r => ({
              ...r,
              had_roster_shift: r.had_roster_shift ? 'Yes' : 'No',
              shift_name: r.shift_name || '—',
            }))}
            summary={[
              { value: 'TOTAL', colSpan: 3 },
              { value: totalHours, align: 'right' },
              { value: '', colSpan: 4 },
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
        subtitle="Overtime session details"
        columns={DETAIL_COLUMNS}
        rows={drillRows}
      />
    </DashboardLayout>
  )
}
