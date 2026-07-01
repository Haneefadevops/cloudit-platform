'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { Umbrella, Plus, X, ChevronRight, Calendar, ShieldCheck, Clock, Coffee, HeartPulse, Wallet } from 'lucide-react'
import { useAutoLinkEmployee } from '@/hooks/use-auto-link-employee'
import { EmployeeLayout } from '@/components/employee-layout'
import { toast } from 'sonner'
import { PullToRefresh } from '@/components/ui-touchorbit'

interface Employee {
  id: string
  organization_id: string
}

interface LeaveBalance {
  id: string
  leave_type: string
  year: number
  entitled_days: number
  used_days: number
  remaining_days: number
}

interface LeaveRequest {
  id: string
  leave_type: string
  start_date: string
  end_date: string
  days_count: number
  reason: string
  status: string
  created_at: string
  rejection_reason?: string
}

const leaveTypeConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  annual:   { label: 'Annual',   icon: Umbrella,   color: '#3B82F6' },
  casual:   { label: 'Casual',   icon: Coffee,     color: '#10B981' },
  sick:     { label: 'Sick',     icon: HeartPulse, color: '#EF4444' },
  unpaid:   { label: 'Unpaid',   icon: Wallet,     color: '#6B7280' },
}

const leaveTypeLabels: Record<string, string> = {
  annual: 'Annual Leave',
  casual: 'Casual Leave',
  sick: 'Sick Leave',
  comp_off: 'Comp Off',
  maternity: 'Maternity Leave',
  paternity: 'Paternity Leave',
  unpaid: 'Unpaid Leave',
}

export default function LeavePage() {
  const { isLoaded, isSignedIn } = useAuth()
  const { isLinked } = useAutoLinkEmployee()
  
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [balances, setBalances] = useState<LeaveBalance[]>([])
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showApplyForm, setShowApplyForm] = useState(false)

  // Form state
  const [leaveType, setLeaveType] = useState('annual')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (isLoaded && isSignedIn && isLinked) {
      loadLeaveData()
    }
  }, [isLoaded, isSignedIn, isLinked])

  async function loadLeaveData() {
    setLoading(true)
    try {
      const empResult = await api.get<Employee>('/employees/me')
      if (!empResult.ok || !empResult.data) throw new Error(empResult.error || 'Employee not found')
      const emp = empResult.data
      setEmployee(emp)

      const year = new Date().getFullYear()
      const [balResult, reqResult] = await Promise.all([
        api.get<LeaveBalance[]>(`/leave/balances/${emp.id}`),
        api.get<LeaveRequest[]>(`/leave/requests?employee_id=${emp.id}`),
      ])
      setBalances((balResult.data || []).filter((b) => b.year === year))
      setRequests(reqResult.data || [])
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Failed to load leave data')
    } finally {
      setLoading(false)
    }
  }

  const calcWeekdays = (start: string, end: string): number => {
    if (!start || !end) return 0
    const s = new Date(start + 'T00:00:00')
    const e = new Date(end + 'T00:00:00')
    if (e < s) return 0
    let count = 0
    const cur = new Date(s)
    while (cur <= e) {
      const day = cur.getDay()
      if (day !== 0 && day !== 6) count++
      cur.setDate(cur.getDate() + 1)
    }
    return Math.max(0, count)
  }

  const durationDays = useMemo(() => calcWeekdays(startDate, endDate), [startDate, endDate])

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!startDate || !endDate) { toast.error('Please select start and end dates'); return }
    if (new Date(endDate) < new Date(startDate)) { toast.error('End date cannot be before start date'); return }
    if (durationDays === 0) { toast.error('Selected range contains no working days'); return }
    if (!employee) { toast.error('Employee not found'); return }
    setSubmitting(true)
    try {
      const result = await api.post<LeaveRequest>('/leave/requests', {
        employee_id: employee.id,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        reason: reason,
      })

      if (!result.ok) throw new Error(result.error || 'Failed to submit application')
      toast.success('Leave application submitted')
      setShowApplyForm(false)
      setStartDate('')
      setEndDate('')
      setReason('')
      loadLeaveData()
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit application')
    } finally {
      setSubmitting(false)
    }
  }

  const stats = [
    { label: 'Annual',  value: balances.find(b => b.leave_type === 'annual')?.remaining_days || '0', color: '#3B82F6' },
    { label: 'Casual',  value: balances.find(b => b.leave_type === 'casual')?.remaining_days || '0', color: '#10B981' },
    { label: 'Sick',    value: balances.find(b => b.leave_type === 'sick')?.remaining_days || '0',   color: '#EF4444' },
    { label: 'Unpaid',  value: balances.find(b => b.leave_type === 'unpaid')?.used_days || '0',      color: '#6B7280' },
  ]

  return (
    <EmployeeLayout showGreeting={false} title="Leave" hideHeader>
      <PullToRefresh onRefresh={loadLeaveData} className="min-h-screen">
      <div className="flex flex-col min-h-screen bg-[#F8F7F9] font-['Plus_Jakarta_Sans'] pb-24">
        
        {/* Header Summary */}
        <div className="bg-[#1E1854] px-4 pt-4 pb-12">
          <div className="flex justify-between items-center mb-6">
            <span className="text-white font-extrabold text-lg">Leave Status</span>
            <button className="text-white/60 p-2"><Umbrella size={20} /></button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {stats.map(s => (
              <div key={s.label} className="bg-white/10 rounded-xl p-2.5 text-center border border-white/5">
                <div className="text-lg font-black text-white">{s.value}</div>
                <div className="text-[9px] font-bold text-white/50 uppercase tracking-wider mt-0.5 leading-none">{s.label}</div>
                <div className="h-0.5 w-6 mx-auto mt-2 rounded-full" style={{ backgroundColor: s.color }} />
              </div>
            ))}
          </div>
        </div>

        {/* Form or List Section */}
        <div className="px-4 -mt-6 flex-1">
          <div className="bg-white rounded-t-[32px] min-h-full border-t border-[#F1F0F4] p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.04)]">
            
            {!showApplyForm ? (
              <>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-[14px] font-black text-[#1A1727] uppercase tracking-wider">Leave History</h3>
                  <button 
                    onClick={() => setShowApplyForm(true)}
                    className="text-[11px] font-black text-[#534AB7] uppercase tracking-widest flex items-center gap-1 bg-purple-50 px-3 py-1.5 rounded-lg"
                  >
                    <Plus size={12} strokeWidth={3} /> Apply New
                  </button>
                </div>

                <div className="space-y-4">
                  {loading ? (
                    <div className="py-20 text-center text-[#9CA3AF]">Loading history...</div>
                  ) : requests.length === 0 ? (
                    <div className="py-20 text-center text-[#9CA3AF] italic">No leave applications found</div>
                  ) : requests.map(r => {
                    const isApproved = r.status === 'approved'
                    const isRejected = r.status === 'rejected'
                    
                    return (
                      <div key={r.id} className="flex items-center gap-4 p-4 bg-[#F8F7F9] rounded-2xl border border-[#F1F0F4]">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isApproved ? 'bg-emerald-50 text-emerald-500' : isRejected ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'}`}>
                          {isApproved ? <ShieldCheck size={20} strokeWidth={3} /> : isRejected ? <X size={20} strokeWidth={3} /> : <Clock size={20} strokeWidth={3} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-0.5">
                            <div className="text-[14px] font-extrabold text-[#1A1727] truncate">{leaveTypeLabels[r.leave_type] || r.leave_type}</div>
                            <div className="text-[14px] font-black text-[#534AB7]">{r.days_count}d</div>
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-wider">{new Date(r.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</div>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${isApproved ? 'bg-emerald-100 text-emerald-700' : isRejected ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                              {r.status.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <form onSubmit={handleApply} className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[14px] font-black text-[#1A1727] uppercase tracking-wider">Apply for Leave</h3>
                  <button type="button" onClick={() => setShowApplyForm(false)} className="p-2 text-[#9CA3AF] hover:text-[#1A1727]"><X size={20} /></button>
                </div>

                <div className="space-y-4">
                  {/* Leave Type Grid */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-[#9CA3AF] uppercase tracking-widest ml-1">Leave Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(leaveTypeConfig).map(([key, cfg]) => {
                        const Icon = cfg.icon
                        const isActive = leaveType === key
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setLeaveType(key)}
                            className={`py-3 rounded-xl border text-[12px] font-bold transition-all flex items-center justify-center gap-2 ${isActive ? 'bg-[#534AB7] border-[#534AB7] text-white shadow-lg' : 'bg-[#F8F7F9] border-[#F1F0F4] text-[#6B7280]'}`}
                          >
                            <Icon size={16} strokeWidth={2} style={{ color: isActive ? 'white' : cfg.color }} />
                            {cfg.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Date Range */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[11px] font-black text-[#9CA3AF] uppercase tracking-widest ml-1">Start Date</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-[#D1D5DB]" size={14} />
                        <input 
                          type="date" 
                          required
                          value={startDate}
                          onChange={e => setStartDate(e.target.value)}
                          className="w-full h-12 pl-10 pr-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-[12px] font-bold text-[#1A1727] outline-none" 
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-black text-[#9CA3AF] uppercase tracking-widest ml-1">End Date</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-[#D1D5DB]" size={14} />
                        <input 
                          type="date" 
                          required
                          value={endDate}
                          onChange={e => setEndDate(e.target.value)}
                          className="w-full h-12 pl-10 pr-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-[12px] font-bold text-[#1A1727] outline-none" 
                        />
                      </div>
                    </div>
                  </div>

                  {/* Duration Badge */}
                  {durationDays > 0 && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-center gap-2">
                      <Clock size={14} className="text-blue-500" />
                      <span className="text-[12px] font-bold text-blue-700">
                        {durationDays} working day{durationDays !== 1 ? 's' : ''} requested
                      </span>
                    </div>
                  )}

                  {/* Reason */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-[#9CA3AF] uppercase tracking-widest ml-1">Reason</label>
                    <textarea 
                      required
                      rows={3}
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      placeholder="Briefly explain the reason for your leave..."
                      className="w-full p-4 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none resize-none"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={submitting}
                  className="w-full h-14 bg-[#534AB7] text-white rounded-2xl font-black text-[13px] uppercase tracking-widest shadow-xl shadow-purple-900/30 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? 'Applying...' : <>Submit Application <ChevronRight size={16} strokeWidth={3} /></>}
                </button>
              </form>
            )}

          </div>
        </div>

      </div>
      </PullToRefresh>
    </EmployeeLayout>
  )
}
