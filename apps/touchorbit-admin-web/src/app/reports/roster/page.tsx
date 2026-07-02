'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/lib/auth'
import { ChevronLeft, CheckCircle, XCircle, Clock, Users, XCircleIcon } from 'lucide-react'
import Link from 'next/link'
import { ReportFilterBar } from '@/components/reports/ReportFilterBar'
import { StatCards } from '@/components/reports/StatCards'
import { ReportTable } from '@/components/reports/ReportTable'
import { DrillDownPanel } from '@/components/reports/DrillDownPanel'
import { useReportFilters } from '@/hooks/use-report-filters'
import { useReportData } from '@/hooks/use-report-data'
import { reportFetch, triggerExport } from '@/lib/reports/fetch'
import type { AdherenceRow, AttendanceDetailRow, ReportFilters } from '@/lib/reports/fetch'

const DETAIL_COLUMNS = [
  { key: 'work_date', header: 'Date' },
  { key: 'shift_name', header: 'Shift' },
  { key: 'clock_in', header: 'Clock In' },
  { key: 'clock_out', header: 'Clock Out' },
  { key: 'status', header: 'Status' },
]

function AdherenceBadge({ rate }: { rate: number }) {
  const tone = rate >= 90 ? 'green' : rate >= 70 ? 'amber' : 'red'
  const colors = {
    green: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    red:   'bg-red-50 text-red-600 border-red-100',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-[3px] text-[11px] font-black ${colors[tone]}`}>
      <span className="w-1 h-1 rounded-full bg-current" />
      {rate}%
    </span>
  )
}

export default function AdherenceReportPage() {
  const { isLoaded, isOwner, isManager, isHrAdmin, organizationId } = useAuth()
  const [startDate, setStartDate] = useState('2026-05-01')
  const [endDate, setEndDate] = useState('2026-05-31')
  const [selectedDept, setSelectedDept] = useState<string | null>(null)
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [drillOpen, setDrillOpen] = useState(false)
  const [drillTitle, setDrillTitle] = useState('')
  const [drillRows, setDrillRows] = useState<Record<string, unknown>[]>([])

  const { departments, employees } = useReportFilters(organizationId)
  const { data: rawData, loading, hasData, generated, error, generate } = useReportData(reportFetch.adherence)
  const data = rawData as AdherenceRow[]

  const canAccess = isOwner || isManager || isHrAdmin

  const activeFilters: ReportFilters = {
    startDate,
    endDate,
    departmentId: selectedDept,
    employeeIds: selectedEmployees.length ? selectedEmployees : null,
  }

  const handleGenerate = () => generate(activeFilters)

  const handleRowClick = async (row: Record<string, unknown>) => {
    const empId = String(row.employee_id ?? '')
    setDrillTitle(String(row.employee_name ?? 'Employee Details'))
    setDrillOpen(true)
    setDrillRows([])
    const result = await reportFetch.attendance({
      startDate,
      endDate,
      employeeIds: empId ? [empId] : null,
      mode: 'detail',
    })
    setDrillRows(
      result.data.map(r => {
        const d = r as AttendanceDetailRow
        return {
          work_date: d.work_date,
          shift_name: d.shift_name || '—',
          clock_in: d.clock_in || '—',
          clock_out: d.clock_out || '—',
          status: d.status,
        }
      }),
    )
  }

  if (!isLoaded) return null
  if (!canAccess) {
    return (
      <DashboardLayout>
        <div className="flex flex-col h-full bg-[#F8F7F9] items-center justify-center gap-3">
          <XCircleIcon size={40} className="text-red-400" />
          <p className="text-[16px] font-semibold text-[#1A1727]">Access Denied</p>
          <p className="text-[13px] text-[#9994A8]">You don&apos;t have permission to view this report.</p>
        </div>
      </DashboardLayout>
    )
  }

  const avgAdherence = data.length
    ? (data.reduce((s, r) => s + r.adherence_rate, 0) / data.length).toFixed(1)
    : '0.0'
  const totalAbsent = data.reduce((s, r) => s + r.absent_count, 0)
  const totalLate = data.reduce((s, r) => s + r.late_count, 0)
  const employeeCount = data.length

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full bg-[#F8F7F9]">
        <div className="bg-white border-b border-[#F1F0F4] px-8 py-4 flex items-center gap-3 shrink-0">
          <Link href="/reports" className="p-2 rounded-lg hover:bg-[#F8F7F9] transition-all text-[#9CA3AF]">
            <ChevronLeft size={18} />
          </Link>
          <div>
            <h1 className="text-[15px] font-bold text-[#1A1727]">Adherence Report</h1>
            <p className="text-[11px] text-[#9CA3AF]">Roster compliance and attendance patterns</p>
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
            onExport={() => triggerExport('adherence', activeFilters)}
            loading={loading}
            hasData={hasData}
          />

          {hasData && generated && (
            <StatCards
              cards={[
                { label: 'Avg Adherence', value: `${avgAdherence}%`, tone: 'green', icon: CheckCircle },
                { label: 'Total Absent', value: totalAbsent, tone: 'red', icon: XCircle },
                { label: 'Total Late', value: totalLate, tone: 'amber', icon: Clock },
                { label: 'Employees', value: employeeCount, tone: 'purple', icon: Users },
              ]}
            />
          )}

          <ReportTable
            columns={[
              { key: 'employee_name', header: 'Employee', type: 'text' },
              { key: 'department_name', header: 'Department', type: 'text' },
              { key: 'total_scheduled', header: 'Scheduled', type: 'number', align: 'center' },
              { key: 'on_time_count', header: 'On Time', type: 'number', align: 'center' },
              { key: 'late_count', header: 'Late', type: 'number', align: 'center' },
              { key: 'early_departure_count', header: 'Early Out', type: 'number', align: 'center' },
              { key: 'absent_count', header: 'Absent', type: 'number', align: 'center' },
              { key: 'late_early_count', header: 'Late + Early', type: 'number', align: 'center' },
              { key: 'adherence_rate', header: 'Adherence %', type: 'text', align: 'right' },
            ]}
            rows={data.map(r => ({
              ...r,
              adherence_rate: r.adherence_rate.toFixed(1) + '%',
            }))}
            summary={[
              { value: 'TOTAL', colSpan: 2 },
              { value: data.reduce((s, r) => s + r.total_scheduled, 0), align: 'center' },
              { value: data.reduce((s, r) => s + r.on_time_count, 0), align: 'center' },
              { value: totalLate, align: 'center' },
              { value: data.reduce((s, r) => s + r.early_departure_count, 0), align: 'center' },
              { value: totalAbsent, align: 'center' },
              { value: data.reduce((s, r) => s + r.late_early_count, 0), align: 'center' },
              { value: `${avgAdherence}%`, align: 'right' },
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
        subtitle="Daily adherence details"
        columns={DETAIL_COLUMNS}
        rows={drillRows}
      />
    </DashboardLayout>
  )
}
