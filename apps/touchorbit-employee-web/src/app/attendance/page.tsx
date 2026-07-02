'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'
import { 
  Check, 
  X, 
  Calendar as CalendarIcon, 
  MapPin, 
  ChevronRight,
  AlertCircle,
  Coffee,
  Clock,
  Square
} from 'lucide-react'
import { toast } from 'sonner'
import { useAutoLinkEmployee } from '@/hooks/use-auto-link-employee'
import { EmployeeLayout } from '@/components/employee-layout'
import { useClockStatus } from '@/hooks/use-clock-status'
import { useBreakTracker } from '@/hooks/use-break-tracker'
import { PullToRefresh } from '@/components/ui-touchorbit'

interface ClockEvent {
  id: string
  event_type: 'clock_in' | 'clock_out'
  timestamp: string
  location_verified: boolean
  selfie_url: string | null
}

interface BreakEvent {
  id: string
  clock_event_id: string
  break_start: string
  break_end: string | null
  break_type: 'break' | 'lunch' | 'other'
  duration_minutes: number | null
}

interface DayStats {
  date: string
  clockIn: string | null
  clockOut: string | null
  hours: number
  netHours: number
  status: 'present' | 'late' | 'absent'
  locationVerified: boolean
  breakMinutes: number
  breaks: BreakEvent[]
}

export default function AttendancePage() {
  const { userId, isLoaded, isSignedIn, organizationId } = useAuth()
  const { isLinking, isLinked } = useAutoLinkEmployee()
  const { isClockedIn, todayEvents } = useClockStatus()
  const currentClockEventId = isClockedIn && todayEvents.length > 0
    ? todayEvents[todayEvents.length - 1]?.id
    : null
  const { isOnBreak, todayBreakEvents } = useBreakTracker(currentClockEventId)
  const [events, setEvents] = useState<ClockEvent[]>([])
  const [breakEvents, setBreakEvents] = useState<BreakEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState('')
  const [monthStats, setMonthStats] = useState({ present: 0, late: 0, absent: 0 })

  useEffect(() => {
    if (!selectedMonth) setSelectedMonth(new Date().toISOString().slice(0, 7))
  }, [])

  useEffect(() => {
    if (isLoaded && isSignedIn && isLinked && selectedMonth) {
      loadAttendance()
    }
  }, [isLoaded, isSignedIn, isLinked, selectedMonth])

  async function loadAttendance() {
    setLoading(true)
    const { data: employee } = await supabase.from('employees').select('id').eq('user_id', userId).single()
    if (!employee) {
      setLoading(false)
      return
    }

    const startOfMonth = `${selectedMonth}-01`
    const endOfMonth = new Date(selectedMonth + '-01')
    endOfMonth.setMonth(endOfMonth.getMonth() + 1)
    endOfMonth.setDate(0)
    const endDate = endOfMonth.toISOString().split('T')[0]

    const [eventsResult, breaksResult] = await Promise.all([
      api.get<any[]>(`/attendance?employee_id=${employee.id}&from=${encodeURIComponent(startOfMonth)}&to=${encodeURIComponent(endDate + 'T23:59:59')}&limit=500`),
      api.get<any[]>('/attendance/break-events'),
    ])

    const data = eventsResult.ok ? eventsResult.data || [] : []
    const breaksData = breaksResult.ok
      ? (breaksResult.data || []).filter((b: any) =>
          b.employee_id === employee.id &&
          b.break_start >= startOfMonth &&
          b.break_start <= endDate + 'T23:59:59'
        )
      : []

    if (!eventsResult.ok) {
      console.error('Error loading clock events:', eventsResult.error)
      toast.error('Failed to load attendance')
    } else {
      setEvents(data)
    }
    if (!breaksResult.ok) {
      console.error('Error loading break events:', breaksResult.error)
    } else {
      setBreakEvents(breaksData)
    }

    // Calculate month stats
    const eventsByDate = new Map<string, ClockEvent[]>()
    ;(data || []).forEach((event: ClockEvent) => {
      const date = event.timestamp.split('T')[0]
      if (!eventsByDate.has(date)) eventsByDate.set(date, [])
      eventsByDate.get(date)!.push(event)
    })

    let present = 0, late = 0, absent = 0
    const year = parseInt(selectedMonth.split('-')[0])
    const month = parseInt(selectedMonth.split('-')[1]) - 1
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const todayStr = new Date().toISOString().split('T')[0]

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const dateObj = new Date(dateStr)
      const dayOfWeek = dateObj.getDay()
      if (dayOfWeek === 0 || dayOfWeek === 6) continue
      if (dateStr > todayStr) continue

      const dayEvents = eventsByDate.get(dateStr) || []
      const clockIn = dayEvents.find(e => e.event_type === 'clock_in')

      if (!clockIn) {
        absent++
      } else {
        const clockInTime = new Date(clockIn.timestamp)
        if (clockInTime.getHours() > 9 || (clockInTime.getHours() === 9 && clockInTime.getMinutes() > 15)) {
          late++
        } else {
          present++
        }
      }
    }
    setMonthStats({ present, late, absent })
    setLoading(false)
  }

  // Group events and breaks by date
  const eventsByDate = new Map<string, ClockEvent[]>()
  events.forEach(event => {
    const date = event.timestamp.split('T')[0]
    if (!eventsByDate.has(date)) eventsByDate.set(date, [])
    eventsByDate.get(date)!.push(event)
  })

  const breaksByDate = new Map<string, BreakEvent[]>()
  breakEvents.forEach(b => {
    const date = b.break_start.split('T')[0]
    if (!breaksByDate.has(date)) breaksByDate.set(date, [])
    breaksByDate.get(date)!.push(b)
  })

  // duration_minutes is a DB-generated column; fall back to client calculation if null
  const breakMins = (b: BreakEvent) =>
    b.duration_minutes != null
      ? b.duration_minutes
      : b.break_end
        ? Math.round((new Date(b.break_end).getTime() - new Date(b.break_start).getTime()) / 60000)
        : 0

  // Process events into daily stats
  const dailyStats: DayStats[] = []

  const year = parseInt(selectedMonth.split('-')[0])
  const month = parseInt(selectedMonth.split('-')[1]) - 1
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day).toISOString().split('T')[0]
    const dayEvents = eventsByDate.get(date) || []
    const clockIn = dayEvents.find(e => e.event_type === 'clock_in')
    const clockOut = dayEvents.find(e => e.event_type === 'clock_out')
    const dayBreaks = breaksByDate.get(date) || []
    const breakMinutes = dayBreaks.reduce((sum, b) => sum + breakMins(b), 0)
    let status: 'present' | 'late' | 'absent' = 'absent'
    let hours = 0
    let netHours = 0
    if (clockIn) {
      const clockInTime = new Date(clockIn.timestamp)
      if (clockInTime.getHours() > 9 || (clockInTime.getHours() === 9 && clockInTime.getMinutes() > 15)) status = 'late'
      else status = 'present'
      if (clockOut) hours = (new Date(clockOut.timestamp).getTime() - clockInTime.getTime()) / (1000 * 60 * 60)
      else if (date === new Date().toISOString().split('T')[0]) hours = (new Date().getTime() - clockInTime.getTime()) / (1000 * 60 * 60)
      netHours = Math.max(0, hours - breakMinutes / 60)
    }
    const today = new Date().toISOString().split('T')[0]
    if (date <= today) {
      dailyStats.push({
        date,
        clockIn: clockIn?.timestamp || null,
        clockOut: clockOut?.timestamp || null,
        hours,
        netHours,
        status: clockIn ? status : 'absent',
        locationVerified: clockIn?.location_verified || false,
        breakMinutes,
        breaks: dayBreaks,
      })
    }
  }

  // Today's status
  const todayStr = new Date().toISOString().split('T')[0]
  const todayClockIn = todayEvents.find(e => e.event_type === 'clock_in')
  let todayStatus: 'present' | 'late' | 'not clocked in' = 'not clocked in'
  if (todayClockIn) {
    const t = new Date(todayClockIn.timestamp)
    if (t.getHours() > 9 || (t.getHours() === 9 && t.getMinutes() > 15)) todayStatus = 'late'
    else todayStatus = 'present'
  }

  // Today's break status — live from useBreakTracker (polls every 10s, stays in sync with dashboard)
  const todayBreaks = todayBreakEvents
  const todayTotalBreakMinutes = todayBreaks.reduce((sum, b) => sum + breakMins(b), 0)

  if (!isLoaded || isLinking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#534AB7]"></div>
      </div>
    )
  }

  return (
    <EmployeeLayout showGreeting={false} title="Attendance" hideHeader>
      <PullToRefresh onRefresh={loadAttendance} className="min-h-screen">
      <div className="flex flex-col min-h-screen bg-[#F8F7F9] font-['Plus_Jakarta_Sans'] pb-24">

        {/* Purple Header */}
        <div className="bg-[#1E1854] px-4 pt-4 pb-12">
          <div className="flex justify-between items-center mb-4">
            <span className="text-white font-extrabold text-lg">Attendance</span>
            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
              isOnBreak ? 'bg-amber-400/20 text-amber-400 border border-amber-400/30' :
              todayStatus === 'present' ? 'bg-emerald-400/20 text-emerald-400 border border-emerald-400/30' :
              todayStatus === 'late' ? 'bg-amber-400/20 text-amber-400 border border-amber-400/30' :
              'bg-red-400/20 text-red-400 border border-red-400/30'
            }`}>
              {isOnBreak ? 'On Break' : todayStatus === 'not clocked in' ? 'Not Clocked In' : todayStatus}
            </span>
          </div>

          {/* Month selector + stats */}
          <div className="flex items-center justify-between bg-white/10 rounded-2xl p-3 border border-white/5 mb-4">
            <button onClick={() => setSelectedMonth(new Date(year, month - 1).toISOString().slice(0, 7))}>
              <ChevronRight size={20} className="text-white/40 rotate-180" />
            </button>
            <span className="text-white font-bold text-sm">
              {new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={() => setSelectedMonth(new Date(year, month + 1).toISOString().slice(0, 7))}>
              <ChevronRight size={20} className="text-white/40" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Present', value: monthStats.present, color: '#10B981' },
              { label: 'Late', value: monthStats.late, color: '#F59E0B' },
              { label: 'Absent', value: monthStats.absent, color: '#EF4444' },
            ].map(s => (
              <div key={s.label} className="bg-white/10 rounded-xl p-2.5 text-center border border-white/5">
                <div className="text-lg font-black text-white">{s.value}</div>
                <div className="text-[9px] font-bold text-white/50 uppercase tracking-wider mt-0.5">{s.label}</div>
                <div className="h-0.5 w-6 mx-auto mt-2 rounded-full" style={{ backgroundColor: s.color }} />
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-4 -mt-6 flex-1">
          <div className="bg-white rounded-t-[32px] min-h-full border-t border-[#F1F0F4] p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.04)]">

            {/* Today's Timeline */}
            {todayEvents.length > 0 && (
              <div className="mb-6">
                <h3 className="text-[13px] font-black text-[#1A1727] uppercase tracking-wider mb-4">Today's Timeline</h3>
                <div className="space-y-0 relative">
                  <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-[#F1F0F4]" />
                  {(() => {
                    const clockInEvent = todayEvents.find(e => e.event_type === 'clock_in')
                    const clockOutEvent = todayEvents.find(e => e.event_type === 'clock_out')
                    const hasClockOut = !!clockOutEvent

                    if (!clockInEvent) return null

                    type Step = {
                      label: string
                      time: string | null
                      done: boolean
                      pulse?: boolean
                      color: string
                      icon: any
                      subtext?: string
                      noIcon?: boolean
                    }

                    const steps: Step[] = []

                    // 1. Clock In
                    steps.push({
                      label: 'Clock In',
                      time: clockInEvent.timestamp,
                      done: true,
                      color: '#059669',
                      icon: Check,
                    })

                    // 2. First Work period (clock-in → first break OR clock-out if no breaks)
                    const hasAnyBreak = todayBreaks.length > 0
                    const firstBreak = todayBreaks[0]
                    const firstWorkDone = hasClockOut || (hasAnyBreak && !!firstBreak?.break_start)
                    const firstWorkActive = isClockedIn && !hasClockOut && !isOnBreak && !hasAnyBreak
                    steps.push({
                      label: 'Work',
                      time: clockInEvent.timestamp,
                      done: firstWorkDone,
                      pulse: firstWorkActive,
                      color: '#F59E0B',
                      icon: Clock,
                      subtext: firstWorkActive ? 'In progress' : undefined,
                    })

                    // 3. For each break: On → duration row → Off → Work
                    todayBreaks.forEach((b, idx) => {
                      const isLastBreak = idx === todayBreaks.length - 1
                      const nextBreak = todayBreaks[idx + 1]

                      // Break On
                      steps.push({
                        label: 'Break',
                        time: b.break_start,
                        done: !!b.break_end,
                        pulse: !b.break_end,
                        color: '#F59E0B',
                        icon: Coffee,
                        subtext: 'On',
                      })

                      // Duration row (noIcon) — final duration if ended, elapsed if active
                      if (b.break_end) {
                        steps.push({
                          label: '',
                          time: null,
                          done: true,
                          color: '#F59E0B',
                          icon: null as any,
                          subtext: `${breakMins(b)}m break`,
                          noIcon: true,
                        })
                      } else {
                        const minsSoFar = Math.floor((Date.now() - new Date(b.break_start).getTime()) / 60000)
                        steps.push({
                          label: '',
                          time: null,
                          done: false,
                          pulse: true,
                          color: '#F59E0B',
                          icon: null as any,
                          subtext: `${minsSoFar}m`,
                          noIcon: true,
                        })
                      }

                      // Break Off + following Work — only if break has ended
                      if (b.break_end) {
                        steps.push({
                          label: 'Break',
                          time: b.break_end,
                          done: true,
                          color: '#F59E0B',
                          icon: Square,
                          subtext: 'Off',
                        })

                        // Work after this break
                        // Done if: clocked out OR another break has started after this one
                        const workAfterDone = hasClockOut || (!isLastBreak && !!nextBreak?.break_start)
                        const workAfterActive = isLastBreak && isClockedIn && !hasClockOut && !isOnBreak
                        steps.push({
                          label: 'Work',
                          time: b.break_end,
                          done: workAfterDone,
                          pulse: workAfterActive,
                          color: '#F59E0B',
                          icon: Clock,
                          subtext: workAfterActive ? 'In progress' : undefined,
                        })
                      }
                    })

                    // 4. Clock Out
                    steps.push({
                      label: 'Clock Out',
                      time: clockOutEvent?.timestamp || null,
                      done: hasClockOut,
                      color: '#534AB7',
                      icon: X,
                    })

                    return steps.map((step, i) => (
                      <div key={`${step.label}-${i}`} className="flex items-start gap-3 relative z-10">
                        {step.noIcon ? (
                          <div className="flex flex-col items-center w-4">
                            <div className="w-0.5 h-4 bg-[#F1F0F4]" />
                            {i < steps.length - 1 && <div className="w-0.5 h-8 bg-[#F1F0F4] mt-1" />}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center">
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${step.done ? 'border-current' : 'border-[#E5E3EA]'}`}
                              style={{ color: step.done ? step.color : undefined, backgroundColor: step.done ? step.color + '20' : '#F8F7F9' }}>
                              {step.done && <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: step.color }} />}
                              {step.pulse && <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
                            </div>
                            {i < steps.length - 1 && <div className="w-0.5 h-8 bg-[#F1F0F4] mt-1" />}
                          </div>
                        )}
                        <div className="pb-6">
                          {step.label && <div className="text-[12px] font-black text-[#1A1727]">{step.label}</div>}
                          {step.time && <div className="text-[11px] text-[#9CA3AF] font-bold">{new Date(step.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}</div>}
                          {step.subtext && <div className={`text-[11px] font-bold ${step.pulse ? 'text-amber-500' : step.done ? 'text-amber-600' : 'text-[#D1D5DB]'}`}>{step.subtext}</div>}
                          {!step.done && !step.pulse && !step.subtext && !step.noIcon && <div className="text-[11px] text-[#D1D5DB] font-bold">Not yet</div>}
                        </div>
                      </div>
                    ))
                  })()}
                </div>
                {todayTotalBreakMinutes > 0 && (
                  <div className="mt-2 px-3 py-2 bg-amber-50 rounded-xl border border-amber-100">
                    <div className="text-[11px] font-bold text-amber-700">
                      Total break time today: {Math.floor(todayTotalBreakMinutes / 60)}h {todayTotalBreakMinutes % 60}m
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Monthly History */}
            <div>
              <h3 className="text-[13px] font-black text-[#1A1727] uppercase tracking-wider mb-4">Recent History</h3>
              <div className="space-y-2">
                {loading ? (
                  <div className="py-10 text-center text-[#9CA3AF] text-sm font-medium">Loading history...</div>
                ) : dailyStats.slice(0, 10).length === 0 ? (
                  <div className="py-10 text-center text-[#9CA3AF] text-sm font-medium">No records for this period</div>
                ) : dailyStats.slice(0, 10).map((day) => {
                  const statusColors = {
                    present: { bg: '#ECFDF5', color: '#059669' },
                    late:    { bg: '#FFFBEB', color: '#D97706' },
                    absent:  { bg: '#FFF5F5', color: '#E53E3E' },
                  }
                  const s = statusColors[day.status]
                  return (
                    <div key={day.date} className="flex items-center gap-3 px-3 py-3 bg-[#F8F7F9] rounded-2xl border border-[#F1F0F4]">
                      <div className="w-11 h-11 rounded-xl flex flex-col items-center justify-center flex-shrink-0" style={{ backgroundColor: day.status === 'absent' ? '#F1F0F4' : '#EDE9FE' }}>
                        <div className="text-[9px] font-bold uppercase" style={{ color: day.status === 'absent' ? '#9994A8' : '#534AB7' }}>
                          {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                        <div className="text-[15px] font-black" style={{ color: day.status === 'absent' ? '#9994A8' : '#1A1727' }}>
                          {new Date(day.date + 'T00:00:00').getDate()}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[13px] font-semibold" style={{ color: '#1A1727' }}>
                            {day.clockIn ? new Date(day.clockIn).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }) : 'No Record'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase" style={{ backgroundColor: s.bg, color: s.color }}>
                            {day.status}
                          </span>
                        </div>
                        <div className="text-[11px]" style={{ color: '#9994A8' }}>
                          {day.hours > 0
                            ? `${day.netHours.toFixed(1)}h net${day.breakMinutes > 0 ? ` (${day.breakMinutes}m break)` : ''}`
                            : 'No record'
                          }
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

          </div>
        </div>
      </div>
      </PullToRefresh>
    </EmployeeLayout>
  )
}
