'use client'

import { Mail, Eye } from 'lucide-react'
import { ToAvatar } from '@/components/ui/ToAvatar'
import { ToBadge } from '@/components/ui/ToBadge'
import type { Employee } from '@/hooks/use-employees'

interface EmployeeGridCardProps {
  employee: Employee
  isSelected: boolean
  onToggleSelect: (id: string) => void
  onClick: (emp: Employee) => void
}

const DEPT_TONES: Record<string, string> = {}
function getDeptTone(dept: string | null): string {
  if (!dept) return 'bg-[#F8F7F9] text-[#9994A8]'
  if (!DEPT_TONES[dept]) {
    const tones = [
      'bg-purple-50 text-purple-600',
      'bg-emerald-50 text-emerald-600',
      'bg-blue-50 text-blue-600',
      'bg-amber-50 text-amber-600',
      'bg-rose-50 text-rose-600',
      'bg-cyan-50 text-cyan-600',
      'bg-indigo-50 text-indigo-600',
      'bg-teal-50 text-teal-600',
    ]
    const idx = Object.keys(DEPT_TONES).length % tones.length
    DEPT_TONES[dept] = tones[idx]
  }
  return DEPT_TONES[dept]
}

export function EmployeeGridCard({ employee, isSelected, onToggleSelect, onClick }: EmployeeGridCardProps) {
  const initials = `${employee.first_name?.[0] || ''}${employee.last_name?.[0] || ''}`

  return (
    <div
      onClick={() => onClick(employee)}
      className={`group relative bg-white rounded-xl border transition-all cursor-pointer overflow-hidden ${
        isSelected
          ? 'border-[#534AB7] ring-2 ring-[#534AB7]/10 shadow-md'
          : 'border-[#C7C3D0] shadow-sm hover:shadow-md hover:border-[#534AB7]/30'
      }`}
    >
      {/* Selection checkbox */}
      <div
        className="absolute top-3 left-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(employee.id)}
          className="rounded border-[#C7C3D0] text-[#534AB7] focus:ring-[#534AB7]/20"
        />
      </div>

      <div className="p-4 flex flex-col items-center text-center gap-2">
        <ToAvatar
          initials={initials}
          photoUrl={employee.photo_url}
          size={56}
          className="mb-1"
        />
        <div className="min-w-0 w-full">
          <div className="text-[13px] font-black text-[#1A1727] truncate group-hover:text-[#534AB7] transition-colors">
            {employee.first_name} {employee.last_name}
          </div>
          <div className="text-[11px] text-[#6B6578] truncate mt-0.5">
            {employee.job_title || 'No title'}
          </div>
        </div>

        {employee.department && (
          <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg ${getDeptTone(employee.department)}`}>
            {employee.department}
          </span>
        )}

        <div className="mt-1">
          <ToBadge status={employee.employment_status} showDot />
        </div>
      </div>

      {/* Hover actions */}
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex justify-center gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation()
            window.location.href = `mailto:${employee.email}`
          }}
          className="p-1.5 bg-white rounded-lg shadow-sm text-[#6B6578] hover:text-[#534AB7] border border-[#F1F0F4]"
          title="Send email"
        >
          <Mail size={14} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onClick(employee)
          }}
          className="p-1.5 bg-white rounded-lg shadow-sm text-[#6B6578] hover:text-[#534AB7] border border-[#F1F0F4]"
          title="Quick view"
        >
          <Eye size={14} />
        </button>
      </div>
    </div>
  )
}
