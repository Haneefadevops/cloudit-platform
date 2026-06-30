'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, Pencil, ChevronDown, UserX, Key } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

interface Employee {
  id: string
  first_name: string
  last_name: string
  email: string | null
  job_title: string | null
  department: string | null
  employment_status: string
  photo_url: string | null
}

interface ProfileHeaderProps {
  employee: Employee
  isCompact: boolean
  onEdit: () => void
  canManageAppAccess: boolean
  canTerminateEmployee: boolean
  onResetPassword: () => void
  onTerminate: () => void
}

export function ProfileHeader({
  employee,
  isCompact,
  onEdit,
  canManageAppAccess,
  canTerminateEmployee,
  onResetPassword,
  onTerminate,
}: ProfileHeaderProps) {
  const router = useRouter()
  const [showActionsMenu, setShowActionsMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowActionsMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const initials = `${employee.first_name?.[0] || ''}${employee.last_name?.[0] || ''}`

  if (isCompact) {
    return (
      <div className="shrink-0 bg-white border-b border-[#C7C3D0] px-6 py-2 flex items-center justify-between z-20">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => router.push('/employees')}
            className="p-1 hover:bg-[#F8F7F9] rounded-lg text-[#9994A8] transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="w-7 h-7 rounded-lg bg-[#F3E8FF] flex items-center justify-center text-[#534AB7] text-[11px] font-black shrink-0 overflow-hidden border-2 border-white shadow-sm">
            {employee.photo_url ? (
              <img src={employee.photo_url} className="w-full h-full object-cover" alt="" />
            ) : (
              initials
            )}
          </div>
          <div>
            <span className="text-[12px] font-black text-[#1A1727]">
              {employee.first_name} {employee.last_name}
            </span>
            <span className="text-[10px] text-[#6B6578] ml-1.5">
              {employee.job_title} · {employee.department}
            </span>
          </div>
          <StatusDot status={employee.employment_status} />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-[#F4F3F7] border border-[#C7C3D0] rounded-lg text-[10px] font-black text-[#1A1727] hover:bg-white transition-colors"
          >
            <Pencil size={11} /> Edit
          </button>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowActionsMenu(!showActionsMenu)}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1A1727] text-white rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-black transition-colors"
            >
              Actions <ChevronDown size={11} />
            </button>
            {showActionsMenu && <ActionsMenu {...{ canManageAppAccess, canTerminateEmployee, onResetPassword, onTerminate, onClose: () => setShowActionsMenu(false) }} />}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="shrink-0 bg-white border-b border-[#C7C3D0] px-8 py-4 z-20">
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={() => router.push('/employees')}
          className="p-1.5 hover:bg-[#F8F7F9] rounded-lg text-[#9994A8] transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="text-[10px] font-black text-[#9994A8] uppercase tracking-[0.2em]">Employee Profile</div>
      </div>

      <div className="flex items-end justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-[#F3E8FF] border-[3px] border-white shadow-lg flex items-center justify-center text-[#534AB7] text-lg font-black shrink-0 overflow-hidden">
            {employee.photo_url ? (
              <img src={employee.photo_url} className="w-full h-full object-cover" alt="" />
            ) : (
              initials
            )}
          </div>
          <div>
            <h1 className="text-xl font-black text-[#1A1727] tracking-tight">
              {employee.first_name} {employee.last_name}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex items-center gap-1 text-[12px] font-bold text-[#534AB7]">
                <BriefcaseIcon size={12} /> {employee.job_title || 'No title'}
              </div>
              <span className="w-1 h-1 rounded-full bg-[#C7C3D0]" />
              <div className="text-[12px] font-bold text-[#6B6578]">{employee.department || 'No department'}</div>
              <StatusDot status={employee.employment_status} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F4F3F7] border border-[#C7C3D0] rounded-xl text-[10px] font-black text-[#1A1727] hover:bg-white transition-colors"
          >
            <Pencil size={12} /> Edit Profile
          </button>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowActionsMenu(!showActionsMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1A1727] text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-black transition-colors"
            >
              Actions <ChevronDown size={12} />
            </button>
            {showActionsMenu && <ActionsMenu {...{ canManageAppAccess, canTerminateEmployee, onResetPassword, onTerminate, onClose: () => setShowActionsMenu(false) }} />}
          </div>
        </div>
      </div>
    </div>
  )
}

function BriefcaseIcon({ size }: { size: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
  )
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-emerald-500',
    on_leave: 'bg-blue-500',
    suspended: 'bg-amber-500',
    terminated: 'bg-[#9994A8]',
  }
  const labels: Record<string, string> = {
    active: 'Active',
    on_leave: 'On Leave',
    suspended: 'Suspended',
    terminated: 'Terminated',
  }
  const color = colors[status] || 'bg-[#9994A8]'
  const label = labels[status] || status
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#6B6578] ml-1">
      <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
      {label}
    </span>
  )
}

function ActionsMenu({
  canManageAppAccess,
  canTerminateEmployee,
  onResetPassword,
  onTerminate,
  onClose,
}: {
  canManageAppAccess: boolean
  canTerminateEmployee: boolean
  onResetPassword: () => void
  onTerminate: () => void
  onClose: () => void
}) {
  return (
    <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-[#F1F0F4] z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      {canManageAppAccess && (
        <button
          onClick={() => { onClose(); onResetPassword() }}
          className="w-full px-5 py-3.5 text-left text-[11px] font-black uppercase tracking-widest text-[#374151] hover:bg-[#F8F7F9] flex items-center gap-3"
        >
          <Key size={14} className="text-[#9994A8]" /> Reset Password
        </button>
      )}
      {canTerminateEmployee && (
        <button
          onClick={() => { onClose(); onTerminate() }}
          className="w-full px-5 py-3.5 text-left text-[11px] font-black uppercase tracking-widest text-red-600 hover:bg-red-50 flex items-center gap-3 border-t border-[#F8F7F9]"
        >
          <UserX size={14} /> Terminate Staff
        </button>
      )}
      {!canManageAppAccess && !canTerminateEmployee && (
        <div className="px-5 py-3.5 text-[11px] font-black uppercase tracking-widest text-[#9CA3AF]">
          No available actions
        </div>
      )}
    </div>
  )
}
