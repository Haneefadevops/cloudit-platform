'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { EventCardData } from '@/components/ui-touchorbit'
import { Users, Loader2 } from 'lucide-react'

interface Employee {
  id: string
  first_name: string | null
  last_name: string | null
}

interface MultiEmployeeViewProps {
  startDate: string
  endDate: string
  employeeIds: string[]
}

export function MultiEmployeeView({ startDate, endDate, employeeIds }: MultiEmployeeViewProps) {
  const { organizationId, isLoaded } = useAuth()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<{
    employees: Employee[]
    by_employee: Record<string, any[]>
  } | null>(null)

  useEffect(() => {
    if (!isLoaded || !organizationId || employeeIds.length === 0) return
    fetchData()
  }, [isLoaded, organizationId, startDate, endDate, employeeIds.join(',')])

  async function fetchData() {
    setLoading(true)
    try {
      const url = `/api/calendar/multi-employee?startDate=${startDate}&endDate=${endDate}&${employeeIds.map(id => `employeeId=${id}`).join('&')}`
      const res = await fetch(url)
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const dates: Date[] = []
  const start = new Date(startDate)
  const end = new Date(endDate)
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(new Date(d))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-[#9CA3AF]">
        <Loader2 size={20} className="animate-spin mr-2" />
        <span className="text-xs font-bold">Loading multi-employee view...</span>
      </div>
    )
  }

  if (!data || data.employees.length === 0) {
    return (
      <div className="text-center py-12">
        <Users size={32} className="mx-auto text-[#D1D5DB] mb-2" />
        <p className="text-xs font-bold text-[#9CA3AF]">No employees selected</p>
      </div>
    )
  }

  const typeColors: Record<string, string> = {
    meeting: 'bg-purple-100 text-purple-800 border-purple-200',
    training: 'bg-orange-100 text-orange-800 border-orange-200',
    company_event: 'bg-violet-100 text-violet-800 border-violet-200',
    holiday: 'bg-red-100 text-red-800 border-red-200',
    leave: 'bg-blue-100 text-blue-800 border-blue-200',
    shift: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    birthday: 'bg-pink-100 text-pink-800 border-pink-200',
  }

  return (
    <div className="bg-white rounded-[24px] border border-[#F1F0F4] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#F8F7F9]/50 border-b border-[#F1F0F4]">
              <th className="px-4 py-3 text-left text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest sticky left-0 bg-[#F8F7F9] z-10 w-48 border-r border-[#F1F0F4]">
                Employee
              </th>
              {dates.map((date, i) => (
                <th key={i} className="px-3 py-3 text-center min-w-[140px] border-r border-[#F1F0F4] last:border-r-0">
                  <div className="text-[9px] font-black text-[#9CA3AF] uppercase tracking-wider">
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div className="text-sm font-bold text-[#1A1727]">{date.getDate()}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F8F7F9]">
            {data.employees.map(emp => {
              const empEvents = data.by_employee[emp.id] || []
              return (
                <tr key={emp.id} className="hover:bg-[#F8F7F9]/50 transition-colors">
                  <td className="px-4 py-3 sticky left-0 bg-white z-10 border-r border-[#F1F0F4]">
                    <div className="font-bold text-[#1A1727] text-sm">
                      {emp.first_name} {emp.last_name}
                    </div>
                  </td>
                  {dates.map((date, i) => {
                    const dateStr = date.toISOString().split('T')[0]
                    const dayEvents = empEvents.filter((e: any) => {
                      const start = e.start_at ? e.start_at.slice(0, 10) : e.event_date
                      const end = e.end_at ? e.end_at.slice(0, 10) : e.event_date
                      return dateStr >= start && dateStr <= end
                    })
                    return (
                      <td key={i} className="px-2 py-2 border-r border-[#F8F7F9] last:border-r-0 align-top">
                        <div className="space-y-1">
                          {dayEvents.slice(0, 3).map((e: any, idx: number) => (
                            <div
                              key={idx}
                              className={`text-[9px] font-black px-2 py-1 rounded-lg border truncate ${
                                typeColors[e.event_type] || typeColors[e.type] || 'bg-gray-100 text-gray-800 border-gray-200'
                              }`}
                              title={e.title}
                            >
                              {e.title}
                            </div>
                          ))}
                          {dayEvents.length > 3 && (
                            <div className="text-[8px] font-bold text-[#9CA3AF] text-center">
                              +{dayEvents.length - 3} more
                            </div>
                          )}
                          {dayEvents.length === 0 && (
                            <div className="text-[8px] font-bold text-[#D1D5DB] text-center py-2">—</div>
                          )}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
