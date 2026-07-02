'use client'

import { ShieldAlert, Inbox, TrendingUp } from 'lucide-react'

interface CommandBarBadgesProps {
  conflictCount: number
  requestCount: number
  coverageRate: number
  onConflictClick?: () => void
  onRequestClick?: () => void
  onCoverageClick?: () => void
}

export function CommandBarBadges({
  conflictCount,
  requestCount,
  coverageRate,
  onConflictClick,
  onRequestClick,
  onCoverageClick,
}: CommandBarBadgesProps) {
  return (
    <div className="flex items-center gap-2">
      {conflictCount > 0 && (
        <button
          onClick={onConflictClick}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[10px] font-black uppercase tracking-wider hover:bg-red-100 transition-all active:scale-95"
          title="Scroll to first conflict"
        >
          <ShieldAlert size={12} strokeWidth={2.5} />
          🔴 {conflictCount}
        </button>
      )}
      {requestCount > 0 && (
        <button
          onClick={onRequestClick}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-black uppercase tracking-wider hover:bg-amber-100 transition-all active:scale-95"
          title="Scroll to first request"
        >
          <Inbox size={12} strokeWidth={2.5} />
          🟡 {requestCount}
        </button>
      )}
      <button
        onClick={onCoverageClick}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 ${
          coverageRate < 70
            ? 'bg-red-50 border-red-200 text-red-700'
            : coverageRate < 85
            ? 'bg-amber-50 border-amber-200 text-amber-700'
            : 'bg-emerald-50 border-emerald-200 text-emerald-700'
        }`}
        title="Coverage rate"
      >
        <TrendingUp size={12} strokeWidth={2.5} />
        💜 {coverageRate}%
      </button>
    </div>
  )
}
