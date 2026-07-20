'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Mail, Bell, Save, Check } from 'lucide-react'
import { api } from '@/lib/api'

interface Preference {
  notification_type: string
  email_enabled: boolean
  push_enabled: boolean
}

const NOTIFICATION_TYPES: Record<string, string> = {
  leave_submitted: 'Leave Requests',
  leave_approved: 'Leave Approvals',
  leave_rejected: 'Leave Rejections',
  overtime_submitted: 'Overtime Requests',
  overtime_approved: 'Overtime Approvals',
  overtime_rejected: 'Overtime Rejections',
  expense_submitted: 'Expense Claims',
  expense_approved: 'Expense Approvals',
  expense_rejected: 'Expense Rejections',
  correction_submitted: 'Attendance Corrections',
  correction_approved: 'Correction Approvals',
  correction_rejected: 'Correction Rejections',
  payroll_finalized: 'Payroll Finalized',
  salary_revised: 'Salary Revised',
  training_assigned: 'Training Assigned',
  clock_flagged: 'Clock-in Flagged',
  announcement_posted: 'Announcements',
  document_signed: 'Document Signed',
  event_invite: 'Event Invitations',
  event_reminder: 'Event Reminders',
  roster_published: 'Roster Published',
  swap_request: 'Shift Swap Requests',
  swap_approved: 'Shift Swap Approved',
  swap_rejected: 'Shift Swap Rejected',
  task_assigned: 'Task Assigned',
  task_reminder: 'Task Reminders',
}

export function NotificationPreferences() {
  const [preferences, setPreferences] = useState<Record<string, Preference>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadPreferences()
  }, [])

  async function loadPreferences() {
    setLoading(true)
    try {
      const result = await api.get<Preference[]>('/notifications/preferences')
      if (!result.ok) throw new Error(result.error)
      const map: Record<string, Preference> = {}
      ;(result.data || []).forEach((p: Preference) => {
        map[p.notification_type] = p
      })
      // Ensure all known types have an entry
      Object.keys(NOTIFICATION_TYPES).forEach(type => {
        if (!map[type]) {
          map[type] = { notification_type: type, email_enabled: true, push_enabled: true }
        }
      })
      setPreferences(map)
    } catch {
      toast.error('Failed to load preferences')
      // Default all on
      const map: Record<string, Preference> = {}
      Object.keys(NOTIFICATION_TYPES).forEach(type => {
        map[type] = { notification_type: type, email_enabled: true, push_enabled: true }
      })
      setPreferences(map)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload = Object.values(preferences).map(p => ({
        notification_type: p.notification_type,
        email_enabled: p.email_enabled,
        push_enabled: p.push_enabled,
      }))
      const result = await api.post('/notifications/preferences', { preferences: payload })
      if (!result.ok) throw new Error(result.error)
      toast.success('Preferences saved')
    } catch {
      toast.error('Failed to save preferences')
    } finally {
      setSaving(false)
    }
  }

  function toggle(type: string, field: 'email_enabled' | 'push_enabled') {
    setPreferences(prev => ({
      ...prev,
      [type]: { ...prev[type], [field]: !prev[type]?.[field] },
    }))
  }

  if (loading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#534AB7] mx-auto mb-3" />
        <div className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">Loading Preferences...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[13px] font-black text-[#1A1727] flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#534AB7]" />
            Notification Preferences
          </h2>
          <p className="text-[11px] text-[#9CA3AF] mt-1">Choose how you want to be notified for each event type.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-[#534AB7] text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-[#1E1854] transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          Save
        </button>
      </div>

      <div className="bg-white rounded-[20px] border border-[#F1F0F4] shadow-sm overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-5 py-3 bg-[#F8F7F9] border-b border-[#F1F0F4] text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">
          <div>Notification Type</div>
          <div className="flex items-center gap-1"><Mail size={10} /> Email</div>
          <div className="flex items-center gap-1"><Bell size={10} /> Push</div>
        </div>
        <div className="divide-y divide-[#F1F0F4]">
          {Object.entries(NOTIFICATION_TYPES).map(([type, label]) => {
            const pref = preferences[type] || { email_enabled: true, push_enabled: true }
            return (
              <div key={type} className="grid grid-cols-[1fr_auto_auto] gap-4 px-5 py-3 items-center hover:bg-[#F8F7F9]/50 transition-colors">
                <div className="text-sm font-bold text-[#1A1727]">{label}</div>
                <button
                  onClick={() => toggle(type, 'email_enabled')}
                  className={`w-10 h-6 rounded-full transition-all relative ${pref.email_enabled ? 'bg-[#534AB7]' : 'bg-[#F1F0F4]'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${pref.email_enabled ? 'left-5' : 'left-1'}`} />
                </button>
                <button
                  onClick={() => toggle(type, 'push_enabled')}
                  className={`w-10 h-6 rounded-full transition-all relative ${pref.push_enabled ? 'bg-[#534AB7]' : 'bg-[#F1F0F4]'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${pref.push_enabled ? 'left-5' : 'left-1'}`} />
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-purple-50 rounded-[20px] border border-purple-100 p-5">
        <h3 className="text-[12px] font-black text-purple-800 mb-2">Browser Push Notifications</h3>
        <p className="text-[11px] text-purple-700 mb-3">Get notified instantly even when TouchOrbit is not open.</p>
        <PushNotificationPrompt />
      </div>
    </div>
  )
}

function PushNotificationPrompt() {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [subscribed, setSubscribed] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window)) {
      setPermission('unsupported')
      return
    }
    setPermission(Notification.permission)
  }, [])

  async function requestPermission() {
    if (!('Notification' in window)) return
    const result = await Notification.requestPermission()
    setPermission(result)
    if (result === 'granted') {
      setSubscribed(true)
      toast.success('Push notifications enabled')
    } else {
      toast.error('Push notifications blocked')
    }
  }

  if (permission === 'unsupported') {
    return (
      <div className="text-[11px] font-bold text-purple-600">Your browser does not support push notifications.</div>
    )
  }

  if (permission === 'granted' || subscribed) {
    return (
      <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-600">
        <Check size={14} strokeWidth={3} /> Push notifications are enabled
      </div>
    )
  }

  if (permission === 'denied') {
    return (
      <div className="text-[11px] font-bold text-red-600">
        Push notifications are blocked. Enable them in your browser settings to receive alerts.
      </div>
    )
  }

  return (
    <button
      onClick={requestPermission}
      className="px-4 py-2 bg-[#534AB7] text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-[#1E1854] transition-all"
    >
      Enable Push Notifications
    </button>
  )
}
