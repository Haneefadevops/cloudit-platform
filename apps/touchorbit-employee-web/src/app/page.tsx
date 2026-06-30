'use client'

import { useEffect, useState } from 'react'
import { EmployeeLayout } from '@/components/employee-layout'
import { FlaggedPunchBanner } from '@/components/flagged-punch-banner'
import { BreakTracker } from '@/components/break-tracker'
import { HoursCounter } from '@/components/hours-counter'
import { AnnouncementsFeed } from '@/components/announcements-feed'
import { ClockInButton } from '@/components/clock-in-button'
import { useAuth } from '@/lib/auth'
import { useClockStatus } from '@/hooks/use-clock-status'
import { useBreakTracker } from '@/hooks/use-break-tracker'
import { supabase } from '@/lib/supabase'
import { calculateHours } from '@/lib/utils'
import { Umbrella, Receipt, Coffee, ChevronRight, MapPin, Calendar, Gift } from 'lucide-react'
import Link from 'next/link'
import { PullToRefresh } from '@/components/ui-touchorbit'

const TARGET_HOURS = 8.5

export default function EmployeeDashboard() {
  const { organizationId, userId, isLoaded } = useAuth()
  const { isClockedIn, todayEvents } = useClockStatus()
  const [employee, setEmployee] = useState<any>(null)
  const [compOffBalance, setCompOffBalance] = useState(0)
  const [upcomingHolidays, setUpcomingHolidays] = useState<any[]>([])
  const [mounted, setMounted] = useState(false)
  const [workedHours, setWorkedHours] = useState(0)

  const currentClockEventId = isClockedIn && todayEvents.length > 0
    ? todayEvents[todayEvents.length - 1]?.id
    : null
  const { isOnBreak, todayBreakMinutes, todayBreakEvents, currentBreak } = useBreakTracker(currentClockEventId)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Calculate worked hours for progress bar (subtract break time)
  useEffect(() => {
    const calcWorkedHours = () => {
      let total = 0
      for (let i = 0; i < todayEvents.length; i++) {
        const event = todayEvents[i]
        if (event.event_type === 'clock_in') {
          const next = todayEvents[i + 1]
          if (next && next.event_type === 'clock_out') {
            total += calculateHours(event.timestamp, next.timestamp)
            i++
          } else if (isClockedIn && i === todayEvents.length - 1) {
            total += calculateHours(event.timestamp)
          }
        }
      }
      // Subtract break time (convert minutes to hours)
      const breakHours = todayBreakMinutes / 60
      total = Math.max(0, total - breakHours)
      setWorkedHours(total)
    }
    calcWorkedHours()
    if (isClockedIn) {
      const id = setInterval(calcWorkedHours, 1000)
      return () => clearInterval(id)
    }
  }, [todayEvents, isClockedIn, todayBreakMinutes])

  // Get first clock in time
  const clockInEvent = todayEvents.find(e => e.event_type === 'clock_in')
  // Hydration safety: use placeholder until mounted to match server
  const clockInTime = mounted && clockInEvent 
    ? new Date(clockInEvent.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) 
    : '—'

  const progressPct = Math.min(100, Math.round((workedHours / TARGET_HOURS) * 100))

  useEffect(() => {
    if (isLoaded && organizationId && userId) {
      loadData()
    }
  }, [isLoaded, organizationId, userId])

  const loadData = async () => {
    try {
      const { data: emp } = await supabase
        .from('employees')
        .select('*')
        .eq('user_id', userId)
        .single()
      setEmployee(emp)

      if (emp) {
        const { data: compOff } = await supabase
          .from('comp_off_records')
          .select('id')
          .eq('employee_id', emp.id)
          .eq('status', 'approved')
        setCompOffBalance(compOff?.length || 0)
      }

      const { data: holidays } = await supabase
        .from('holidays')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true })
        .limit(2)
      setUpcomingHolidays(holidays || [])
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    }
  }

  const quickActions = [
    { icon: Coffee,   label: 'Break',   color: '#F59E0B', isBreak: true },
    { icon: Umbrella, label: 'Leave',   color: '#3B82F6', href: '/leave' },
    { icon: Receipt,  label: 'Expense', color: '#8B5CF6', href: '/expenses' },
  ]

  return (
    <EmployeeLayout>
      <FlaggedPunchBanner />
      <PullToRefresh onRefresh={loadData} className="pb-24">
      <div className="p-4 space-y-4">
        {/* Working Hours Card — always visible */}
        <div
          className="rounded-[32px] p-6 text-white relative overflow-hidden shadow-2xl shadow-purple-900/20"
          style={{ background: 'linear-gradient(135deg, #1E1854, #534AB7)' }}
        >
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white opacity-5" />
          <div className="absolute -bottom-16 -right-5 w-40 h-40 rounded-full bg-white opacity-5" />
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="text-[11px] font-black text-white/50 uppercase tracking-[0.1em] mb-1">Working Hours Today</div>
              <div className="text-4xl font-black tracking-tighter"><HoursCounter /></div>
              <div className="text-xs font-medium text-white/60 mt-1">
                {isOnBreak
                  ? `On break — started at ${currentBreak ? new Date(currentBreak.break_start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '—'}`
                  : isClockedIn
                    ? `Clocked in at ${clockInTime}${todayBreakMinutes > 0 ? ` • ${Math.round(todayBreakMinutes)}m break` : ''}`
                    : 'Not clocked in yet'
                }
              </div>
            </div>
            <div className="text-right">
              <div className={`px-3 py-1.5 rounded-xl flex items-center gap-2 mb-3 border ${
                isOnBreak ? 'bg-amber-400/20 border-amber-400/30 text-amber-400' :
                isClockedIn ? 'bg-emerald-400/20 border-emerald-400/30 text-emerald-400' :
                'bg-orange-400/20 border-orange-400/30 text-orange-400'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${
                  isOnBreak ? 'bg-amber-400 animate-pulse' :
                  isClockedIn ? 'bg-emerald-400 animate-pulse' :
                  'bg-orange-400'
                }`} />
                <span className="text-[11px] font-black uppercase tracking-widest">
                  {isOnBreak ? 'On Break' : isClockedIn ? 'Working' : 'Offline'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 justify-end text-white/40">
                <MapPin size={10} strokeWidth={2.5} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Main Branch</span>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex justify-between mb-1.5">
              <span className="text-[9.5px] font-bold text-white/40 uppercase tracking-wider">Progress to {TARGET_HOURS}h target</span>
              <span className="text-[9.5px] font-bold text-white/60">{progressPct}%</span>
            </div>
            <div className="h-1.5 bg-white/15 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-400 rounded-full transition-all duration-700" 
                style={{ width: `${progressPct}%` }} 
              />
            </div>
          </div>
        </div>

        {/* Clock In / Clock Out button — directly under main card */}
        <div className="flex flex-col items-center">
          <ClockInButton />
        </div>

        {/* Quick Actions — Break, Leave, Expense */}
        <div className="grid grid-cols-3 gap-3">
          {quickActions.map((a) => (
            a.isBreak ? (
              <div key={a.label} className="flex flex-col items-center gap-2">
                <div className="w-full aspect-square bg-white rounded-2xl border border-[#F1F0F4] flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-sm">
                  <BreakTracker currentClockEventId={currentClockEventId} isClockedIn={isClockedIn} />
                </div>
                <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">{a.label}</span>
              </div>
            ) : (
              <Link key={a.label} href={a.href!} className="flex flex-col items-center gap-2">
                <div className="w-full aspect-square bg-white rounded-2xl border border-[#F1F0F4] flex items-center justify-center transition-all active:scale-90 shadow-sm">
                  <a.icon size={22} style={{ color: a.color }} strokeWidth={2} />
                </div>
                <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">{a.label}</span>
              </Link>
            )
          ))}
        </div>

        {/* Comp-Off + Calendar quick cards */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/calendar" className="bg-gradient-to-br from-[#1E1854] to-[#534AB7] rounded-2xl p-4 text-white shadow-lg relative overflow-hidden active:scale-[0.97] transition-all">
            <Gift className="absolute -right-2 -top-2 w-14 h-14 opacity-10 rotate-12" />
            <p className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-1">Comp-Off</p>
            <h3 className="text-2xl font-black">{compOffBalance} Days</h3>
            <div className="flex items-center mt-2 text-[10px] text-white/50 font-bold">
              View Calendar <ChevronRight className="w-3 h-3 ml-1" />
            </div>
          </Link>
          <Link href="/calendar" className="bg-white rounded-2xl p-4 border border-[#F1F0F4] shadow-sm relative overflow-hidden active:scale-[0.97] transition-all">
            <Calendar className="absolute -right-2 -top-2 w-14 h-14 text-[#F1F0F4] rotate-12" />
            <p className="text-[#9CA3AF] text-[10px] font-black uppercase tracking-widest mb-1">
              {upcomingHolidays.length > 0 ? 'Next Holiday' : 'My Calendar'}
            </p>
            {upcomingHolidays.length > 0 ? (
              <>
                <p className="text-sm font-black text-[#1A1727] truncate">{upcomingHolidays[0].name}</p>
                <p className="text-[10px] text-[#9CA3AF] font-bold mt-1">{new Date(upcomingHolidays[0].date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
              </>
            ) : (
              <p className="text-sm font-black text-[#1A1727]">Open Calendar</p>
            )}
          </Link>
        </div>

        {/* Announcements Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[13px] font-black text-[#1A1727] uppercase tracking-[0.1em]">Announcements</h2>
            <Link href="/announcements" className="text-[11px] font-black text-[#534AB7] uppercase tracking-widest flex items-center gap-1">
              View All <ChevronRight size={10} strokeWidth={3} />
            </Link>
          </div>
          <AnnouncementsFeed />
        </div>
      </div>
      </PullToRefresh>
    </EmployeeLayout>
  )
}
