'use client'

import { Clock, MapPin } from 'lucide-react'
import { AttendanceHeatmap } from './AttendanceHeatmap'

interface ClockEvent {
  id: string
  timestamp: string
  event_type: 'clock_in' | 'clock_out'
  location_verified?: boolean
}

interface AttendanceTabProps {
  events: ClockEvent[]
  isLoading: boolean
}

export function AttendanceTab({ events, isLoading }: AttendanceTabProps) {
  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="bg-white rounded-2xl border border-[#C7C3D0] p-6 shadow-sm animate-pulse h-32" />
        <div className="bg-white rounded-2xl border border-[#C7C3D0] p-6 shadow-sm animate-pulse h-64" />
      </div>
    )
  }

  // Calculate summary stats from events
  const eventsByDate = new Map<string, ClockEvent[]>()
  events.forEach((ev) => {
    const dateKey = ev.timestamp.split('T')[0]
    if (!eventsByDate.has(dateKey)) eventsByDate.set(dateKey, [])
    eventsByDate.get(dateKey)!.push(ev)
  })

  let presentDays = 0
  let lateDays = 0
  let absentDays = 0

  const today = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateKey = d.toISOString().split('T')[0]
    const dayEvents = eventsByDate.get(dateKey) || []
    const clockIns = dayEvents.filter((e) => e.event_type === 'clock_in')

    if (clockIns.length === 0) {
      absentDays++
    } else {
      const firstClockIn = new Date(clockIns[0].timestamp)
      const hour = firstClockIn.getHours()
      const minute = firstClockIn.getMinutes()
      if (hour > 9 || (hour === 9 && minute > 15)) {
        lateDays++
      } else {
        presentDays++
      }
    }
  }

  const total = presentDays + lateDays + absentDays || 1
  const summary = [
    { label: 'Present', value: presentDays, color: 'bg-emerald-500', text: 'text-emerald-600' },
    { label: 'Late', value: lateDays, color: 'bg-amber-500', text: 'text-amber-600' },
    { label: 'Absent', value: absentDays, color: 'bg-red-500', text: 'text-red-600' },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Summary Bar */}
      <div className="bg-white rounded-2xl border border-[#C7C3D0] p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-black text-[#1A1727] uppercase tracking-widest">Last 30 Days Summary</h3>
          <span className="text-[11px] font-bold text-[#9994A8]">{events.length} events</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1 h-3 rounded-full bg-[#F1F0F4] overflow-hidden flex">
            {summary.map((s) => (
              <div
                key={s.label}
                className={`h-full ${s.color} transition-all`}
                style={{ width: `${(s.value / total) * 100}%` }}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-5 mt-3">
          {summary.map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${s.color}`} />
              <span className="text-[11px] font-black text-[#6B6578]">{s.label}</span>
              <span className={`text-[13px] font-black ${s.text}`}>{s.value}</span>
              <span className="text-[10px] font-bold text-[#9994A8]">({Math.round((s.value / total) * 100)}%)</span>
            </div>
          ))}
        </div>
      </div>

      {/* Heatmap */}
      <AttendanceHeatmap events={events} days={30} />

      {/* Recent Events Table */}
      <div className="bg-white rounded-2xl border border-[#C7C3D0] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#F1F0F4]">
          <h3 className="text-[13px] font-black text-[#1A1727] uppercase tracking-widest flex items-center gap-2">
            <Clock size={16} className="text-[#534AB7]" /> Recent Events
          </h3>
        </div>
        {events.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-[13px] font-bold text-[#9994A8]">No attendance records found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#F4F3F7] border-b border-[#F1F0F4]">
                  {['Date', 'Type', 'Time', 'Location'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-black text-[#6B6578] uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F0F4]">
                {events.slice(0, 50).map((ev) => (
                  <tr key={ev.id} className="hover:bg-[#F8F7F9] transition-colors">
                    <td className="px-5 py-3 text-[12.5px] font-bold text-[#1A1727]">
                      {new Date(ev.timestamp).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                          ev.event_type === 'clock_in'
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                            : 'bg-blue-50 text-blue-600 border-blue-100'
                        }`}
                      >
                        {ev.event_type === 'clock_in' ? 'Clock In' : 'Clock Out'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[12.5px] font-black text-[#534AB7] font-mono">
                      {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <MapPin size={12} className={ev.location_verified ? 'text-emerald-500' : 'text-[#D1D5DB]'} />
                        <span className="text-[11px] font-bold text-[#6B6578]">
                          {ev.location_verified ? 'Verified' : '—'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
