'use client'

interface ClockEvent {
  id: string
  timestamp: string
  event_type: 'clock_in' | 'clock_out'
  location_verified?: boolean
}

interface AttendanceHeatmapProps {
  events: ClockEvent[]
  days?: number
}

interface DayCell {
  date: Date
  status: 'present' | 'late' | 'absent' | 'future'
  hoursWorked?: number
  clockInTime?: string
}

export function AttendanceHeatmap({ events, days = 30 }: AttendanceHeatmapProps) {
  // Build date → events map
  const eventsByDate = new Map<string, ClockEvent[]>()
  events.forEach((ev) => {
    const dateKey = ev.timestamp.split('T')[0]
    if (!eventsByDate.has(dateKey)) eventsByDate.set(dateKey, [])
    eventsByDate.get(dateKey)!.push(ev)
  })

  // Generate day cells for last `days` days, ending today
  const cells: DayCell[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateKey = d.toISOString().split('T')[0]
    const dayEvents = eventsByDate.get(dateKey) || []
    const clockIns = dayEvents.filter((e) => e.event_type === 'clock_in')
    const clockOuts = dayEvents.filter((e) => e.event_type === 'clock_out')

    let status: DayCell['status'] = 'absent'
    let hoursWorked: number | undefined
    let clockInTime: string | undefined

    if (clockIns.length > 0) {
      const firstClockIn = new Date(clockIns[0].timestamp)
      const hour = firstClockIn.getHours()
      const minute = firstClockIn.getMinutes()
      status = hour > 9 || (hour === 9 && minute > 15) ? 'late' : 'present'
      clockInTime = firstClockIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })

      if (clockOuts.length > 0) {
        const lastClockOut = new Date(clockOuts[clockOuts.length - 1].timestamp)
        hoursWorked = Math.round((lastClockOut.getTime() - firstClockIn.getTime()) / (1000 * 60 * 60) * 10) / 10
      }
    }

    cells.push({ date: d, status, hoursWorked, clockInTime })
  }

  // Group into weeks (columns)
  const weeks: DayCell[][] = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }

  const statusColor = (status: DayCell['status']) => {
    switch (status) {
      case 'present': return '#10B981'
      case 'late': return '#F59E0B'
      case 'absent': return '#EF4444'
      default: return '#F1F0F4'
    }
  }

  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  return (
    <div className="bg-white rounded-2xl border border-[#C7C3D0] p-6 shadow-sm">
      <h3 className="text-[13px] font-black text-[#1A1727] uppercase tracking-widest mb-4">Attendance Heatmap</h3>
      <div className="flex gap-1 overflow-x-auto pb-2">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((cell, di) => (
              <div
                key={di}
                className="w-5 h-5 rounded-sm cursor-pointer transition-transform hover:scale-110"
                style={{ backgroundColor: statusColor(cell.status), opacity: cell.status === 'present' && cell.hoursWorked ? Math.min(1, 0.4 + (cell.hoursWorked / 10) * 0.6) : 1 }}
                title={`${cell.date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}\nStatus: ${cell.status}${cell.clockInTime ? `\nClock-in: ${cell.clockInTime}` : ''}${cell.hoursWorked ? `\nHours: ${cell.hoursWorked}h` : ''}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-3">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#10B981' }} />
          <span className="text-[10px] font-bold text-[#6B6578]">Present</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#F59E0B' }} />
          <span className="text-[10px] font-bold text-[#6B6578]">Late</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#EF4444' }} />
          <span className="text-[10px] font-bold text-[#6B6578]">Absent</span>
        </div>
      </div>
    </div>
  )
}
