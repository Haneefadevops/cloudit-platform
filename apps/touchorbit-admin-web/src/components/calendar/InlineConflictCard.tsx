'use client'

import { ShieldAlert, X, ArrowUpRight } from 'lucide-react'
import { useState } from 'react'

export interface InlineConflict {
  conflict_id: string
  conflict_type: string
  severity: 'high' | 'medium' | 'low'
  employee_name: string
  source_title: string
}

interface InlineConflictCardProps {
  conflict: InlineConflict
  onDismiss?: (id: string) => void
  onView?: (conflict: InlineConflict) => void
}

const severityStyles = {
  high: 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100',
  medium: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100',
  low: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100',
}

const severityDot = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-blue-500',
}

export function InlineConflictCard({ conflict, onDismiss, onView }: InlineConflictCardProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className={`group relative flex items-center gap-1.5 px-1.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-tighter truncate transition-all cursor-pointer ${severityStyles[conflict.severity]}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onView?.(conflict)}
      title={`${conflict.conflict_type}: ${conflict.source_title} (${conflict.employee_name})`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${severityDot[conflict.severity]} ${hovered ? 'animate-pulse' : ''}`} />
      <ShieldAlert size={10} className="shrink-0 opacity-70" />
      <span className="truncate flex-1 min-w-0">{conflict.source_title}</span>

      {hovered && onDismiss && (
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(conflict.conflict_id) }}
          className="shrink-0 p-0.5 rounded hover:bg-black/10 transition-colors"
          title="Dismiss"
        >
          <X size={8} strokeWidth={3} />
        </button>
      )}
      {hovered && (
        <ArrowUpRight size={8} className="shrink-0 opacity-50" />
      )}
    </div>
  )
}
