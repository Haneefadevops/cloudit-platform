'use client'

import React, { useState, useEffect } from 'react'
import { AnimatedModal, PillBadge } from '@/components/ui-touchorbit'
import { ScopeSelector, EventScope } from './ScopeSelector'
import { AttendeePicker } from './AttendeePicker'
import { Video, Bell, Check, Clock, AlertTriangle, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UnifiedCalendarEvent } from '@/hooks/use-calendar'

export type EventTypeOption = 'meeting' | 'training' | 'company_event' | 'task' | 'holiday'

interface EventEditFormData {
  title: string
  description: string
  event_date: string
  start_time: string
  end_time: string
  all_day: boolean
  event_type: EventTypeOption
  event_scope: EventScope
  branch_id: string
  department_id: string
  secondary_branch_id: string
  secondary_department_id: string
  team_member_ids: string[]
  meeting_provider: 'google_meet' | 'zoom' | 'microsoft_teams' | 'manual' | ''
  meeting_url: string
  requires_rsvp: boolean
  reminder_minutes: number
  location: string
  status: 'draft' | 'confirmed' | 'cancelled' | 'rescheduled'
}

const EVENT_TYPE_OPTIONS: { id: EventTypeOption; label: string; color: string }[] = [
  { id: 'meeting', label: 'Meeting', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { id: 'training', label: 'Training', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { id: 'company_event', label: 'Company Event', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  { id: 'task', label: 'Task Deadline', color: 'bg-slate-50 text-slate-700 border-slate-200' },
  { id: 'holiday', label: 'Holiday', color: 'bg-red-50 text-red-700 border-red-200' },
]

const MEETING_PROVIDERS = [
  { id: 'google_meet', label: 'Google Meet', icon: 'G' },
  { id: 'zoom', label: 'Zoom', icon: 'Z' },
  { id: 'microsoft_teams', label: 'Teams', icon: 'T' },
  { id: 'manual', label: 'Manual Link', icon: '🔗' },
]

const REMINDER_OPTIONS = [
  { value: 0, label: 'None' },
  { value: 5, label: '5 min before' },
  { value: 15, label: '15 min before' },
  { value: 30, label: '30 min before' },
  { value: 60, label: '1 hour before' },
  { value: 1440, label: '1 day before' },
]

function eventToForm(event: UnifiedCalendarEvent | null): EventEditFormData {
  if (!event) return {
    title: '', description: '', event_date: '', start_time: '', end_time: '', all_day: false,
    event_type: 'meeting', event_scope: 'organization', branch_id: '', department_id: '',
    secondary_branch_id: '', secondary_department_id: '', team_member_ids: [],
    meeting_provider: '', meeting_url: '', requires_rsvp: false, reminder_minutes: 30,
    location: '', status: 'confirmed',
  }
  const start = event.startAt ? new Date(event.startAt) : null
  const end = event.endAt ? new Date(event.endAt) : null
  const raw = event.raw || {}
  return {
    title: event.title,
    description: event.description || '',
    event_date: start ? start.toISOString().split('T')[0] : '',
    start_time: start && !event.allDay ? `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}` : '',
    end_time: end && !event.allDay ? `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}` : '',
    all_day: event.allDay || false,
    event_type: (raw.event_type === 'announcement' ? 'company_event' : raw.event_type) || 'meeting',
    event_scope: raw.event_scope || 'organization',
    branch_id: raw.branch_id || '',
    department_id: raw.department_id || '',
    secondary_branch_id: raw.secondary_branch_id || '',
    secondary_department_id: raw.secondary_department_id || '',
    team_member_ids: raw.team_member_ids || [],
    meeting_provider: raw.meeting_provider || '',
    meeting_url: event.meetingUrl || '',
    requires_rsvp: raw.requires_rsvp || false,
    reminder_minutes: raw.reminder_minutes || 30,
    location: event.location || '',
    status: event.status || 'confirmed',
  }
}

interface EventEditModalProps {
  event: UnifiedCalendarEvent | null
  open: boolean
  onClose: () => void
  onSubmit: (id: string, data: EventEditFormData) => void | Promise<void>
  onReschedule?: (id: string, data: { new_date: string; new_start_time: string; new_end_time: string; reason: string }) => void | Promise<void>
}

export function EventEditModal({ event, open, onClose, onSubmit, onReschedule }: EventEditModalProps) {
  const [form, setForm] = useState<EventEditFormData>(eventToForm(null))
  const [submitting, setSubmitting] = useState(false)
  const [showReschedule, setShowReschedule] = useState(false)
  const [rescheduleData, setRescheduleData] = useState({ new_date: '', new_start_time: '', new_end_time: '', reason: '' })

  useEffect(() => {
    setForm(eventToForm(event))
    setShowReschedule(false)
    setRescheduleData({ new_date: '', new_start_time: '', new_end_time: '', reason: '' })
  }, [event])

  const update = <K extends keyof EventEditFormData>(key: K, value: EventEditFormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!event?.id || !form.title.trim() || !form.event_date) return
    setSubmitting(true)
    try {
      await onSubmit(event.id, form)
    } finally {
      setSubmitting(false)
    }
  }

  const handleReschedule = async () => {
    if (!event?.id || !rescheduleData.new_date || !onReschedule) return
    setSubmitting(true)
    try {
      await onReschedule(event.id, rescheduleData)
      setShowReschedule(false)
    } finally {
      setSubmitting(false)
    }
  }

  if (!event) return null

  const showAttendees = form.event_scope === 'team' || form.event_scope === 'one_on_one'

  return (
    <AnimatedModal open={open} onClose={onClose} title="Edit Event">
      {/* Status banner */}
      {event.status && event.status !== 'confirmed' && (
        <div className="mb-4 px-4 py-2.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-500 shrink-0" />
          <span className="text-[11px] font-bold text-amber-700">
            This event is <PillBadge status={event.status} className="text-[9px] px-1.5">{event.status}</PillBadge>
          </span>
        </div>
      )}

      {showReschedule ? (
        <div className="space-y-5">
          <div className="flex items-center gap-2 text-[#534AB7]">
            <CalendarDays size={16} />
            <span className="text-sm font-black">Reschedule Event</span>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">New Date *</label>
              <input
                type="date" required
                value={rescheduleData.new_date}
                onChange={e => setRescheduleData(d => ({ ...d, new_date: e.target.value }))}
                className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">New Start</label>
              <input
                type="time"
                value={rescheduleData.new_start_time}
                onChange={e => setRescheduleData(d => ({ ...d, new_start_time: e.target.value }))}
                className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">New End</label>
              <input
                type="time"
                value={rescheduleData.new_end_time}
                onChange={e => setRescheduleData(d => ({ ...d, new_end_time: e.target.value }))}
                className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Reason</label>
            <textarea
              value={rescheduleData.reason}
              onChange={e => setRescheduleData(d => ({ ...d, reason: e.target.value }))}
              rows={2}
              placeholder="Why is this being rescheduled?"
              className="w-full p-4 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none resize-none placeholder:text-[#D1D5DB]"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowReschedule(false)}
              className="flex-1 py-3 text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] hover:bg-[#F8F7F9] rounded-xl transition-all"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleReschedule}
              disabled={submitting || !rescheduleData.new_date}
              className="flex-1 py-3 bg-amber-500 text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-amber-900/20 active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {submitting ? <Clock size={14} className="animate-spin" /> : <CalendarDays size={14} />}
              Confirm Reschedule
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
          {/* Title */}
          <div>
            <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Event Title *</label>
            <input required value={form.title} onChange={e => update('title', e.target.value)}
              className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none focus:ring-4 focus:ring-[#534AB7]/10 transition-all" />
          </div>

          {/* Event Type */}
          <div>
            <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Event Type</label>
            <div className="flex flex-wrap gap-2">
              {EVENT_TYPE_OPTIONS.map(opt => (
                <button key={opt.id} type="button" onClick={() => update('event_type', opt.id)}
                  className={cn('px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all', form.event_type === opt.id ? opt.color : 'bg-white border-[#F1F0F4] text-[#9CA3AF] hover:bg-[#F8F7F9]')}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Date *</label>
              <input type="date" required value={form.event_date} onChange={e => update('event_date', e.target.value)}
                className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Start</label>
              <input type="time" value={form.start_time} onChange={e => update('start_time', e.target.value)} disabled={form.all_day}
                className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none disabled:opacity-40" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">End</label>
              <input type="time" value={form.end_time} onChange={e => update('end_time', e.target.value)} disabled={form.all_day}
                className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none disabled:opacity-40" />
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div className="relative">
              <input type="checkbox" checked={form.all_day} onChange={e => update('all_day', e.target.checked)} className="sr-only peer" />
              <div className="w-10 h-6 bg-[#F1F0F4] peer-checked:bg-[#534AB7] rounded-full transition-all" />
              <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-all peer-checked:translate-x-4" />
            </div>
            <span className="text-xs font-bold text-[#374151]">All day event</span>
          </label>

          {/* Scope */}
          <ScopeSelector
            value={form.event_scope}
            onChange={v => update('event_scope', v)}
            branchId={form.branch_id} onBranchChange={v => update('branch_id', v)}
            departmentId={form.department_id} onDepartmentChange={v => update('department_id', v)}
            secondaryBranchId={form.secondary_branch_id} onSecondaryBranchChange={v => update('secondary_branch_id', v)}
            secondaryDepartmentId={form.secondary_department_id} onSecondaryDepartmentChange={v => update('secondary_department_id', v)}
          />

          {showAttendees && (
            <div>
              <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">
                {form.event_scope === 'one_on_one' ? 'Invitee' : 'Team Members'}
              </label>
              <AttendeePicker selectedIds={form.team_member_ids} onChange={ids => update('team_member_ids', ids)} maxSelections={form.event_scope === 'one_on_one' ? 1 : undefined} />
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Location</label>
            <input value={form.location} onChange={e => update('location', e.target.value)}
              placeholder="e.g. Conference Room A or Remote"
              className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none placeholder:text-[#D1D5DB]" />
          </div>

          <div>
            <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Meeting Link</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {MEETING_PROVIDERS.map(p => (
                <button key={p.id} type="button" onClick={() => update('meeting_provider', p.id as any)}
                  className={cn('px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all flex items-center gap-1.5', form.meeting_provider === p.id ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-white border-[#F1F0F4] text-[#9CA3AF] hover:bg-[#F8F7F9]')}>
                  <Video size={12} /> {p.label}
                </button>
              ))}
            </div>
            {form.meeting_provider && (
              <input value={form.meeting_url} onChange={e => update('meeting_url', e.target.value)}
                placeholder="Paste meeting link..."
                className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none placeholder:text-[#D1D5DB]" />
            )}
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div className="relative">
              <input type="checkbox" checked={form.requires_rsvp} onChange={e => update('requires_rsvp', e.target.checked)} className="sr-only peer" />
              <div className="w-10 h-6 bg-[#F1F0F4] peer-checked:bg-[#534AB7] rounded-full transition-all" />
              <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-all peer-checked:translate-x-4" />
            </div>
            <span className="text-xs font-bold text-[#374151]">Require RSVP</span>
          </label>

          <div>
            <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Reminder</label>
            <div className="flex flex-wrap gap-2">
              {REMINDER_OPTIONS.map(opt => (
                <button key={opt.value} type="button" onClick={() => update('reminder_minutes', opt.value)}
                  className={cn('px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all flex items-center gap-1.5', form.reminder_minutes === opt.value ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-white border-[#F1F0F4] text-[#9CA3AF] hover:bg-[#F8F7F9]')}>
                  <Bell size={12} /> {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Description</label>
            <textarea value={form.description} onChange={e => update('description', e.target.value)} rows={3}
              className="w-full p-4 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none resize-none placeholder:text-[#D1D5DB]" />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowReschedule(true)}
              className="px-4 py-3 bg-amber-50 text-amber-700 rounded-xl text-[11px] font-black uppercase tracking-widest border border-amber-200 hover:bg-amber-100 transition-all flex items-center gap-2">
              <CalendarDays size={14} /> Reschedule
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 py-3 text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] hover:bg-[#F8F7F9] rounded-xl transition-all">
              Cancel
            </button>
            <button type="submit" disabled={submitting || !form.title.trim() || !form.event_date}
              className="flex-1 py-3 bg-[#534AB7] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-purple-900/20 active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
              {submitting ? <Clock size={14} className="animate-spin" /> : <Check size={14} />}
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}
    </AnimatedModal>
  )
}
