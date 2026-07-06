'use client'

import { useDashboard } from '@/lib/dashboard/dashboard-context'
import { WidgetShell } from './WidgetShell'
import type { WidgetProps } from '@/lib/widgets/types'
import { registerWidget } from '@/lib/widgets/registry'
import { Megaphone, Calendar } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { WidgetEmpty, WidgetError, WidgetFooterLink } from './_shared/WidgetPrimitives'

interface Announcement {
  id: string
  title: string
  priority: 'urgent' | 'important' | 'normal'
  created_at: string
}

export function AnnouncementsWidget({ editMode, onRemove }: WidgetProps) {
  const { summary, loading, error, refresh } = useDashboard()
  const announcements = (summary.latestAnnouncements ?? []) as Announcement[]

  return (
    <WidgetShell
      title="Announcements"
      icon={Megaphone}
      tone="purple"
      editMode={editMode}
      onRemove={onRemove}
      loading={loading}
    >
      {error ? (
        <WidgetError onRetry={refresh} />
      ) : announcements.length === 0 ? (
        <WidgetEmpty icon={Megaphone} label="No announcements yet" />
      ) : (
        <div className="flex flex-col h-full">
          <div className="flex-1 px-4 pb-2">
            {announcements.map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-[#F1F0F4] py-2.5 last:border-b-0">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-black text-[#1A1727]">{item.title}</p>
                  <span className="mt-0.5 flex items-center gap-1 text-[10px] font-bold text-[#9994A8]">
                    <Calendar size={10} />
                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                  </span>
                </div>
                <div>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                    item.priority === 'urgent'
                      ? 'bg-red-50 text-red-600 border-red-100'
                      : item.priority === 'important'
                      ? 'bg-amber-50 text-amber-600 border-amber-100'
                      : 'bg-gray-50 text-gray-600 border-gray-100'
                  }`}>
                    {item.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {announcements.length > 0 && <WidgetFooterLink href="/announcements">View all announcements</WidgetFooterLink>}
        </div>
      )}
    </WidgetShell>
  )
}

registerWidget({
  type: 'announcements',
  title: 'Announcements',
  description: 'Latest org announcements',
  category: 'comms',
  component: AnnouncementsWidget,
  defaultSize: { w: 4, h: 3 },
  minSize: { w: 3, h: 3 }
})
