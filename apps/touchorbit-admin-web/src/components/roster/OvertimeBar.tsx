'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { Clock } from 'lucide-react'

interface OvertimeBarProps {
  employeeId: string
  weekStart: string
  maxHours?: number
}

export function OvertimeBar({ employeeId, weekStart, maxHours = 40 }: OvertimeBarProps) {
  const { organizationId } = useAuth()
  const [hours, setHours] = useState<{ scheduled: number; overtime: number; total: number } | null>(null)

  useEffect(() => {
    if (!organizationId || !employeeId || !weekStart) return
    fetchHours()
  }, [organizationId, employeeId, weekStart])

  async function fetchHours() {
    try {
      const { data, error } = await supabase.rpc('get_employee_weekly_hours', {
        p_employee_id: employeeId,
        p_week_start: weekStart,
      })
      if (error) { console.error(error); return }
      if (data && data.length > 0) {
        setHours({
          scheduled: Number(data[0].scheduled_hours ?? 0),
          overtime: Number(data[0].overtime_hours ?? 0),
          total: Number(data[0].total_hours ?? 0),
        })
      }
    } catch (e) { console.error(e) }
  }

  if (!hours) return null

  const pct = Math.min((hours.total / maxHours) * 100, 100)
  const color = hours.total >= maxHours ? 'bg-red-500' : hours.total >= maxHours * 0.8 ? 'bg-amber-500' : 'bg-emerald-500'
  const textColor = hours.total >= maxHours ? 'text-red-600' : hours.total >= maxHours * 0.8 ? 'text-amber-600' : 'text-emerald-600'

  return (
    <div className="mt-1.5">
      <div className="flex items-center justify-between text-[9px] font-bold mb-0.5">
        <span className={`flex items-center gap-1 ${textColor}`}>
          <Clock size={8} />
          {hours.total.toFixed(1)}h
        </span>
        <span className="text-[#D1D5DB]">of {maxHours}h</span>
      </div>
      <div className="w-full h-1 bg-[#F1F0F4] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
