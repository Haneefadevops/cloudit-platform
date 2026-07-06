'use client'

import { useEffect, useState } from 'react'
import { useDashboard } from '@/lib/dashboard/dashboard-context'
import { api } from '@/lib/api'
import { WidgetShell } from './WidgetShell'
import type { WidgetProps } from '@/lib/widgets/types'
import { registerWidget } from '@/lib/widgets/registry'
import { BarChart3 } from 'lucide-react'
import { WidgetError } from './_shared/WidgetPrimitives'

interface DayData {
  label: string
  pct: number
}

export function WeeklyTrendWidget({ organizationId, editMode, onRemove }: WidgetProps) {
  const { summary } = useDashboard()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [data, setData] = useState<{
    sparkline: number[]
    days: DayData[]
  }>({
    sparkline: [],
    days: []
  })

  async function loadData() {
    setLoading(true)
    setError(false)
    try {
      const total = summary.activeEmployees || 0

      const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const dayDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (6 - i))
        return d.toISOString().split('T')[0]
      })

      const startDay = dayDates[0] + 'T00:00:00'
      const endDay = dayDates[6] + 'T23:59:59'

      const result = await api.get<any[]>(`/attendance?event_type=clock_in&from=${encodeURIComponent(startDay)}&to=${encodeURIComponent(endDay)}&limit=500`)
      if (!result.ok) throw new Error(result.error || 'Failed to load weekly trend')

      const events = result.data || []

      const results = dayDates.map((day) => {
        const dayEvents = events.filter((e: any) => {
          const ts = e.timestamp as string
          return ts >= day + 'T00:00:00' && ts <= day + 'T23:59:59'
        })
        const uniqueCount = new Set(dayEvents.map((r: any) => r.employee_id)).size
        return { date: day, count: uniqueCount }
      })

      const sparkline = results.map(r => r.count)
      const days = results.map(r => {
        const date = new Date(r.date + 'T00:00:00')
        const label = dayLabels[date.getDay()]
        const pct = total > 0 ? Math.round((r.count / total) * 100) : 0
        return { label, pct }
      })

      setData({ sparkline, days })
    } catch (error) {
      console.error('Error loading weekly trend widget data:', error)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (organizationId) loadData()
  }, [organizationId, summary.activeEmployees])

  const average = data.days.length > 0
    ? Math.round(data.days.reduce((sum, day) => sum + day.pct, 0) / data.days.length)
    : 0

  return (
    <WidgetShell
      title="Weekly Trend"
      subtitle="Attendance % Over the Last 7 Days"
      icon={BarChart3}
      tone="purple"
      editMode={editMode}
      onRemove={onRemove}
      loading={loading}
      onRefresh={loadData}
    >
      {error ? (
        <WidgetError onRetry={loadData} />
      ) : (
      <div className="flex h-full flex-col p-6 pt-5">
        <div className="flex h-48 items-end gap-5 border-b border-slate-200 px-4">
          {data.days.map((day, i) => (
            <div key={`${day.label}-${i}`} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <span className="text-xs font-bold text-slate-950">{day.pct}%</span>
              <div className="flex h-32 w-7 items-end">
                <div
                  className="w-7 rounded-t-md bg-[#534AB7] transition-all duration-700"
                  style={{ height: `${Math.max(day.pct * 1.25, 5)}px` }}
                />
              </div>
              <span className="text-xs text-slate-500">{day.label}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-between text-sm">
          <span className="text-slate-500">Average Attendance</span>
          <span className="text-2xl font-black text-[#534AB7]">{average}%</span>
        </div>
      </div>
      )}
    </WidgetShell>
  )
}

registerWidget({
  type: 'weekly-trend',
  title: 'Weekly Attendance',
  description: '7-day attendance trend',
  category: 'attendance',
  component: WeeklyTrendWidget,
  defaultSize: { w: 4, h: 4 },
  minSize: { w: 3, h: 3 }
})
