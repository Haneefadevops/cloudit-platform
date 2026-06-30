'use client'

import { useEffect, useState } from 'react'
import { EmployeeLayout } from '@/components/employee-layout'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { AlertCircle, Plus, X, Clock, CheckCircle, XCircle, Calendar, RefreshCw, ChevronRight, Fingerprint } from 'lucide-react'
import { toast } from 'sonner'

interface AttendanceCorrection {
  id: string
  correction_type: 'forgot_in' | 'forgot_out' | 'wrong_time' | 'other'
  requested_time: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason: string | null
  created_at: string
}

const correctionTypes = [
  { value: 'forgot_in', label: 'Forgot to Clock In' },
  { value: 'forgot_out', label: 'Forgot to Clock Out' },
  { value: 'wrong_time', label: 'Wrong Time Entry' },
  { value: 'other', label: 'Miscellaneous' },
]

export default function CorrectionsPage() {
  const { userId, isLoaded, organizationId } = useAuth()
  const [corrections, setCorrections] = useState<AttendanceCorrection[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    type: 'forgot_in' as 'forgot_in' | 'forgot_out' | 'wrong_time' | 'other',
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    reason: '',
  })

  useEffect(() => {
    if (isLoaded && userId) {
      loadCorrections()
    }
  }, [isLoaded, userId])

  const loadCorrections = async () => {
    setLoading(true)
    try {
      const { data: employee } = await supabase.from('employees').select('id').eq('user_id', userId).single()
      if (!employee) { setLoading(false); return }
      const { data, error } = await supabase.from('attendance_corrections').select('*').eq('employee_id', employee.id).order('created_at', { ascending: false })
      if (!error) setCorrections(data || [])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const { data: employee } = await supabase.from('employees').select('id, organization_id').eq('user_id', userId).single()
      if (!employee) throw new Error('Employee not found')

      const requestedTime = new Date(`${formData.date}T${formData.time}`)
      await supabase.from('attendance_corrections').insert({
        organization_id: employee.organization_id,
        employee_id: employee.id,
        correction_type: formData.type,
        requested_time: requestedTime.toISOString(),
        reason: formData.reason,
        status: 'pending',
      })

      toast.success('Correction request submitted!')
      setFormData({ type: 'forgot_in', date: new Date().toISOString().split('T')[0], time: '09:00', reason: '' })
      setShowForm(false); loadCorrections()
    } catch (error) {
      toast.error('Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  const stats = [
    { label: 'Pending', value: corrections.filter(c => c.status === 'pending').length, color: '#F59E0B', icon: Clock },
    { label: 'Approved', value: corrections.filter(c => c.status === 'approved').length, color: '#10B981', icon: CheckCircle },
    { label: 'Rejected', value: corrections.filter(c => c.status === 'rejected').length, color: '#EF4444', icon: XCircle },
  ]

  return (
    <EmployeeLayout showGreeting={false} title="Corrections">
      <div className="flex flex-col min-h-screen bg-[#F8F7F9] font-['Plus_Jakarta_Sans'] pb-24">
        <div className="bg-[#1E1854] px-4 pt-4 pb-12">
          <div className="flex justify-between items-center mb-6">
            <span className="text-white font-extrabold text-lg">Attendance Corrections</span>
            <RefreshCw className="text-white/60" size={20} />
          </div>
          <div className="grid grid-cols-3 gap-3">
             {stats.map(s => (
                <div key={s.label} className="bg-white/10 rounded-2xl p-4 border border-white/5">
                   <div className="text-[9px] font-black text-white/50 uppercase tracking-widest mb-1">{s.label}</div>
                   <div className="text-lg font-black text-white">{s.value}</div>
                   <div className="h-0.5 w-6 mt-2 rounded-full" style={{ backgroundColor: s.color }} />
                </div>
             ))}
          </div>
        </div>

        <div className="px-4 -mt-6 flex-1">
          <div className="bg-white rounded-t-[32px] min-h-full border-t border-[#F1F0F4] p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.04)]">
             {!showForm ? (
               <>
                 <div className="flex justify-between items-center mb-6">
                    <h3 className="text-[14px] font-black text-[#1A1727] uppercase tracking-wider">Adjustment History</h3>
                    <button onClick={() => setShowForm(true)} className="text-[11px] font-black text-[#534AB7] uppercase tracking-widest flex items-center gap-1 bg-purple-50 px-3 py-1.5 rounded-lg"><Plus size={12} strokeWidth={3} /> Request Fix</button>
                 </div>

                 <div className="space-y-4">
                    {loading ? (
                      <div className="py-20 text-center text-[#9CA3AF] animate-pulse uppercase font-black text-[10px]">Loading Log...</div>
                    ) : corrections.length === 0 ? (
                      <div className="py-20 text-center flex flex-col items-center">
                         <Fingerprint size={40} className="text-[#D1D5DB] mb-4 opacity-20" />
                         <div className="text-sm font-bold text-[#9CA3AF]">No corrections requested</div>
                      </div>
                    ) : corrections.map(c => (
                      <div key={c.id} className="flex items-center gap-4 p-4 bg-[#F8F7F9] rounded-2xl border border-[#F1F0F4] group">
                         <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${c.status === 'approved' ? 'bg-emerald-50 text-emerald-500' : c.status === 'rejected' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'}`}>
                           {c.status === 'approved' ? <CheckCircle size={24} strokeWidth={2.5} /> : c.status === 'rejected' ? <XCircle size={24} strokeWidth={2.5} /> : <Clock size={24} strokeWidth={2.5} />}
                         </div>
                         <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-0.5">
                               <div className="text-[14px] font-extrabold text-[#1A1727] truncate">{correctionTypes.find(t=>t.value===c.correction_type)?.label}</div>
                            </div>
                            <div className="flex justify-between items-center">
                               <div className="text-[11px] font-medium text-[#9CA3AF]">{new Date(c.requested_time).toLocaleDateString('en-GB', { day:'2-digit', month:'short' })} · {new Date(c.requested_time).toLocaleTimeString([], { hour:'numeric', minute:'2-digit', hour12:true })}</div>
                               <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${c.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : c.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{c.status}</span>
                            </div>
                         </div>
                      </div>
                    ))}
                 </div>
               </>
             ) : (
               <form onSubmit={handleSubmit} className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
                  <div className="flex items-center justify-between mb-2">
                     <h3 className="text-[14px] font-black text-[#1A1727] uppercase tracking-wider">New Correction Request</h3>
                     <button type="button" onClick={() => setShowForm(false)} className="p-2 text-[#9CA3AF] hover:text-[#1A1727]"><X size={20} /></button>
                  </div>

                  <div className="space-y-4">
                     <div>
                        <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Type of Adjustment</label>
                        <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none">
                           {correctionTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Actual Date</label>
                           <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none" />
                        </div>
                        <div>
                           <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Actual Time</label>
                           <input type="time" required value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none" />
                        </div>
                     </div>
                     <div>
                        <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Justification</label>
                        <textarea required value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} rows={3} className="w-full p-4 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none resize-none" placeholder="Explain what happened..." />
                     </div>
                  </div>

                  <button type="submit" disabled={submitting} className="w-full py-4 bg-[#534AB7] text-white rounded-2xl font-black text-[13px] uppercase tracking-widest shadow-xl shadow-purple-900/30 active:scale-95 transition-all disabled:opacity-50">
                     {submitting ? 'Submitting...' : 'Send Request'}
                  </button>
               </form>
             )}
          </div>
        </div>
      </div>
    </EmployeeLayout>
  )
}
