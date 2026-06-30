'use client'

import { useState } from 'react'
import { CreditCard, Pencil, Check, X, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface Employee {
  id: string
  bank_name: string | null
  bank_account_number: string | null
  bank_branch: string | null
}

interface BankTabProps {
  employee: Employee
  onUpdate: () => void
}

export function BankTab({ employee, onUpdate }: BankTabProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    bank_name: employee.bank_name || '',
    bank_account_number: employee.bank_account_number || '',
    bank_branch: employee.bank_branch || '',
  })

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase.from('employees').update(form).eq('id', employee.id)
      if (error) throw error
      toast.success('Bank details updated')
      setIsEditing(false)
      onUpdate()
    } catch {
      toast.error('Failed to update bank details')
    } finally {
      setSaving(false)
    }
  }

  const fields = [
    { label: 'Bank Name', value: employee.bank_name },
    { label: 'Account Number', value: employee.bank_account_number },
    { label: 'Bank Branch', value: employee.bank_branch },
  ]

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="bg-white rounded-2xl border border-[#C7C3D0] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[13px] font-black text-[#1A1727] uppercase tracking-widest flex items-center gap-2">
            <CreditCard size={16} className="text-[#534AB7]" /> Bank & Payroll Details
          </h3>
          {isEditing ? (
            <div className="flex items-center gap-2">
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#534AB7] text-white rounded-lg text-[11px] font-black uppercase tracking-wider hover:bg-[#1E1854] transition-colors">
                <Check size={12} /> {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setIsEditing(false)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F8F7F9] text-[#6B6578] rounded-lg text-[11px] font-black uppercase tracking-wider hover:bg-[#F1F0F4] transition-colors">
                <X size={12} /> Cancel
              </button>
            </div>
          ) : (
            <button onClick={() => setIsEditing(true)} className="p-2 text-[#9994A8] hover:text-[#534AB7] hover:bg-[#F3E8FF] rounded-lg transition-colors">
              <Pencil size={14} />
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Bank Name', key: 'bank_name' },
              { label: 'Account Number', key: 'bank_account_number' },
              { label: 'Bank Branch', key: 'bank_branch' },
            ].map((f) => (
              <div key={f.key}>
                <label className="block text-[10px] font-black text-[#9994A8] uppercase tracking-widest mb-1">{f.label}</label>
                <input
                  value={(form as any)[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F8F7F9] border border-[#F1F0F4] rounded-xl text-sm font-bold text-[#1A1727] outline-none focus:ring-2 focus:ring-[#534AB7]/20 font-mono"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-y-5 gap-x-8">
            {fields.map((f) => (
              <div key={f.label}>
                <div className="text-[10px] font-black text-[#9994A8] uppercase tracking-widest mb-0.5">{f.label}</div>
                <div className="text-[13px] font-bold text-[#1A1727] font-mono tracking-tighter">{f.value || '—'}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl text-[11px] font-bold text-amber-700">
        <AlertTriangle size={16} />
        Bank details are used for payroll processing. Ensure accuracy before saving.
      </div>
    </div>
  )
}
