'use client'

import { useState } from 'react'
import { User, CreditCard, MapPin, Key, Mail, Phone, Calendar, Shield, Check } from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { InfoCard } from './InfoCard'

interface Employee {
  id: string
  employee_number: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  nic: string | null
  hire_date: string | null
  employment_status: string
  job_title: string | null
  department: string | null
  bank_name: string | null
  bank_account_number: string | null
  bank_branch: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  postal_code: string | null
  basic_salary: number | null
}

interface OverviewTabProps {
  employee: Employee
  onUpdate: () => void
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  on_leave: 'bg-blue-100 text-blue-700',
  suspended: 'bg-amber-100 text-amber-700',
  terminated: 'bg-gray-100 text-gray-600',
}

export function OverviewTab({ employee, onUpdate }: OverviewTabProps) {
  const [editingGeneral, setEditingGeneral] = useState(false)
  const [editingBank, setEditingBank] = useState(false)
  const [editingAddress, setEditingAddress] = useState(false)
  const [saving, setSaving] = useState(false)

  const [generalForm, setGeneralForm] = useState({
    employee_number: employee.employee_number || '',
    email: employee.email || '',
    phone: employee.phone || '',
    hire_date: employee.hire_date || '',
    nic: employee.nic || '',
    employment_status: employee.employment_status || 'active',
  })

  const [bankForm, setBankForm] = useState({
    bank_name: employee.bank_name || '',
    bank_account_number: employee.bank_account_number || '',
    bank_branch: employee.bank_branch || '',
  })

  const [addressForm, setAddressForm] = useState({
    address_line1: employee.address_line1 || '',
    address_line2: employee.address_line2 || '',
    city: employee.city || '',
    postal_code: employee.postal_code || '',
  })

  const handleSaveGeneral = async () => {
    setSaving(true)
    try {
      const result = await api.patch<any>(`/employees/${employee.id}`, {
        employee_number: generalForm.employee_number,
        email: generalForm.email,
        phone: generalForm.phone,
        hire_date: generalForm.hire_date,
        nic: generalForm.nic,
        employment_status: generalForm.employment_status,
      })
      if (!result.ok) throw new Error(result.error || 'Failed to update')
      toast.success('General information updated')
      setEditingGeneral(false)
      onUpdate()
    } catch {
      toast.error('Failed to update')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveBank = async () => {
    setSaving(true)
    try {
      const result = await api.patch<any>(`/employees/${employee.id}`, {
        bank_name: bankForm.bank_name,
        bank_account_number: bankForm.bank_account_number,
        bank_branch: bankForm.bank_branch,
      })
      if (!result.ok) throw new Error(result.error || 'Failed to update bank details')
      toast.success('Bank details updated')
      setEditingBank(false)
      onUpdate()
    } catch {
      toast.error('Failed to update bank details')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAddress = async () => {
    setSaving(true)
    try {
      const result = await api.patch<any>(`/employees/${employee.id}`, {
        address_line1: addressForm.address_line1,
        address_line2: addressForm.address_line2,
        city: addressForm.city,
        postal_code: addressForm.postal_code,
      })
      if (!result.ok) throw new Error(result.error || 'Failed to update address')
      toast.success('Address updated')
      setEditingAddress(false)
      onUpdate()
    } catch {
      toast.error('Failed to update address')
    } finally {
      setSaving(false)
    }
  }

  const generalFields = [
    { label: 'Employee ID', value: employee.employee_number, icon: Key },
    { label: 'Official Email', value: employee.email, icon: Mail },
    { label: 'Phone Number', value: employee.phone, icon: Phone },
    { label: 'Joining Date', value: employee.hire_date ? new Date(employee.hire_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '—', icon: Calendar },
    { label: 'NIC / ID Number', value: employee.nic, icon: Shield },
    { label: 'Status', value: employee.employment_status, icon: Check, isBadge: true },
  ]

  const generalEditForm = (
    <div className="grid grid-cols-2 gap-4">
      {[
        { label: 'Employee Number', key: 'employee_number', type: 'text' },
        { label: 'Official Email', key: 'email', type: 'email' },
        { label: 'Phone Number', key: 'phone', type: 'text' },
        { label: 'Joining Date', key: 'hire_date', type: 'date' },
        { label: 'NIC / ID Number', key: 'nic', type: 'text' },
        { label: 'Status', key: 'employment_status', type: 'select', options: ['active', 'on_leave', 'suspended', 'terminated'] },
      ].map((f) => (
        <div key={f.key}>
          <label className="block text-[10px] font-black text-[#9994A8] uppercase tracking-widest mb-1">{f.label}</label>
          {f.type === 'select' ? (
            <select
              value={(generalForm as any)[f.key]}
              onChange={(e) => setGeneralForm({ ...generalForm, [f.key]: e.target.value })}
              className="w-full px-3 py-2 bg-[#F8F7F9] border border-[#F1F0F4] rounded-xl text-sm font-bold text-[#1A1727] outline-none focus:ring-2 focus:ring-[#534AB7]/20"
            >
              {f.options?.map((opt) => <option key={opt} value={opt}>{opt.replace('_', ' ')}</option>)}
            </select>
          ) : (
            <input
              type={f.type}
              value={(generalForm as any)[f.key]}
              onChange={(e) => setGeneralForm({ ...generalForm, [f.key]: e.target.value })}
              className="w-full px-3 py-2 bg-[#F8F7F9] border border-[#F1F0F4] rounded-xl text-sm font-bold text-[#1A1727] outline-none focus:ring-2 focus:ring-[#534AB7]/20"
            />
          )}
        </div>
      ))}
    </div>
  )

  const bankEditForm = (
    <div className="grid grid-cols-2 gap-4">
      {[
        { label: 'Bank Name', key: 'bank_name' },
        { label: 'Account Number', key: 'bank_account_number' },
        { label: 'Bank Branch', key: 'bank_branch' },
      ].map((f) => (
        <div key={f.key}>
          <label className="block text-[10px] font-black text-[#9994A8] uppercase tracking-widest mb-1">{f.label}</label>
          <input
            value={(bankForm as any)[f.key]}
            onChange={(e) => setBankForm({ ...bankForm, [f.key]: e.target.value })}
            className="w-full px-3 py-2 bg-[#F8F7F9] border border-[#F1F0F4] rounded-xl text-sm font-bold text-[#1A1727] outline-none focus:ring-2 focus:ring-[#534AB7]/20 font-mono"
          />
        </div>
      ))}
    </div>
  )

  const addressEditForm = (
    <div className="grid grid-cols-2 gap-4">
      {[
        { label: 'Address Line 1', key: 'address_line1' },
        { label: 'Address Line 2', key: 'address_line2' },
        { label: 'City', key: 'city' },
        { label: 'Postal Code', key: 'postal_code' },
      ].map((f) => (
        <div key={f.key}>
          <label className="block text-[10px] font-black text-[#9994A8] uppercase tracking-widest mb-1">{f.label}</label>
          <input
            value={(addressForm as any)[f.key]}
            onChange={(e) => setAddressForm({ ...addressForm, [f.key]: e.target.value })}
            className="w-full px-3 py-2 bg-[#F8F7F9] border border-[#F1F0F4] rounded-xl text-sm font-bold text-[#1A1727] outline-none focus:ring-2 focus:ring-[#534AB7]/20"
          />
        </div>
      ))}
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <InfoCard
        title="General Information"
        icon={User}
        isEditing={editingGeneral}
        onEdit={() => setEditingGeneral(true)}
        onSave={handleSaveGeneral}
        onCancel={() => setEditingGeneral(false)}
        editForm={generalEditForm}
      >
        <div className="grid grid-cols-2 gap-y-6 gap-x-8">
          {generalFields.map((f) => (
            <div key={f.label} className="flex gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#F8F7F9] flex items-center justify-center text-[#9994A8] shrink-0 border border-[#F1F0F4]">
                <f.icon size={15} />
              </div>
              <div>
                <div className="text-[10px] font-black text-[#9994A8] uppercase tracking-widest mb-0.5">{f.label}</div>
                {f.isBadge ? (
                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${STATUS_COLORS[f.value] || STATUS_COLORS.active}`}>
                    {f.value}
                  </span>
                ) : (
                  <div className="text-[13px] font-bold text-[#1A1727]">{f.value || '—'}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </InfoCard>

      <InfoCard
        title="Bank & Payroll"
        icon={CreditCard}
        isEditing={editingBank}
        onEdit={() => setEditingBank(true)}
        onSave={handleSaveBank}
        onCancel={() => setEditingBank(false)}
        editForm={bankEditForm}
      >
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="text-[10px] font-black text-[#9994A8] uppercase tracking-widest mb-0.5">Bank Name</div>
            <div className="text-[13px] font-bold text-[#1A1727]">{employee.bank_name || '—'}</div>
          </div>
          <div>
            <div className="text-[10px] font-black text-[#9994A8] uppercase tracking-widest mb-0.5">Account Number</div>
            <div className="text-[13px] font-bold text-[#1A1727] font-mono tracking-tighter">{employee.bank_account_number || '—'}</div>
          </div>
          <div>
            <div className="text-[10px] font-black text-[#9994A8] uppercase tracking-widest mb-0.5">Bank Branch</div>
            <div className="text-[13px] font-bold text-[#1A1727]">{employee.bank_branch || '—'}</div>
          </div>
        </div>
      </InfoCard>

      <InfoCard
        title="Address"
        icon={MapPin}
        isEditing={editingAddress}
        onEdit={() => setEditingAddress(true)}
        onSave={handleSaveAddress}
        onCancel={() => setEditingAddress(false)}
        editForm={addressEditForm}
      >
        <div className="space-y-1">
          <div className="text-[13px] font-bold text-[#1A1727]">{employee.address_line1 || '—'}</div>
          {employee.address_line2 && <div className="text-[13px] font-bold text-[#6B6578]">{employee.address_line2}</div>}
          <div className="text-[13px] font-bold text-[#6B6578]">{[employee.city, employee.postal_code].filter(Boolean).join(', ') || '—'}</div>
        </div>
      </InfoCard>
    </div>
  )
}
