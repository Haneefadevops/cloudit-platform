'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, useMemo } from 'react'

interface MiniCalendarProps {
  currentDate: Date
  onDateSelect: (date: Date) => void
  highlightDates?: string[] // ISO date strings to highlight
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function MiniCalendar({ currentDate, onDateSelect, highlightDates = [] }: MiniCalendarProps) {
  const [viewDate, setViewDate] = useState(new Date(currentDate))

  // Sync viewDate when currentDate changes significantly
  const currentMonthKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}`
  const viewMonthKey = `${viewDate.getFullYear()}-${viewDate.getMonth()}`

  const highlightSet = useMemo(() => new Set(highlightDates), [highlightDates])

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfMonth = new Date(year, month, 1).getDay()

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  const days: (number | null)[] = []
  for (let i = 0; i < firstDayOfMonth; i++) days.push(null)
  for (let d = 1; d <= daysInMonth; d++) days.push(d)

  const isToday = (d: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    return dateStr === todayStr
  }

  const isSelected = (d: number) => {
    return d === currentDate.getDate() && month === currentDate.getMonth() && year === currentDate.getFullYear()
  }

  const hasHighlight = (d: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    return highlightSet.has(dateStr)
  }

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1))
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1))

  return (
    <div className="bg-white rounded-2xl border border-[#F1F0F4] p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-black text-[#1A1727]">{MONTHS[month]} {year}</span>
        <div className="flex items-center gap-0.5">
          <button onClick={prevMonth} className="p-1 rounded-lg hover:bg-[#F8F7F9] text-[#9CA3AF] transition-all">
            <ChevronLeft size={14} strokeWidth={2.5} />
          </button>
          <button onClick={nextMonth} className="p-1 rounded-lg hover:bg-[#F8F7F9] text-[#9CA3AF] transition-all">
            <ChevronRight size={14} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center text-[9px] font-black text-[#D1D5DB] uppercase tracking-wider py-1">
            {d}
          </div>
        ))}
        {days.map((day, i) => (
          <button
            key={i}
            onClick={() => day !== null && onDateSelect(new Date(year, month, day))}
            disabled={day === null}
            className={`
              aspect-square flex items-center justify-center rounded-lg text-[10px] font-bold transition-all
              ${day === null ? 'invisible' : ''}
              ${isSelected(day!) ? 'bg-[#534AB7] text-white shadow-sm' : ''}
              ${!isSelected(day!) && isToday(day!) ? 'bg-purple-50 text-[#534AB7] border border-[#534AB7]/20' : ''}
              ${!isSelected(day!) && !isToday(day!) ? 'text-[#374151] hover:bg-[#F8F7F9]' : ''}
            `}
          >
            <span className="relative">
              {day}
              {hasHighlight(day!) && !isSelected(day!) && (
                <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#534AB7]" />
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
