'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { Cake, Loader2 } from 'lucide-react'
import { BirthdayCard } from './BirthdayCard'

interface Birthday {
  employee_id: string
  employee_name: string
  department: string
  next_occurrence: string
  age: number
  days_until: number
}

export function UpcomingBirthdaysWidget() {
  const { organizationId } = useAuth()
  const [birthdays, setBirthdays] = useState<Birthday[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!organizationId) return
    loadBirthdays()
  }, [organizationId])

  async function loadBirthdays() {
    setLoading(true)
    try {
      const result = await api.get<Birthday[]>('/calendar-events/birthdays/upcoming?limit=5')
      if (!result.ok) throw new Error(result.error || 'Failed to load birthdays')
      setBirthdays(result.data || [])
    } catch {
      setBirthdays([])
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-[20px] border border-[#F1F0F4] shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Cake size={14} className="text-pink-500" />
          <h3 className="text-xs font-black text-[#1A1727] uppercase tracking-widest">Upcoming Birthdays</h3>
        </div>
        <div className="space-y-2 animate-pulse">
          {[1, 2].map(i => <div key={i} className="h-14 bg-[#F8F7F9] rounded-xl" />)}
        </div>
      </div>
    )
  }

  if (birthdays.length === 0) {
    return (
      <div className="bg-white rounded-[20px] border border-[#F1F0F4] shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <Cake size={14} className="text-pink-500" />
          <h3 className="text-xs font-black text-[#1A1727] uppercase tracking-widest">Upcoming Birthdays</h3>
        </div>
        <div className="text-center py-4 text-[11px] text-[#9CA3AF] font-medium">No upcoming birthdays</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-[20px] border border-[#F1F0F4] shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Cake size={14} className="text-pink-500" />
          <h3 className="text-xs font-black text-[#1A1727] uppercase tracking-widest">Upcoming Birthdays</h3>
        </div>
        <span className="text-[9px] font-black text-[#9CA3AF] uppercase tracking-widest">{birthdays.length} this month</span>
      </div>
      <div className="space-y-3">
        {birthdays.map(b => (
          <BirthdayCard
            key={b.employee_id}
            name={b.employee_name}
            department={b.department}
            age={b.age}
            date={b.next_occurrence}
          />
        ))}
      </div>
    </div>
  )
}
