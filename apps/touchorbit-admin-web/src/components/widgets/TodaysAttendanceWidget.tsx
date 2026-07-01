'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'
import { WidgetShell, useWidgetSize } from './WidgetShell'
import type { WidgetProps } from '@/lib/widgets/types'
import { registerWidget } from '@/lib/widgets/registry'
import { ArrowUp, CalendarCheck, Users } from 'lucide-react'
import { WidgetError } from './_shared/WidgetPrimitives'

export function TodaysAttendanceWidget({ organizationId, editMode, onRemove }: WidgetProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [data, setData] = useState({
    total: 0,
    present: 0,
    late: 0,
    absent: 0,
    rate: 0
  })

  async function loadData() {
    setLoading(true)
    setError(false)
    try {
      const today = new Date().toISOString().split('T')[0]
      const todayStart = today + 'T00:00:00'
      const todayEnd = today + 'T23:59:59'

      const [{ data: empData }, eventsResult] = await Promise.all([
        supabase
          .from('employees')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('employment_status', 'active'),
        api.get<any[]>(`/attendance?event_type=clock_in&from=${encodeURIComponent(todayStart)}&to=${encodeURIComponent(todayEnd)}&limit=500`),
      ])

      if (!eventsResult.ok) throw new Error(eventsResult.error || 'Failed to load clock events')
      const clockData = eventsResult.data || []

      const total = empData?.length || 0
      
      // Deduplicate present employees
      const presentIds = new Set(clockData?.map((e: any) => e.employee_id) || [])
      const presentCount = presentIds.size

      // Late calculation: clock-ins after 09:15
      // We only count the FIRST clock-in of each employee for lateness
      const firstClockIns = new Map<string, string>()
      clockData?.forEach((e: any) => {
        if (!firstClockIns.has(e.employee_id) || e.timestamp < firstClockIns.get(e.employee_id)!) {
          firstClockIns.set(e.employee_id, e.timestamp)
        }
      })

      let lateCount = 0
      firstClockIns.forEach((timestamp) => {
        const time = new Date(timestamp)
        const hours = time.getHours()
        const minutes = time.getMinutes()
        if (hours > 9 || (hours === 9 && minutes > 15)) {
          lateCount++
        }
      })

      const absentCount = total - presentCount
      const rate = total > 0 ? Math.round((presentCount / total) * 100) : 0

      setData({
        total,
        present: presentCount,
        late: lateCount,
        absent: absentCount,
        rate
      })
    } catch (error) {
      console.error('Error loading attendance widget data:', error)
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
      title="Today's Attendance"
      subtitle="Attendance Overview"
      icon={CalendarCheck}
      tone="purple"
      editMode={editMode}
      onRemove={onRemove}
      loading={loading}
      onRefresh={loadData}
    >
      {error ? (
        <WidgetError onRetry={loadData} />
      ) : (
      <AttendanceContent data={data} />
      )}
    </WidgetShell>
  )
}

function AttendanceContent({ data }: { data: { total: number; present: number; late: number; absent: number; rate: number } }) {
  const widgetSize = useWidgetSize()
  const compact = widgetSize === 'xs' || widgetSize === 'sm'

  return (
    <div className={`${compact ? 'p-4 pt-3' : 'p-6 pt-5'} flex h-full flex-col`}>
      <div className="mt-2 flex items-center justify-between gap-6">
        <div className="min-w-0">
          <p className={`${compact ? 'text-4xl' : 'text-6xl'} font-black tracking-tight text-[#534AB7]`}>
            {data.rate}<span className={compact ? 'text-xl' : 'text-3xl'}>%</span>
          </p>
          <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
            <ArrowUp size={16} className="text-emerald-600" />
            <span className="font-bold text-emerald-600">{data.present}</span> present today
          </p>
        </div>
        <div
          className={`relative grid ${compact ? 'h-20 w-20' : 'h-28 w-28'} shrink-0 place-items-center rounded-full`}
          style={{ background: `conic-gradient(#534AB7 0 ${data.rate}%, #ECECF1 ${data.rate}% 100%)` }}
        >
          <div className={`grid ${compact ? 'h-14 w-14' : 'h-20 w-20'} place-items-center rounded-full bg-white`}>
            <Users size={compact ? 20 : 28} className="text-slate-900" />
          </div>
        </div>
      </div>

      {!compact && <div className="mt-auto grid grid-cols-3 border-t border-slate-200 pt-5">
        {[
          { label: 'Present', value: data.present, pct: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0, dot: 'bg-emerald-500' },
          { label: 'Late', value: data.late, pct: data.total > 0 ? Math.round((data.late / data.total) * 100) : 0, dot: 'bg-amber-500' },
          { label: 'Absent', value: data.absent, pct: data.total > 0 ? Math.round((data.absent / data.total) * 100) : 0, dot: 'bg-red-500' },
        ].map((item, index) => (
          <div key={item.label} className={index ? 'border-l border-slate-200 pl-6' : ''}>
            <p className="flex items-center gap-2 text-xs text-slate-500">
              <span className={`h-2 w-2 rounded-full ${item.dot}`} />
              {item.label}
            </p>
            <p className="mt-2 text-xl font-black text-slate-950">{item.value}</p>
            <p className="text-xs text-slate-500">{item.pct}%</p>
          </div>
        ))}
      </div>}
    </div>
  )
}

registerWidget({
  type: 'todays-attendance',
  title: "Today's Attendance",
  description: "Live attendance snapshot",
  category: 'attendance',
  component: TodaysAttendanceWidget,
  defaultSize: { w: 4, h: 3 },
  minSize: { w: 3, h: 3 }
})
