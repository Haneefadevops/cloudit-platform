'use client'

import { ChevronRight } from 'lucide-react'
import { ToAvatar } from '@/components/ui/ToAvatar'
import { ToBadge } from '@/components/ui/ToBadge'
import { TableSkeleton } from '@/components/ui/ToSkeleton'
import { ToEmptyState } from '@/components/ui/ToEmptyState'
import type { Employee } from '@/hooks/use-employees'

interface EmployeeCompactViewProps {
  employees: Employee[]
  isLoading: boolean
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onRowClick: (emp: Employee) => void
  emptyAction?: React.ReactNode
}

export function EmployeeCompactView({
  employees,
  isLoading,
  selectedIds,
  onToggleSelect,
  onRowClick,
  emptyAction,
}: EmployeeCompactViewProps) {
  return (
    <div className="bg-white rounded-xl border border-[#C7C3D0] shadow-sm overflow-hidden flex flex-col h-full">
      <div className="overflow-y-auto flex-1">
        {isLoading ? (
          <div className="p-4">
            <TableSkeleton rows={8} columns={1} />
          </div>
        ) : employees.length === 0 ? (
          <ToEmptyState title="No employees found" description="Try adjusting your search or filters." action={emptyAction} />
        ) : (
          <div className="divide-y divide-[#F1F0F4]">
            {employees.map((emp) => {
              const isSelected = selectedIds.has(emp.id)
              return (
                <div
                  key={emp.id}
                  onClick={() => onRowClick(emp)}
                  className={`group flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-[#F8F7F9] ${
                    isSelected ? 'bg-[#F3E8FF]' : ''
                  }`}
                >
                  <div onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(emp.id)}
                      className="rounded border-[#C7C3D0] text-[#534AB7] focus:ring-[#534AB7]/20"
                    />
                  </div>
                  <ToAvatar
                    initials={`${emp.first_name?.[0] || ''}${emp.last_name?.[0] || ''}`}
                    photoUrl={emp.photo_url}
                    size={36}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[12.5px] font-black text-[#1A1727] truncate group-hover:text-[#534AB7] transition-colors">
                        {emp.first_name} {emp.last_name}
                      </span>
                      <ToBadge status={emp.employment_status} showDot={false} className="text-[10px] px-1.5 py-0.5" />
                    </div>
                    <div className="text-[11px] text-[#6B6578] truncate">
                      {emp.job_title}{emp.job_title && emp.department ? ' · ' : ''}{emp.department}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-[#C7C3D0] group-hover:text-[#534AB7] transition-colors shrink-0" />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {!isLoading && employees.length > 0 && (
        <div className="px-4 py-3 border-t border-[#F1F0F4] bg-[#F4F3F7] flex items-center justify-between">
          <span className="text-[11px] font-semibold text-[#9994A8]">Showing {employees.length} employees</span>
          {selectedIds.size > 0 && (
            <span className="text-[11px] font-black text-[#534AB7]">{selectedIds.size} selected</span>
          )}
        </div>
      )}
    </div>
  )
}
