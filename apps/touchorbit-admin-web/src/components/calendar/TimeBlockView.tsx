'use client'

import { EventCardData } from '@/components/ui-touchorbit'
import { useMemo } from 'react'

interface TimeBlockEvent extends EventCardData {
  startHour: number
  endHour: number
}

interface TimeBlockViewProps {
  dates: Date[]
  events: { date: Date; events: TimeBlockEvent[] }[]
  onEventClick?: (event: TimeBlockEvent) => void
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)

export function TimeBlockView({ dates, events, onEventClick }: TimeBlockViewProps) {
  const maxHour = useMemo(() => {
    let max = 18
    events.forEach(day => {
      day.events.forEach(e => {
        if (e.endHour > max) max = e.endHour
      })
    })
    return Math.min(max + 1, 24)
  }, [events])

  const visibleHours = HOURS.filter(h => h <= maxHour)

  return (
    <div className="border border-[#F1F0F4] rounded-[24px] bg-white overflow-hidden">
      {/* Header row */}
      <div className="grid" style={{ gridTemplateColumns: `60px repeat(${dates.length}, 1fr)` }}>
        <div className="border-b border-r border-[#F1F0F4] p-2 bg-[#F8F7F9]/50" />
        {dates.map(date => (
          <div key={date.toISOString()} className="border-b border-r border-[#F1F0F4] p-2 text-center bg-[#F8F7F9]/50">
            <div className="text-[9px] font-black text-[#9CA3AF] uppercase tracking-wider">
              {date.toLocaleDateString('en-US', { weekday: 'short' })}
            </div>
            <div className={`text-sm font-black mt-0.5 ${
              date.toDateString() === new Date().toDateString() ? 'text-[#534AB7]' : 'text-[#1A1727]'
            }`}>
              {date.getDate()}
            </div>
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div className="grid" style={{ gridTemplateColumns: `60px repeat(${dates.length}, 1fr)` }}>
        {/* Hour labels */}
        <div className="relative">
          {visibleHours.map(hour => (
            <div
              key={hour}
              className="border-b border-r border-[#F1F0F4] text-[9px] font-bold text-[#D1D5DB] text-right pr-2 flex items-center justify-end"
              style={{ height: '48px' }}
            >
              {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {dates.map((date, dateIndex) => {
          const dayEvents = events[dateIndex]?.events || []
          const dateStr = date.toISOString().split('T')[0]

          return (
            <div key={date.toISOString()} className="relative">
              {visibleHours.map(hour => (
                <div
                  key={hour}
                  className="border-b border-r border-[#F1F0F4]"
                  style={{ height: '48px' }}
                />
              ))}

              {/* Events positioned absolutely */}
              {dayEvents.map((event, i) => {
                const top = event.startHour * 48
                const height = Math.max((event.endHour - event.startHour) * 48, 20)
                const colors: Record<string, string> = {
                  meeting: 'bg-purple-100 border-purple-300 text-purple-800',
                  training: 'bg-orange-100 border-orange-300 text-orange-800',
                  company_event: 'bg-violet-100 border-violet-300 text-violet-800',
                  holiday: 'bg-red-100 border-red-300 text-red-800',
                  leave: 'bg-blue-100 border-blue-300 text-blue-800',
                  shift: 'bg-emerald-100 border-emerald-300 text-emerald-800',
                }
                const colorClass = colors[event.type] || 'bg-gray-100 border-gray-300 text-gray-800'

                return (
                  <button
                    key={`${event.id}-${i}`}
                    onClick={() => onEventClick?.(event)}
                    className={`absolute left-1 right-1 rounded-lg border px-2 py-1 text-left transition-all hover:shadow-md hover:brightness-95 ${colorClass}`}
                    style={{ top: `${top}px`, height: `${height}px`, minHeight: '20px' }}
                    title={event.title}
                  >
                    <div className="text-[9px] font-black truncate leading-tight">{event.title}</div>
                    {height > 28 && (
                      <div className="text-[8px] font-bold opacity-70 mt-0.5">
                        {event.startHour === 0 ? '12 AM' : event.startHour < 12 ? `${event.startHour} AM` : event.startHour === 12 ? '12 PM' : `${event.startHour - 12} PM`}
                        {' – '}
                        {event.endHour === 0 ? '12 AM' : event.endHour < 12 ? `${event.endHour} AM` : event.endHour === 12 ? '12 PM' : `${event.endHour - 12} PM`}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
