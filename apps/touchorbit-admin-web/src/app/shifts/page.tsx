'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { Plus, Edit2, Trash2, Clock, Users, RefreshCw, X, ChevronRight, Check } from 'lucide-react'
import { toast } from 'sonner'

interface Shift {
  id: string
  name: string
  start_time: string
  end_time: string
  grace_period_minutes: number
  color: string
  status: 'active' | 'inactive'
  break_minutes?: number
}

interface ShiftFormData {
  name: string
  start_time: string
  end_time: string
  grace_period_minutes: number
  color: string
}

const defaultColors = [
  '#534AB7', // Primary Purple
  '#2563EB', // Blue
  '#10B981', // Green
  '#D97706', // Amber
  '#EF4444', // Red
  '#7C3AED', // Indigo
]

export default function ShiftsPage() {
  const { organizationId, isLoaded } = useAuth()
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingShift, setEditingShift] = useState<Shift | null>(null)
  const [formData, setFormData] = useState<ShiftFormData>({
    name: '',
    start_time: '09:00',
    end_time: '17:00',
    grace_period_minutes: 15,
    color: defaultColors[0],
  })

  useEffect(() => {
    if (isLoaded && organizationId) {
      loadShifts()
    }
  }, [isLoaded, organizationId])

  async function loadShifts() {
    setLoading(true)
    const res = await api.get<Shift[]>('/shifts')
    if (res.ok) {
      setShifts(res.data || [])
    } else {
      toast.error(res.error || 'Failed to load shifts')
    }
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.name.trim()) { toast.error('Enter a shift name'); return }

    try {
      if (editingShift) {
        const res = await api.patch<Shift>(`/shifts/${editingShift.id}`, {
          name: formData.name,
          start_time: formData.start_time,
          end_time: formData.end_time,
          color: formData.color,
        })
        if (!res.ok) throw new Error(res.error)
        toast.success('Shift updated')
      } else {
        const res = await api.post<Shift>('/shifts', {
          name: formData.name,
          start_time: formData.start_time,
          end_time: formData.end_time,
          break_duration: 0,
          color: formData.color,
        })
        if (!res.ok) throw new Error(res.error)
        toast.success('Shift created')
      }
      setShowForm(false); setEditingShift(null); loadShifts()
    } catch (error: any) { toast.error(error.message || 'Failed to save shift') }
  }

  async function toggleStatus(shiftId: string, currentStatus: string) {
    try {
      const result = await api.patch<Shift>(`/shifts/${shiftId}`, {
        status: currentStatus === 'active' ? 'inactive' : 'active',
      })
      if (!result.ok) throw new Error(result.error || 'Failed to update status')
      toast.success('Status updated')
      loadShifts()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update status')
    }
  }

  function handleEdit(shift: Shift) {
    setEditingShift(shift)
    setFormData({
      name: shift.name,
      start_time: shift.start_time,
      end_time: shift.end_time,
      grace_period_minutes: shift.grace_period_minutes,
      color: shift.color,
    })
    setShowForm(true)
  }

  async function handleDelete(shiftId: string) {
    if (!confirm('Delete this shift?')) return
    const res = await api.del<{ deleted: boolean; id: string }>(`/shifts/${shiftId}`)
    if (res.ok) { toast.success('Shift deleted'); loadShifts() }
    else { toast.error(res.error || 'Failed to delete shift') }
  }

  function formatTime(time: string): string {
    const [hours, minutes] = time.split(':')
    const h = parseInt(hours)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 || 12
    return `${h12}:${minutes} ${ampm}`
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full bg-[#F8F7F9]">
        {/* Page Header */}
        <div className="bg-white border-b border-[#F1F0F4] px-8 py-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-[15px] font-bold text-[#1A1727]">Shift Templates</h1>
            <p className="text-[11px] text-[#9CA3AF]">Define operational work hours for scheduling</p>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={loadShifts} className="p-2 hover:bg-[#F8F7F9] rounded-lg text-[#9CA3AF] transition-all"><RefreshCw size={16} /></button>
             <button 
              onClick={() => { setEditingShift(null); setFormData({ name: '', start_time: '09:00', end_time: '17:00', grace_period_minutes: 15, color: defaultColors[0] }); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-1.5 bg-[#534AB7] text-white rounded-lg hover:bg-[#1E1854] transition-all text-xs font-bold shadow-md shadow-purple-900/20"
            >
              <Plus size={13} strokeWidth={3} />
              Add Shift
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 max-w-6xl mx-auto w-full">
           {loading ? (
             <div className="py-20 text-center font-bold text-[#D1D5DB] animate-pulse uppercase tracking-widest text-[10px]">Loading Configurations...</div>
           ) : shifts.length === 0 ? (
             <div className="py-20 text-center flex flex-col items-center">
                <Clock size={48} className="text-[#D1D5DB] mb-6 opacity-20" />
                <h3 className="text-lg font-black text-[#1A1727] uppercase tracking-widest mb-2">No Shifts Defined</h3>
                <button onClick={() => setShowForm(true)} className="px-6 py-2.5 bg-[#534AB7] text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-purple-900/20">Create First Shift</button>
             </div>
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
                {shifts.map(shift => (
                  <div key={shift.id} className="bg-white rounded-[24px] border border-[#F1F0F4] shadow-sm hover:shadow-xl hover:shadow-purple-900/5 transition-all group overflow-hidden">
                     <div className="h-1.5 w-full" style={{ backgroundColor: shift.color }} />
                     <div className="p-6">
                        <div className="flex justify-between items-start mb-6">
                           <div>
                              <h3 className="text-[16px] font-black text-[#1A1727]">{shift.name}</h3>
                              <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mt-1">
                                 <Clock size={12} strokeWidth={2.5} /> {formatTime(shift.start_time)} — {formatTime(shift.end_time)}
                              </div>
                           </div>
                           <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border flex items-center gap-1 ${shift.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                              <div className={`w-1 h-1 rounded-full ${shift.status === 'active' ? 'bg-emerald-600' : 'bg-gray-500'}`} />
                              {shift.status}
                           </span>
                        </div>

                        <div className="space-y-3 mb-8">
                           <div className="flex justify-between items-center text-[11px] font-medium">
                              <span className="text-[#9CA3AF] uppercase tracking-widest font-black text-[9px]">Grace Period</span>
                              <span className="text-[#1A1727] font-bold">{shift.grace_period_minutes} Minutes</span>
                           </div>
                           <div className="flex justify-between items-center text-[11px] font-medium">
                              <span className="text-[#9CA3AF] uppercase tracking-widest font-black text-[9px]">Total Duration</span>
                              <span className="text-[#534AB7] font-black">Full Shift</span>
                           </div>
                        </div>

                        <div className="pt-5 border-t border-[#F8F7F9] flex gap-2 opacity-40 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => handleEdit(shift)} className="flex-1 py-2.5 bg-[#F8F7F9] hover:bg-[#F3E8FF] text-[#1A1727] hover:text-[#534AB7] rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                              <Edit2 size={12} /> Edit
                           </button>
                           <button onClick={() => toggleStatus(shift.id, shift.status)} className="p-2.5 bg-[#F8F7F9] hover:bg-gray-100 text-[#9CA3AF] rounded-xl transition-all">
                              {shift.status === 'active' ? <X size={16} /> : <Check size={16} />}
                           </button>
                           <button onClick={() => handleDelete(shift.id)} className="p-2.5 bg-red-50 hover:bg-red-500 text-red-400 hover:text-white rounded-xl transition-all">
                              <Trash2 size={16} />
                           </button>
                        </div>
                     </div>
                  </div>
                ))}
             </div>
           )}
        </div>

        {/* Dialog */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#1A1727]/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 border border-[#F1F0F4]">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-black text-[#1A1727] tracking-tight">{editingShift ? 'Edit' : 'New'} Shift</h2>
                <button onClick={() => setShowForm(false)} className="p-2 text-[#9CA3AF] hover:text-[#1A1727] transition-all"><X size={20} strokeWidth={2.5} /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Shift Label</label>
                  <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none" placeholder="e.g. Morning Operational" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Starts At</label>
                    <input type="time" required value={formData.start_time} onChange={e => setFormData({...formData, start_time: e.target.value})} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727]" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Ends At</label>
                    <input type="time" required value={formData.end_time} onChange={e => setFormData({...formData, end_time: e.target.value})} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727]" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Grace Period (Mins)</label>
                  <input type="number" required value={formData.grace_period_minutes} onChange={e => setFormData({...formData, grace_period_minutes: parseInt(e.target.value)})} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727]" />
                </div>
                <div>
                   <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-3 ml-1">Shift Identification Color</label>
                   <div className="flex gap-2.5">
                      {defaultColors.map(c => (
                        <button key={c} type="button" onClick={() => setFormData({...formData, color: c})} className={`w-10 h-10 rounded-xl transition-all shadow-sm ${formData.color === c ? 'scale-110 ring-4 ring-purple-100 border-2 border-white' : 'hover:scale-105'}`} style={{ backgroundColor: c }} />
                      ))}
                   </div>
                </div>
                <div className="flex gap-4 pt-2">
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] hover:bg-[#F8F7F9] rounded-xl">Cancel</button>
                  <button type="submit" className="flex-1 py-3 bg-[#534AB7] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-purple-900/20 active:scale-95 transition-all">Save Template</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
