'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { WidgetShell } from './WidgetShell'
import type { WidgetProps } from '@/lib/widgets/types'
import { registerWidget } from '@/lib/widgets/registry'
import { CalendarDays, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { WidgetEmpty, WidgetError, WidgetFooterLink } from './_shared/WidgetPrimitives'

interface EventItem {
  id: string
  title: string
  date: string
  type: string
  source: 'holiday' | 'event'
}

const EVENT_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  public:   { bg: 'bg-green-100',  text: 'text-green-700' },
  religious:{ bg: 'bg-purple-100', text: 'text-purple-700' },
  company:  { bg: 'bg-blue-100',   text: 'text-blue-700' },
  birthday: { bg: 'bg-pink-100',   text: 'text-pink-700' },
  meeting:  { bg: 'bg-amber-100',  text: 'text-amber-700' },
}

function getTypeStyle(type: string) {
  return EVENT_TYPE_COLORS[type] ?? { bg: 'bg-gray-100', text: 'text-gray-600' }
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function UpcomingEventsWidget({ organizationId, editMode, onRemove }: WidgetProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [events, setEvents] = useState<EventItem[]>([])

  async function loadData() {
    setLoading(true)
    setError(false)
    try {
      const result = await api.get<EventItem[]>('/calendar-events/upcoming?days=30')
      if (!result.ok) throw new Error(result.error || 'Failed')
      setEvents(result.data || [])
    } catch (e) {
      console.error('Error loading upcoming events widget data:', e)
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
      title="Upcoming Events"
      icon={CalendarDays}
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
          {events.length === 0 ? (
            <WidgetEmpty icon={CalendarDays} label="No events in next 30 days" />
          ) : (
            <div className="divide-y divide-[#F8F7F9] flex-1">
              {events.map((item) => {
                const style = getTypeStyle(item.type)
                return (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#F8F7F9]/50 transition-colors">
                    <div className="w-10 h-10 rounded-lg bg-[#EDE9FE] flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-black text-[#534AB7] leading-tight">
                        {formatDate(item.date).split(' ')[0].toUpperCase()}
                      </span>
                      <span className="text-[14px] font-black text-[#534AB7] leading-tight">
                        {formatDate(item.date).split(' ')[1]}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-[#1A1727] truncate">{item.title}</p>
                      <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${style.bg} ${style.text}`}>
                        {item.type}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {events.length > 0 && (
            <WidgetFooterLink href="/calendar">View Calendar</WidgetFooterLink>
          )}
        </div>
      )}
    </WidgetShell>
  )
}

registerWidget({
  type: 'upcoming-events',
  title: 'Upcoming Events',
  description: 'Holidays and events in the next 30 days',
  category: 'comms',
  component: UpcomingEventsWidget,
  defaultSize: { w: 4, h: 3 },
  minSize: { w: 3, h: 3 }
})
