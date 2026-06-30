'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { Building2, Users, GitBranch, ArrowRightLeft, User, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'

export type EventScope =
  | 'organization'
  | 'branch'
  | 'department'
  | 'branch_to_branch'
  | 'dept_to_dept'
  | 'one_on_one'
  | 'team'

interface ScopeOption {
  id: EventScope
  label: string
  description: string
  icon: React.ReactNode
  requiresSecondary: boolean
}

const SCOPE_OPTIONS: ScopeOption[] = [
  { id: 'organization', label: 'Organization', description: 'Everyone in the company', icon: <Building2 size={14} />, requiresSecondary: false },
  { id: 'branch', label: 'Branch', description: 'Specific branch only', icon: <Layers size={14} />, requiresSecondary: false },
  { id: 'department', label: 'Department', description: 'Specific department only', icon: <Users size={14} />, requiresSecondary: false },
  { id: 'branch_to_branch', label: 'Branch to Branch', description: 'Cross-branch collaboration', icon: <ArrowRightLeft size={14} />, requiresSecondary: true },
  { id: 'dept_to_dept', label: 'Dept to Dept', description: 'Cross-department collaboration', icon: <ArrowRightLeft size={14} />, requiresSecondary: true },
  { id: 'one_on_one', label: 'One-on-One', description: 'Private meeting with one person', icon: <User size={14} />, requiresSecondary: false },
  { id: 'team', label: 'Team', description: 'Hand-picked team members', icon: <Users size={14} />, requiresSecondary: false },
]

interface ScopeSelectorProps {
  value: EventScope
  onChange: (scope: EventScope) => void
  branchId?: string
  onBranchChange?: (id: string) => void
  departmentId?: string
  onDepartmentChange?: (id: string) => void
  secondaryBranchId?: string
  onSecondaryBranchChange?: (id: string) => void
  secondaryDepartmentId?: string
  onSecondaryDepartmentChange?: (id: string) => void
  className?: string
}

export function ScopeSelector({
  value,
  onChange,
  branchId,
  onBranchChange,
  departmentId,
  onDepartmentChange,
  secondaryBranchId,
  onSecondaryBranchChange,
  secondaryDepartmentId,
  onSecondaryDepartmentChange,
  className,
}: ScopeSelectorProps) {
  const { organizationId } = useAuth()
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    if (!organizationId) return
    loadBranches()
    loadDepartments()
  }, [organizationId])

  async function loadBranches() {
    const { data } = await supabase
      .from('branches')
      .select('id, name')
      .eq('organization_id', organizationId)
      .order('name')
    setBranches(data || [])
  }

  async function loadDepartments() {
    const { data } = await supabase
      .from('departments')
      .select('id, name')
      .eq('organization_id', organizationId)
      .order('name')
    setDepartments(data || [])
  }

  const selectedScope = SCOPE_OPTIONS.find(s => s.id === value) || SCOPE_OPTIONS[0]
  const needsBranch = ['branch', 'branch_to_branch'].includes(value)
  const needsDept = ['department', 'dept_to_dept'].includes(value)
  const needsSecondaryBranch = value === 'branch_to_branch'
  const needsSecondaryDept = value === 'dept_to_dept'

  return (
    <div className={cn('space-y-4', className)}>
      <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">
        Event Scope
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {SCOPE_OPTIONS.map(opt => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              'flex flex-col items-start gap-1.5 p-3 rounded-2xl border transition-all text-left',
              value === opt.id
                ? 'bg-purple-50 border-purple-200 shadow-sm'
                : 'bg-white border-[#F1F0F4] hover:bg-[#F8F7F9]'
            )}
          >
            <div className={cn(
              'w-7 h-7 rounded-xl flex items-center justify-center',
              value === opt.id ? 'bg-[#534AB7] text-white' : 'bg-[#F8F7F9] text-[#9CA3AF]'
            )}>
              {opt.icon}
            </div>
            <div>
              <div className={cn('text-[11px] font-bold', value === opt.id ? 'text-[#534AB7]' : 'text-[#1A1727]')}>
                {opt.label}
              </div>
              <div className="text-[9px] text-[#9CA3AF] font-medium leading-tight">{opt.description}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Branch selector */}
      {needsBranch && onBranchChange && (
        <div>
          <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">
            Select Branch
          </label>
          <select
            value={branchId || ''}
            onChange={e => onBranchChange(e.target.value)}
            className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none"
          >
            <option value="">Choose a branch...</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      )}

      {/* Department selector */}
      {needsDept && onDepartmentChange && (
        <div>
          <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">
            Select Department
          </label>
          <select
            value={departmentId || ''}
            onChange={e => onDepartmentChange(e.target.value)}
            className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none"
          >
            <option value="">Choose a department...</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      )}

      {/* Secondary branch */}
      {needsSecondaryBranch && onSecondaryBranchChange && (
        <div>
          <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">
            Second Branch
          </label>
          <select
            value={secondaryBranchId || ''}
            onChange={e => onSecondaryBranchChange(e.target.value)}
            className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none"
          >
            <option value="">Choose second branch...</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      )}

      {/* Secondary department */}
      {needsSecondaryDept && onSecondaryDepartmentChange && (
        <div>
          <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">
            Second Department
          </label>
          <select
            value={secondaryDepartmentId || ''}
            onChange={e => onSecondaryDepartmentChange(e.target.value)}
            className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none"
          >
            <option value="">Choose second department...</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      )}
    </div>
  )
}
