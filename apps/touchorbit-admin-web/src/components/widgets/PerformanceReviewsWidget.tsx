'use client'

import { useDashboard } from '@/lib/dashboard/dashboard-context'
import { WidgetShell } from './WidgetShell'
import type { WidgetProps } from '@/lib/widgets/types'
import { registerWidget } from '@/lib/widgets/registry'
import { Star, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useWidgetSize } from './WidgetShell'
import { WidgetEmpty, WidgetError, WidgetIcon } from './_shared/WidgetPrimitives'

export function PerformanceReviewsWidget({ editMode, onRemove }: WidgetProps) {
  const { summary, loading, error, refresh } = useDashboard()
  const total = summary.pendingPerformanceSelf + summary.pendingPerformanceManager
  const widgetSize = useWidgetSize()

  return (
    <WidgetShell
      title="Performance Reviews"
      icon={Star}
      tone="amber"
      editMode={editMode}
      onRemove={onRemove}
      loading={loading}
    >
      {error ? (
        <WidgetError onRetry={refresh} />
      ) : total === 0 && summary.activePerformanceCycles === 0 ? (
        <WidgetEmpty icon={Star} label="No active review cycles" />
      ) : (
        <Link href="/performance" className="block p-4 h-full group">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <WidgetIcon icon={Star} tone="amber" size="sm" />
              <span className="text-[11px] font-black text-[#9994A8] uppercase tracking-wider">Review Cycles</span>
            </div>
            <ArrowRight size={16} className="text-[#D1D5DB] group-hover:text-[#534AB7] group-hover:translate-x-1 transition-all" />
          </div>

          <div className="flex items-baseline gap-1.5 mb-4">
            <span className="text-[24px] font-black text-[#1A1727]">{summary.activePerformanceCycles}</span>
            <span className="text-[12px] font-bold text-[#9994A8]">Active {summary.activePerformanceCycles === 1 ? 'Cycle' : 'Cycles'}</span>
          </div>

          {widgetSize !== 'xs' && widgetSize !== 'sm' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  <span className="text-[12px] font-semibold text-[#6B6578]">Pending Self-Review</span>
                </div>
                <span className="text-[13px] font-black text-[#1A1727]">{summary.pendingPerformanceSelf}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-400" />
                  <span className="text-[12px] font-semibold text-[#6B6578]">Pending Manager</span>
                </div>
                <span className="text-[13px] font-black text-[#1A1727]">{summary.pendingPerformanceManager}</span>
              </div>
            </div>
          )}
        </Link>
      )}
    </WidgetShell>
  )
}

registerWidget({
  type: 'performance-reviews',
  title: 'Performance Reviews',
  description: 'Active review cycles and pending reviews',
  category: 'people',
  component: PerformanceReviewsWidget,
  defaultSize: { w: 4, h: 3 },
  minSize: { w: 3, h: 3 }
})
