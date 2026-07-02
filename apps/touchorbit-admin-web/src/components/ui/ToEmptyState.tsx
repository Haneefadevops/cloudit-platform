'use client'

import React from 'react'
import { SearchX } from 'lucide-react'

interface ToEmptyStateProps {
  title?: string
  description?: string
  icon?: React.ReactNode
  action?: React.ReactNode | { label: string; onClick: () => void }
  className?: string
}

export function ToEmptyState({
  title = 'No results found',
  description = 'Try adjusting your search or filters.',
  icon,
  action,
  className = '',
}: ToEmptyStateProps) {
  const actionNode = action && typeof action === 'object' && 'label' in action
    ? (
      <button
        onClick={action.onClick}
        className="mt-4 text-[#534AB7] font-black text-[10px] uppercase tracking-widest hover:text-[#1E1854] transition-all"
      >
        {action.label} →
      </button>
    )
    : action

  return (
    <div className={`flex flex-col items-center justify-center py-16 text-center ${className}`}>
      <div className="w-12 h-12 rounded-xl bg-[#F8F7F9] flex items-center justify-center mb-4">
        {icon || <SearchX size={22} className="text-[#D1D5DB]" />}
      </div>
      <p className="text-[13px] font-semibold text-[#9CA3AF] mb-1">{title}</p>
      <p className="text-[12px] text-[#9CA3AF] max-w-[280px] leading-relaxed">{description}</p>
      {actionNode && <div className="mt-4">{actionNode}</div>}
    </div>
  )
}
