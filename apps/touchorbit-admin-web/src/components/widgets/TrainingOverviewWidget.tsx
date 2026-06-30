'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { WidgetShell } from './WidgetShell'
import type { WidgetProps } from '@/lib/widgets/types'
import { registerWidget } from '@/lib/widgets/registry'
import { GraduationCap, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useWidgetSize } from './WidgetShell'
import { SoftBadge, WidgetEmpty, WidgetError, WidgetIcon } from './_shared/WidgetPrimitives'

export function TrainingOverviewWidget({ organizationId, editMode, onRemove }: WidgetProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [data, setData] = useState({ assigned: 0, inProgress: 0, completed: 0, rescheduleRequests: 0 })

  async function loadData() {
    setLoading(true)
    setError(false)
    try {
      const { data: rows } = await supabase
        .from('training_assignments')
        .select('status, reschedule_requested')
        .eq('organization_id', organizationId)
        .neq('status', 'cancelled')

      if (rows) {
        let assigned = 0, inProgress = 0, completed = 0, rescheduleRequests = 0
        for (const r of rows) {
          if (r.status === 'assigned') assigned++
          else if (r.status === 'in_progress') inProgress++
          else if (r.status === 'completed') completed++
          if (r.reschedule_requested) rescheduleRequests++
        }
        setData({ assigned, inProgress, completed, rescheduleRequests })
      }
    } catch (e) {
      console.error('Error loading training overview widget data:', e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (organizationId) loadData()
  }, [organizationId])

  const total = data.assigned + data.inProgress + data.completed
  const widgetSize = useWidgetSize()

  return (
    <WidgetShell
      title="Training Overview"
      icon={GraduationCap}
      tone="blue"
      editMode={editMode}
      onRemove={onRemove}
      loading={loading}
      onRefresh={loadData}
    >
      {error ? (
        <WidgetError onRetry={loadData} />
      ) : total === 0 ? (
        <WidgetEmpty icon={GraduationCap} label="No training assignments" />
      ) : (
        <Link href="/training" className="block p-4 h-full group">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <WidgetIcon icon={GraduationCap} tone="blue" size="sm" />
              <span className="text-[11px] font-black text-[#9994A8] uppercase tracking-wider">Training Status</span>
            </div>
            <div className="flex items-center gap-2">
              {data.rescheduleRequests > 0 && (
                <SoftBadge tone="amber">{data.rescheduleRequests} Reschedule</SoftBadge>
              )}
              <ArrowRight size={16} className="text-[#D1D5DB] group-hover:text-[#534AB7] group-hover:translate-x-1 transition-all" />
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="text-[12px] font-semibold text-[#6B6578]">Assigned</span>
              </div>
              <span className="text-[13px] font-black text-[#1A1727]">{data.assigned}</span>
            </div>
            {widgetSize !== 'xs' && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-[12px] font-semibold text-[#6B6578]">In Progress</span>
                  </div>
                  <span className="text-[13px] font-black text-[#1A1727]">{data.inProgress}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                    <span className="text-[12px] font-semibold text-[#6B6578]">Completed</span>
                  </div>
                  <span className="text-[13px] font-black text-[#1A1727]">{data.completed}</span>
                </div>
              </>
            )}
          </div>
        </Link>
      )}
    </WidgetShell>
  )
}

registerWidget({
  type: 'training-overview',
  title: 'Training Overview',
  description: 'Training assignment status breakdown',
  category: 'people',
  component: TrainingOverviewWidget,
  defaultSize: { w: 4, h: 3 },
  minSize: { w: 3, h: 3 }
})
