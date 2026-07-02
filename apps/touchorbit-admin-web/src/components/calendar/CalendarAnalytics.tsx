'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { CalendarDays, Users, CheckCircle, XCircle, Clock, AlertTriangle, ArrowRightLeft, Percent } from 'lucide-react'

interface AnalyticsData {
  range: { start_date: string; end_date: string; days: number }
  events: { total: number; meetings: number; online_meetings: number; requires_rsvp: number }
  attendance: { invited: number; accepted: number; declined: number; tentative: number; pending: number; acceptance_rate: number }
  roster: { active_employees: number; potential_shift_days: number; assigned_shift_days: number; scheduled_shifts: number; coverage_rate: number; coverage_gap_days: number }
  requests: { open_shift_swaps: number }
  conflicts: { total: number }
}

export function CalendarAnalytics({ startDate, endDate }: { startDate: string; endDate: string }) {
  const { organizationId } = useAuth()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!organizationId || !startDate || !endDate) return
    loadAnalytics()
  }, [organizationId, startDate, endDate])

  async function loadAnalytics() {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/calendar/analytics?startDate=${startDate}&endDate=${endDate}`)
      const json = await res.json()
      setData(json.data)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 animate-pulse">
            <div className="h-3 w-16 bg-gray-100 rounded mb-3" />
            <div className="h-8 w-12 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    )
  }

  if (!data) return null

  const cards = [
    { label: 'Total Events', value: data.events.total, icon: CalendarDays, color: '#534AB7', bg: 'bg-purple-50' },
    { label: 'Meetings', value: data.events.meetings, icon: Users, color: '#3B82F6', bg: 'bg-blue-50' },
    { label: 'RSVP Acceptance', value: `${data.attendance.acceptance_rate}%`, icon: CheckCircle, color: '#10B981', bg: 'bg-emerald-50' },
    { label: 'Shift Coverage', value: `${data.roster.coverage_rate}%`, icon: Percent, color: '#F59E0B', bg: 'bg-amber-50' },
    { label: 'Active Employees', value: data.roster.active_employees, icon: Users, color: '#6366F1', bg: 'bg-indigo-50' },
    { label: 'Open Swaps', value: data.requests.open_shift_swaps, icon: ArrowRightLeft, color: '#8B5CF6', bg: 'bg-violet-50' },
    { label: 'Pending RSVPs', value: data.attendance.pending, icon: Clock, color: '#9CA3AF', bg: 'bg-gray-50' },
    { label: 'Conflicts', value: data.conflicts.total, icon: AlertTriangle, color: data.conflicts.total > 0 ? '#EF4444' : '#10B981', bg: data.conflicts.total > 0 ? 'bg-red-50' : 'bg-emerald-50' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="bg-white border border-gray-100 rounded-2xl p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-7 h-7 rounded-lg ${c.bg} flex items-center justify-center`}>
              <c.icon size={14} style={{ color: c.color }} strokeWidth={2.5} />
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{c.label}</span>
          </div>
          <div className="text-2xl font-black text-gray-900">{c.value}</div>
        </div>
      ))}
    </div>
  )
}
