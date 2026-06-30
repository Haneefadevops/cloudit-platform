'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { X, CalendarDays, Clock, MapPin, Video, Users } from 'lucide-react'

interface CalendarEvent {
  id: string
  title: string
  event_type: string
  start_time: string
  end_time: string | null
  all_day: boolean
  location: string | null
  meeting_url: string | null
}

interface EmployeeCalendarOverlayProps {
  employeeId: string | null
  employeeName: string
  onClose: () => void
}

export function EmployeeCalendarOverlay({ employeeId, employeeName, onClose }: EmployeeCalendarOverlayProps) {
  const { organizationId } = useAuth()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!employeeId || !organizationId) return
    loadEvents()
  }, [employeeId, organizationId])

  async function loadEvents() {
    setLoading(true)
    try {
      const start = new Date()
      start.setDate(start.getDate() - 7)
      const end = new Date()
      end.setDate(end.getDate() + 21)
      const startStr = start.toISOString().split('T')[0]
      const endStr = end.toISOString().split('T')[0]

      const { data, error } = await supabase
        .rpc('get_events_for_employee', { p_employee_id: employeeId, p_start_date: startStr, p_end_date: endStr })
      if (error) throw error
      setEvents((data || []) as CalendarEvent[])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const today = new Date().toISOString().split('T')[0]
  const upcoming = events.filter(e => {
    const d = new Date(e.start_time).toISOString().split('T')[0]
    return d >= today
  }).slice(0, 10)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative h-full w-full max-w-md bg-white shadow-2xl border-l border-gray-100 flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black text-gray-900">{employeeName}</h2>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">Upcoming Events</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-50 rounded-lg transition-colors text-gray-400 hover:text-gray-900">
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* Events list */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : upcoming.length === 0 ? (
            <div className="text-center py-12">
              <CalendarDays size={32} className="mx-auto text-gray-200 mb-3" strokeWidth={1.5} />
              <p className="text-xs font-bold text-gray-400">No upcoming events</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map((ev) => {
                const date = new Date(ev.start_time)
                const dateStr = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
                const timeStr = ev.all_day
                  ? 'All day'
                  : date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

                return (
                  <div key={ev.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-purple-200 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-black text-gray-900 truncate">{ev.title}</h4>
                        <div className="flex items-center gap-2 mt-1.5 text-[10px] font-bold text-gray-400">
                          <span className="flex items-center gap-1"><CalendarDays size={10} /> {dateStr}</span>
                          <span className="flex items-center gap-1"><Clock size={10} /> {timeStr}</span>
                        </div>
                      </div>
                      {ev.meeting_url && (
                        <a
                          href={ev.meeting_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600 hover:bg-purple-200 transition-colors"
                          title="Join meeting"
                        >
                          <Video size={12} strokeWidth={2.5} />
                        </a>
                      )}
                    </div>
                    {ev.location && (
                      <div className="flex items-center gap-1 mt-1.5 text-[10px] font-bold text-gray-400">
                        <MapPin size={10} /> {ev.location}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
