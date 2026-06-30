'use client'

import { ShieldAlert, Inbox, TrendingUp, CalendarPlus, Download, Printer, BarChart3 } from 'lucide-react'

interface SmartSummaryBarProps {
  conflictCount: number
  requestCount: number
  coverageRate: number
  activeEmployees: number
  onAutoFill?: () => void
  onExport?: () => void
  onPrint?: () => void
  onForecast?: () => void
}

export function SmartSummaryBar({
  conflictCount,
  requestCount,
  coverageRate,
  activeEmployees,
  onAutoFill,
  onExport,
  onPrint,
  onForecast,
}: SmartSummaryBarProps) {
  const coverageColor = coverageRate < 70 ? 'text-red-600' : coverageRate < 85 ? 'text-amber-600' : 'text-emerald-600'
  const coverageBg = coverageRate < 70 ? 'bg-red-500' : coverageRate < 85 ? 'bg-amber-500' : 'bg-emerald-500'

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-t border-[#F1F0F4] px-4 py-2.5 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
        {/* Stats */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#9CA3AF]">
            <ShieldAlert size={12} className="text-red-500" />
            <span className={conflictCount > 0 ? 'text-red-700 font-black' : ''}>
              {conflictCount} Conflict{conflictCount !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="w-px h-3 bg-[#F1F0F4]" />
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#9CA3AF]">
            <Inbox size={12} className="text-amber-500" />
            <span className={requestCount > 0 ? 'text-amber-700 font-black' : ''}>
              {requestCount} Request{requestCount !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="w-px h-3 bg-[#F1F0F4]" />
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#9CA3AF]">
            <TrendingUp size={12} className={coverageColor} />
            <span className={`${coverageColor} font-black`}>{coverageRate}% Coverage</span>
            <span className="text-[9px] text-[#D1D5DB]">({activeEmployees} active)</span>
          </div>
          {/* Coverage mini bar */}
          <div className="hidden sm:block w-24 h-1.5 bg-[#F1F0F4] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${coverageBg}`}
              style={{ width: `${Math.min(coverageRate, 100)}%` }}
            />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-1.5">
          {onAutoFill && (
            <button
              onClick={onAutoFill}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#534AB7] text-white text-[10px] font-black uppercase tracking-wider hover:bg-[#1E1854] transition-all active:scale-95 shadow-sm"
            >
              <CalendarPlus size={12} strokeWidth={2.5} />
              <span className="hidden sm:inline">Auto-fill</span>
            </button>
          )}
          {onExport && (
            <button
              onClick={onExport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#F1F0F4] text-[#9CA3AF] text-[10px] font-black uppercase tracking-wider hover:bg-[#F8F7F9] hover:text-[#374151] transition-all active:scale-95"
            >
              <Download size={12} strokeWidth={2.5} />
              <span className="hidden sm:inline">Export</span>
            </button>
          )}
          {onPrint && (
            <button
              onClick={onPrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#F1F0F4] text-[#9CA3AF] text-[10px] font-black uppercase tracking-wider hover:bg-[#F8F7F9] hover:text-[#374151] transition-all active:scale-95"
            >
              <Printer size={12} strokeWidth={2.5} />
              <span className="hidden sm:inline">Print</span>
            </button>
          )}
          {onForecast && (
            <button
              onClick={onForecast}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#F1F0F4] text-[#9CA3AF] text-[10px] font-black uppercase tracking-wider hover:bg-[#F8F7F9] hover:text-[#374151] transition-all active:scale-95"
            >
              <BarChart3 size={12} strokeWidth={2.5} />
              <span className="hidden sm:inline">Forecast</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
