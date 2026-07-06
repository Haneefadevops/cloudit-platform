'use client'

import { useDashboard } from '@/lib/dashboard/dashboard-context'
import { WidgetShell } from './WidgetShell'
import type { WidgetProps } from '@/lib/widgets/types'
import { registerWidget } from '@/lib/widgets/registry'
import { GraduationCap, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useWidgetSize } from './WidgetShell'
import { SoftBadge, WidgetEmpty, WidgetError, WidgetIcon } from './_shared/WidgetPrimitives'

export function TrainingOverviewWidget({ editMode, onRemove }: WidgetProps) {
  const { summary, loading, error, refresh } = useDashboard()
  const total = summary.trainingAssigned + summary.trainingInProgress + summary.trainingCompleted
  const widgetSize = useWidgetSize()

  return (
    <WidgetShell
      title="Training Overview"
      icon={GraduationCap}
      tone="blue"
      editMode={editMode}
      onRemove={onRemove}
      loading={loading}
    >
      {error ? (
        <WidgetError onRetry={refresh} />
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
              {summary.trainingRescheduleRequests > 0 && (
                <SoftBadge tone="amber">{summary.trainingRescheduleRequests} Reschedule</SoftBadge>
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
              <span className="text-[13px] font-black text-[#1A1727]">{summary.trainingAssigned}</span>
            </div>
            {widgetSize !== 'xs' && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-[12px] font-semibold text-[#6B6578]">In Progress</span>
                  </div>
                  <span className="text-[13px] font-black text-[#1A1727]">{summary.trainingInProgress}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                    <span className="text-[12px] font-semibold text-[#6B6578]">Completed</span>
                  </div>
                  <span className="text-[13px] font-black text-[#1A1727]">{summary.trainingCompleted}</span>
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
