'use client'

import React, { useEffect, useRef, useState } from 'react'
import {
  Calendar,
  ChevronDown,
  Download,
  Play,
  Search,
  X,
} from 'lucide-react'

export type DatePreset = 'today' | 'week' | 'month' | 'lastMonth' | 'custom'

interface Department {
  id: string
  name: string
}

interface Employee {
  id: string
  name: string
}

interface ReportFilterBarProps {
  startDate: string
  endDate: string
  onDateChange: (start: string, end: string) => void
  departments: Department[]
  selectedDept: string | null
  onDeptChange: (id: string | null) => void
  employees: Employee[]
  selectedEmployees: string[]
  onEmployeeChange: (ids: string[]) => void
  datePresets: DatePreset[]
  onGenerate: () => void
  onExport: () => void
  loading: boolean
  hasData: boolean
}

const PRESET_LABELS: Record<DatePreset, string> = {
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
  lastMonth: 'Last Month',
  custom: 'Custom',
}

function getPresetRange(preset: DatePreset): { start: string; end: string } {
  const today = new Date()
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  switch (preset) {
    case 'today':
      return { start: fmt(today), end: fmt(today) }
    case 'week': {
      const mon = new Date(today)
      mon.setDate(today.getDate() - today.getDay() + 1)
      const sun = new Date(mon)
      sun.setDate(mon.getDate() + 6)
      return { start: fmt(mon), end: fmt(sun) }
    }
    case 'month': {
      const first = new Date(today.getFullYear(), today.getMonth(), 1)
      const last = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      return { start: fmt(first), end: fmt(last) }
    }
    case 'lastMonth': {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const last = new Date(today.getFullYear(), today.getMonth(), 0)
      return { start: fmt(first), end: fmt(last) }
    }
    default:
      return { start: '', end: '' }
  }
}

export function ReportFilterBar({
  startDate,
  endDate,
  onDateChange,
  departments,
  selectedDept,
  onDeptChange,
  employees,
  selectedEmployees,
  onEmployeeChange,
  datePresets,
  onGenerate,
  onExport,
  loading,
  hasData,
}: ReportFilterBarProps) {
  const [activePreset, setActivePreset] = useState<DatePreset | null>(null)
  const [empSearch, setEmpSearch] = useState('')
  const [empDropdownOpen, setEmpDropdownOpen] = useState(false)
  const empRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (empRef.current && !empRef.current.contains(e.target as Node)) {
        setEmpDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const handlePreset = (preset: DatePreset) => {
    setActivePreset(preset)
    if (preset === 'custom') {
      onDateChange('', '')
    } else {
      const range = getPresetRange(preset)
      onDateChange(range.start, range.end)
    }
  }

  const toggleEmployee = (id: string) => {
    if (selectedEmployees.includes(id)) {
      onEmployeeChange(selectedEmployees.filter((x) => x !== id))
    } else {
      onEmployeeChange([...selectedEmployees, id])
    }
  }

  const removeEmployee = (id: string) => {
    onEmployeeChange(selectedEmployees.filter((x) => x !== id))
  }

  const selectedEmpObjs = employees.filter((e) => selectedEmployees.includes(e.id))
  const visibleChips = selectedEmpObjs.slice(0, 3)
  const hiddenCount = selectedEmpObjs.length - 3

  const filteredEmployees = employees.filter((e) =>
    e.name.toLowerCase().includes(empSearch.toLowerCase())
  )

  const showCustom = activePreset === 'custom'

  return (
    <div className="sticky top-0 z-30 mb-6 rounded-2xl border border-[#E5E3EA] bg-white/95 px-5 py-4 shadow-[0_4px_20px_rgba(15,23,42,0.06)] backdrop-blur-md">
      {/* Date presets */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {datePresets.map((preset) => (
          <button
            key={preset}
            onClick={() => handlePreset(preset)}
            className={`
              rounded-full px-3.5 py-1.5 text-[11px] font-black transition-all
              ${activePreset === preset
                ? 'bg-[#534AB7] text-white shadow-sm'
                : 'bg-[#F8F7F9] text-[#6B6578] hover:bg-[#F1F0F4]'
              }
            `}
          >
            {PRESET_LABELS[preset]}
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Custom date range */}
        {showCustom && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <Calendar size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9994A8]" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => onDateChange(e.target.value, endDate)}
                className="h-9 rounded-lg border border-[#E5E3EA] bg-white pl-8 pr-3 text-[12px] font-semibold text-[#2A2537] outline-none focus:ring-2 focus:ring-[#534AB7]/20"
              />
            </div>
            <span className="text-[11px] font-bold text-[#9994A8]">to</span>
            <div className="relative">
              <Calendar size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9994A8]" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => onDateChange(startDate, e.target.value)}
                className="h-9 rounded-lg border border-[#E5E3EA] bg-white pl-8 pr-3 text-[12px] font-semibold text-[#2A2537] outline-none focus:ring-2 focus:ring-[#534AB7]/20"
              />
            </div>
          </div>
        )}

        {/* Department dropdown */}
        <div className="relative min-w-[160px]">
          <select
            value={selectedDept ?? ''}
            onChange={(e) => onDeptChange(e.target.value || null)}
            className="h-9 w-full appearance-none rounded-lg border border-[#E5E3EA] bg-white pl-3 pr-8 text-[12px] font-semibold text-[#2A2537] outline-none focus:ring-2 focus:ring-[#534AB7]/20"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#9994A8]" />
        </div>

        {/* Employee multi-select */}
        <div className="relative min-w-[220px]" ref={empRef}>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9994A8]" />
            <input
              type="text"
              placeholder="Filter by employee..."
              value={empSearch}
              onChange={(e) => setEmpSearch(e.target.value)}
              onFocus={() => setEmpDropdownOpen(true)}
              className="h-9 w-full rounded-lg border border-[#E5E3EA] bg-white pl-8 pr-3 text-[12px] font-semibold text-[#2A2537] outline-none placeholder:font-medium placeholder:text-[#9994A8] focus:ring-2 focus:ring-[#534AB7]/20"
            />
          </div>

          {empDropdownOpen && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-52 overflow-auto rounded-xl border border-[#E5E3EA] bg-white p-1.5 shadow-lg">
              {filteredEmployees.length === 0 ? (
                <p className="px-3 py-2 text-[11px] font-medium text-[#9994A8]">No employees found</p>
              ) : (
                filteredEmployees.map((emp) => (
                  <label
                    key={emp.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold text-[#2A2537] hover:bg-[#F8F7F9]"
                  >
                    <input
                      type="checkbox"
                      checked={selectedEmployees.includes(emp.id)}
                      onChange={() => toggleEmployee(emp.id)}
                      className="h-3.5 w-3.5 rounded border-[#D0CDD8] text-[#534AB7] accent-[#534AB7]"
                    />
                    {emp.name}
                  </label>
                ))
              )}
            </div>
          )}

          {/* Selected chips */}
          {selectedEmpObjs.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {visibleChips.map((emp) => (
                <span
                  key={emp.id}
                  className="inline-flex items-center gap-1 rounded-full bg-[#F1EEFF] px-2.5 py-[3px] text-[10px] font-bold text-[#534AB7]"
                >
                  {emp.name}
                  <button
                    onClick={() => removeEmployee(emp.id)}
                    className="rounded-full hover:bg-[#534AB7]/10"
                  >
                    <X size={10} strokeWidth={3} />
                  </button>
                </span>
              ))}
              {hiddenCount > 0 && (
                <span className="text-[10px] font-bold text-[#9994A8]">+{hiddenCount} more</span>
              )}
              <button
                onClick={() => onEmployeeChange([])}
                className="ml-1 text-[10px] font-bold text-[#9994A8] hover:text-red-500"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Generate */}
          <button
            onClick={onGenerate}
            disabled={loading}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#534AB7] px-4 text-[12px] font-black text-white shadow-sm transition-all hover:bg-[#4338CA] active:scale-[0.98] disabled:opacity-50"
          >
            <Play size={14} fill="currentColor" />
            {loading ? 'Generating…' : 'Generate'}
          </button>

          {/* Export */}
          {hasData && (
            <button
              onClick={onExport}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E5E3EA] bg-white px-4 text-[12px] font-black text-[#534AB7] transition-all hover:bg-[#F8F6FF] active:scale-[0.98]"
            >
              <Download size={14} />
              Export
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
