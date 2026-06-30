'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { BookOpen, Plus, Pencil, Trash2, X, XCircle, Clock, GraduationCap, ChevronRight, CheckCircle2, History, Send, ShieldCheck, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useAutoLinkEmployee } from '@/hooks/use-auto-link-employee'
import { EmployeeLayout } from '@/components/employee-layout'

// Helper function to format time
const formatTime = (timeString: string | null) => {
  if (!timeString) return null
  const [hours, minutes] = timeString.split(':')
  const hour = parseInt(hours)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return `${hour12}:${minutes} ${ampm}`
}

interface Training {
  id: string
  training_name: string
  description: string | null
  start_date: string
  end_date: string
  created_at: string
}

interface AssignedTraining {
  id: string
  status: 'assigned' | 'in_progress' | 'completed' | 'expired' | 'cancelled'
  start_date: string | null
  end_date: string | null
  start_time: string | null
  end_time: string | null
  reschedule_requested: boolean
  reschedule_reason: string | null
  reschedule_new_start_date: string | null
  reschedule_new_end_date: string | null
  cancel_requested: boolean
  cancel_reason: string | null
  program: {
    title: string
    description: string | null
    category: string | null
  }
}

export default function TrainingPage() {
  const { userId, organizationId, isLoaded, isSignedIn } = useAuth()
  const { isLinked } = useAutoLinkEmployee()
  
  const [trainings, setTrainings] = useState<Training[]>([])
  const [assignedTrainings, setAssignedTrainings] = useState<AssignedTraining[]>([])
  const [loading, setLoading] = useState(true)
  const [dataLoaded, setDataLoaded] = useState(false)

  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTraining, setEditingTraining] = useState<Training | null>(null)
  const [formData, setFormData] = useState({ training_name: '', description: '', start_date: '', end_date: '' })

  // Request States
  const [showRescheduleModal, setShowRescheduleModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState<AssignedTraining | null>(null)
  const [requestLoading, setRequestLoading] = useState(false)
  const [requestForm, setRequestForm] = useState({ new_start: '', new_end: '', reason: '' })

  useEffect(() => {
    if (isLoaded && isSignedIn && isLinked) {
      loadEmployeeData()
    } else if (isLoaded) {
      setLoading(false)
      setDataLoaded(true)
    }
  }, [isLoaded, isSignedIn, isLinked])

  const loadEmployeeData = async () => {
    setLoading(true)
    try {
      const { data: emp } = await supabase.from('employees').select('id').eq('user_id', userId).single()
      if (emp) {
        const { data: tData } = await supabase.from('employee_training').select('*').eq('employee_id', emp.id).order('start_date', { ascending: false })
        const { data: aData } = await supabase.from('training_assignments').select('*, program:training_programs(title, description, category)').eq('employee_id', emp.id).order('start_date', { ascending: false })
        setTrainings(tData || [])
        setAssignedTrainings(aData as any || [])
      }
    } finally {
      setLoading(false)
      setDataLoaded(true)
    }
  }

  const handleSavePersonal = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { data: emp } = await supabase.from('employees').select('id, organization_id').eq('user_id', userId).single()
      if (!emp) throw new Error('Not linked')
      const data = { ...formData, organization_id: emp.organization_id, employee_id: emp.id, description: formData.description || null }
      if (editingTraining) await supabase.from('employee_training').update(data).eq('id', editingTraining.id)
      else await supabase.from('employee_training').insert({ ...data, created_by: userId })
      toast.success('Record saved'); setIsDialogOpen(false); loadEmployeeData()
    } catch (error) { toast.error('Save failed') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this record?')) return
    await supabase.from('employee_training').delete().eq('id', id)
    toast.success('Deleted'); loadEmployeeData()
  }

  const handleRequestReschedule = async (e: React.FormEvent) => {
    e.preventDefault(); if (!selectedAssignment) return
    setRequestLoading(true)
    try {
      await supabase.from('training_assignments').update({ reschedule_requested: true, reschedule_reason: requestForm.reason, reschedule_new_start_date: requestForm.new_start, reschedule_new_end_date: requestForm.new_end }).eq('id', selectedAssignment.id)
      toast.success('Reschedule requested'); setShowRescheduleModal(false); loadEmployeeData()
    } finally { setRequestLoading(false) }
  }

  const handleRequestCancel = async (e: React.FormEvent) => {
    e.preventDefault(); if (!selectedAssignment) return
    setRequestLoading(true)
    try {
      await supabase.from('training_assignments').update({ cancel_requested: true, cancel_reason: requestForm.reason }).eq('id', selectedAssignment.id)
      toast.success('Cancellation requested'); setShowCancelModal(false); loadEmployeeData()
    } finally { setRequestLoading(false) }
  }

  const stats = [
    { label: 'Assigned', value: assignedTrainings.filter(a => a.status !== 'completed' && a.status !== 'cancelled').length, color: '#534AB7', icon: GraduationCap },
    { label: 'Completed', value: assignedTrainings.filter(a => a.status === 'completed').length + trainings.filter(t => new Date(t.end_date) < new Date()).length, color: '#10B981', icon: CheckCircle2 },
    { label: 'Personal', value: trainings.length, color: '#3B82F6', icon: BookOpen },
  ]

  return (
    <EmployeeLayout showGreeting={false} title="Training">
      <div className="flex flex-col min-h-screen bg-[#F8F7F9] font-['Plus_Jakarta_Sans'] pb-24">
        <div className="bg-[#1E1854] px-4 pt-4 pb-12">
          <div className="flex justify-between items-center mb-6">
            <span className="text-white font-extrabold text-lg">My Learning</span>
            <GraduationCap className="text-white/60" size={20} />
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

        <div className="px-4 -mt-6 space-y-8">
           {/* Section 1: Assigned */}
           <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                 <h3 className="text-[12px] font-black text-[#1A1727] uppercase tracking-wider">Required Training</h3>
                 <span className="text-[10px] font-bold text-[#9CA3AF] uppercase">{assignedTrainings.length} Programs</span>
              </div>
              
              {loading ? (
                <div className="p-12 text-center text-[#9CA3AF] animate-pulse uppercase font-black text-[10px]">Syncing Courseware...</div>
              ) : dataLoaded && assignedTrainings.length === 0 ? (
                <div className="p-10 text-center bg-white rounded-[32px] border border-dashed border-[#F1F0F4] text-[#D1D5DB] text-xs font-bold italic">No assigned programs.</div>
              ) : (
                <div className="space-y-4">
                   {assignedTrainings.map(as => (
                     <div key={as.id} className="bg-white rounded-[32px] border border-[#F1F0F4] p-6 shadow-lg shadow-purple-900/5 group relative overflow-hidden">
                        <div className="flex justify-between items-start mb-6">
                           <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-[#534AB7] shrink-0 border border-purple-100"><GraduationCap size={24} strokeWidth={2.5} /></div>
                           <div className="text-right">
                              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                                as.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : as.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                              }`}>{as.status}</span>
                              {as.reschedule_requested && <div className="text-[7px] font-black text-amber-500 uppercase mt-1 tracking-tighter">Reschedule Requested</div>}
                           </div>
                        </div>
                        <h4 className="text-[16px] font-black text-[#1A1727] leading-tight mb-1">{as.program?.title}</h4>
                        <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-6">{as.program?.category}</p>
                        
                        <div className="bg-[#F8F7F9] rounded-2xl p-4 border border-[#F1F0F4] mb-6">
                           <div className="flex items-center gap-3">
                              <Clock size={14} className="text-[#534AB7]" />
                              <div>
                                 <div className="text-[12px] font-black text-[#374151]">{new Date(as.start_date!).toLocaleDateString('en-GB', { day:'2-digit', month:'short' })} — {new Date(as.end_date!).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}</div>
                                 <div className="text-[9px] font-bold text-[#9CA3AF] uppercase mt-0.5">{formatTime(as.start_time)} to {formatTime(as.end_time)}</div>
                              </div>
                           </div>
                        </div>

                        {(as.status === 'assigned' || as.status === 'in_progress') && !as.reschedule_requested && !as.cancel_requested && (
                          <div className="flex gap-2 pt-2">
                             <button onClick={() => { setSelectedAssignment(as); setRequestForm({ new_start: as.start_date!, new_end: as.end_date!, reason: '' }); setShowRescheduleModal(true); }} className="flex-1 py-3 bg-[#F8F7F9] hover:bg-[#F3E8FF] text-[#534AB7] rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Reschedule</button>
                             <button onClick={() => { setSelectedAssignment(as); setRequestForm({ ...requestForm, reason: '' }); setShowCancelModal(true); }} className="flex-1 py-3 bg-red-50 hover:bg-red-500 hover:text-white text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Withdraw</button>
                          </div>
                        )}
                     </div>
                   ))}
                </div>
              )}
           </div>

           {/* Section 2: Personal */}
           <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                 <h3 className="text-[12px] font-black text-[#1A1727] uppercase tracking-wider">Personal Log</h3>
                 <button onClick={() => { setEditingTraining(null); setFormData({ training_name: '', description: '', start_date: '', end_date: '' }); setIsDialogOpen(true); }} className="text-[10px] font-black text-[#534AB7] uppercase tracking-widest flex items-center gap-1 bg-purple-50 px-3 py-1.5 rounded-lg"><Plus size={12} strokeWidth={3} /> Log New</button>
              </div>

              <div className="space-y-3">
                 {trainings.map(t => (
                   <div key={t.id} className="bg-white rounded-[24px] p-5 border border-[#F1F0F4] shadow-sm flex items-center gap-4 group">
                      <div className="w-10 h-10 rounded-xl bg-[#F8F7F9] flex items-center justify-center text-[#9CA3AF] shrink-0 group-hover:bg-purple-50 group-hover:text-[#534AB7] transition-all"><BookOpen size={20} /></div>
                      <div className="flex-1 min-w-0">
                         <h4 className="text-[14px] font-black text-[#1A1727] truncate">{t.training_name}</h4>
                         <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-tighter mt-0.5">{new Date(t.start_date).toLocaleDateString('en-GB', { day:'2-digit', month:'short' })} — {new Date(t.end_date).toLocaleDateString('en-GB', { day:'2-digit', month:'short' })}</p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => { setEditingTraining(t); setFormData({ training_name: t.training_name, description: t.description || '', start_date: t.start_date, end_date: t.end_date }); setIsDialogOpen(true); }} className="p-1.5 hover:bg-[#F3E8FF] text-[#D1D5DB] hover:text-[#534AB7] rounded-lg transition-all"><Pencil size={14} /></button>
                         <button onClick={() => handleDelete(t.id)} className="p-1.5 hover:bg-red-50 text-[#D1D5DB] hover:text-red-500 rounded-lg transition-all"><Trash2 size={14} /></button>
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>

        {/* Form Modal (Personal Record) */}
        {isDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#1A1727]/60 backdrop-blur-sm animate-in fade-in duration-200">
             <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 border border-[#F1F0F4]">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-xl font-black text-[#1A1727] tracking-tight">{editingTraining ? 'Edit' : 'Add'} Learning</h2>
                  <button onClick={() => setIsDialogOpen(false)} className="p-2 text-[#9CA3AF] hover:text-[#1A1727] transition-all"><X size={20} strokeWidth={2.5} /></button>
                </div>
                <form onSubmit={handleSavePersonal} className="space-y-6">
                   <div>
                      <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Training/Course Name</label>
                      <input required value={formData.training_name} onChange={e => setFormData({...formData, training_name: e.target.value})} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none" placeholder="e.g. AWS Cloud Practitioner" />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Start Date</label>
                        <input type="date" required value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727]" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">End Date</label>
                        <input type="date" required value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727]" />
                      </div>
                   </div>
                   <div>
                      <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Details (Optional)</label>
                      <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={2} className="w-full p-4 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none resize-none" placeholder="Briefly describe what you learned..." />
                   </div>
                   <button type="submit" className="w-full py-4 bg-[#534AB7] text-white rounded-2xl font-black text-[13px] uppercase tracking-widest shadow-xl shadow-purple-900/30 active:scale-95 transition-all">Confirm Entry</button>
                </form>
             </div>
          </div>
        )}

        {/* Reschedule Modal */}
        {showRescheduleModal && selectedAssignment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#1A1727]/60 backdrop-blur-sm animate-in fade-in duration-200">
             <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 border border-[#F1F0F4]">
                <div className="flex justify-between items-center mb-6">
                  <div>
                     <h2 className="text-xl font-black text-[#1A1727] tracking-tight">Request Change</h2>
                     <p className="text-[11px] font-bold text-[#534AB7] uppercase tracking-widest mt-1">{selectedAssignment.program?.title}</p>
                  </div>
                  <button onClick={() => setShowRescheduleModal(false)} className="p-2 text-[#9CA3AF] hover:text-[#1A1727]"><X size={20} /></button>
                </div>
                <form onSubmit={handleRequestReschedule} className="space-y-6">
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">New Start</label>
                        <input type="date" required value={requestForm.new_start} onChange={e => setRequestForm({...requestForm, new_start: e.target.value})} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727]" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">New End</label>
                        <input type="date" required value={requestForm.new_end} onChange={e => setRequestForm({...requestForm, new_end: e.target.value})} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727]" />
                      </div>
                   </div>
                   <div>
                      <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Reason for Request</label>
                      <textarea required value={requestForm.reason} onChange={e => setRequestForm({...requestForm, reason: e.target.value})} rows={3} className="w-full p-4 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none resize-none" placeholder="Provide a reason for the adjustment..." />
                   </div>
                   <button type="submit" disabled={requestLoading} className="w-full py-4 bg-[#534AB7] text-white rounded-2xl font-black text-[13px] uppercase tracking-widest shadow-xl shadow-purple-900/30 disabled:opacity-50">Submit Request</button>
                </form>
             </div>
          </div>
        )}

        {/* Withdrawal Modal */}
        {showCancelModal && selectedAssignment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#1A1727]/60 backdrop-blur-sm animate-in fade-in duration-200">
             <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 border border-[#F1F0F4]">
                <div className="flex justify-between items-center mb-6">
                  <div>
                     <h2 className="text-xl font-black text-red-600 tracking-tight">Withdraw from Course</h2>
                     <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest mt-1">{selectedAssignment.program?.title}</p>
                  </div>
                  <button onClick={() => setShowCancelModal(false)} className="p-2 text-[#9CA3AF] hover:text-[#1A1727]"><X size={20} /></button>
                </div>
                <form onSubmit={handleRequestCancel} className="space-y-6">
                   <div>
                      <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Reason for Withdrawal</label>
                      <textarea required value={requestForm.reason} onChange={e => setRequestForm({...requestForm, reason: e.target.value})} rows={4} className="w-full p-4 bg-red-50 border-none rounded-2xl text-sm font-bold text-red-900 outline-none resize-none" placeholder="Please explain why you cannot attend..." />
                   </div>
                   <button type="submit" disabled={requestLoading} className="w-full py-4 bg-red-600 text-white rounded-2xl font-black text-[13px] uppercase tracking-widest shadow-xl shadow-red-900/30 disabled:opacity-50 flex items-center justify-center gap-2"><XCircle size={16} strokeWidth={3} /> Confirm Withdrawal</button>
                </form>
             </div>
          </div>
        )}
      </div>
    </EmployeeLayout>
  )
}
