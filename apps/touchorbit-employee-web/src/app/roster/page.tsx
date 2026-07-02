'use client'

import { useEffect, useState, useRef } from 'react'
import { EmployeeLayout } from '@/components/employee-layout'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'
import { 
  CalendarDays, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Coffee,
  ArrowRight,
  Lock,
  ShieldCheck,
  History,
  Send,
  X,
  RefreshCw,
  AlertTriangle,
  Check,
  Flag,
  ShoppingBag,
  Globe
} from 'lucide-react'
import { toast } from 'sonner'
import { PullToRefresh } from '@/components/ui-touchorbit'
import { AvailabilitySetter } from '@/components/roster/AvailabilitySetter'
import { ShiftMarketplace } from '@/components/roster/ShiftMarketplace'

interface RosterEntry {
  id?: string
  employee_id: string
  date: string | null
  shift_name: string | null
  start_time: string | null
  end_time: string | null
  break_minutes: number | null
  notes: string | null
}

interface ClockEvent {
  event_type: 'clock_in' | 'clock_out'
  timestamp: string
}

interface SwapRequest {
  id: string
  requester_employee_id: string
  target_employee_id: string | null
  requester_date: string
  target_date: string
  status: 'pending' | 'claimed' | 'approved' | 'rejected'
  created_at: string
  target?: { first_name: string, last_name: string }
  requester?: { first_name: string, last_name: string }
  claimer?: { first_name: string, last_name: string }
}

export default function EmployeeRosterPage() {
  const { userId, isLoaded, isSignedIn, organizationId } = useAuth()
  
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const d = new Date()
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust to Monday
    const monday = new Date(d.setDate(diff))
    monday.setHours(0, 0, 0, 0)
    return monday
  })

  const [myRoster, setMyRoster] = useState<RosterEntry[]>([])
  const [clockEvents, setClockEvents] = useState<ClockEvent[]>([])
  const [weekStatus, setWeekStatus] = useState<'draft' | 'published' | 'locked'>('draft')
  const [mySwaps, setMySwaps] = useState<SwapRequest[]>([])
  const [allEmployees, setAllEmployees] = useState<{id: string, first_name: string, last_name: string}[]>([])
  const [employeeId, setEmployeeId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  
  const [showSwapModal, setShowSwapModal] = useState(false)
  const [submittingSwap, setSubmittingSwap] = useState(false)
  const [swapForm, setSwapForm] = useState({
    requester_date: '',
    requester_shift_name: '',
    target_employee_id: '',
    target_date: '',
    is_open: false
  })
  const [openSwaps, setOpenSwaps] = useState<SwapRequest[]>([])

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentWeekStart)
    d.setDate(d.getDate() + i)
    return d
  })

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      loadMyRoster()
    }
  }, [isLoaded, isSignedIn, currentWeekStart])

  function splitName(fullName?: string | null) {
    if (!fullName) return { first_name: '', last_name: '' }
    const parts = fullName.trim().split(/\s+/)
    return { first_name: parts[0] || '', last_name: parts.slice(1).join(' ') || '' }
  }

  async function loadMyRoster() {
    setLoading(true)
    try {
      const { data: employee } = await supabase.from('employees').select('id, organization_id').eq('user_id', userId).single()
      if (!employee) { setLoading(false); return }
      setEmployeeId(employee.id)

      const weekStartStr = currentWeekStart.toISOString().split('T')[0]
      const nextWeekStartStr = new Date(currentWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      const rosterRes = await api.get<(RosterEntry & { id?: string; shift_id?: string | null; employee_id: string })[]>(`/roster/week?week_start=${weekStartStr}`)
      if (!rosterRes.ok) throw new Error(rosterRes.error)
      setMyRoster((rosterRes.data || []).filter(r => r.employee_id === employee.id))

      const { data: events, error: eventsError } = await supabase.from('clock_events').select('event_type, timestamp').eq('employee_id', employee.id).gte('timestamp', weekStartStr).lt('timestamp', nextWeekStartStr).order('timestamp', { ascending: true })
      if (eventsError) throw eventsError
      setClockEvents(events || [])

      const statusRes = await api.get<{ status: string }>(`/roster/week-status?week_start=${weekStartStr}`)
      if (!statusRes.ok) throw new Error(statusRes.error)
      setWeekStatus((statusRes.data?.status as 'draft' | 'published' | 'locked') || 'draft')

      const swapsRes = await api.get<(SwapRequest & { requester_name?: string; target_name?: string; claimed_name?: string })[]>('/shift-swaps')
      if (!swapsRes.ok) throw new Error(swapsRes.error)
      const allSwaps = (swapsRes.data || []).map(s => ({
        ...s,
        requester: splitName(s.requester_name),
        target: splitName(s.target_name),
        claimer: splitName(s.claimed_name),
      }))

      const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      setMySwaps(allSwaps.filter(s =>
        (s.requester_employee_id === employee.id || s.target_employee_id === employee.id) &&
        new Date(s.created_at) >= thirtyDaysAgo
      ))

      setOpenSwaps(allSwaps.filter(s =>
        s.target_employee_id === null &&
        s.status === 'pending' &&
        s.requester_employee_id !== employee.id
      ))

      const { data: colleagues } = await supabase.from('employees').select('id, first_name, last_name').eq('organization_id', organizationId).neq('id', employee.id).is('termination_date', null).order('first_name')
      setAllEmployees(colleagues || [])
    } catch (error) { toast.error('Failed to load schedule') } finally { setLoading(false) }
  }

  const handleAcknowledge = async (dateStr: string) => {
    try {
      const { data: employee } = await supabase.from('employees').select('id').eq('user_id', userId).single()
      if (!employee) return
      await supabase.rpc('acknowledge_roster_assignment', {
        p_employee_id: employee.id,
        p_date: dateStr,
        p_status: 'acknowledged'
      })
      toast.success('Shift acknowledged')
      loadMyRoster()
    } catch {
      toast.error('Failed to acknowledge')
    }
  }

  const handleFlagConflict = async (dateStr: string) => {
    try {
      const { data: employee } = await supabase.from('employees').select('id').eq('user_id', userId).single()
      if (!employee) return
      await supabase.rpc('acknowledge_roster_assignment', {
        p_employee_id: employee.id,
        p_date: dateStr,
        p_status: 'flagged'
      })
      toast.success('Conflict flagged')
      loadMyRoster()
    } catch {
      toast.error('Failed to flag')
    }
  }

  const handleClaimSwap = async (swapId: string) => {
    if (!employeeId) return
    try {
      const res = await api.post(`/shift-swaps/${swapId}/claim`, { claimer_employee_id: employeeId })
      if (!res.ok) throw new Error(res.error)
      toast.success('Swap claimed!')
      loadMyRoster()
    } catch {
      toast.error('Failed to claim swap')
    }
  }

  const handleSubmitSwap = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmittingSwap(true)
    try {
      if (!employeeId) throw new Error('Employee not loaded')
      const assignment = myRoster.find(r => r.date === swapForm.requester_date)
      if (!assignment?.id) throw new Error('No roster assignment found for selected date')

      const body: Record<string, unknown> = {
        requesting_employee_id: employeeId,
        roster_assignment_id: assignment.id,
        requested_employee_id: swapForm.is_open ? undefined : swapForm.target_employee_id,
      }
      if (swapForm.target_date) {
        // TODO: backend shift-swap create does not yet accept a custom target_date
        body.target_date = swapForm.target_date
      }

      const res = await api.post('/shift-swaps', body)
      if (!res.ok) throw new Error(res.error)
      toast.success('Swap request sent')
      setShowSwapModal(false)
      loadMyRoster()
    } catch (error: any) {
      toast.error(error.message || 'Request failed')
    } finally {
      setSubmittingSwap(false)
    }
  }

  const navigateWeek = (direction: number) => {
    const newDate = new Date(currentWeekStart); newDate.setDate(newDate.getDate() + direction * 7); setCurrentWeekStart(newDate)
  }

  // Touch swipe for week nav
  const touchStartX = useRef(0)
  const touchDeltaX = useRef(0)
  const weekContainerRef = useRef<HTMLDivElement>(null)
  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX }
  const handleTouchMove = (e: React.TouchEvent) => { touchDeltaX.current = e.touches[0].clientX - touchStartX.current }
  const handleTouchEnd = () => {
    if (touchDeltaX.current > 60) navigateWeek(-1)
    else if (touchDeltaX.current < -60) navigateWeek(1)
    touchDeltaX.current = 0
  }

  const formatTimeStr = (time: string | null) => {
    if (!time) return ''
    const [h, m] = time.split(':'); const hour = parseInt(h); const ampm = hour >= 12 ? 'PM' : 'AM'; const h12 = hour % 12 || 12
    return `${h12}:${m} ${ampm}`
  }

  const formatTimestamp = (ts: string | null) => {
    if (!ts) return ''
    return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }

  const getDayAdherence = (dateStr: string, rosterEntry: RosterEntry | undefined) => {
    if (!rosterEntry?.shift_name) return null
    const dayEvents = clockEvents.filter(e => e.timestamp.startsWith(dateStr))
    const firstIn = dayEvents.find(e => e.event_type === 'clock_in')
    const lastOut = [...dayEvents].reverse().find(e => e.event_type === 'clock_out')
    if (!firstIn) return { status: 'absent' }
    const scheduledStart = rosterEntry.start_time!; const scheduledEnd = rosterEntry.end_time!
    const [sh, sm] = scheduledStart.split(':').map(Number); const [eh, em] = scheduledEnd.split(':').map(Number)
    const actualIn = new Date(firstIn.timestamp); const inHour = actualIn.getHours(); const inMin = actualIn.getMinutes()
    const isLate = (inHour * 60 + inMin) > (sh * 60 + sm + 5)
    let isEarly = false
    if (lastOut) {
      const actualOut = new Date(lastOut.timestamp); const outHour = actualOut.getHours(); const outMin = actualOut.getMinutes()
      isEarly = (outHour * 60 + outMin) < (eh * 60 + em - 5)
    }
    if (isLate && isEarly) return { status: 'late_early', inTime: firstIn.timestamp, outTime: lastOut?.timestamp }
    if (isLate) return { status: 'late', inTime: firstIn.timestamp }
    if (isEarly) return { status: 'early_departure', outTime: lastOut?.timestamp }
    return { status: 'on_time', inTime: firstIn.timestamp }
  }

  return (
    <EmployeeLayout showGreeting={false} title="Schedule">
      <PullToRefresh onRefresh={loadMyRoster} className="min-h-screen">
      <div className="flex flex-col min-h-screen bg-[#F8F7F9] font-['Plus_Jakarta_Sans'] pb-24"
        ref={weekContainerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="bg-[#1E1854] px-4 pt-4 pb-12">
           <div className="flex justify-between items-center mb-8">
              <span className="text-white font-extrabold text-lg uppercase tracking-wider">Work Schedule</span>
              <CalendarDays className="text-white/60" size={20} />
           </div>

           <div className="bg-white/10 rounded-[24px] p-6 border border-white/5 flex items-center justify-between">
              <button onClick={() => navigateWeek(-1)} className="p-3 bg-white/10 rounded-xl text-white hover:bg-white/20 transition-all"><ChevronLeft size={20} strokeWidth={3} /></button>
              <div className="text-center">
                 <div className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-1.5">Operational Week</div>
                 <div className="text-[15px] font-black text-white">{currentWeekStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} — {new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                 <div className="mt-3 flex justify-center gap-2">
                    {weekStatus === 'locked' && <span className="bg-gray-500 text-white px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest flex items-center gap-1"><Lock size={10} /> Locked</span>}
                    {weekStatus === 'published' && <span className="bg-emerald-500 text-white px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest flex items-center gap-1"><ShieldCheck size={10} /> Published</span>}
                 </div>
              </div>
              <button onClick={() => navigateWeek(1)} className="p-3 bg-white/10 rounded-xl text-white hover:bg-white/20 transition-all"><ChevronRight size={20} strokeWidth={3} /></button>
           </div>
        </div>

        <div className="px-4 -mt-6 flex-1 space-y-6">
           <div className="bg-white rounded-t-[32px] min-h-full border-t border-[#F1F0F4] p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.04)]">
              {loading ? (
                <div className="py-20 text-center text-[#9CA3AF] animate-pulse font-black text-[10px] uppercase tracking-widest">Compiling Roster...</div>
              ) : (
                <div className="space-y-4">
                  {weekDays.map((day, idx) => {
                    const dateStr = day.toISOString().split('T')[0]
                    const entry = myRoster.find(r => r.date === dateStr)
                    const isToday = new Date().toISOString().split('T')[0] === dateStr
                    const adherence = getDayAdherence(dateStr, entry)

                    return (
                      <div key={idx} className={`rounded-[24px] border transition-all ${entry?.shift_name ? isToday ? 'bg-[#534AB7] border-[#534AB7] text-white shadow-xl shadow-purple-900/20' : 'bg-[#F8F7F9] border-[#F1F0F4]' : 'bg-white border-dashed border-[#D1D5DB] opacity-60'}`}>
                        <div className="p-4 flex items-center gap-5">
                           <div className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center font-black ${entry?.shift_name ? isToday ? 'bg-white/20 text-white' : 'bg-white text-[#1A1727] shadow-sm' : 'bg-gray-100 text-[#9CA3AF]'}`}>
                              <div className="text-[9px] uppercase">{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                              <div className="text-lg leading-none">{day.getDate()}</div>
                           </div>
                           
                           <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-center mb-1">
                                 <h4 className={`text-[15px] font-black ${isToday ? 'text-white' : 'text-[#1A1727]'}`}>{entry?.shift_name || 'Day Off'}</h4>
                                 {entry?.shift_name && day > new Date() && weekStatus !== 'locked' && (
                                   <button onClick={() => { setSwapForm({ requester_date: dateStr, requester_shift_name: entry.shift_name!, target_employee_id: '', target_date: dateStr, is_open: false }); setShowSwapModal(true); }} className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all active:scale-90 ${isToday ? 'bg-white/10 border-white/20 text-white' : 'bg-white border-[#F1F0F4] text-[#534AB7]'}`}>Swap</button>
                                 )}
                              </div>
                              
                              {entry?.shift_name ? (
                                <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-medium ${isToday ? 'text-white/70' : 'text-[#9CA3AF]'}`}>
                                   <div className="flex items-center gap-1.5"><Clock size={12} strokeWidth={2.5} /> {formatTimeStr(entry.start_time)} - {formatTimeStr(entry.end_time)}</div>
                                   {entry.break_minutes && entry.break_minutes > 0 && <div className="flex items-center gap-1.5"><Coffee size={12} strokeWidth={2.5} /> {entry.break_minutes}m</div>}
                                </div>
                              ) : <div className="text-[11px] italic font-medium text-[#9CA3AF]">Rest day</div>}

                              {adherence && (
                                <div className={`mt-2 text-[10px] font-black uppercase tracking-wider ${isToday ? 'text-white' : adherence.status === 'absent' ? 'text-red-500' : adherence.status === 'on_time' ? 'text-emerald-500' : 'text-amber-500'}`}>
                                   {adherence.status === 'on_time' && `Arrived ${formatTimestamp(adherence.inTime!)} · On time`}
                                   {adherence.status === 'late' && `Arrived ${formatTimestamp(adherence.inTime!)} · Late`}
                                   {adherence.status === 'early_departure' && `Left ${formatTimestamp(adherence.outTime!)} · Early`}
                                   {adherence.status === 'late_early' && `Late In · Early Out`}
                                   {adherence.status === 'absent' && `No clock-in recorded`}
                                </div>
                              )}

                              {/* Acknowledgment buttons for published rosters */}
                              {weekStatus === 'published' && entry?.shift_name && (
                                <div className="mt-3 flex gap-2">
                                  <button
                                    onClick={() => handleAcknowledge(dateStr)}
                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all active:scale-90 ${isToday ? 'bg-emerald-500/20 border-emerald-300/30 text-emerald-100' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}
                                  >
                                    <Check size={10} /> Acknowledge
                                  </button>
                                  <button
                                    onClick={() => handleFlagConflict(dateStr)}
                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all active:scale-90 ${isToday ? 'bg-red-500/20 border-red-300/30 text-red-100' : 'bg-red-50 border-red-200 text-red-700'}`}
                                  >
                                    <Flag size={10} /> Flag Conflict
                                  </button>
                                </div>
                              )}
                           </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Open Marketplace */}
              <div className="mt-10">
                <ShiftMarketplace swaps={openSwaps} onClaim={handleClaimSwap} />
              </div>

              {/* Swaps History */}
              {mySwaps.length > 0 && (
                <div className="mt-10 space-y-4">
                   <h3 className="text-[12px] font-black text-[#1A1727] uppercase tracking-wider flex items-center gap-2"><History size={16} /> My Exchanges</h3>
                   <div className="space-y-3">
                      {mySwaps.map(swap => (
                        <div key={swap.id} className="p-4 bg-[#F8F7F9] rounded-[24px] border border-[#F1F0F4] flex items-center justify-between shadow-sm">
                           <div>
                              <div className="text-[11px] font-black text-[#1A1727] flex items-center gap-2">
                                 {swap.requester?.first_name} <ArrowRight size={10} /> {swap.target?.first_name}
                              </div>
                              <div className="text-[10px] font-bold text-[#9CA3AF] uppercase mt-1 tracking-tighter">{new Date(swap.requester_date).toLocaleDateString('en-GB', {day:'2-digit', month:'short'})} ↔ {new Date(swap.target_date).toLocaleDateString('en-GB', {day:'2-digit', month:'short'})}</div>
                           </div>
                           <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${swap.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : swap.status === 'claimed' ? 'bg-purple-100 text-purple-700' : swap.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{swap.status}</span>
                        </div>
                      ))}
                   </div>
                </div>
              )}

              {/* Availability Setter */}
              <div className="mt-10">
                <AvailabilitySetter />
              </div>
           </div>
        </div>

        {/* Swipe hint */}
        <div className="text-center py-2 text-[9px] font-bold text-[#D1D5DB] uppercase tracking-widest">Swipe to change week</div>

        {/* Swap Modal */}
        {showSwapModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#1A1727]/60 backdrop-blur-sm animate-in fade-in duration-200">
             <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 border border-[#F1F0F4]">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-xl font-black text-[#1A1727] tracking-tight">Request Swap</h2>
                  <button onClick={() => setShowSwapModal(false)} className="p-2 text-[#9CA3AF] hover:text-[#1A1727] transition-all"><X size={20} strokeWidth={2.5} /></button>
                </div>
                <form onSubmit={handleSubmitSwap} className="space-y-6">
                   <div className="p-4 bg-[#F3E8FF] rounded-2xl border border-purple-100">
                      <div className="text-[10px] font-black text-[#534AB7] uppercase tracking-widest mb-1">Your Shift</div>
                      <div className="text-sm font-bold text-[#1A1727]">{new Date(swapForm.requester_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} — {swapForm.requester_shift_name}</div>
                   </div>
                   {!swapForm.is_open && (
                     <div>
                        <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Swap With</label>
                        <select required={!swapForm.is_open} value={swapForm.target_employee_id} onChange={e => setSwapForm({...swapForm, target_employee_id: e.target.value})} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none">
                           <option value="">Select a colleague...</option>
                           {allEmployees.map(emp => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>)}
                        </select>
                     </div>
                   )}
                   <div>
                      <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Proposed Swap Date</label>
                      <input type="date" required value={swapForm.target_date} onChange={e => setSwapForm({...swapForm, target_date: e.target.value})} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none" />
                   </div>
                   <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-2xl border border-purple-100 cursor-pointer" onClick={() => setSwapForm(f => ({ ...f, is_open: !f.is_open }))}>
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${swapForm.is_open ? 'bg-[#534AB7] border-[#534AB7]' : 'border-[#D1D5DB]'}`}>
                        {swapForm.is_open && <Check size={12} className="text-white" strokeWidth={3} />}
                      </div>
                      <div className="flex items-center gap-2">
                        <Globe size={14} className="text-purple-600" />
                        <span className="text-[11px] font-bold text-purple-700">Open to anyone in the organization</span>
                      </div>
                   </div>
                   <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-3">
                      <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                      <p className="text-[10px] text-amber-800 font-bold leading-relaxed uppercase tracking-tight">Shift swaps require manager approval once confirmed by both parties.</p>
                   </div>
                   <button type="submit" disabled={submittingSwap} className="w-full py-4 bg-[#534AB7] text-white rounded-2xl font-black text-[13px] uppercase tracking-widest shadow-xl shadow-purple-900/30 active:scale-95 transition-all flex items-center justify-center gap-2">
                      {submittingSwap ? 'Processing...' : <><Send size={14} /> Send Proposal</>}
                   </button>
                </form>
             </div>
          </div>
        )}
      </div>
      </PullToRefresh>
    </EmployeeLayout>
  )
}
