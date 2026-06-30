'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/lib/auth'
import { ChevronLeft, Clock, AlertTriangle, AlertCircle, Timer, XCircle } from 'lucide-react'
import Link from 'next/link'
import { ReportFilterBar } from '@/components/reports/ReportFilterBar'
import { StatCards } from '@/components/reports/StatCards'
import { ReportTable } from '@/components/reports/ReportTable'
import { DrillDownPanel } from '@/components/reports/DrillDownPanel'
import { useReportFilters } from '@/hooks/use-report-filters'
import { useReportData } from '@/hooks/use-report-data'
import { reportFetch, triggerExport } from '@/lib/reports/fetch'
import type { LateArrivalRow, ReportFilters } from '@/lib/reports/fetch'

const DETAIL_COLUMNS = [
  { key: 'work_date', header: 'Date' },
  { key: 'scheduled_start', header: 'Scheduled' },
  { key: 'actual_clock_in', header: 'Actual' },
  { key: 'minutes_late', header: 'Minutes Late' },
  { key: 'severity', header: 'Severity' },
]

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    severe:   { bg: 'bg-red-50',    text: 'text-red-600',    label: 'Severe' },
    moderate: { bg: 'bg-amber-50',  text: 'text-amber-600',  label: 'Moderate' },
    mild:     { bg: 'bg-yellow-50', text: 'text-yellow-600', label: 'Mild' },
  }
  const c = map[severity] || map.mild
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-[3px] text-[11px] font-bold ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  )
}

export default function LateArrivalsPage() {
  const { isLoaded, isOwner, isManager, isHrAdmin, organizationId } = useAuth()
  const [startDate, setStartDate] = useState('2026-05-01')
  const [endDate, setEndDate] = useState('2026-05-31')
  const [selectedDept, setSelectedDept] = useState<string | null>(null)
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [drillOpen, setDrillOpen] = useState(false)
  const [drillTitle, setDrillTitle] = useState('')
  const [drillEmployeeId, setDrillEmployeeId] = useState<string>('')

  const { departments, employees } = useReportFilters(organizationId)
  const { data: rawData, loading, hasData, generated, error, generate } = useReportData(reportFetch.late)
  const data = rawData as LateArrivalRow[]

  const canAccess = isOwner || isManager || isHrAdmin

  const activeFilters: ReportFilters = {
    startDate,
    endDate,
    departmentId: selectedDept,
    employeeIds: selectedEmployees.length ? selectedEmployees : null,
  }

  const handleGenerate = () => generate(activeFilters)

  const handleRowClick = (row: Record<string, unknown>) => {
    setDrillEmployeeId(String(row.employee_id ?? ''))
    setDrillTitle(String(row.employee_name ?? 'Employee Details'))
    setDrillOpen(true)
  }

  const drillRows = data
    .filter(r => r.employee_id === drillEmployeeId)
    .map(r => ({
      work_date: r.work_date,
      scheduled_start: r.scheduled_start,
      actual_clock_in: r.actual_clock_in,
      minutes_late: r.minutes_late,
      severity: r.severity,
    }))

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

  const totalEvents = data.length
  const severeCount = data.filter(r => r.severity === 'severe').length
  const moderateCount = data.filter(r => r.severity === 'moderate').length
  const avgMinutes = data.length
    ? Math.round(data.reduce((s, r) => s + r.minutes_late, 0) / data.length)
    : 0

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full bg-[#F8F7F9]">
        <div className="bg-white border-b border-[#F1F0F4] px-8 py-4 flex items-center gap-3 shrink-0">
          <Link href="/reports" className="p-2 rounded-lg hover:bg-[#F8F7F9] transition-all text-[#9CA3AF]">
            <ChevronLeft size={18} />
          </Link>
          <div>
            <h1 className="text-[15px] font-bold text-[#1A1727]">Late Arrivals</h1>
            <p className="text-[11px] text-[#9CA3AF]">Employees who clocked in after their scheduled start time</p>
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
            onExport={() => triggerExport('late', activeFilters)}
            loading={loading}
            hasData={hasData}
          />

          {hasData && generated && (
            <StatCards
              cards={[
                { label: 'Total Late Events', value: totalEvents, tone: 'purple', icon: Clock },
                { label: 'Severe', value: severeCount, tone: 'red', icon: AlertTriangle },
                { label: 'Moderate', value: moderateCount, tone: 'amber', icon: AlertCircle },
                { label: 'Avg Minutes Late', value: `${avgMinutes}m`, tone: 'blue', icon: Timer },
              ]}
            />
          )}

          <ReportTable
            columns={[
              { key: 'employee_name', header: 'Employee', type: 'text' },
              { key: 'department_name', header: 'Department', type: 'text' },
              { key: 'work_date', header: 'Date', type: 'date' },
              { key: 'day_of_week', header: 'Day', type: 'text', align: 'center' },
              { key: 'shift_name', header: 'Shift', type: 'text' },
              { key: 'scheduled_start', header: 'Scheduled', type: 'text' },
              { key: 'actual_clock_in', header: 'Actual', type: 'text' },
              { key: 'minutes_late', header: 'Minutes Late', type: 'number', align: 'right' },
              { key: 'severity', header: 'Severity', type: 'status' },
              { key: 'repeat_count', header: 'Repeats', type: 'number', align: 'center' },
            ]}
            rows={data as unknown as Record<string, unknown>[]}
            summary={[
              { value: 'TOTAL', colSpan: 7 },
              { value: data.length ? `${data.reduce((s, r) => s + r.minutes_late, 0)}m` : '0m', align: 'right' },
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
        subtitle="Late arrival history"
        columns={DETAIL_COLUMNS}
        rows={drillRows}
      />
    </DashboardLayout>
  )
}
