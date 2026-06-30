'use client'

import { Umbrella, ArrowRightLeft, CalendarClock, Check, X, Clock } from 'lucide-react'
import { useState, useEffect } from 'react'

export interface InlineRequest {
  id: string
  type: 'leave' | 'swap' | 'reschedule' | 'availability'
  employee_name: string
  employee_id?: string
  title: string // e.g. "Annual leave" or "Swap with John"
  status: string
  days_count?: number
}

interface InlineRequestCardProps {
  request: InlineRequest
  onApprove?: (id: string, type: string) => void
  onReject?: (id: string, type: string) => void
}

const typeIcons: Record<string, React.ElementType> = {
  leave: Umbrella,
  swap: ArrowRightLeft,
  reschedule: CalendarClock,
  availability: Clock,
}

function LeaveBalancePreview({ employeeId, daysCount }: { employeeId?: string; daysCount?: number }) {
  const [balance, setBalance] = useState<number | null>(null)

  useEffect(() => {
    if (!employeeId) return
    fetch(`/api/leave/balance?employee_id=${employeeId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setBalance(data.annual ?? 0)
      })
      .catch(() => {})
  }, [employeeId])

  if (balance === null || daysCount === undefined) return null
  const remaining = Math.max(0, balance - daysCount)
  return (
    <span className="text-[8px] font-bold text-emerald-600 ml-1">
      → {remaining}d left
    </span>
  )
}

export function InlineRequestCard({ request, onApprove, onReject }: InlineRequestCardProps) {
  const [hovered, setHovered] = useState(false)
  const Icon = typeIcons[request.type] || Clock

  return (
    <div
      className="group relative flex items-center gap-1.5 px-1.5 py-1 rounded-lg border border-dashed border-amber-300 bg-amber-50/60 text-amber-800 text-[9px] font-black uppercase tracking-tighter truncate transition-all"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={`${request.type}: ${request.title} (${request.employee_name})`}
    >
      <Icon size={10} className="shrink-0 opacity-70" />
      <span className="truncate flex-1 min-w-0">{request.title}</span>
      {request.type === 'leave' && (
        <LeaveBalancePreview employeeId={request.employee_id} daysCount={request.days_count} />
      )}

      {hovered && (onApprove || onReject) && (
        <div className="flex items-center gap-0.5 shrink-0">
          {onApprove && (
            <button
              onClick={(e) => { e.stopPropagation(); onApprove(request.id, request.type) }}
              className="p-0.5 rounded hover:bg-emerald-200/50 text-emerald-700 transition-colors"
              title="Approve"
            >
              <Check size={8} strokeWidth={3} />
            </button>
          )}
          {onReject && (
            <button
              onClick={(e) => { e.stopPropagation(); onReject(request.id, request.type) }}
              className="p-0.5 rounded hover:bg-red-200/50 text-red-700 transition-colors"
              title="Reject"
            >
              <X size={8} strokeWidth={3} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
