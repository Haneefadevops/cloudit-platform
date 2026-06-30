'use client'

import { useRouter } from 'next/navigation'
import {
  X, Mail, Phone, MapPin, Briefcase, Calendar, DollarSign,
  CreditCard, Building2, UserCheck, UserX, ExternalLink, Copy, Check
} from 'lucide-react'
import { useState } from 'react'
import { ToAvatar } from '@/components/ui/ToAvatar'
import { ToBadge } from '@/components/ui/ToBadge'
import type { Employee } from '@/hooks/use-employees'

interface EmployeePreviewDrawerProps {
  employee: Employee | null
  onClose: () => void
  canTerminate?: boolean
}

export function EmployeePreviewDrawer({ employee, onClose, canTerminate }: EmployeePreviewDrawerProps) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)

  if (!employee) return null

  const handleCopyEmail = () => {
    if (employee.email) {
      navigator.clipboard.writeText(employee.email)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-full max-w-[420px] bg-white shadow-2xl z-50 flex flex-col transform transition-transform duration-200 ease-out translate-x-0">
        {/* Header */}
        <div className="p-6 border-b border-[#F1F0F4]">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <ToAvatar
                initials={`${employee.first_name?.[0] || ''}${employee.last_name?.[0] || ''}`}
                photoUrl={employee.photo_url}
                size={64}
              />
              <div>
                <h2 className="text-[16px] font-black text-[#1A1727]">
                  {employee.first_name} {employee.last_name}
                </h2>
                <p className="text-[12px] text-[#6B6578] mt-0.5">
                  {employee.job_title || 'No title'}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  {employee.department && (
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg bg-[#F8F7F9] text-[#6B6578]">
                      {employee.department}
                    </span>
                  )}
                  <ToBadge status={employee.employment_status} />
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-[#9994A8] hover:text-[#1A1727] hover:bg-[#F8F7F9] rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 mt-4">
            <a
              href={`mailto:${employee.email}`}
              className="flex items-center gap-2 px-3 py-2 bg-[#F4F3F7] rounded-lg text-[11px] font-black text-[#1A1727] hover:bg-[#ECECF1] transition-colors"
            >
              <Mail size={14} /> Email
            </a>
            <button
              onClick={handleCopyEmail}
              className="flex items-center gap-2 px-3 py-2 bg-[#F4F3F7] rounded-lg text-[11px] font-black text-[#1A1727] hover:bg-[#ECECF1] transition-colors"
            >
              {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy Email'}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-[#F1F0F4] bg-[#F8F7F9] px-3 py-2.5 text-center">
              <div className="text-[9px] font-black uppercase tracking-wider text-[#9994A8] mb-1">Emp ID</div>
              <div className="text-[13px] font-black text-[#1A1727]">{employee.employee_number || '—'}</div>
            </div>
            <div className="rounded-xl border border-[#F1F0F4] bg-[#F8F7F9] px-3 py-2.5 text-center">
              <div className="text-[9px] font-black uppercase tracking-wider text-[#9994A8] mb-1">Joined</div>
              <div className="text-[13px] font-black text-[#1A1727]">
                {employee.hire_date
                  ? new Date(employee.hire_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
                  : '—'}
              </div>
            </div>
            <div className="rounded-xl border border-[#F1F0F4] bg-[#F8F7F9] px-3 py-2.5 text-center">
              <div className="text-[9px] font-black uppercase tracking-wider text-[#9994A8] mb-1">Salary</div>
              <div className="text-[13px] font-black text-[#1A1727]">
                {employee.basic_salary ? `LKR ${employee.basic_salary.toLocaleString()}` : '—'}
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <Section title="Contact">
            <InfoRow icon={Mail} label="Email" value={employee.email} />
            <InfoRow icon={Phone} label="Phone" value={employee.phone || '—'} />
            <InfoRow
              icon={MapPin}
              label="Address"
              value={[employee.address_line1, employee.address_line2, employee.city].filter(Boolean).join(', ') || '—'}
            />
          </Section>

          {/* Employment */}
          <Section title="Employment">
            <InfoRow icon={Briefcase} label="Job Title" value={employee.job_title || '—'} />
            <InfoRow icon={Building2} label="Department" value={employee.department || '—'} />
            <InfoRow
              icon={Calendar}
              label="Hire Date"
              value={employee.hire_date ? new Date(employee.hire_date).toLocaleDateString('en-GB') : '—'}
            />
            <InfoRow icon={UserCheck} label="Status" value={<ToBadge status={employee.employment_status} />} />
          </Section>

          {/* Bank */}
          <Section title="Bank Details">
            <InfoRow icon={CreditCard} label="Bank" value={employee.bank_name || '—'} />
            <InfoRow icon={DollarSign} label="Account" value={employee.bank_account_number || '—'} />
            <InfoRow icon={Building2} label="Branch" value={employee.bank_branch || '—'} />
          </Section>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#F1F0F4] bg-[#F8F7F9] flex gap-2">
          <button
            onClick={() => router.push(`/employees/${employee.id}`)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#534AB7] text-white rounded-xl text-[12px] font-black uppercase tracking-wider hover:bg-[#1E1854] transition-colors shadow-sm"
          >
            <ExternalLink size={14} /> View Full Profile
          </button>
          {canTerminate && employee.employment_status !== 'terminated' && (
            <button
              onClick={() => router.push(`/employees/${employee.id}`)}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 rounded-xl text-[12px] font-black uppercase tracking-wider hover:bg-red-100 transition-colors border border-red-100"
            >
              <UserX size={14} /> Terminate
            </button>
          )}
        </div>
      </div>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] font-black uppercase tracking-widest text-[#9994A8] mb-3">{title}</h3>
      <div className="space-y-2.5">{children}</div>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Icon size={14} className="text-[#9994A8] mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-[10px] font-black uppercase tracking-wider text-[#9994A8]">{label}</div>
        <div className="text-[12.5px] font-semibold text-[#1A1727] truncate">{value}</div>
      </div>
    </div>
  )
}
