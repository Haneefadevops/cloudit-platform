'use client'

import { useEffect, useMemo, useState } from 'react'
import { EmployeeLayout } from '@/components/employee-layout'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { Clock, Plus, X, Calendar, ChevronRight, Check } from 'lucide-react'
import { toast } from 'sonner'

interface OvertimeRecord {
  id: string
  date: string
  start_time: string | null
  end_time: string | null
  hours: number | string
  rate: number | string
  reason: string | null
  status: string
  rejection_reason: string | null
}

interface Employee {
  id: string
}

export default function OvertimePage() {
  const { isLoaded } = useAuth()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [records, setRecords] = useState<OvertimeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    start_time: '18:00',
    end_time: '20:00',
    hours: '2.0',
    reason: '',
  })

  useEffect(() => {
    if (isLoaded) {
      loadRecords()
    }
  }, [isLoaded])

  const calculatedHours = useMemo(() => {
    if (!formData.start_time || !formData.end_time) return 0
    const start = new Date(`2000-01-01T${formData.start_time}`)
    const end = new Date(`2000-01-01T${formData.end_time}`)
    let diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
    if (diff < 0) diff += 24
    return Math.round(diff * 10) / 10
  }, [formData.start_time, formData.end_time])

  useEffect(() => {
    if (calculatedHours > 0) {
      setFormData(prev => ({ ...prev, hours: String(calculatedHours) }))
    }
  }, [calculatedHours])

  const loadRecords = async () => {
    setLoading(true)
    try {
      const empResult = await api.get<Employee>('/employees/me')
      if (!empResult.ok || !empResult.data) throw new Error(empResult.error || 'Employee not found')
      setEmployee(empResult.data)
      const recordsResult = await api.get<OvertimeRecord[]>(`/overtime?employee_id=${empResult.data.id}`)
      if (!recordsResult.ok) throw new Error(recordsResult.error || 'Failed to load overtime records')
      setRecords(recordsResult.data || [])
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Failed to load overtime records')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!employee) { toast.error('Employee not found'); return }
    setSubmitting(true)
    try {
      const result = await api.post<OvertimeRecord>('/overtime', {
        employee_id: employee.id,
        date: formData.date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        hours: parseFloat(formData.hours),
        rate: 1.5,
        reason: formData.reason,
      })
      if (!result.ok) throw new Error(result.error || 'Failed to submit request')
      toast.success('Overtime request submitted')
      setShowForm(false)
      await loadRecords()
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit request')
    } finally {
      setSubmitting(false)
    }
  }

  // Real stats from records
  const totalHours = records.reduce((sum, r) => sum + Number(r.hours || 0), 0)
  const thisMonth = new Date().toISOString().slice(0, 7)
  const monthHours = records
    .filter(r => r.date.startsWith(thisMonth) && r.status === 'approved')
    .reduce((sum, r) => sum + Number(r.hours || 0), 0)
  const pendingHours = records
    .filter(r => r.status === 'pending')
    .reduce((sum, r) => sum + Number(r.hours || 0), 0)

  const stats = [
    { label: 'Total OT',   value: `${totalHours.toFixed(1)}h`, color: '#534AB7' },
    { label: 'This Month', value: `${monthHours.toFixed(1)}h`,  color: '#10B981' },
    { label: 'Pending',    value: `${pendingHours.toFixed(1)}h`,  color: '#F59E0B' },
  ]

  return (
    <EmployeeLayout showGreeting={false} title="Overtime" hideHeader>
      <div className="flex flex-col min-h-screen bg-[#F8F7F9] font-['Plus_Jakarta_Sans'] pb-24">
        
        {/* Header Summary */}
        <div className="bg-[#1E1854] px-4 pt-4 pb-12">
          <div className="flex justify-between items-center mb-6">
            <span className="text-white font-extrabold text-lg">Overtime</span>
            <button className="text-white/60 p-2"><Clock size={20} /></button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {stats.map(s => (
              <div key={s.label} className="bg-white/10 rounded-2xl p-4 border border-white/5">
                <div className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-1">{s.label}</div>
                <div className="text-[16px] font-black text-white">{s.value}</div>
                <div className="h-1 w-6 mt-3 rounded-full" style={{ backgroundColor: s.color }} />
              </div>
            ))}
          </div>
        </div>

        {/* Form or List Section */}
        <div className="px-4 -mt-6 flex-1">
          <div className="bg-white rounded-t-[32px] min-h-full border-t border-[#F1F0F4] p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.04)]">
            
            {!showForm ? (
              <>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-[14px] font-black text-[#1A1727] uppercase tracking-wider">Recent Logs</h3>
                  <button 
                    onClick={() => setShowForm(true)}
                    disabled={loading || !employee}
                    className="text-[11px] font-black text-[#534AB7] uppercase tracking-widest flex items-center gap-1 bg-purple-50 px-3 py-1.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus size={12} strokeWidth={3} /> New Request
                  </button>
                </div>

                <div className="space-y-4">
                  {loading ? (
                    <div className="py-20 text-center text-[#9CA3AF]">Loading records...</div>
                  ) : records.length === 0 ? (
                    <div className="py-20 text-center text-[#9CA3AF] italic">No overtime logs found</div>
                  ) : records.map(r => (
                    <div key={r.id} className="flex items-center gap-4 p-4 bg-[#F8F7F9] rounded-2xl border border-[#F1F0F4]">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${r.status === 'approved' ? 'bg-emerald-50 text-emerald-500' : 'bg-amber-50 text-amber-500'}`}>
                        {r.status === 'approved' ? <Check size={20} strokeWidth={3} /> : <Clock size={20} strokeWidth={3} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-0.5">
                          <div className="text-[14px] font-extrabold text-[#1A1727]">{new Date(r.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</div>
                          <div className="text-[14px] font-black text-[#534AB7]">{r.hours}h</div>
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="text-[11px] font-medium text-[#9CA3AF]">{r.start_time?.slice(0,5)} - {r.end_time?.slice(0,5)}</div>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${r.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {r.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[14px] font-black text-[#1A1727] uppercase tracking-wider">Request Overtime</h3>
                  <button type="button" onClick={() => setShowForm(false)} className="p-2 text-[#9CA3AF] hover:text-[#1A1727]"><X size={20} /></button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-[#9CA3AF] uppercase tracking-widest ml-1">Work Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-[#D1D5DB]" size={18} />
                      <input 
                        type="date" 
                        required
                        value={formData.date}
                        onChange={e => setFormData({...formData, date: e.target.value})}
                        className="w-full h-14 pl-12 pr-4 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] focus:border-[#534AB7] outline-none" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[11px] font-black text-[#9CA3AF] uppercase tracking-widest ml-1">Start Time</label>
                      <input 
                        type="time" 
                        required
                        value={formData.start_time}
                        onChange={e => setFormData({...formData, start_time: e.target.value})}
                        className="w-full h-14 px-4 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] focus:border-[#534AB7] outline-none text-center" 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-black text-[#9CA3AF] uppercase tracking-widest ml-1">End Time</label>
                      <input 
                        type="time" 
                        required
                        value={formData.end_time}
                        onChange={e => setFormData({...formData, end_time: e.target.value})}
                        className="w-full h-14 px-4 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] focus:border-[#534AB7] outline-none text-center" 
                      />
                    </div>
                  </div>

                  {/* Duration badge */}
                  {calculatedHours > 0 && (
                    <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 flex items-center gap-2">
                      <Clock size={14} className="text-amber-500" />
                      <span className="text-[12px] font-bold text-amber-700">
                        {calculatedHours} hours overtime
                      </span>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-[#9CA3AF] uppercase tracking-widest ml-1">Reason for OT</label>
                    <textarea 
                      required
                      rows={3}
                      value={formData.reason}
                      onChange={e => setFormData({...formData, reason: e.target.value})}
                      placeholder="Briefly describe the task performed..."
                      className="w-full p-4 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] focus:border-[#534AB7] outline-none resize-none"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={submitting || !employee}
                  className="w-full h-14 bg-[#534AB7] text-white rounded-2xl font-black text-[13px] uppercase tracking-widest shadow-xl shadow-purple-900/30 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : <>Submit Request <ChevronRight size={16} strokeWidth={3} /></>}
                </button>
              </form>
            )}

          </div>
        </div>

      </div>
    </EmployeeLayout>
  )
}
