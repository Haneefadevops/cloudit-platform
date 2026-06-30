'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { Search, X, Users, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Employee {
  id: string
  first_name: string
  last_name: string
  department?: string
  avatar_url?: string
}

interface AttendeePickerProps {
  selectedIds: string[]
  onChange: (ids: string[]) => void
  maxSelections?: number
  className?: string
}

export function AttendeePicker({ selectedIds, onChange, maxSelections, className }: AttendeePickerProps) {
  const { organizationId } = useAuth()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState<string>('all')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!organizationId) return
    loadEmployees()
  }, [organizationId])

  async function loadEmployees() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('employees')
        .select('id, first_name, last_name, department, avatar_url')
        .eq('organization_id', organizationId)
        .eq('employment_status', 'active')
        .order('first_name')
      setEmployees(data || [])
    } finally {
      setLoading(false)
    }
  }

  const departments = useMemo(() => {
    const set = new Set(employees.map(e => e.department).filter(Boolean))
    return Array.from(set).sort()
  }, [employees])

  const filtered = useMemo(() => {
    return employees.filter(e => {
      const matchesDept = deptFilter === 'all' || e.department === deptFilter
      const fullName = `${e.first_name} ${e.last_name}`.toLowerCase()
      const matchesSearch = !search || fullName.includes(search.toLowerCase())
      return matchesDept && matchesSearch
    })
  }, [employees, deptFilter, search])

  const selectedEmployees = useMemo(
    () => employees.filter(e => selectedIds.includes(e.id)),
    [employees, selectedIds]
  )

  function toggleEmployee(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(sid => sid !== id))
    } else {
      if (maxSelections && selectedIds.length >= maxSelections) return
      onChange([...selectedIds, id])
    }
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Selected chips */}
      {selectedEmployees.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedEmployees.map(emp => (
            <button
              key={emp.id}
              type="button"
              onClick={() => toggleEmployee(emp.id)}
              className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 bg-purple-50 border border-purple-200 rounded-xl text-[11px] font-bold text-purple-700 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-all group"
            >
              <span className="w-5 h-5 rounded-full bg-purple-200 text-purple-700 flex items-center justify-center text-[9px] font-black">
                {emp.first_name[0]}{emp.last_name[0]}
              </span>
              {emp.first_name} {emp.last_name}
              <X size={12} className="text-purple-400 group-hover:text-red-400" />
            </button>
          ))}
        </div>
      )}

      {/* Search + filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search employees..."
            className="w-full pl-9 pr-3 py-2.5 bg-[#F8F7F9] border border-[#F1F0F4] rounded-xl text-xs font-bold text-[#1A1727] outline-none placeholder:text-[#D1D5DB]"
          />
        </div>
        <select
          value={deptFilter}
          onChange={e => setDeptFilter(e.target.value)}
          className="px-3 py-2.5 bg-[#F8F7F9] border border-[#F1F0F4] rounded-xl text-xs font-bold text-[#1A1727] outline-none"
        >
          <option value="all">All Depts</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* Employee list */}
      <div className="max-h-[200px] overflow-y-auto border border-[#F1F0F4] rounded-2xl bg-white">
        {loading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 bg-[#F8F7F9] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#9CA3AF] font-medium">No employees found</div>
        ) : (
          <div className="divide-y divide-[#F1F0F4]">
            {filtered.map(emp => {
              const isSelected = selectedIds.includes(emp.id)
              return (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => toggleEmployee(emp.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all',
                    isSelected ? 'bg-purple-50/50' : 'hover:bg-[#F8F7F9]'
                  )}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black shrink-0',
                    isSelected ? 'bg-purple-500 text-white' : 'bg-[#F8F7F9] text-[#9CA3AF] border border-[#F1F0F4]'
                  )}>
                    {isSelected ? <Check size={14} /> : `${emp.first_name[0]}${emp.last_name[0]}`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-[#1A1727] truncate">{emp.first_name} {emp.last_name}</div>
                    {emp.department && <div className="text-[10px] text-[#9CA3AF] font-medium">{emp.department}</div>}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {maxSelections && (
        <div className="text-[10px] text-[#9CA3AF] font-medium">
          {selectedIds.length} / {maxSelections} selected
        </div>
      )}
    </div>
  )
}
