'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
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

export function AnnouncementsWidget({ organizationId, editMode, onRemove }: WidgetProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [data, setData] = useState<Announcement[]>([])

  async function loadData() {
    setLoading(true)
    setError(false)
    try {
      const { data: announcements } = await supabase
        .from('announcements')
        .select('id, title, priority, created_at')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(3)

      if (announcements) {
        setData(announcements as Announcement[])
      }
    } catch (error) {
      console.error('Error loading announcements widget data:', error)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (organizationId) loadData()
  }, [organizationId])

  const priorityConfig = {
    urgent: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-100' },
    important: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' },
    normal: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-100' }
  }

  return (
    <WidgetShell
      title="Announcements"
      icon={Megaphone}
      tone="purple"
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
          <WidgetEmpty icon={Megaphone} label="No announcements yet" />
        ) : (
          <div className="flex-1 px-4 pb-2">
            {data.map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-[#F1F0F4] py-2.5 last:border-b-0">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-black text-[#1A1727]">{item.title}</p>
                  <span className="mt-0.5 flex items-center gap-1 text-[10px] font-bold text-[#9994A8]">
                    <Calendar size={10} />
                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                  </span>
                </div>
                <div>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${priorityConfig[item.priority]?.bg} ${priorityConfig[item.priority]?.text} ${priorityConfig[item.priority]?.border}`}>
                    {item.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        {data.length > 0 && <WidgetFooterLink href="/announcements">View all announcements</WidgetFooterLink>}
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
