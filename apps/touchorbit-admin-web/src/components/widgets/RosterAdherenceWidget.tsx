'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { WidgetShell } from './WidgetShell'
import type { WidgetProps } from '@/lib/widgets/types'
import { registerWidget } from '@/lib/widgets/registry'
import { CalendarCheck, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useWidgetSize } from './WidgetShell'
import { MiniStat, ProgressBar, WidgetEmpty, WidgetError, WidgetIcon } from './_shared/WidgetPrimitives'

export function RosterAdherenceWidget({ organizationId, editMode, onRemove }: WidgetProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [data, setData] = useState({ onTime: 0, late: 0, absent: 0 })

  async function loadData() {
    setLoading(true)
    setError(false)
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data: rows } = await supabase
        .from('shift_adherence')
        .select('status')
        .eq('organization_id', organizationId)
        .eq('date', today)

      if (rows) {
        let onTime = 0, late = 0, absent = 0
        for (const r of rows) {
          if (r.status === 'on_time') onTime++
          else if (r.status === 'late' || r.status === 'late_early') late++
          else if (r.status === 'absent') absent++
        }
        setData({ onTime, late, absent })
      }
    } catch (e) {
      console.error('Error loading roster adherence widget data:', e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (organizationId) loadData()
  }, [organizationId])

  const total = data.onTime + data.late + data.absent
  const adherencePct = total > 0 ? Math.round((data.onTime / total) * 100) : 0
  const widgetSize = useWidgetSize()

  return (
    <WidgetShell
      title="Roster Adherence"
      icon={CalendarCheck}
      tone="purple"
      editMode={editMode}
      onRemove={onRemove}
      loading={loading}
      onRefresh={loadData}
    >
      {error ? (
        <WidgetError onRetry={loadData} />
      ) : total === 0 ? (
        <WidgetEmpty icon={CalendarCheck} label="No adherence data today" />
      ) : (
        <Link href="/roster" className="block p-4 h-full group">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <WidgetIcon icon={CalendarCheck} tone="purple" size="sm" />
              <span className="text-[11px] font-black text-[#9994A8] uppercase tracking-wider">Today's Adherence</span>
            </div>
            <ArrowRight size={16} className="text-[#D1D5DB] group-hover:text-[#534AB7] group-hover:translate-x-1 transition-all" />
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            <MiniStat label="On Time" value={data.onTime} tone="green" />
            <MiniStat label="Late" value={data.late} tone="amber" />
            <MiniStat label="Absent" value={data.absent} tone="red" />
          </div>

          {widgetSize !== 'xs' && widgetSize !== 'sm' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-[#9994A8]">Adherence Rate</span>
                <span className="text-[11px] font-black text-[#534AB7]">{adherencePct}%</span>
              </div>
              <ProgressBar value={adherencePct} tone="purple" />
            </div>
          )}
        </Link>
      )}
    </WidgetShell>
  )
}

registerWidget({
  type: 'roster-adherence',
  title: 'Roster Adherence',
  description: "Today's roster adherence breakdown",
  category: 'attendance',
  component: RosterAdherenceWidget,
  defaultSize: { w: 4, h: 3 },
  minSize: { w: 3, h: 3 }
})
