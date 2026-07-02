'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { EmployeeLayout } from '@/components/employee-layout'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import {
  ChevronLeft, ChevronRight, Check, X, Clock, Coffee,
  CalendarDays, Video,
} from 'lucide-react'
import {
  CalendarGrid, CalendarDayCell,
  PillBadge, EmptyState,
  EventCard, EventCardData,
  EventDetailPanel,
  BottomSheet,
  PullToRefresh,
} from '@/components/ui-touchorbit'
import { RescheduleRequestForm } from '@/components/calendar/RescheduleRequestForm'
import { EventActions, TaskForm, TaskFormData } from '@/components/ui-touchorbit'
import { MyTasks } from '@/components/calendar/MyTasks'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface LeaveRecord {
  id: string; start_date: string; end_date: string; leave_type: string; status: string
}
interface Holiday { id: string; name: string; date: string; type: 'public' | 'company' | 'restricted' }
interface Training { id: string; training_name: string; start_date: string; end_date: string }
interface ClockEvent { id: string; event_type: 'clock_in' | 'clock_out'; timestamp: string }
interface CalendarEvent {
  id: string
  title: string
  event_type: string
  start_time: string
  end_time: string | null
  all_day: boolean
  meeting_url: string | null
  description: string | null
  location: string | null
}

type CalendarViewMode = 'month' | 'week'

export default function EmployeeCalendarPage() {
  const { organizationId, userId, isLoaded } = useAuth()
  const [currentDate, setCurrentDate] = useState<Date | null>(null)
  const [leaveRecords, setLeaveRecords] = useState<LeaveRecord[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [trainings, setTrainings] = useState<Training[]>([])
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [employeeId, setEmployeeId] = useState<string | null>(null)
  const [todayLogs, setTodayLogs] = useState<ClockEvent[]>([])
  const [monthStats, setMonthStats] = useState({ present: 0, absent: 0, late: 0, leave: 0 })
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month')
  const [isMobile, setIsMobile] = useState(false)

  // Swipe week view state
  const [weekStart, setWeekStart] = useState<Date | null>(null)
  const weekStripRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef(0)
  const touchDeltaX = useRef(0)

  useEffect(() => {
    setCurrentDate(new Date())
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (currentDate) {
      const d = new Date(currentDate)
      const day = d.getDay()
      const diff = d.getDate() - day + (day === 0 ? -6 : 1)
      const monday = new Date(d.setDate(diff))
      monday.setHours(0, 0, 0, 0)
      setWeekStart(monday)
    }
  }, [currentDate])

  const currentYear = currentDate ? currentDate.getFullYear() : 0
  const currentMonth = currentDate ? currentDate.getMonth() : 0

  useEffect(() => {
    if (isLoaded && organizationId && userId) loadEmployeeInfo()
  }, [isLoaded, organizationId, userId])

  useEffect(() => {
    if (employeeId && organizationId && currentDate) {
      loadData()
      loadTodayLogs()
      loadMonthStats()
    }
  }, [employeeId, organizationId, currentYear, currentMonth])

  const loadEmployeeInfo = async () => {
    try {
      const result = await api.get<any>('/employees/me')
      if (result.ok && result.data) setEmployeeId(result.data.id)
    } catch (e) { console.error(e) }
  }

  const loadData = async () => {
    if (!currentDate || !employeeId) return
    setLoading(true)
    try {
      const lastDay = new Date(currentYear, currentMonth + 1, 0)
      const firstDayStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`
      const lastDayStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`

      const [holidaysRes, leaveRes, trainingRes, calRes] = await Promise.all([
        api.get<Holiday[]>(`/holidays?start=${firstDayStr}&end=${lastDayStr}`),
        api.get<LeaveRecord[]>(`/leave/requests?employee_id=${employeeId}&status=approved&from=${firstDayStr}&to=${lastDayStr}`),
        api.get<Training[]>(`/training/employee/${employeeId}?start=${firstDayStr}&end=${lastDayStr}`),
        api.get<CalendarEvent[]>(`/calendar-events/employee/${employeeId}/events?start=${firstDayStr}&end=${lastDayStr}`),
      ])
      setHolidays(holidaysRes.data || [])
      setLeaveRecords(leaveRes.data || [])
      setTrainings(trainingRes.data || [])
      setCalendarEvents((calRes.data || []) as CalendarEvent[])
    } catch (e) {
      console.error(e)
      toast.error('Failed to load calendar data')
    } finally {
      setLoading(false)
    }
  }

  const loadMonthStats = async () => {
    if (!employeeId || !currentDate) return
    try {
      const lastDay = new Date(currentYear, currentMonth + 1, 0)
      const firstDayStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`
      const lastDayStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`
      const todayStr = new Date().toISOString().split('T')[0]

      const [clockRes, leaveRes, holidayRes] = await Promise.all([
        api.get<ClockEvent[]>(`/attendance?employee_id=${employeeId}&from=${firstDayStr}&to=${lastDayStr}&limit=10000`),
        api.get<LeaveRecord[]>(`/leave/requests?employee_id=${employeeId}&status=approved&from=${firstDayStr}&to=${lastDayStr}`),
        api.get<Holiday[]>(`/holidays?start=${firstDayStr}&end=${lastDayStr}`),
      ])

      const events = (clockRes.data || []) as ClockEvent[]
      const eventsByDate = new Map<string, ClockEvent[]>()
      events.forEach(ev => {
        const date = ev.timestamp.split('T')[0]
        if (!eventsByDate.has(date)) eventsByDate.set(date, [])
        eventsByDate.get(date)!.push(ev)
      })

      const leaveRecs = (leaveRes.data || []) as LeaveRecord[]
      const hols = (holidayRes.data || []) as Holiday[]
      const holidaySet = new Set(hols.map(h => h.date))

      let present = 0, absent = 0, late = 0, leaveCount = 0
      const daysInMonth = lastDay.getDate()

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        const dateObj = new Date(dateStr)
        const dayOfWeek = dateObj.getDay()
        if (dayOfWeek === 0 || dayOfWeek === 6) continue
        if (dateStr > todayStr) continue
        if (holidaySet.has(dateStr)) continue

        const onLeave = leaveRecs.some(r => {
          const s = new Date(r.start_date); const e = new Date(r.end_date)
          return dateObj >= s && dateObj <= e
        })
        if (onLeave) { leaveCount++; continue }

        const dayEvents = eventsByDate.get(dateStr) || []
        const clockIn = dayEvents.find(e => e.event_type === 'clock_in')
        if (!clockIn) { absent++ }
        else {
          const t = new Date(clockIn.timestamp)
          if (t.getHours() > 9 || (t.getHours() === 9 && t.getMinutes() > 15)) late++
          else present++
        }
      }
      setMonthStats({ present, absent, late, leave: leaveCount })
    } catch (e) { console.error(e) }
  }

  const loadTodayLogs = async () => {
    if (!employeeId) return
    const today = new Date().toISOString().split('T')[0]
    const result = await api.get<ClockEvent[]>(`/attendance?employee_id=${employeeId}&from=${today}&to=${today}&limit=500`)
    setTodayLogs((result.data || []) as ClockEvent[])
  }

  const isDateInLeave = useCallback((date: Date) => {
    return leaveRecords.some(r => {
      const s = new Date(r.start_date); const e = new Date(r.end_date)
      return date >= s && date <= e
    })
  }, [leaveRecords])

  const isHoliday = useCallback((date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    return holidays.some(h => h.date === dateStr)
  }, [holidays])

  const isTraining = useCallback((date: Date) => {
    return trainings.some(t => {
      const s = new Date(t.start_date); const e = new Date(t.end_date)
      return date >= s && date <= e
    })
  }, [trainings])

  const getDayEvents = useCallback((date: Date) => {
    const evs: { id: string; type: any; title: string; allDay?: boolean; meetingUrl?: string }[] = []
    const dateStr = date.toISOString().split('T')[0]
    if (isHoliday(date)) {
      const h = holidays.find(x => x.date === dateStr)
      if (h) evs.push({ id: `hol-${h.id}`, type: 'holiday', title: h.name, allDay: true })
    }
    if (isDateInLeave(date)) evs.push({ id: `leave-${dateStr}`, type: 'leave', title: 'On Leave', allDay: true })
    if (isTraining(date)) evs.push({ id: `train-${dateStr}`, type: 'training', title: 'Training', allDay: true })

    // Add calendar events
    const dayCalEvents = calendarEvents.filter(ce => {
      const s = new Date(ce.start_time).toISOString().split('T')[0]
      const e = ce.end_time ? new Date(ce.end_time).toISOString().split('T')[0] : s
      return dateStr >= s && dateStr <= e
    })
    dayCalEvents.forEach(ce => {
      evs.push({
        id: `cal-${ce.id}`,
        type: ce.event_type || 'company_event',
        title: ce.title,
        allDay: ce.all_day,
        meetingUrl: ce.meeting_url || undefined,
      })
    })
    return evs
  }, [holidays, leaveRecords, trainings, calendarEvents, isHoliday, isDateInLeave, isTraining])

  const daysInMonth = currentDate ? new Date(currentYear, currentMonth + 1, 0).getDate() : 0
  const firstDayOfWeek = currentDate ? new Date(currentYear, currentMonth, 1).getDay() : 0
  const calendarDays: (number | null)[] = []
  for (let i = 0; i < (firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1); i++) calendarDays.push(null)
  for (let day = 1; day <= daysInMonth; day++) calendarDays.push(day)

  const stats = [
    { label: 'Present', value: String(monthStats.present), color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    { label: 'Absent', value: String(monthStats.absent), color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200' },
    { label: 'Late', value: String(monthStats.late), color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200' },
    { label: 'Leave', value: String(monthStats.leave), color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200' },
  ]

  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return []
    const evs = getDayEvents(selectedDate)
    return evs.map((e): EventCardData => ({
      id: e.id,
      title: e.title,
      type: e.type,
      allDay: e.allDay,
      meetingUrl: e.meetingUrl,
    }))
  }, [selectedDate, getDayEvents])

  const [selectedEvent, setSelectedEvent] = useState<EventCardData | null>(null)
  const [showRescheduleForm, setShowRescheduleForm] = useState(false)
  const [rsvpStatuses, setRsvpStatuses] = useState<Record<string, string>>({})
  const [showTaskDialog, setShowTaskDialog] = useState(false)

  const handleRsvp = (eventId: string, status: any) => {
    setRsvpStatuses(prev => ({ ...prev, [eventId]: status }))
  }

  const handleCreateTask = async (formData: TaskFormData) => {
    if (!organizationId || !userId) return
    try {
      const result = await api.post('/employee-tasks', {
        title: formData.title,
        description: formData.description || null,
        category: formData.category,
        due_date: formData.due_date || null,
        reminder_minutes: formData.reminder_minutes,
        is_recurring: formData.is_recurring,
        recurrence_rule: formData.recurrence_rule || null,
      })
      if (!result.ok) throw new Error(result.error || 'Failed to create task')
      toast.success('Task created')
      setShowTaskDialog(false)
    } catch (error: any) { toast.error(error.message) }
  }

  // Week strip helpers
  const weekDays = useMemo(() => {
    if (!weekStart) return []
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [weekStart])

  const navigateWeek = (dir: number) => {
    if (!weekStart) return
    const d = new Date(weekStart)
    d.setDate(d.getDate() + dir * 7)
    setWeekStart(d)
    setCurrentDate(d)
  }

  const handleWeekTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }
  const handleWeekTouchMove = (e: React.TouchEvent) => {
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current
  }
  const handleWeekTouchEnd = () => {
    if (touchDeltaX.current > 60) navigateWeek(-1)
    else if (touchDeltaX.current < -60) navigateWeek(1)
    touchDeltaX.current = 0
  }

  if (!currentDate) return null

  return (
    <EmployeeLayout showGreeting={false} title="Calendar" hideHeader>
      <PullToRefresh onRefresh={async () => {
        await loadData()
        await loadTodayLogs()
        await loadMonthStats()
      }} className="min-h-screen">
        <div className="flex flex-col min-h-screen bg-[#F8F7F9] font-['Plus_Jakarta_Sans']">

          {/* Header Section */}
          <div className="bg-[#1E1854] px-4 pt-4 pb-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-white font-extrabold text-lg">Calendar</span>
              <div className="flex items-center gap-2">
                {/* View toggle */}
                <div className="flex bg-white/10 rounded-lg p-0.5">
                  <button
                    onClick={() => setViewMode('month')}
                    className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${viewMode === 'month' ? 'bg-white text-[#1E1854]' : 'text-white/60'}`}
                  >Month</button>
                  <button
                    onClick={() => setViewMode('week')}
                    className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${viewMode === 'week' ? 'bg-white text-[#1E1854]' : 'text-white/60'}`}
                  >Week</button>
                </div>
                <div className="flex items-center gap-2 text-white/60">
                  <button onClick={() => {
                    if (viewMode === 'month') setCurrentDate(new Date(currentYear, currentMonth - 1))
                    else navigateWeek(-1)
                  }} className="p-1 hover:text-white transition-colors">
                    <ChevronLeft size={20} />
                  </button>
                  <span className="text-white font-bold text-sm min-w-[100px] text-center">
                    {viewMode === 'month' ? `${MONTHS[currentMonth]} ${currentYear}` : weekStart?.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                  </span>
                  <button onClick={() => {
                    if (viewMode === 'month') setCurrentDate(new Date(currentYear, currentMonth + 1))
                    else navigateWeek(1)
                  }} className="p-1 hover:text-white transition-colors">
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {stats.map(s => (
                <div key={s.label} className={`${s.bg} border ${s.border} rounded-xl p-2.5 text-center`}>
                  <div className={`text-lg font-black ${s.color}`}>{s.value}</div>
                  <div className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Swipeable Week Strip — shown in week view, or always on mobile */}
          {(viewMode === 'week' || isMobile) && weekStart && (
            <div
              ref={weekStripRef}
              className="bg-white px-2 py-4 border-b border-[#F1F0F4]"
              onTouchStart={handleWeekTouchStart}
              onTouchMove={handleWeekTouchMove}
              onTouchEnd={handleWeekTouchEnd}
            >
              <div className="flex justify-between items-center select-none">
                {weekDays.map((day, idx) => {
                  const isSelected = selectedDate ? day.toDateString() === selectedDate.toDateString() : false
                  const isToday = day.toDateString() === new Date().toDateString()
                  const dayEvents = getDayEvents(day)
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedDate(day)}
                      className={`flex flex-col items-center justify-center flex-1 py-2 mx-0.5 rounded-2xl transition-all active:scale-95 ${
                        isSelected ? 'bg-[#534AB7] text-white shadow-lg shadow-purple-900/20' : isToday ? 'bg-purple-50 text-[#534AB7]' : 'text-[#374151]'
                      }`}
                    >
                      <span className="text-[9px] font-black uppercase tracking-wider mb-1 opacity-70">
                        {day.toLocaleDateString('en-US', { weekday: 'narrow' })}
                      </span>
                      <span className="text-lg font-black leading-none">{day.getDate()}</span>
                      {dayEvents.length > 0 && (
                        <div className="flex gap-0.5 mt-1.5">
                          {dayEvents.slice(0, 3).map((_, i) => (
                            <div key={i} className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white/60' : 'bg-[#534AB7]'}`} />
                          ))}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
              {/* Swipe hint on first load */}
              <div className="text-center mt-1 text-[9px] font-bold text-[#D1D5DB] uppercase tracking-widest">Swipe to change week</div>
            </div>
          )}

          {/* Calendar Grid (month view) */}
          {viewMode === 'month' && (
            <div className="bg-white px-4 py-6 border-b border-[#F1F0F4]">
              {loading ? (
                <div className="animate-pulse grid grid-cols-7 gap-1">
                  {Array.from({ length: 35 }).map((_, i) => (
                    <div key={i} className="h-12 rounded-lg bg-[#F8F7F9] border border-[#F1F0F4]" />
                  ))}
                </div>
              ) : (
                <CalendarGrid view="month" currentDate={currentDate}>
                  {calendarDays.map((day, i) => {
                    if (day === null) return <div key={`e-${i}`} className="h-12" />
                    const date = new Date(currentYear, currentMonth, day)
                    const isT = day === new Date().getDate() && currentMonth === new Date().getMonth() && currentYear === new Date().getFullYear()
                    return (
                      <CalendarDayCell
                        key={day}
                        date={date}
                        isToday={isT}
                        events={getDayEvents(date)}
                        onClick={(d) => setSelectedDate(d)}
                        className="h-12 lg:h-14"
                      />
                    )
                  })}
                </CalendarGrid>
              )}
            </div>
          )}

          {/* Selected Date Details */}
          {selectedDate && (
            <div className="px-4 py-6 border-b border-[#F1F0F4] bg-white">
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs font-black text-[#374151] uppercase tracking-widest">
                  {selectedDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
                <button onClick={() => setSelectedDate(null)} className="p-1.5 text-[#9CA3AF] hover:text-[#1A1727] transition-colors">
                  <X size={16} strokeWidth={2.5} />
                </button>
              </div>
              {selectedDateEvents.length === 0 ? (
                <EmptyState title="No events" description="Nothing scheduled for this day." className="py-6" />
              ) : (
                <div className="space-y-2">
                  {selectedDateEvents.map(ev => (
                    <div key={ev.id} className="relative">
                      <EventCard event={ev} compact onClick={() => setSelectedEvent(ev)} />
                      {/* One-tap join meeting */}
                      {ev.meetingUrl && (
                        <a
                          href={ev.meetingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-[#534AB7] flex items-center justify-center text-white shadow-lg active:scale-90 transition-transform"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Video size={16} strokeWidth={2.5} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Daily Log Section */}
          <div className="flex-1 px-4 py-6">
            <div className="text-xs font-black text-[#374151] uppercase tracking-widest mb-6">
              Today · {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
            </div>

            <div className="space-y-6 relative">
              <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-[#F1F0F4]" />

              {todayLogs.length > 0 ? todayLogs.map((log, i) => (
                <div key={i} className="flex gap-4 relative z-10">
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 shadow-sm ${
                    log.event_type === 'clock_in' ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'
                  }`}>
                    {log.event_type === 'clock_in'
                      ? <Check size={14} className="text-emerald-500" strokeWidth={3} />
                      : <X size={14} className="text-red-500" strokeWidth={3} />
                    }
                  </div>
                  <div>
                    <div className="text-[13px] font-extrabold text-[#1A1727]">{log.event_type === 'clock_in' ? 'Clocked In' : 'Clocked Out'}</div>
                    <div className="text-[11px] font-medium text-[#9CA3AF]">Main Branch · GPS Verified</div>
                    <div className="text-[10px] font-black text-[#D1D5DB] mt-1 font-mono">
                      {new Date(log.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </div>
                  </div>
                </div>
              )) : (
                <div className="flex gap-4 relative z-10 opacity-50">
                  <div className="w-8 h-8 rounded-full bg-[#F8F7F9] border-2 border-[#F1F0F4] flex items-center justify-center shrink-0">
                    <Clock size={14} className="text-[#D1D5DB]" />
                  </div>
                  <div className="pt-1 text-xs font-bold text-[#9CA3AF] italic">No activity recorded for today yet.</div>
                </div>
              )}

              <div className="flex gap-4 relative z-10 opacity-40">
                <div className="w-8 h-8 rounded-full bg-[#F8F7F9] border-2 border-[#F1F0F4] flex items-center justify-center shrink-0">
                  <Coffee size={14} className="text-[#D1D5DB]" />
                </div>
                <div>
                  <div className="text-[13px] font-bold text-[#1A1727]">Scheduled End</div>
                  <div className="text-[11px] font-medium text-[#9CA3AF]">Expected 06:00 PM</div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Bottom Sheet for event details */}
          {isMobile ? (
            <BottomSheet
              open={!!selectedEvent}
              onClose={() => setSelectedEvent(null)}
              title={selectedEvent?.title}
            >
              {selectedEvent && (
                <div className="space-y-5 pt-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <PillBadge eventType={selectedEvent.type}>{selectedEvent.type.replace('_', ' ')}</PillBadge>
                    {selectedEvent.allDay && <PillBadge>All day</PillBadge>}
                  </div>

                  {selectedEvent.meetingUrl && (
                    <a
                      href={selectedEvent.meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-black text-sm uppercase tracking-widest bg-[#534AB7] text-white shadow-lg shadow-purple-900/20 active:scale-[0.98] transition-all"
                    >
                      <Video size={16} strokeWidth={2.5} />
                      Join Meeting
                    </a>
                  )}

                  <EventActions
                    rsvpStatus={(rsvpStatuses[selectedEvent.id] as any) || 'pending'}
                    onRsvp={(status) => handleRsvp(selectedEvent.id, status)}
                    onRescheduleRequest={() => setShowRescheduleForm(true)}
                    size="sm"
                  />
                </div>
              )}
            </BottomSheet>
          ) : (
            <EventDetailPanel
              event={selectedEvent}
              onClose={() => setSelectedEvent(null)}
            />
          )}

          {/* My Tasks Section */}
          <div className="px-4 py-6">
            <MyTasks onCreateTask={() => setShowTaskDialog(true)} />
          </div>

          {/* Reschedule Request Form */}
          <RescheduleRequestForm
            open={showRescheduleForm}
            onClose={() => setShowRescheduleForm(false)}
            eventTitle={selectedEvent?.title || ''}
            eventDate={selectedEvent?.startAt || new Date().toISOString()}
            onSubmit={async (data) => {
              console.log('Reschedule request:', data)
              setShowRescheduleForm(false)
            }}
          />

          {/* Task Form Modal */}
          <TaskForm
            open={showTaskDialog}
            onClose={() => setShowTaskDialog(false)}
            onSubmit={handleCreateTask}
          />
        </div>
      </PullToRefresh>
    </EmployeeLayout>
  )
}
