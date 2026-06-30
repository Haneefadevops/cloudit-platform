'use client'

import { useState } from 'react'
import { Phone, Plus, X, Star, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface EmergencyContact {
  name: string
  relationship: string
  phone: string
  email?: string
  is_primary?: boolean
}

interface EmergencyTabProps {
  employeeId: string
  contacts: EmergencyContact[]
  isLoading: boolean
  onUpdate: () => void
}

export function EmergencyTab({ employeeId, contacts: initialContacts, isLoading, onUpdate }: EmergencyTabProps) {
  const [contacts, setContacts] = useState<EmergencyContact[]>(initialContacts)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await supabase.from('employee_emergency_contacts').delete().eq('employee_id', employeeId)
      const toInsert = contacts.filter((c) => c.name && c.phone).map((c) => ({
        employee_id: employeeId,
        name: c.name,
        relationship: c.relationship,
        phone: c.phone,
        email: c.email || null,
        is_primary: c.is_primary || false,
      }))
      if (toInsert.length > 0) {
        const { error } = await supabase.from('employee_emergency_contacts').insert(toInsert)
        if (error) throw error
      }
      toast.success('Emergency contacts saved')
      onUpdate()
    } catch {
      toast.error('Failed to save emergency contacts')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl border border-[#C7C3D0] p-6 shadow-sm animate-pulse h-48" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="bg-white rounded-2xl border border-[#C7C3D0] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[13px] font-black text-[#1A1727] uppercase tracking-widest flex items-center gap-2">
            <Phone size={16} className="text-[#534AB7]" /> Emergency Contacts
          </h3>
          <button
            onClick={() => setContacts([...contacts, { name: '', relationship: '', phone: '', email: '', is_primary: contacts.length === 0 }])}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#F3E8FF] text-[#534AB7] rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-[#DDD6FE] transition-colors"
          >
            <Plus size={12} /> Add Contact
          </button>
        </div>

        {contacts.length === 0 ? (
          <div className="py-10 text-center">
            <div className="w-14 h-14 bg-[#F8F7F9] rounded-full flex items-center justify-center mx-auto mb-3">
              <User size={28} className="text-[#D1D5DB]" />
            </div>
            <p className="text-[13px] font-bold text-[#9994A8]">No emergency contacts added</p>
          </div>
        ) : (
          <div className="space-y-3">
            {contacts.map((c, i) => (
              <div key={i} className="p-4 bg-[#F8F7F9] rounded-xl border border-[#F1F0F4] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {c.is_primary && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-[#534AB7] text-white text-[9px] font-black rounded-full uppercase tracking-widest">
                        <Star size={8} /> Primary
                      </span>
                    )}
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B6578] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={c.is_primary || false}
                        onChange={(e) => {
                          const u = contacts.map((x, j) => ({ ...x, is_primary: j === i ? e.target.checked : false }))
                          setContacts(u)
                        }}
                        className="w-3.5 h-3.5 rounded border-[#C7C3D0] text-[#534AB7] focus:ring-[#534AB7]/20"
                      />
                      Set as Primary
                    </label>
                  </div>
                  <button
                    onClick={() => setContacts(contacts.filter((_, j) => j !== i))}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Full Name', key: 'name', placeholder: 'Jane Doe' },
                    { label: 'Relationship', key: 'relationship', placeholder: 'Spouse, Parent...' },
                    { label: 'Phone Number', key: 'phone', placeholder: '0771234567' },
                    { label: 'Email (Optional)', key: 'email', placeholder: 'jane@example.com' },
                  ].map((f) => (
                    <div key={f.key}>
                      <label className="block text-[10px] font-black text-[#9994A8] uppercase tracking-widest mb-1">{f.label}</label>
                      <input
                        value={(c as any)[f.key] || ''}
                        onChange={(e) => {
                          const u = [...contacts]
                          u[i] = { ...u[i], [f.key]: e.target.value }
                          setContacts(u)
                        }}
                        placeholder={f.placeholder}
                        className="w-full px-3 py-2 bg-white border border-[#F1F0F4] rounded-xl text-sm font-bold text-[#1A1727] outline-none focus:ring-2 focus:ring-[#534AB7]/20"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-[#534AB7] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-sm hover:bg-[#1E1854] transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Emergency Contacts'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
