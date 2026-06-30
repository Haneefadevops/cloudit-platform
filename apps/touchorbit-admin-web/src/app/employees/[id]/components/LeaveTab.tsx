'use client'

import { useState } from 'react'
import { Plus, X, Calendar, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { LeaveRing } from './LeaveRing'

interface LeaveBalance {
  id: string
  leave_type: string
  total_days: number
  remaining_days: number
}

interface LeaveRecord {
  id: string
  leave_type: string
  start_date: string
  end_date: string
  days_count: number
  status: string
}

interface LeaveTabProps {
  employeeId: string
  organizationId: string | null | undefined
  balances: LeaveBalance[]
  history: LeaveRecord[]
  isLoading: boolean
  onUpdate: () => void
}

const STATUS_STYLES: Record<string, string> = {
  approved: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  rejected: 'bg-red-50 text-red-600 border-red-100',
  pending: 'bg-amber-50 text-amber-600 border-amber-100',
}

export function LeaveTab({ employeeId, organizationId, balances, history, isLoading, onUpdate }: LeaveTabProps) {
  const [showAdjust, setShowAdjust] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    leave_type: 'annual',
    adjustment_type: 'add',
    days: '',
    reason: '',
  })

  const handleAdjust = async () => {
    if (!form.days || !form.reason) { toast.error('All fields required'); return }
    const days = parseFloat(form.days)
    if (isNaN(days) || days <= 0) { toast.error('Enter a valid number of days'); return }
    setSaving(true)
    try {
      const delta = form.adjustment_type === 'add' ? days : -days
      const existing = balances.find((b) => b.leave_type === form.leave_type)
      if (existing) {
        const newRemaining = Math.max(0, (existing.remaining_days || 0) + delta)
        const newTotal = Math.max(0, (existing.total_days || 0) + delta)
        await supabase.from('leave_balances').update({ remaining_days: newRemaining, total_days: newTotal }).eq('id', existing.id)
      } else {
        const newDays = Math.max(0, delta)
        await supabase.from('leave_balances').insert({
          employee_id: employeeId,
          organization_id: organizationId,
          leave_type: form.leave_type,
          total_days: newDays,
          remaining_days: newDays,
          used_days: 0,
        })
      }
      toast.success(`Leave balance ${form.adjustment_type === 'add' ? 'increased' : 'decreased'} by ${days} day${days !== 1 ? 's' : ''}`)
      setShowAdjust(false)
      setForm({ leave_type: 'annual', adjustment_type: 'add', days: '', reason: '' })
      onUpdate()
    } catch (e: any) {
      toast.error(e.message || 'Failed to adjust balance')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Leave Balances with Rings */}
      <div className="bg-white rounded-2xl border border-[#C7C3D0] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[13px] font-black text-[#1A1727] uppercase tracking-widest flex items-center gap-2">
            <Calendar size={16} className="text-[#534AB7]" /> Leave Balances
          </h3>
          <button
            onClick={() => { setForm({ leave_type: 'annual', adjustment_type: 'add', days: '', reason: '' }); setShowAdjust(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-[#534AB7] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-sm hover:bg-[#1E1854] transition-colors"
          >
            <Plus size={13} /> Adjust
          </button>
        </div>
        {isLoading ? (
          <div className="py-8 text-center animate-pulse">
            <div className="h-4 bg-[#F1F0F4] rounded w-32 mx-auto" />
          </div>
        ) : balances.length === 0 ? (
          <div className="py-8 text-center text-[13px] font-bold text-[#9994A8]">No leave balances on record</div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-5 gap-6">
            {balances.map((b) => (
              <LeaveRing
                key={b.id}
                label={b.leave_type.replace('_', ' ') + ' Leave'}
                remaining={b.remaining_days ?? 0}
                total={b.total_days ?? 0}
              />
            ))}
          </div>
        )}
      </div>

      {/* Leave History */}
      <div className="bg-white rounded-2xl border border-[#C7C3D0] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#F1F0F4]">
          <h3 className="text-[13px] font-black text-[#1A1727] uppercase tracking-widest flex items-center gap-2">
            <Calendar size={16} className="text-[#534AB7]" /> Leave History
          </h3>
        </div>
        {isLoading ? (
          <div className="py-16 text-center animate-pulse">
            <div className="h-4 bg-[#F1F0F4] rounded w-40 mx-auto" />
          </div>
        ) : history.length === 0 ? (
          <div className="py-16 text-center text-[13px] font-bold text-[#9994A8]">No leave records found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#F4F3F7] border-b border-[#F1F0F4]">
                  {['Type', 'From', 'To', 'Days', 'Status'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-black text-[#6B6578] uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F0F4]">
                {history.map((lr) => (
                  <tr key={lr.id} className="hover:bg-[#F8F7F9] transition-colors">
                    <td className="px-5 py-3 text-[12.5px] font-bold text-[#1A1727] capitalize">{lr.leave_type}</td>
                    <td className="px-5 py-3 text-[12px] font-bold text-[#6B6578]">
                      {new Date(lr.start_date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-3 text-[12px] font-bold text-[#6B6578]">
                      {new Date(lr.end_date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-3 text-[12.5px] font-black text-[#1A1727]">{lr.days_count}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${STATUS_STYLES[lr.status] || STATUS_STYLES.pending}`}>
                        {lr.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Adjust Dialog */}
      {showAdjust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#1A1727]/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 border border-[#F1F0F4]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-black text-[#1A1727] tracking-tight">Adjust Leave Balance</h2>
              <button onClick={() => setShowAdjust(false)} className="p-2 text-[#9994A8] hover:text-[#1A1727] transition-colors">
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-[#9994A8] uppercase tracking-widest mb-1.5">Leave Type</label>
                <select
                  value={form.leave_type}
                  onChange={(e) => setForm({ ...form, leave_type: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F8F7F9] border border-[#F1F0F4] rounded-xl text-sm font-bold text-[#1A1727] outline-none focus:ring-2 focus:ring-[#534AB7]/20"
                >
                  <option value="annual">Annual Leave</option>
                  <option value="casual">Casual Leave</option>
                  <option value="sick">Sick Leave</option>
                  <option value="maternity">Maternity Leave</option>
                  <option value="paternity">Paternity Leave</option>
                  <option value="unpaid">Unpaid Leave</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-[#9994A8] uppercase tracking-widest mb-1.5">Adjustment</label>
                <div className="flex rounded-xl overflow-hidden border border-[#F1F0F4]">
                  {[{ val: 'add', label: 'Add Days' }, { val: 'deduct', label: 'Deduct Days' }].map((opt) => (
                    <button
                      key={opt.val}
                      onClick={() => setForm({ ...form, adjustment_type: opt.val })}
                      className={`flex-1 py-2 text-[11px] font-black uppercase tracking-wider transition-all ${
                        form.adjustment_type === opt.val
                          ? opt.val === 'add' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                          : 'bg-[#F8F7F9] text-[#9994A8] hover:text-[#1A1727]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-[#9994A8] uppercase tracking-widest mb-1.5">Number of Days</label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={form.days}
                  onChange={(e) => setForm({ ...form, days: e.target.value })}
                  placeholder="e.g. 1.5"
                  className="w-full px-3 py-2 bg-[#F8F7F9] border border-[#F1F0F4] rounded-xl text-sm font-bold text-[#1A1727] outline-none focus:ring-2 focus:ring-[#534AB7]/20"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-[#9994A8] uppercase tracking-widest mb-1.5">Reason</label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="e.g. Annual carry-forward, Manual correction..."
                  className="w-full px-3 py-2 bg-[#F8F7F9] border border-[#F1F0F4] rounded-xl text-sm font-bold text-[#1A1727] outline-none focus:ring-2 focus:ring-[#534AB7]/20 h-20 resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowAdjust(false)}
                  className="flex-1 py-2.5 bg-[#F8F7F9] border border-[#F1F0F4] text-[#1A1727] rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-[#F1F0F4] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdjust}
                  disabled={saving}
                  className="flex-1 py-2.5 bg-[#534AB7] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-sm hover:bg-[#1E1854] transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Apply'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
