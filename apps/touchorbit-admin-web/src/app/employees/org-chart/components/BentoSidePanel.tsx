'use client'

import { useMemo, useState } from 'react'
import {
  X, Users, DollarSign, Calendar, Briefcase, TrendingUp,
  Clock, Shield, MapPin, UserCheck, GitBranch, Plus, Trash2, UserPlus
} from 'lucide-react'
import type { MatrixEdge, OrgChartNode, Vacancy } from '@/components/ui-touchorbit'

interface BentoSidePanelProps {
  node: OrgChartNode | null
  vacancy?: Vacancy | null
  presence?: { status: 'clocked_in' | 'on_leave' | 'offline'; since?: string }
  employees?: OrgChartNode[]
  matrixEdges?: MatrixEdge[]
  isHistorical?: boolean
  onAddMatrixReport?: (employeeId: string, matrixManagerId: string, relationshipType: string) => void
  onRemoveMatrixReport?: (edge: MatrixEdge) => void
  onFillVacancy?: (vacancy: Vacancy) => void
  onClose: () => void
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function deptColor(code: string | null): string {
  const palette: Record<string, string> = {
    EXEC: '#534AB7',
    ENG: '#0EA5E9',
    FIN: '#10B981',
    HR: '#F59E0B',
    PROD: '#EC4899',
  }
  return palette[code ?? ''] ?? '#6B7280'
}

function presenceMeta(status: 'clocked_in' | 'on_leave' | 'offline') {
  if (status === 'clocked_in')
    return { color: '#10B981', bg: '#10B98115', label: 'Clocked in', icon: UserCheck }
  if (status === 'on_leave')
    return { color: '#F59E0B', bg: '#F59E0B15', label: 'On leave', icon: Clock }
  return { color: '#9CA3AF', bg: '#9CA3AF15', label: 'Offline', icon: Shield }
}

export function BentoSidePanel({
  node,
  vacancy,
  presence,
  employees = [],
  matrixEdges = [],
  isHistorical = false,
  onAddMatrixReport,
  onRemoveMatrixReport,
  onFillVacancy,
  onClose,
}: BentoSidePanelProps) {
  const [matrixManagerId, setMatrixManagerId] = useState('')
  const [relationshipType, setRelationshipType] = useState('project')

  const isAdminNode = useMemo(() => {
    if (!node) return false
    return 'subtree_headcount' in node
  }, [node])

  if (vacancy) {
    return (
      <>
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity"
          onClick={onClose}
        />

        <div className="fixed inset-y-0 right-0 w-full max-w-[420px] bg-white shadow-2xl z-50 flex flex-col">
          <div className="p-6 border-b border-[#F1F0F4]">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-gray-400 bg-gray-50 border border-dashed border-gray-300 shrink-0">
                  <Briefcase size={22} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-[16px] font-black text-[#1A1727] truncate">
                    {vacancy.title ?? 'Open Position'}
                  </h2>
                  <p className="text-[12px] text-[#6B6578] mt-0.5">
                    {vacancy.level ?? 'Level not set'}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg bg-gray-100 text-gray-500">
                      Open role
                    </span>
                    {vacancy.department_name && (
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg bg-[#F8F7F9] text-[#6B6578]">
                        {vacancy.department_name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-[#9994A8] hover:text-[#1A1727] hover:bg-[#F8F7F9] rounded-lg transition-colors shrink-0"
                aria-label="Close panel"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="bg-white rounded-2xl border border-[#C7C3D0] p-5 shadow-sm">
              <h3 className="text-[11px] font-black text-[#1A1727] uppercase tracking-widest mb-3">
                Position Details
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#F8F7F9] flex items-center justify-center text-[#9994A8]">
                    <Briefcase size={14} />
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-[#9994A8] uppercase tracking-widest">
                      Title
                    </div>
                    <div className="text-xs font-bold text-[#1A1727]">
                      {vacancy.title ?? 'Open Position'}
                    </div>
                  </div>
                </div>
                {vacancy.department_name && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#F8F7F9] flex items-center justify-center text-[#9994A8]">
                      <MapPin size={14} />
                    </div>
                    <div>
                      <div className="text-[10px] font-black text-[#9994A8] uppercase tracking-widest">
                        Department
                      </div>
                      <div className="text-xs font-bold text-[#1A1727]">
                        {vacancy.department_name}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => onFillVacancy?.(vacancy)}
              disabled={isHistorical}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#534AB7] text-white rounded-xl text-sm font-bold hover:bg-[#423a9e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <UserPlus size={16} />
              Fill position
            </button>
          </div>
        </div>
      </>
    )
  }

  if (!node) return null

  const p = presence ? presenceMeta(presence.status) : null
  const admin = isAdminNode ? (node as any) : null
  const nodeMatrixEdges = matrixEdges.filter((edge) => edge.employee_id === node.employee_id)
  const existingMatrixManagerIds = new Set(nodeMatrixEdges.map((edge) => edge.matrix_manager_id))
  const matrixCandidates = employees.filter(
    (employee) =>
      employee.employee_id !== node.employee_id &&
      !existingMatrixManagerIds.has(employee.employee_id)
  )

  const handleAddMatrix = () => {
    if (!matrixManagerId || isHistorical) return
    onAddMatrixReport?.(node.employee_id, matrixManagerId, relationshipType)
    setMatrixManagerId('')
    setRelationshipType('project')
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-full max-w-[420px] bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-[#F1F0F4]">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-sm font-black shrink-0"
                style={{ backgroundColor: deptColor(node.department_code) }}
              >
                {node.photo_url ? (
                  <img
                    src={node.photo_url}
                    alt={node.full_name}
                    className="w-full h-full rounded-2xl object-cover"
                  />
                ) : (
                  <span>{getInitials(node.full_name)}</span>
                )}
              </div>
              <div className="min-w-0">
                <h2 className="text-[16px] font-black text-[#1A1727] truncate">
                  {node.full_name}
                </h2>
                <p className="text-[12px] text-[#6B6578] mt-0.5">
                  {node.job_title || 'No title'}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  {node.department_name && (
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg bg-[#F8F7F9] text-[#6B6578]">
                      {node.department_name}
                    </span>
                  )}
                  {admin?.employment_status && (
                    <span
                      className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg"
                      style={{
                        backgroundColor:
                          admin.employment_status === 'active' ? '#10B98115' : '#EF444415',
                        color:
                          admin.employment_status === 'active' ? '#10B981' : '#EF4444',
                      }}
                    >
                      {admin.employment_status}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-[#9994A8] hover:text-[#1A1727] hover:bg-[#F8F7F9] rounded-lg transition-colors shrink-0"
              aria-label="Close panel"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Bento Grid */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Presence card */}
          {p && (
            <div
              className="rounded-2xl p-4 border"
              style={{ backgroundColor: p.bg, borderColor: `${p.color}25` }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${p.color}20`, color: p.color }}
                >
                  <p.icon size={18} />
                </div>
                <div>
                  <div className="text-[11px] font-black text-[#9994A8] uppercase tracking-widest">
                    Live Status
                  </div>
                  <div className="text-sm font-black" style={{ color: p.color }}>
                    {p.label}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Matrix reporting */}
          <div className="bg-white rounded-2xl border border-[#C7C3D0] p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <GitBranch size={14} className="text-[#534AB7]" />
              <h3 className="text-[11px] font-black text-[#1A1727] uppercase tracking-widest">
                Matrix Reporting
              </h3>
            </div>

            <div className="space-y-2">
              {nodeMatrixEdges.length === 0 ? (
                <div className="text-xs font-medium text-[#9994A8]">
                  No dotted-line managers assigned.
                </div>
              ) : (
                nodeMatrixEdges.map((edge) => {
                  const manager = employees.find((employee) => employee.employee_id === edge.matrix_manager_id)
                  return (
                    <div
                      key={`${edge.employee_id}-${edge.matrix_manager_id}-${edge.relationship_type}`}
                      className="flex items-center justify-between gap-2 rounded-xl bg-[#F8F7F9] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#1A1727] truncate">
                          {manager?.full_name ?? 'Matrix manager'}
                        </div>
                        <div className="text-[10px] font-bold text-[#9994A8] uppercase tracking-wider">
                          {edge.relationship_type || 'project'}
                        </div>
                      </div>
                      {!isHistorical && onRemoveMatrixReport && (
                        <button
                          onClick={() => onRemoveMatrixReport(edge)}
                          className="p-1.5 text-[#9994A8] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                          aria-label="Remove matrix relationship"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            {!isHistorical && onAddMatrixReport && (
              <div className="mt-4 space-y-2">
                <select
                  value={matrixManagerId}
                  onChange={(event) => setMatrixManagerId(event.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#C7C3D0] rounded-xl text-xs font-medium text-[#1A1727] outline-none focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7]"
                  aria-label="Choose matrix manager"
                >
                  <option value="">Choose dotted-line manager</option>
                  {matrixCandidates.map((employee) => (
                    <option key={employee.employee_id} value={employee.employee_id}>
                      {employee.full_name}
                      {employee.job_title ? ` - ${employee.job_title}` : ''}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <input
                    value={relationshipType}
                    onChange={(event) => setRelationshipType(event.target.value)}
                    className="min-w-0 flex-1 px-3 py-2 bg-white border border-[#C7C3D0] rounded-xl text-xs font-medium text-[#1A1727] outline-none focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7]"
                    placeholder="project"
                    aria-label="Relationship type"
                  />
                  <button
                    onClick={handleAddMatrix}
                    disabled={!matrixManagerId}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#534AB7] text-white rounded-xl text-xs font-bold hover:bg-[#423a9e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus size={13} />
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Stats grid */}
          {admin && (
            <div className="grid grid-cols-2 gap-3">
              {/* Headcount */}
              <div className="bg-[#F8F7F9] rounded-2xl p-4 border border-[#F1F0F4]">
                <div className="flex items-center gap-2 mb-2">
                  <Users size={14} className="text-[#534AB7]" />
                  <span className="text-[10px] font-black text-[#9994A8] uppercase tracking-widest">
                    Team
                  </span>
                </div>
                <div className="text-xl font-black text-[#1A1727]">
                  {admin.subtree_headcount ?? 0}
                </div>
                <div className="text-[10px] font-bold text-[#9994A8] mt-0.5">
                  {admin.direct_reports_count ?? 0} direct
                </div>
              </div>

              {/* Salary roll-up */}
              {admin.subtree_salary_total != null && (
                <div className="bg-[#F8F7F9] rounded-2xl p-4 border border-[#F1F0F4]">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign size={14} className="text-[#10B981]" />
                    <span className="text-[10px] font-black text-[#9994A8] uppercase tracking-widest">
                      Subtree Cost
                    </span>
                  </div>
                  <div className="text-xl font-black text-[#1A1727]">
                    {new Intl.NumberFormat('en-LK', {
                      style: 'currency',
                      currency: 'LKR',
                      maximumFractionDigits: 0,
                    }).format(admin.subtree_salary_total)}
                  </div>
                  <div className="text-[10px] font-bold text-[#9994A8] mt-0.5">
                    monthly roll-up
                  </div>
                </div>
              )}

              {/* Hire date */}
              {admin.hire_date && (
                <div className="bg-[#F8F7F9] rounded-2xl p-4 border border-[#F1F0F4]">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar size={14} className="text-[#0EA5E9]" />
                    <span className="text-[10px] font-black text-[#9994A8] uppercase tracking-widest">
                      Hire Date
                    </span>
                  </div>
                  <div className="text-sm font-black text-[#1A1727]">
                    {new Date(admin.hire_date).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                </div>
              )}

              {/* Employee number */}
              {admin.employee_number && (
                <div className="bg-[#F8F7F9] rounded-2xl p-4 border border-[#F1F0F4]">
                  <div className="flex items-center gap-2 mb-2">
                    <Briefcase size={14} className="text-[#F59E0B]" />
                    <span className="text-[10px] font-black text-[#9994A8] uppercase tracking-widest">
                      ID
                    </span>
                  </div>
                  <div className="text-sm font-black text-[#1A1727]">
                    {admin.employee_number}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Structural info */}
          <div className="bg-white rounded-2xl border border-[#C7C3D0] p-5 shadow-sm">
            <h3 className="text-[11px] font-black text-[#1A1727] uppercase tracking-widest mb-3">
              Reporting Line
            </h3>
            <div className="space-y-2">
              {node.path_names.map((name, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                    style={{
                      backgroundColor:
                        idx === node.path_names.length - 1
                          ? deptColor(node.department_code)
                          : '#D1D5DB',
                    }}
                  >
                    {getInitials(name)}
                  </div>
                  <span
                    className={`text-xs ${
                      idx === node.path_names.length - 1
                        ? 'font-bold text-[#1A1727]'
                        : 'text-[#6B6578]'
                    }`}
                  >
                    {name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Location */}
          {(node.branch_name || admin?.basic_salary != null) && (
            <div className="bg-white rounded-2xl border border-[#C7C3D0] p-5 shadow-sm">
              <h3 className="text-[11px] font-black text-[#1A1727] uppercase tracking-widest mb-3">
                Details
              </h3>
              <div className="space-y-3">
                {node.branch_name && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#F8F7F9] flex items-center justify-center text-[#9994A8]">
                      <MapPin size={14} />
                    </div>
                    <div>
                      <div className="text-[10px] font-black text-[#9994A8] uppercase tracking-widest">
                        Branch
                      </div>
                      <div className="text-xs font-bold text-[#1A1727]">
                        {node.branch_name}
                      </div>
                    </div>
                  </div>
                )}
                {admin?.basic_salary != null && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#F8F7F9] flex items-center justify-center text-[#9994A8]">
                      <TrendingUp size={14} />
                    </div>
                    <div>
                      <div className="text-[10px] font-black text-[#9994A8] uppercase tracking-widest">
                        Basic Salary
                      </div>
                      <div className="text-xs font-bold text-[#1A1727]">
                        {new Intl.NumberFormat('en-LK', {
                          style: 'currency',
                          currency: 'LKR',
                          maximumFractionDigits: 0,
                        }).format(admin.basic_salary)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
