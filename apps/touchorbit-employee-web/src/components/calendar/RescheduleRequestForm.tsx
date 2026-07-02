'use client'

import React, { useState } from 'react'
import { AnimatedModal } from '@/components/ui-touchorbit'
import { CalendarDays, Clock, Send, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RescheduleRequestFormProps {
  open: boolean
  onClose: () => void
  eventTitle: string
  eventDate: string
  onSubmit: (data: { new_date: string; new_start_time: string; new_end_time: string; reason: string }) => void | Promise<void>
}

export function RescheduleRequestForm({ open, onClose, eventTitle, eventDate, onSubmit }: RescheduleRequestFormProps) {
  const [form, setForm] = useState({ new_date: '', new_start_time: '', new_end_time: '', reason: '' })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.new_date) return
    setSubmitting(true)
    try {
      await onSubmit(form)
      setForm({ new_date: '', new_start_time: '', new_end_time: '', reason: '' })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AnimatedModal open={open} onClose={onClose} title="Request Reschedule">
      <div className="mb-4 px-4 py-3 rounded-2xl bg-purple-50 border border-purple-200">
        <div className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-0.5">Event</div>
        <div className="text-sm font-bold text-purple-900">{eventTitle}</div>
        <div className="text-[11px] text-purple-600 font-medium">
          {new Date(eventDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">New Date *</label>
            <input
              type="date" required
              value={form.new_date}
              onChange={e => setForm(f => ({ ...f, new_date: e.target.value }))}
              className="w-full px-3 py-2.5 bg-[#F8F7F9] border border-[#F1F0F4] rounded-xl text-sm font-bold text-[#1A1727] outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Start</label>
            <input
              type="time"
              value={form.new_start_time}
              onChange={e => setForm(f => ({ ...f, new_start_time: e.target.value }))}
              className="w-full px-3 py-2.5 bg-[#F8F7F9] border border-[#F1F0F4] rounded-xl text-sm font-bold text-[#1A1727] outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">End</label>
            <input
              type="time"
              value={form.new_end_time}
              onChange={e => setForm(f => ({ ...f, new_end_time: e.target.value }))}
              className="w-full px-3 py-2.5 bg-[#F8F7F9] border border-[#F1F0F4] rounded-xl text-sm font-bold text-[#1A1727] outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Reason</label>
          <textarea
            value={form.reason}
            onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
            rows={3}
            placeholder="Explain why you need this event rescheduled..."
            className="w-full p-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none resize-none placeholder:text-[#D1D5DB]"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] hover:bg-[#F8F7F9] rounded-xl transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !form.new_date}
            className={cn(
              'flex-1 py-3 bg-[#534AB7] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-purple-900/20 active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2'
            )}
          >
            {submitting ? <Clock size={14} className="animate-spin" /> : <Send size={14} />}
            {submitting ? 'Sending...' : 'Send Request'}
          </button>
        </div>
      </form>
    </AnimatedModal>
  )
}
