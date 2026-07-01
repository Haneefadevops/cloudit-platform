'use client'

import { useMemo } from 'react'
import { useDashboard } from '@/lib/dashboard/dashboard-context'
import { WidgetShell } from './WidgetShell'
import type { WidgetProps } from '@/lib/widgets/types'
import { registerWidget } from '@/lib/widgets/registry'
import { Activity } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { WidgetEmpty, WidgetError, WidgetFooterLink } from './_shared/WidgetPrimitives'

export function RecentActivityWidget({ organizationId: _organizationId, editMode, onRemove }: WidgetProps) {
  const { activities, loading, error, refresh } = useDashboard()

  const data = useMemo(() => activities.slice(0, 5), [activities])

  return (
    <WidgetShell
      title="Recent Activity"
      icon={Activity}
      tone="violet"
      editMode={editMode}
      onRemove={onRemove}
      loading={loading}
      onRefresh={refresh}
    >
      {error ? (
        <WidgetError onRetry={refresh} />
      ) : data.length === 0 ? (
        <WidgetEmpty icon={Activity} label="No recent activity" />
      ) : (
        <div className="flex flex-col h-full">
          <div className="flex-1 px-4 pb-2 space-y-2">
            {data.map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_auto] items-start gap-3 border-b border-[#F1F0F4] py-2 last:border-b-0">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-black text-[#1A1727]">{item.title || `${item.action} ${item.entity_type}`}</p>
                  <p className="text-[10px] font-bold text-[#9994A8] truncate">
                    {item.actor_name || 'System'} · {item.module}
                  </p>
                </div>
                <span className="text-[10px] font-bold text-[#9994A8] whitespace-nowrap">
                  {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
          <WidgetFooterLink href="/audit">View audit log</WidgetFooterLink>
        </div>
      )}
    </WidgetShell>
  )
}

registerWidget({
  type: 'recent-activity',
  title: 'Recent Activity',
  description: 'Latest organization activity stream',
  category: 'comms',
  component: RecentActivityWidget,
  defaultSize: { w: 4, h: 4 },
  minSize: { w: 3, h: 3 }
})
