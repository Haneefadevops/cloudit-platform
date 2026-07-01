'use client'

import { useState } from 'react'
import { Briefcase, Pencil, Check, X } from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from 'sonner'

interface Employee {
  id: string
  employee_number: string
  hire_date: string | null
  job_title: string | null
  department: string | null
  employment_status: string
  basic_salary: number | null
}

interface EmploymentTabProps {
  employee: Employee
  onUpdate: () => void
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  on_leave: 'bg-blue-100 text-blue-700',
  suspended: 'bg-amber-100 text-amber-700',
  terminated: 'bg-gray-100 text-gray-600',
}

export function EmploymentTab({ employee, onUpdate }: EmploymentTabProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    employee_number: employee.employee_number || '',
    hire_date: employee.hire_date || '',
    job_title: employee.job_title || '',
    department: employee.department || '',
    employment_status: employee.employment_status || 'active',
    basic_salary: employee.basic_salary || 0,
  })

  const handleSave = async () => {
    setSaving(true)
    try {
      const result = await api.patch<any>(`/employees/${employee.id}`, form)
      if (!result.ok) throw new Error(result.error || 'Failed to update')
      toast.success('Employment details updated')
      setIsEditing(false)
      onUpdate()
    } catch {
      toast.error('Failed to update')
    } finally {
      setSaving(false)
    }
  }

  const fields = [
    { label: 'Employee Number', value: employee.employee_number },
    { label: 'Hire Date', value: employee.hire_date ? new Date(employee.hire_date).toLocaleDateString('en-GB') : '—' },
    { label: 'Job Title', value: employee.job_title || '—' },
    { label: 'Department', value: employee.department || '—' },
    { label: 'Status', value: employee.employment_status, isBadge: true },
    { label: 'Basic Salary', value: employee.basic_salary ? `LKR ${employee.basic_salary.toLocaleString()}` : '—' },
  ]

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-2xl border border-[#C7C3D0] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[13px] font-black text-[#1A1727] uppercase tracking-widest flex items-center gap-2">
            <Briefcase size={16} className="text-[#534AB7]" /> Employment Details
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
              { label: 'Employee Number', key: 'employee_number', type: 'text' },
              { label: 'Hire Date', key: 'hire_date', type: 'date' },
              { label: 'Job Title', key: 'job_title', type: 'text' },
              { label: 'Department', key: 'department', type: 'text' },
              { label: 'Status', key: 'employment_status', type: 'select', options: ['active', 'on_leave', 'suspended', 'terminated'] },
              { label: 'Basic Salary (LKR)', key: 'basic_salary', type: 'number' },
            ].map((f) => (
              <div key={f.key}>
                <label className="block text-[10px] font-black text-[#9994A8] uppercase tracking-widest mb-1">{f.label}</label>
                {f.type === 'select' ? (
                  <select
                    value={(form as any)[f.key]}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F8F7F9] border border-[#F1F0F4] rounded-xl text-sm font-bold text-[#1A1727] outline-none focus:ring-2 focus:ring-[#534AB7]/20"
                  >
                    {f.options?.map((opt) => <option key={opt} value={opt}>{opt.replace('_', ' ')}</option>)}
                  </select>
                ) : (
                  <input
                    type={f.type}
                    value={(form as any)[f.key]}
                    onChange={(e) => setForm({ ...form, [f.key]: f.type === 'number' ? parseFloat(e.target.value) : e.target.value })}
                    className="w-full px-3 py-2 bg-[#F8F7F9] border border-[#F1F0F4] rounded-xl text-sm font-bold text-[#1A1727] outline-none focus:ring-2 focus:ring-[#534AB7]/20"
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-y-5 gap-x-8">
            {fields.map((f) => (
              <div key={f.label}>
                <div className="text-[10px] font-black text-[#9994A8] uppercase tracking-widest mb-0.5">{f.label}</div>
                {f.isBadge ? (
                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${STATUS_COLORS[f.value] || STATUS_COLORS.active}`}>
                    {f.value}
                  </span>
                ) : (
                  <div className="text-[13px] font-bold text-[#1A1727]">{f.value}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
