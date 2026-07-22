'use client'

import { Clock, ChevronRight } from 'lucide-react'

interface Employee {
  id: string
  first_name: string
  last_name: string
  department: string | null
}

interface AdherenceEntry {
  employee_id: string
  date: string
  status: 'day_off' | 'absent' | 'on_time' | 'late' | 'early_departure' | 'late_early'
  actual_clock_in: string | null
  actual_clock_out: string | null
}

interface AdherenceViewProps {
  employees: Employee[]
  weekDays: Date[]
  adherenceData: AdherenceEntry[]
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const statusConfigs: Record<string, { label: string; color: string }> = {
  on_time: { label: 'On Time', color: 'bg-green-100 text-green-700' },
  late: { label: 'Late', color: 'bg-amber-100 text-amber-700' },
  late_early: { label: 'Late + Early Out', color: 'bg-amber-100 text-amber-700' },
  early_departure: { label: 'Early Out', color: 'bg-orange-100 text-orange-700' },
  absent: { label: 'Absent', color: 'bg-red-100 text-red-700' },
  day_off: { label: 'Off', color: 'bg-[#F8F7F9] text-[#9CA3AF]' }
}

function formatTimestamp(ts: string | null) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export function AdherenceView({ employees, weekDays, adherenceData }: AdherenceViewProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-[#F1F0F4] overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-[#F8F7F9]/50 border-b border-[#F1F0F4]">
            <th className="px-6 py-4 text-left text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest sticky left-0 bg-[#F8F7F9] z-10 w-64 border-r border-[#F1F0F4]">Employee</th>
            {weekDays.map((day, idx) => (
              <th key={idx} className="px-4 py-4 text-center min-w-[140px]">
                <div className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                <div className="text-sm font-bold text-[#1A1727]">{day.getDate()} {day.toLocaleDateString('en-US', { month: 'short' })}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {employees.map(emp => (
            <tr key={emp.id} className="hover:bg-[#F8F7F9]/50 transition-colors">
              <td className="px-6 py-4 sticky left-0 bg-white z-10 border-r border-[#F1F0F4]">
                <div className="font-bold text-[#1A1727]">{emp.first_name} {emp.last_name}</div>
                <div className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">{emp.department || 'No Dept'}</div>
              </td>
              {weekDays.map((day, idx) => {
                const dateStr = formatLocalDate(day)
                const entry = adherenceData.find(d => d.employee_id === emp.id && d.date === dateStr)
                if (!entry) return <td key={idx} className="px-2 py-3 border-r border-[#F8F7F9] text-center text-[#D1D5DB]">-</td>

                const config = statusConfigs[entry.status] || { label: '-', color: 'text-[#D1D5DB]' }

                return (
                  <td key={idx} className="px-2 py-3 border-r border-[#F8F7F9] last:border-r-0">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${config.color}`}>
                        {config.label}
                      </span>
                      {entry.actual_clock_in && (
                        <div className="text-[8px] font-bold text-[#9CA3AF] flex items-center gap-0.5">
                          <Clock className="w-2 h-2" />
                          {formatTimestamp(entry.actual_clock_in)}
                        </div>
                      )}
                      {entry.actual_clock_out && (
                        <div className="text-[8px] font-bold text-[#9CA3AF] flex items-center gap-0.5">
                          <ChevronRight className="w-2 h-2" />
                          {formatTimestamp(entry.actual_clock_out)}
                        </div>
                      )}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
