'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import {
  LogOut,
  Mail,
  Phone,
  Calendar,
  MapPin,
  ChevronRight,
  FileText,
  Umbrella,
  Clock,
  Receipt,
  TrendingUp,
  Check,
  Pencil,
  Save,
  X,
  Star,
  Package,
  GraduationCap,
  AlertCircle
} from 'lucide-react'
import { useAutoLinkEmployee } from '@/hooks/use-auto-link-employee'
import { EmployeeLayout } from '@/components/employee-layout'
import { toast } from 'sonner'

export default function ProfilePage() {
  const { userId, isLoaded, isSignedIn, signOut } = useAuth()
  const { isLinking, isLinked } = useAutoLinkEmployee()
  const router = useRouter()

  const [employee, setEmployee] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [attendancePct, setAttendancePct] = useState<string>('—')
  const [leaveLeft, setLeaveLeft] = useState<string>('—')
  const [otHours, setOtHours] = useState<string>('—')
  const [compOff, setCompOff] = useState<string>('—')

  // Edit mode
  const [editMode, setEditMode] = useState(false)
  const [editPhone, setEditPhone] = useState('')
  const [saving, setSaving] = useState(false)

  // Extra sections
  const [emergencyContacts, setEmergencyContacts] = useState<any[]>([])
  const [assignedAssets, setAssignedAssets] = useState<any[]>([])
  const [trainings, setTrainings] = useState<any[]>([])
  const [activeReview, setActiveReview] = useState<any>(null)
  const [showReviewDialog, setShowReviewDialog] = useState(false)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComments, setReviewComments] = useState('')

  useEffect(() => {
    if (isLoaded && isSignedIn && isLinked) {
      loadProfile()
    }
  }, [isLoaded, isSignedIn, isLinked])

  async function loadProfile() {
    setLoading(true)
    try {
      const empResult = await api.get<any>('/employees/me')
      if (!empResult.ok) throw new Error(empResult.error || 'Failed to load profile')
      const empData = empResult.data
      if (empData) {
        setEmployee({ ...empData, department: empData.department_name || empData.department || null })
        setEditPhone(empData.phone || '')

        const now = new Date()
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

        const [clockRes, lbRes, otRes, coRes, contactsRes, assetsRes, trainingsRes, reviewRes] = await Promise.all([
          supabase.from('clock_events').select('id', { count: 'exact', head: true }).eq('employee_id', empData.id).eq('event_type', 'clock_in').gte('timestamp', monthStart),
          supabase.from('leave_balances').select('remaining_days').eq('employee_id', empData.id).eq('leave_type', 'annual').eq('year', now.getFullYear()).single(),
          supabase.from('overtime_records').select('hours').eq('employee_id', empData.id).eq('status', 'approved').gte('date', monthStart),
          supabase.from('comp_off_records').select('id', { count: 'exact', head: true }).eq('employee_id', empData.id).eq('status', 'approved'),
          api.get<any[]>(`/employees/${empData.id}/emergency-contacts`),
          // TODO: migrate asset/training/performance domains to backend
          supabase.from('asset_assignments').select('*, asset:assets(name, serial_number, category)').eq('employee_id', empData.id).eq('status', 'active'),
          supabase.from('training_assignments').select('id, status, start_date, program:training_programs(title, category)').eq('employee_id', empData.id).in('status', ['assigned', 'in_progress']).order('start_date', { ascending: true }).limit(3),
          supabase.from('performance_reviews').select('id, review_period, status').eq('employee_id', empData.id).eq('status', 'pending_self').maybeSingle(),
        ])

        const workingDaysElapsed = Math.max(1, Math.floor((now.getTime() - new Date(monthStart).getTime()) / 86400000) + 1)
        setAttendancePct(clockRes.count != null ? `${Math.round((clockRes.count / workingDaysElapsed) * 100)}%` : '—')
        setLeaveLeft(lbRes.data ? `${lbRes.data.remaining_days}d` : '—')
        const totalOt = (otRes.data || []).reduce((sum: number, r: any) => sum + (r.hours || 0), 0)
        setOtHours(`${totalOt}h`)
        setCompOff(`${coRes.count ?? 0}d`)
        setEmergencyContacts(contactsRes.ok ? (contactsRes.data || []) : [])
        setAssignedAssets(assetsRes.data || [])
        setTrainings(trainingsRes.data || [])
        setActiveReview(reviewRes.data || null)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const result = await api.patch<any>(`/employees/${employee.id}`, { phone: editPhone })
      if (!result.ok) throw new Error(result.error || 'Failed to update profile')
      setEmployee({ ...employee, phone: editPhone })
      setEditMode(false)
      toast.success('Profile updated')
    } catch {
      toast.error('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmitReview() {
    if (!activeReview) return
    setSaving(true)
    try {
      const { error } = await supabase.from('performance_reviews').update({
        self_rating: reviewRating,
        self_comments: reviewComments,
        status: 'pending_manager',
        self_submitted_at: new Date().toISOString(),
      }).eq('id', activeReview.id)
      if (error) throw error
      toast.success('Self review submitted')
      setShowReviewDialog(false)
      setActiveReview(null)
    } catch {
      toast.error('Failed to submit review')
    } finally {
      setSaving(false)
    }
  }

  if (!isLoaded || isLinking) {
    return (
      <EmployeeLayout showGreeting={false} hideHeader>
        <div className="flex min-h-screen items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#534AB7]"></div>
        </div>
      </EmployeeLayout>
    )
  }

  if (!employee && !loading) {
     return (
       <EmployeeLayout showGreeting={false} hideHeader>
         <div className="flex min-h-screen items-center justify-center flex-col p-6 text-center">
           <AlertCircle size={48} className="text-[#D1D5DB] mb-4" />
           <h2 className="text-lg font-black text-[#1A1727] mb-2">Profile Unavailable</h2>
           <p className="text-sm text-[#9CA3AF]">Could not retrieve your employee profile. Please contact HR.</p>
         </div>
       </EmployeeLayout>
     )
  }

  if (loading) {
    return (
      <EmployeeLayout showGreeting={false} hideHeader>
        <div className="flex min-h-screen items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#534AB7]"></div>
        </div>
      </EmployeeLayout>
    )
  }

  const stats = [
    { label: 'Attendance', value: attendancePct, icon: Check,     color: '#10B981' },
    { label: 'Leave Left', value: leaveLeft,     icon: Umbrella,  color: '#3B82F6' },
    { label: 'OT Hours',   value: otHours,       icon: Clock,     color: '#F59E0B' },
    { label: 'Comp-Off',   value: compOff,       icon: TrendingUp,color: '#8B5CF6' },
  ]

  const quickLinks = [
    { icon: FileText, label: 'My Payslips',        color: '#10B981', href: '/payslips' },
    { icon: Umbrella, label: 'Leave History',      color: '#3B82F6', href: '/leave' },
    { icon: Clock,    label: 'Overtime Records',   color: '#F59E0B', href: '/overtime' },
    { icon: Receipt,  label: 'My Expenses',        color: '#8B5CF6', href: '/expenses' },
  ]

  return (
    <EmployeeLayout showGreeting={false} hideHeader>
      <div className="flex flex-col min-h-screen bg-[#F8F7F9] font-['Plus_Jakarta_Sans'] pb-24">

        {/* Hero Section */}
        <div className="bg-gradient-to-br from-[#1E1854] to-[#534AB7] px-6 pt-10 pb-12 flex flex-col items-center text-center relative">
          <button
            onClick={() => { setEditMode(!editMode); setEditPhone(employee?.phone || '') }}
            className="absolute top-4 right-4 p-2 bg-white/10 rounded-xl text-white/60 hover:bg-white/20 transition-all"
          >
            <Pencil size={16} />
          </button>
          <div className="w-24 h-24 rounded-full bg-white/10 border-4 border-white/20 flex items-center justify-center text-white text-4xl font-black mb-4">
            {employee?.first_name?.[0]}
          </div>
          <h1 className="text-white text-xl font-black">{employee?.first_name} {employee?.last_name}</h1>
          <p className="text-white/60 text-sm font-medium mt-1">{employee?.job_title} · {employee?.department}</p>

          <div className="flex items-center gap-2 mt-4 px-4 py-1.5 bg-emerald-400/10 rounded-full border border-emerald-400/20">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-black text-emerald-400 uppercase tracking-widest">Active · Present Today</span>
          </div>
        </div>

        {/* Stats Row */}
        <div className="px-4 -mt-8 grid grid-cols-4 gap-2">
          {stats.map(s => (
            <div key={s.label} className="bg-white rounded-2xl p-3 text-center shadow-lg shadow-purple-900/5 border border-[#F1F0F4]">
              <div className="flex justify-center mb-2">
                <s.icon size={17} style={{ color: s.color }} strokeWidth={2.5} />
              </div>
              <div className="text-[15px] font-black text-[#1A1727]">{s.value}</div>
              <div className="text-[9px] font-bold text-[#9CA3AF] uppercase tracking-wider mt-0.5 leading-none">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Contact & Links */}
        <div className="px-4 mt-6 space-y-4">

          {/* Performance Review Alert */}
          {activeReview && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-start gap-3">
                <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[12px] font-black text-amber-700 uppercase tracking-widest">Self Review Pending</div>
                  <div className="text-[11px] text-amber-600 font-bold mt-0.5">{activeReview.review_period} · Action required</div>
                </div>
              </div>
              <button
                onClick={() => setShowReviewDialog(true)}
                className="px-4 py-2 bg-amber-500 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-amber-600 transition-all shrink-0"
              >
                Submit
              </button>
            </div>
          )}

          {/* Contact Info Card */}
          <div className="bg-white rounded-2xl border border-[#F1F0F4] shadow-sm overflow-hidden">
            {editMode && (
              <div className="px-4 pt-3 pb-2 bg-[#EDE9FE] border-b border-[#DDD6FE] flex items-center justify-between">
                <span className="text-[10px] font-black text-[#534AB7] uppercase tracking-widest">Edit Mode</span>
                <div className="flex gap-2">
                  <button onClick={() => { setEditMode(false); setEditPhone(employee?.phone || '') }} className="p-1 text-[#9CA3AF] hover:text-[#374151]"><X size={14} /></button>
                  <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-1 bg-[#534AB7] text-white rounded-lg text-[10px] font-black uppercase tracking-wider disabled:opacity-50">
                    <Save size={11} /> {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            )}
            <div className="divide-y divide-[#F8F7F9]">
              <div className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-xl bg-[#F8F7F9] flex items-center justify-center shrink-0"><Mail size={16} className="text-[#9CA3AF]" strokeWidth={2} /></div>
                <div>
                  <div className="text-[10px] font-black text-[#D1D5DB] uppercase tracking-widest mb-0.5">Email</div>
                  <div className="text-[13px] font-bold text-[#374151]">{employee?.email || '—'}</div>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-xl bg-[#F8F7F9] flex items-center justify-center shrink-0"><Phone size={16} className="text-[#9CA3AF]" strokeWidth={2} /></div>
                <div className="flex-1">
                  <div className="text-[10px] font-black text-[#D1D5DB] uppercase tracking-widest mb-0.5">Phone</div>
                  {editMode ? (
                    <input
                      value={editPhone}
                      onChange={e => setEditPhone(e.target.value)}
                      placeholder="Enter phone number"
                      className="w-full text-[13px] font-bold text-[#374151] bg-[#F8F7F9] border border-[#E5E3EA] rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#534AB7]/20"
                    />
                  ) : (
                    <div className="text-[13px] font-bold text-[#374151]">{employee?.phone || '—'}</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-xl bg-[#F8F7F9] flex items-center justify-center shrink-0"><Calendar size={16} className="text-[#9CA3AF]" strokeWidth={2} /></div>
                <div>
                  <div className="text-[10px] font-black text-[#D1D5DB] uppercase tracking-widest mb-0.5">Joined</div>
                  <div className="text-[13px] font-bold text-[#374151]">{employee?.hire_date ? new Date(employee.hire_date).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : '—'}</div>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-xl bg-[#F8F7F9] flex items-center justify-center shrink-0"><MapPin size={16} className="text-[#9CA3AF]" strokeWidth={2} /></div>
                <div>
                  <div className="text-[10px] font-black text-[#D1D5DB] uppercase tracking-widest mb-0.5">Branch</div>
                  <div className="text-[13px] font-bold text-[#374151]">Main Branch, Colombo</div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Links Card */}
          <div className="bg-white rounded-2xl border border-[#F1F0F4] shadow-sm overflow-hidden divide-y divide-[#F8F7F9]">
            {quickLinks.map((item) => (
              <button
                key={item.label}
                onClick={() => router.push(item.href)}
                className="w-full flex items-center gap-4 p-4 hover:bg-[#F8F7F9] transition-colors group"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-active:scale-90" style={{ backgroundColor: item.color + '10' }}>
                  <item.icon size={18} style={{ color: item.color }} strokeWidth={2} />
                </div>
                <span className="flex-1 text-left text-[14px] font-bold text-[#374151]">{item.label}</span>
                <ChevronRight size={18} className="text-[#D1D5DB]" />
              </button>
            ))}
          </div>

          {/* Emergency Contacts */}
          {emergencyContacts.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#F1F0F4] shadow-sm overflow-hidden">
              <div className="px-4 pt-4 pb-2">
                <div className="text-[10px] font-black text-[#D1D5DB] uppercase tracking-widest mb-3">Emergency Contacts</div>
              </div>
              <div className="divide-y divide-[#F8F7F9]">
                {emergencyContacts.map((c, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3">
                    <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                      <Phone size={14} className="text-red-400" strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-[#1A1727] truncate">{c.name}</div>
                      <div className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">{c.relationship}{c.is_primary ? ' · Primary' : ''}</div>
                    </div>
                    <div className="text-[12px] font-bold text-[#534AB7]">{c.phone}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Assigned Assets */}
          {assignedAssets.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#F1F0F4] shadow-sm overflow-hidden">
              <div className="px-4 pt-4 pb-2">
                <div className="text-[10px] font-black text-[#D1D5DB] uppercase tracking-widest mb-3">My Assets</div>
              </div>
              <div className="divide-y divide-[#F8F7F9]">
                {assignedAssets.map((a, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                      <Package size={14} className="text-blue-400" strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-[#1A1727] truncate">{a.asset?.name || 'Asset'}</div>
                      <div className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">{a.asset?.category}{a.asset?.serial_number ? ` · ${a.asset.serial_number}` : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Training Programs */}
          {trainings.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#F1F0F4] shadow-sm overflow-hidden">
              <div className="px-4 pt-4 pb-2">
                <div className="text-[10px] font-black text-[#D1D5DB] uppercase tracking-widest mb-3">Upcoming Training</div>
              </div>
              <div className="divide-y divide-[#F8F7F9]">
                {trainings.map((t, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                      <GraduationCap size={14} className="text-[#534AB7]" strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-[#1A1727] truncate">{t.program?.title || 'Training'}</div>
                      <div className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">
                        {t.program?.category}{t.start_date ? ` · ${new Date(t.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}` : ''}
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${t.status === 'in_progress' ? 'bg-emerald-50 text-emerald-600' : 'bg-[#F8F7F9] text-[#9CA3AF]'}`}>
                      {t.status === 'in_progress' ? 'Active' : 'Upcoming'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sign Out Button */}
          <button
            onClick={() => signOut()}
            className="w-full h-14 bg-red-50 text-red-600 rounded-2xl font-black text-[13px] uppercase tracking-widest flex items-center justify-center gap-3 border border-red-100 active:scale-[0.98] transition-all"
          >
            <LogOut size={18} strokeWidth={2.5} />
            Sign Out
          </button>

          <div className="text-center py-6">
            <div className="text-[10px] font-black text-[#D1D5DB] uppercase tracking-[0.2em]">TouchOrbit v2.0</div>
          </div>

        </div>
      </div>

      {/* Performance Review Dialog */}
      {showReviewDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 pb-safe">
          <div className="bg-white rounded-t-[32px] w-full max-w-lg p-6 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[16px] font-black text-[#1A1727]">Self Performance Review</h2>
              <button onClick={() => setShowReviewDialog(false)} className="p-2 text-[#9CA3AF] hover:text-[#374151]"><X size={18} /></button>
            </div>
            <p className="text-[12px] font-bold text-[#9CA3AF] mb-5 uppercase tracking-widest">{activeReview?.review_period}</p>
            <div className="mb-5">
              <div className="text-[10px] font-black text-[#D1D5DB] uppercase tracking-widest mb-3">Your Rating</div>
              <div className="flex gap-2">
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => setReviewRating(n)} className="p-2 transition-transform active:scale-90">
                    <Star size={28} className={n <= reviewRating ? 'text-amber-400 fill-amber-400' : 'text-[#E5E3EA]'} strokeWidth={1.5} />
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-6">
              <div className="text-[10px] font-black text-[#D1D5DB] uppercase tracking-widest mb-2">Comments</div>
              <textarea
                value={reviewComments}
                onChange={e => setReviewComments(e.target.value)}
                placeholder="Describe your achievements and areas for growth..."
                rows={4}
                className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-[13px] font-bold text-[#374151] resize-none focus:outline-none focus:ring-2 focus:ring-[#534AB7]/20"
              />
            </div>
            <button
              onClick={handleSubmitReview}
              disabled={saving}
              className="w-full py-4 bg-[#534AB7] text-white rounded-2xl font-black text-[12px] uppercase tracking-widest shadow-lg shadow-purple-900/20 disabled:opacity-50"
            >
              {saving ? 'Submitting...' : 'Submit Self Review'}
            </button>
          </div>
        </div>
      )}
    </EmployeeLayout>
  )
}
