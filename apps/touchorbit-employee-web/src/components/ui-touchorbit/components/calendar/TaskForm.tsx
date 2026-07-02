'use client'

import React, { useState } from 'react'
import { AnimatedModal } from './primitives/AnimatedModal'
import { PillBadge } from './primitives/PillBadge'
import { Check, Clock, Bell, Repeat } from 'lucide-react'
import { cn } from '../../lib/utils'

export type TaskCategory = 'work' | 'personal' | 'training' | 'compliance'

export interface TaskFormData {
  title: string
  description: string
  category: TaskCategory
  due_date: string
  due_time: string
  reminder_minutes: number
  is_recurring: boolean
  recurrence_rule: string
  employee_id: string
}

const CATEGORIES: { id: TaskCategory; label: string; color: string }[] = [
  { id: 'work', label: 'Work', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'personal', label: 'Personal', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { id: 'training', label: 'Training', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { id: 'compliance', label: 'Compliance', color: 'bg-red-50 text-red-700 border-red-200' },
]

const REMINDER_OPTIONS = [
  { value: 0, label: 'None' },
  { value: 5, label: '5 min before' },
  { value: 15, label: '15 min before' },
  { value: 30, label: '30 min before' },
  { value: 60, label: '1 hour before' },
  { value: 1440, label: '1 day before' },
]

const RECURRENCE_OPTIONS = [
  { value: '', label: 'Does not repeat' },
  { value: 'FREQ=DAILY', label: 'Daily' },
  { value: 'FREQ=WEEKLY', label: 'Weekly' },
  { value: 'FREQ=MONTHLY', label: 'Monthly' },
]

const DEFAULT_FORM: TaskFormData = {
  title: '',
  description: '',
  category: 'work',
  due_date: '',
  due_time: '',
  reminder_minutes: 30,
  is_recurring: false,
  recurrence_rule: '',
  employee_id: '',
}

interface TaskFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: TaskFormData) => void | Promise<void>
  initialData?: Partial<TaskFormData>
  mode?: 'create' | 'edit'
  employees?: { id: string; first_name: string; last_name: string }[]
  isAdmin?: boolean
}

export function TaskForm({ open, onClose, onSubmit, initialData, mode = 'create', employees = [], isAdmin = false }: TaskFormProps) {
  const [form, setForm] = useState<TaskFormData>({ ...DEFAULT_FORM, ...initialData })
  const [submitting, setSubmitting] = useState(false)

  React.useEffect(() => {
    if (open) {
      setForm({ ...DEFAULT_FORM, ...initialData })
    }
  }, [open, initialData])

  const update = <K extends keyof TaskFormData>(key: K, value: TaskFormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setSubmitting(true)
    try {
      await onSubmit(form)
      setForm({ ...DEFAULT_FORM })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AnimatedModal open={open} onClose={onClose} title={mode === 'create' ? 'New Task' : 'Edit Task'}>
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Title */}
        <div>
          <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Task Title *</label>
          <input
            required
            value={form.title}
            onChange={e => update('title', e.target.value)}
            className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none focus:ring-4 focus:ring-[#534AB7]/10 transition-all"
            placeholder="e.g. Complete Q3 expense report"
          />
        </div>

        {/* Assignee (admin only) */}
        {isAdmin && (
          <div>
            <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Assign To</label>
            <select
              value={form.employee_id}
              onChange={e => update('employee_id', e.target.value)}
              className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none"
            >
              <option value="">Select employee...</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Category */}
        <div>
          <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Category</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => update('category', cat.id)}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all',
                  form.category === cat.id ? cat.color : 'bg-white border-[#F1F0F4] text-[#9CA3AF] hover:bg-[#F8F7F9]'
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Due Date & Time */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Due Date</label>
            <input
              type="date"
              value={form.due_date}
              onChange={e => update('due_date', e.target.value)}
              className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Due Time</label>
            <input
              type="time"
              value={form.due_time}
              onChange={e => update('due_time', e.target.value)}
              className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none"
            />
          </div>
        </div>

        {/* Reminder */}
        <div>
          <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">
            <span className="flex items-center gap-1.5">
              <Bell size={10} /> Reminder
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            {REMINDER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => update('reminder_minutes', opt.value)}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all',
                  form.reminder_minutes === opt.value
                    ? 'bg-purple-50 border-purple-200 text-purple-700'
                    : 'bg-white border-[#F1F0F4] text-[#9CA3AF] hover:bg-[#F8F7F9]'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Recurrence */}
        <div>
          <label className="flex items-center gap-3 cursor-pointer select-none mb-3">
            <div className="relative">
              <input
                type="checkbox"
                checked={form.is_recurring}
                onChange={e => {
                  update('is_recurring', e.target.checked)
                  if (!e.target.checked) update('recurrence_rule', '')
                }}
                className="sr-only peer"
              />
              <div className="w-10 h-6 bg-[#F1F0F4] peer-checked:bg-[#534AB7] rounded-full transition-all" />
              <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-all peer-checked:translate-x-4" />
            </div>
            <span className="text-xs font-bold text-[#374151] flex items-center gap-1.5">
              <Repeat size={12} /> Recurring Task
            </span>
          </label>

          {form.is_recurring && (
            <select
              value={form.recurrence_rule}
              onChange={e => update('recurrence_rule', e.target.value)}
              className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none"
            >
              {RECURRENCE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Description</label>
          <textarea
            value={form.description}
            onChange={e => update('description', e.target.value)}
            rows={3}
            className="w-full p-4 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none resize-none placeholder:text-[#D1D5DB]"
            placeholder="Add details about this task..."
          />
        </div>

        {/* Actions */}
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
            disabled={submitting || !form.title.trim()}
            className="flex-1 py-3 bg-[#534AB7] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-purple-900/20 active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {submitting ? <Clock size={14} className="animate-spin" /> : <Check size={14} />}
            {submitting ? 'Saving...' : mode === 'create' ? 'Create Task' : 'Save Changes'}
          </button>
        </div>
      </form>
    </AnimatedModal>
  )
}
