'use client'

import { ChevronRight } from 'lucide-react'
import { ToAvatar } from '@/components/ui/ToAvatar'
import { ToBadge } from '@/components/ui/ToBadge'
import { TableSkeleton } from '@/components/ui/ToSkeleton'
import { ToEmptyState } from '@/components/ui/ToEmptyState'
import type { Employee } from '@/hooks/use-employees'

interface EmployeeTableViewProps {
  employees: Employee[]
  isLoading: boolean
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onSelectAll: (ids: string[]) => void
  onRowClick: (emp: Employee) => void
  emptyAction?: React.ReactNode
}

export function EmployeeTableView({
  employees,
  isLoading,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onRowClick,
  emptyAction,
}: EmployeeTableViewProps) {
  const allIds = employees.map((e) => e.id)
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id))

  return (
    <div className="bg-white rounded-xl border border-[#C7C3D0] shadow-sm overflow-hidden flex flex-col h-full">
      <div className="overflow-y-auto flex-1">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#F4F3F7] border-b border-[#F1F0F4]">
              <th className="px-4 py-3 text-left w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => onSelectAll(e.target.checked ? allIds : [])}
                  className="rounded border-[#C7C3D0] text-[#534AB7] focus:ring-[#534AB7]/20"
                />
              </th>
              <th className="px-4 py-3 text-left text-[10.5px] font-black text-[#6B6578] uppercase tracking-wider">
                Employee
              </th>
              <th className="px-4 py-3 text-left text-[10.5px] font-black text-[#6B6578] uppercase tracking-wider">
                Department
              </th>
              <th className="px-4 py-3 text-left text-[10.5px] font-black text-[#6B6578] uppercase tracking-wider">
                Role
              </th>
              <th className="px-4 py-3 text-center text-[10.5px] font-black text-[#6B6578] uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-[10.5px] font-black text-[#6B6578] uppercase tracking-wider">
                Joined
              </th>
              <th className="px-4 py-3 text-right text-[10.5px] font-black text-[#6B6578] uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <TableSkeleton rows={6} columns={7} />
            ) : employees.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <ToEmptyState
                    title="No employees found"
                    description="Try adjusting your search or filters."
                    action={emptyAction}
                  />
                </td>
              </tr>
            ) : (
              employees.map((emp) => {
                const isSelected = selectedIds.has(emp.id)
                return (
                  <tr
                    key={emp.id}
                    onClick={() => onRowClick(emp)}
                    className="border-b border-[#F1F0F4] hover:bg-[#F8F7F9] transition-colors cursor-pointer group"
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect(emp.id)}
                        className="rounded border-[#C7C3D0] text-[#534AB7] focus:ring-[#534AB7]/20"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <ToAvatar
                          initials={`${emp.first_name?.[0] || ''}${emp.last_name?.[0] || ''}`}
                          photoUrl={emp.photo_url}
                          size={32}
                        />
                        <div className="min-w-0">
                          <div className="text-[12.5px] font-black text-[#1A1727] truncate group-hover:text-[#534AB7] transition-colors">
                            {emp.first_name} {emp.last_name}
                          </div>
                          <div className="text-[10.5px] text-[#9994A8] truncate">
                            {emp.email || 'no-email@company.lk'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[12px] font-semibold text-[#6B6578]">{emp.department || '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[12px] font-semibold text-[#6B6578]">{emp.job_title || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ToBadge status={emp.employment_status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[11px] font-semibold text-[#9994A8]">
                        {emp.hire_date
                          ? new Date(emp.hire_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
                          : '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button className="p-1.5 text-[#C7C3D0] hover:text-[#534AB7] transition-colors">
                        <ChevronRight size={16} />
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {!isLoading && employees.length > 0 && (
        <div className="px-4 py-3 border-t border-[#F1F0F4] bg-[#F4F3F7] flex items-center justify-between">
          <span className="text-[11px] font-semibold text-[#9994A8]">
            Showing {employees.length} employees
          </span>
          {selectedIds.size > 0 && (
            <span className="text-[11px] font-black text-[#534AB7]">
              {selectedIds.size} selected
            </span>
          )}
        </div>
      )}
    </div>
  )
}
