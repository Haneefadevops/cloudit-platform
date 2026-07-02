'use client'

import React from 'react'

const STATUS_MAP: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  // Positive / Success
  active:       { bg: 'bg-green-50',  text: 'text-green-600',  dot: 'bg-green-500',  label: 'Active' },
  present:      { bg: 'bg-green-50',  text: 'text-green-600',  dot: 'bg-green-500',  label: 'Present' },
  approved:     { bg: 'bg-green-50',  text: 'text-green-600',  dot: 'bg-green-500',  label: 'Approved' },
  on_time:      { bg: 'bg-green-50',  text: 'text-green-600',  dot: 'bg-green-500',  label: 'On Time' },
  completed:    { bg: 'bg-green-50',  text: 'text-green-600',  dot: 'bg-green-500',  label: 'Completed' },
  published:    { bg: 'bg-green-50',  text: 'text-green-600',  dot: 'bg-green-500',  label: 'Published' },

  // Informational / Blue
  on_leave:     { bg: 'bg-blue-50',   text: 'text-blue-600',   dot: 'bg-blue-500',   label: 'On Leave' },
  leave:        { bg: 'bg-blue-50',   text: 'text-blue-600',   dot: 'bg-blue-500',   label: 'On Leave' },
  in_progress:  { bg: 'bg-blue-50',   text: 'text-blue-600',   dot: 'bg-blue-500',   label: 'In Progress' },
  used:         { bg: 'bg-blue-50',   text: 'text-blue-600',   dot: 'bg-blue-500',   label: 'Used' },
  assigned:     { bg: 'bg-blue-50',   text: 'text-blue-600',   dot: 'bg-blue-500',   label: 'Assigned' },

  // Warning / Amber
  late:         { bg: 'bg-amber-50',  text: 'text-amber-600',  dot: 'bg-amber-500',  label: 'Late' },
  pending:      { bg: 'bg-amber-50',  text: 'text-amber-600',  dot: 'bg-amber-500',  label: 'Pending' },
  early_departure: { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-500', label: 'Early Out' },
  late_early:   { bg: 'bg-amber-50',  text: 'text-amber-600',  dot: 'bg-amber-500',  label: 'Late + Early' },
  awaiting_level1: { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-500', label: 'Manager (L1)' },
  awaiting_level2: { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-500', label: 'HR (L2)' },
  awaiting_level3: { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-500', label: 'Owner (L3)' },

  // Severity (late arrivals)
  severe:       { bg: 'bg-red-50',    text: 'text-red-600',    dot: 'bg-red-500',    label: 'Severe' },
  moderate:     { bg: 'bg-amber-50',  text: 'text-amber-600',  dot: 'bg-amber-500',  label: 'Moderate' },
  mild:         { bg: 'bg-yellow-50', text: 'text-yellow-600', dot: 'bg-yellow-500', label: 'Mild' },

  // Overtime flags
  unscheduled_day: { bg: 'bg-red-50',     text: 'text-red-600',     dot: 'bg-red-500',     label: 'Unscheduled' },
  scheduled_day:   { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500', label: 'Scheduled' },

  // Negative / Red
  absent:       { bg: 'bg-red-50',    text: 'text-red-600',    dot: 'bg-red-500',    label: 'Absent' },
  rejected:     { bg: 'bg-red-50',    text: 'text-red-600',    dot: 'bg-red-500',    label: 'Rejected' },

  // Neutral / Gray
  terminated:   { bg: 'bg-gray-100',  text: 'text-gray-500',   dot: 'bg-gray-400',   label: 'Terminated' },
  inactive:     { bg: 'bg-gray-100',  text: 'text-gray-500',   dot: 'bg-gray-400',   label: 'Inactive' },
  cancelled:    { bg: 'bg-gray-100',  text: 'text-gray-500',   dot: 'bg-gray-400',   label: 'Cancelled' },
  expired:      { bg: 'bg-gray-100',  text: 'text-gray-500',   dot: 'bg-gray-400',   label: 'Expired' },
  day_off:      { bg: 'bg-gray-100',  text: 'text-gray-500',   dot: 'bg-gray-400',   label: 'Off' },
  draft:        { bg: 'bg-gray-100',  text: 'text-gray-500',   dot: 'bg-gray-400',   label: 'Draft' },
  locked:       { bg: 'bg-gray-100',  text: 'text-gray-500',   dot: 'bg-gray-400',   label: 'Locked' },
}

interface ToBadgeProps {
  status: string
  className?: string
  showDot?: boolean
}

export function ToBadge({ status, className = '', showDot = true }: ToBadgeProps) {
  const normalized = status?.toLowerCase().replace(/\s+/g, '_') || 'inactive'
  const config = STATUS_MAP[normalized] || STATUS_MAP.inactive

  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        rounded-full px-2.5 py-[3px]
        text-[11px] font-bold
        ${config.bg} ${config.text}
        ${className}
      `}
    >
      {showDot && (
        <span className={`w-[5px] h-[5px] rounded-full ${config.dot}`} />
      )}
      {config.label}
    </span>
  )
}
