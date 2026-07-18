'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { Clock, Plus, Trash2, X, Repeat } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AvailabilitySlot {
  id: string
  day_of_week: number
  start_time?: string
  end_time?: string
  is_available: boolean
  is_recurring: boolean
  reason?: string
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function AvailabilitySetter() {
  const { isLoaded, isSignedIn } = useAuth()
  const [slots, setSlots] = useState<AvailabilitySlot[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    day_of_week: 1,
    start_time: '09:00',
    end_time: '17:00',
    is_available: true,
    is_recurring: true,
    reason: '',
  })

  const loadSlots = useCallback(async () => {
    if (!isLoaded || !isSignedIn) return
    setLoading(true)
    try {
      const empRes = await api.get<{ id: string }>('/employees/me')
      if (!empRes.ok || !empRes.data) throw new Error(empRes.error || 'Employee not found')
      const res = await api.get<AvailabilitySlot[]>(`/roster/availability?employee_id=${empRes.data.id}`)
      if (!res.ok) throw new Error(res.error)
      setSlots(res.data || [])
    } finally {
      setLoading(false)
    }
  }, [isLoaded, isSignedIn])

  useEffect(() => {
    loadSlots()
  }, [loadSlots])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!isSignedIn) return
    try {
      const res = await api.post<AvailabilitySlot>('/roster/availability', {
        day_of_week: form.day_of_week,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        is_available: form.is_available,
        is_recurring: form.is_recurring,
        reason: form.reason || null,
        effective_from: new Date().toISOString().slice(0, 10),
      })
      if (!res.ok) throw new Error(res.error)
      toast.success('Availability updated')
      setShowForm(false)
      loadSlots()
    } catch {
      toast.error('Failed to save')
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await api.del(`/roster/availability/${id}`)
      if (!res.ok) throw new Error(res.error)
      toast.success('Removed')
      loadSlots()
    } catch {
      toast.error('Failed to delete')
    }
  }

  const grouped = slots.reduce((acc, slot) => {
    if (!acc[slot.day_of_week]) acc[slot.day_of_week] = []
    acc[slot.day_of_week].push(slot)
    return acc
  }, {} as Record<number, AvailabilitySlot[]>)

  return (
    <div className="bg-white rounded-[24px] p-5 border border-[#F1F0F4] shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-black text-[#1A1727]">My Availability</h3>
          <p className="text-[10px] text-[#9CA3AF] font-black uppercase tracking-widest mt-0.5">When I can work</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="w-8 h-8 rounded-xl bg-[#534AB7] text-white flex items-center justify-center hover:bg-[#1E1854] transition-all active:scale-95"
        >
          {showForm ? <X size={14} strokeWidth={3} /> : <Plus size={14} strokeWidth={3} />}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="mb-4 p-4 bg-[#F8F7F9] rounded-2xl border border-[#F1F0F4] space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-1">Day</label>
              <select value={form.day_of_week} onChange={e => setForm(f => ({ ...f, day_of_week: parseInt(e.target.value) }))} className="w-full px-3 py-2 bg-white border border-[#F1F0F4] rounded-xl text-xs font-bold text-[#1A1727] outline-none">
                {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-1">Available?</label>
              <select value={form.is_available ? 'true' : 'false'} onChange={e => setForm(f => ({ ...f, is_available: e.target.value === 'true' }))} className="w-full px-3 py-2 bg-white border border-[#F1F0F4] rounded-xl text-xs font-bold text-[#1A1727] outline-none">
                <option value="true">Available</option>
                <option value="false">Unavailable</option>
              </select>
            </div>
          </div>
          {form.is_available && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-1">From</label>
                <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} className="w-full px-3 py-2 bg-white border border-[#F1F0F4] rounded-xl text-xs font-bold text-[#1A1727] outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-1">To</label>
                <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} className="w-full px-3 py-2 bg-white border border-[#F1F0F4] rounded-xl text-xs font-bold text-[#1A1727] outline-none" />
              </div>
            </div>
          )}
          <div>
            <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-1">Reason (optional)</label>
            <input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. School run" className="w-full px-3 py-2 bg-white border border-[#F1F0F4] rounded-xl text-xs font-bold text-[#1A1727] outline-none placeholder:text-[#D1D5DB]" />
          </div>
          <button type="submit" className="w-full py-2.5 bg-[#534AB7] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-purple-900/20 active:scale-95 transition-all">Save</button>
        </form>
      )}

      {loading ? (
        <div className="space-y-2 animate-pulse">
          {[1, 2].map(i => <div key={i} className="h-10 bg-[#F8F7F9] rounded-xl" />)}
        </div>
      ) : slots.length === 0 ? (
        <div className="text-center py-4 text-[11px] text-[#9CA3AF] font-medium">No availability set yet.</div>
      ) : (
        <div className="space-y-2">
          {DAY_NAMES.map((dayName, dayIdx) => {
            const daySlots = grouped[dayIdx]
            if (!daySlots?.length) return null
            return (
              <div key={dayIdx} className="flex items-center gap-2">
                <div className="w-10 text-[10px] font-black text-[#9CA3AF] uppercase">{dayName}</div>
                <div className="flex-1 flex flex-wrap gap-1.5">
                  {daySlots.map(slot => (
                    <div key={slot.id} className={cn('flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold border', slot.is_available ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700')}>
                      {slot.is_available ? <span className="flex items-center gap-1"><Clock size={10} /> {slot.start_time?.slice(0, 5)}-{slot.end_time?.slice(0, 5)}</span> : <span className="flex items-center gap-1"><X size={10} /> Unavailable</span>}
                      {slot.is_recurring && <Repeat size={9} className="text-[#9CA3AF]" />}
                      <button onClick={() => handleDelete(slot.id)} className="ml-1 text-[#9CA3AF] hover:text-red-500 transition-colors"><Trash2 size={10} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
