'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { WidgetShell } from './WidgetShell'
import type { WidgetProps } from '@/lib/widgets/types'
import { registerWidget } from '@/lib/widgets/registry'
import { ChevronRight, Clock } from 'lucide-react'
import { WidgetEmpty, WidgetError, WidgetFooterLink } from './_shared/WidgetPrimitives'

interface RecentClockIn {
  employee_id: string
  employee_name: string
  department: string
  time: string
  initials: string
}

export function RecentClockInsWidget({ organizationId, editMode, onRemove }: WidgetProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [data, setData] = useState<RecentClockIn[]>([])

  async function loadData() {
    setLoading(true)
    setError(false)
    try {
      const today = new Date().toISOString().split('T')[0]
      const result = await api.get<any[]>(`/attendance?event_type=clock_in&from=${encodeURIComponent(today + 'T00:00:00')}&to=${encodeURIComponent(today + 'T23:59:59')}&limit=100`)
      if (!result.ok) throw new Error(result.error || 'Failed to load recent clock-ins')

      const recent = (result.data || []).sort((a: any, b: any) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )

      const seen = new Set<string>()
      const list: RecentClockIn[] = []
      for (const r of recent as any[]) {
        if (seen.has(r.employee_id)) continue
        seen.add(r.employee_id)
        if (list.length >= 8) break // Spec says show last 8

        const name = r.employee_name || 'Unknown'
        const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase() || '?'
        const time = new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        
        list.push({ employee_id: r.employee_id, employee_name: name, department: '—', time, initials })
      }
      setData(list)
    } catch (error) {
      console.error('Error loading recent clock-ins widget data:', error)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (organizationId) loadData()
  }, [organizationId])

  return (
    <WidgetShell
      title="Recent Clock-Ins"
      icon={Clock}
      tone="blue"
      editMode={editMode}
      onRemove={onRemove}
      loading={loading}
      onRefresh={loadData}
    >
      {error ? (
        <WidgetError onRetry={loadData} />
      ) : (
      <div className="flex flex-col h-full">
        {data.length === 0 ? (
          <WidgetEmpty icon={Clock} label="No clock-ins today yet" />
        ) : (
          <div className="px-4 pb-2">
            <div className="grid grid-cols-[1fr_72px_72px] border-b border-[#F1F0F4] pb-2 text-[10px] font-black text-[#9994A8]">
              <span>Employee</span>
              <span className="text-right">Time</span>
              <span className="text-right">Status</span>
            </div>
            {data.map((item) => (
              <div key={item.employee_id} className="grid grid-cols-[1fr_72px_72px] items-center gap-2 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold bg-[#F1EEFF] text-[#534AB7]">
                    {item.initials}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-bold text-[#1A1727]">{item.employee_name}</p>
                    <p className="truncate text-[10px] font-semibold text-[#9994A8]">{item.department}</p>
                  </div>
                </div>
                <span className="text-right text-[11px] font-mono font-bold text-[#1A1727]">{item.time}</span>
                <div className="flex items-center justify-end gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-black text-emerald-600">On Time</span>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {data.length > 0 && (
          <WidgetFooterLink href="/attendance">View all clock ins</WidgetFooterLink>
        )}
      </div>
      )}
    </WidgetShell>
  )
}

registerWidget({
  type: 'recent-clock-ins',
  title: 'Recent Clock-Ins',
  description: "Today's clock-in activity",
  category: 'attendance',
  component: RecentClockInsWidget,
  defaultSize: { w: 5, h: 5 },
  minSize: { w: 4, h: 3 }
})
