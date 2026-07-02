'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { AlertTriangle, Users, CalendarDays, TrendingDown } from 'lucide-react'

interface AnalyticsData {
  roster: { active_employees: number; potential_shift_days: number; assigned_shift_days: number; coverage_rate: number; coverage_gap_days: number }
  conflicts: { total: number }
}

export function CoverageAlertPanel({ startDate, endDate }: { startDate: string; endDate: string }) {
  const { organizationId } = useAuth()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!organizationId || !startDate || !endDate) return
    loadData()
  }, [organizationId, startDate, endDate])

  async function loadData() {
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
      <div className="bg-white border border-gray-100 rounded-2xl p-5 animate-pulse">
        <div className="h-4 w-32 bg-gray-100 rounded mb-4" />
        <div className="h-8 w-20 bg-gray-100 rounded" />
      </div>
    )
  }

  if (!data) return null

  const { roster, conflicts } = data
  const alerts: { severity: 'high' | 'medium' | 'low'; message: string; icon: React.ElementType }[] = []

  if (roster.coverage_rate < 70) {
    alerts.push({ severity: 'high', message: `Shift coverage is ${roster.coverage_rate}% — ${roster.coverage_gap_days} unassigned shift days`, icon: TrendingDown })
  } else if (roster.coverage_rate < 90) {
    alerts.push({ severity: 'medium', message: `Shift coverage at ${roster.coverage_rate}% — consider filling gaps`, icon: TrendingDown })
  }

  if (conflicts.total > 0) {
    alerts.push({ severity: 'high', message: `${conflicts.total} scheduling conflict${conflicts.total > 1 ? 's' : ''} detected`, icon: AlertTriangle })
  }

  if (alerts.length === 0) {
    alerts.push({ severity: 'low', message: 'Coverage looks healthy — no gaps or conflicts', icon: Users })
  }

  const severityStyles = {
    high: 'bg-red-50 border-red-200 text-red-800',
    medium: 'bg-amber-50 border-amber-200 text-amber-800',
    low: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <CalendarDays size={16} className="text-gray-400" strokeWidth={2.5} />
        <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Coverage Alerts</h3>
      </div>
      <div className="space-y-2">
        {alerts.map((a, i) => (
          <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${severityStyles[a.severity]}`}>
            <a.icon size={16} className="shrink-0 mt-0.5" strokeWidth={2.5} />
            <span className="text-[11px] font-bold leading-relaxed">{a.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
