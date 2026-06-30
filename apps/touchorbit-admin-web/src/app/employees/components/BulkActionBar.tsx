'use client'

import { Download, Mail, X } from 'lucide-react'

interface BulkActionBarProps {
  count: number
  onExport: () => void
  onEmail: () => void
  onClear: () => void
}

export function BulkActionBar({ count, onExport, onEmail, onClear }: BulkActionBarProps) {
  if (count === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
      <div className="bg-[#1A1727] text-white rounded-xl shadow-2xl px-5 py-3 flex items-center gap-5">
        <span className="text-[13px] font-black">{count} selected</span>
        <div className="h-4 w-px bg-white/20" />
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-white/80 hover:text-white transition-colors"
        >
          <Download size={14} /> Export
        </button>
        <button
          onClick={onEmail}
          className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-white/80 hover:text-white transition-colors"
        >
          <Mail size={14} /> Email
        </button>
        <div className="h-4 w-px bg-white/20" />
        <button
          onClick={onClear}
          className="text-white/50 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
