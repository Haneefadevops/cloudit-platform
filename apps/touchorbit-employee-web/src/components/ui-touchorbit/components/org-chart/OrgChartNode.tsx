'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { OrgChartFlowNodeData, OrgChartNodeBase, OrgChartNodeAdmin } from './types'

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

function deptShape(code: string | null): string {
  const shapes: Record<string, string> = {
    EXEC: '●',
    ENG: '◆',
    FIN: '■',
    HR: '▲',
    PROD: '★',
  }
  return shapes[code ?? ''] ?? '●'
}

/** Color-blind-safe presence indicators */
function presenceMeta(status: 'clocked_in' | 'on_leave' | 'offline' | undefined) {
  if (status === 'clocked_in')
    return { color: '#10B981', bg: '#10B98115', shape: '●', label: 'Clocked in' }
  if (status === 'on_leave')
    return { color: '#F59E0B', bg: '#F59E0B15', shape: '▲', label: 'On leave' }
  return { color: '#9CA3AF', bg: '#9CA3AF15', shape: '○', label: 'Offline' }
}

/** Span-of-control heatmap tint */
function heatmapTint(directCount: number): string | undefined {
  if (directCount <= 5) return 'rgba(16,185,129,0.06)' // green
  if (directCount <= 9) return 'rgba(245,158,11,0.06)' // amber
  return 'rgba(239,68,68,0.06)' // red
}

function heatmapBorder(directCount: number): string | undefined {
  if (directCount <= 5) return 'rgba(16,185,129,0.2)'
  if (directCount <= 9) return 'rgba(245,158,11,0.2)'
  return 'rgba(239,68,68,0.2)'
}

function isNewJoiner(hireDate: string | null | undefined): boolean {
  if (!hireDate) return false
  const hired = new Date(hireDate)
  const now = new Date()
  const diffMs = now.getTime() - hired.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  return diffDays >= 0 && diffDays <= 30
}

function isBirthdayThisWeek(dateOfBirth: string | null | undefined): boolean {
  if (!dateOfBirth) return false
  const dob = new Date(dateOfBirth)
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)
  endOfWeek.setHours(23, 59, 59, 999)

  const thisYearDob = new Date(now.getFullYear(), dob.getMonth(), dob.getDate())
  return thisYearDob >= startOfWeek && thisYearDob <= endOfWeek
}

function isWorkAnniversaryMonth(hireDate: string | null | undefined): boolean {
  if (!hireDate) return false
  const hired = new Date(hireDate)
  const now = new Date()
  return hired.getMonth() === now.getMonth()
}

interface NodeCardProps {
  data: OrgChartFlowNodeData
  selected?: boolean
}

function hasLeft(node: OrgChartNodeBase | OrgChartNodeAdmin): boolean {
  const t = (node as any).termination_date
  if (!t) return false
  const term = new Date(t)
  const now = new Date()
  return term.getTime() <= now.getTime()
}

function NodeCard({ data, selected }: NodeCardProps) {
  const { node, viewerRole, onToggleExpand, isExpanded, presence, isDropTarget, heatmapEnabled, isHistorical } = data
  const isAdmin = viewerRole === 'admin'
  const p = presenceMeta(presence?.status)
  const departed = isHistorical && hasLeft(node)

  const hireDate = node.hire_date
  const dob = node.date_of_birth
  const newJoiner = !departed && isNewJoiner(hireDate)
  const birthday = !departed && isBirthdayThisWeek(dob)
  const anniversary = !departed && isWorkAnniversaryMonth(hireDate)

  const tint = heatmapEnabled && isAdmin && !departed ? heatmapTint(node.direct_reports_count) : undefined
  const borderTint = heatmapEnabled && isAdmin && !departed ? heatmapBorder(node.direct_reports_count) : undefined

  return (
    <div
      className={`
        relative w-[260px] rounded-2xl border bg-white/80 backdrop-blur-xl
        shadow-[0_2px_16px_rgba(0,0,0,0.06)] transition-all duration-200
        ${selected ? 'ring-2 ring-[#534AB7] shadow-[0_4px_24px_rgba(83,74,183,0.18)]' : 'hover:shadow-[0_4px_24px_rgba(0,0,0,0.1)] hover:-translate-y-0.5'}
        ${isDropTarget ? 'ring-2 ring-emerald-400 shadow-[0_4px_24px_rgba(16,185,129,0.25)] scale-[1.03]' : ''}
        ${departed ? 'opacity-50 grayscale-[0.4]' : ''}
        motion-safe:transition-transform motion-safe:duration-200
      `}
      style={{
        borderColor: selected ? '#534AB7' : isDropTarget ? '#10B981' : borderTint ?? 'rgba(229,231,235,0.6)',
        backgroundColor: tint ? `color-mix(in srgb, white 80%, ${tint})` : undefined,
      }}
    >
      {/* New joiner glow */}
      {newJoiner && (
        <div
          className="absolute -inset-0.5 rounded-[18px] bg-gradient-to-r from-amber-300/40 via-yellow-400/30 to-amber-300/40 -z-10 motion-safe:animate-pulse"
          aria-hidden="true"
        />
      )}

      {/* Presence ring (admin-only) */}
      {isAdmin && presence && (
        <div
          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center motion-safe:animate-pulse"
          style={{ backgroundColor: p.color }}
          title={p.label}
        >
          <span className="text-[8px] text-white font-bold leading-none">{p.shape}</span>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div
            className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-white text-xs font-bold relative"
            style={{ backgroundColor: deptColor(node.department_code) }}
            aria-hidden="true"
          >
            {node.photo_url ? (
              <img
                src={node.photo_url}
                alt={node.full_name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span>{getInitials(node.full_name)}</span>
            )}
            {/* Birthday / anniversary micro-badge */}
            {(birthday || anniversary) && (
              <span className="absolute -bottom-0.5 -right-0.5 text-[10px] leading-none" title={birthday ? 'Birthday this week' : 'Work anniversary month'}>
                {birthday ? '🎂' : '⭐'}
              </span>
            )}
          </div>

          {/* Text */}
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm text-gray-900 truncate">
              {node.full_name}
              {departed && (
                <span className="ml-1.5 text-[9px] font-black text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                  Left
                </span>
              )}
              {node.is_current_user && !departed && (
                <span className="ml-1.5 text-[10px] font-bold text-[#534AB7] bg-[#534AB7]/10 px-1.5 py-0.5 rounded-full">
                  YOU
                </span>
              )}
              {newJoiner && (
                <span className="ml-1.5 text-[9px] font-black text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                  New
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 truncate mt-0.5">
              {node.job_title ?? '—'}
            </div>
            {node.department_name && (
              <div
                className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: `${deptColor(node.department_code)}15`,
                  color: deptColor(node.department_code),
                }}
                title={`${deptShape(node.department_code)} ${node.department_name}`}
              >
                <span aria-hidden="true">{deptShape(node.department_code)}</span>
                <span>{node.department_name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer row: expand toggle + roll-up badge */}
        {node.has_children && (
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggleExpand?.(node.employee_id)
              }}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#534AB7] transition-colors min-h-[44px] px-1 -mx-1 rounded-lg"
              aria-label={isExpanded ? 'Collapse team' : 'Expand team'}
              aria-expanded={isExpanded}
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>Hide team</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>Show team ({node.direct_reports_count})</span>
                </>
              )}
            </button>

            {isAdmin && 'subtree_headcount' in node && (
              <span className="text-[10px] text-gray-400">
                {node.subtree_headcount} total
              </span>
            )}
          </div>
        )}
      </div>

      {/* React Flow handles */}
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-gray-300" aria-hidden="true" />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-gray-300" aria-hidden="true" />
    </div>
  )
}

export const OrgChartNode = memo(function OrgChartNode(props: NodeProps) {
  return <NodeCard data={(props.data as unknown) as OrgChartFlowNodeData} selected={props.selected} />
})
