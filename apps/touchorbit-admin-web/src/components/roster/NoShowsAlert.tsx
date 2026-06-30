'use client'

import { useState } from 'react'
import { AlertCircle, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react'

interface NoShow {
  employee_id: string
  employee_name: string
  department_name: string
  shift_name: string
  scheduled_start: string
  minutes_late: number
}

interface NoShowsAlertProps {
  noShows: NoShow[]
  onRefresh: () => void
}

export function NoShowsAlert({ noShows, onRefresh }: NoShowsAlertProps) {
  const [expanded, setExpanded] = useState(true)

  if (noShows.length === 0) return null

  return (
    <div className="mb-6 bg-red-50 border border-red-100 rounded-xl overflow-hidden animate-in slide-in-from-top-2 duration-300">
      <div
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-red-100/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <h2 className="font-black text-red-900 uppercase tracking-widest text-xs">
            ⚠ No-Shows Today ({noShows.length})
          </h2>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={(e) => { e.stopPropagation(); onRefresh(); }}
            className="p-1 hover:bg-red-200 rounded-lg text-red-600 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {expanded ? <ChevronUp className="w-4 h-4 text-red-400" /> : <ChevronDown className="w-4 h-4 text-red-400" />}
        </div>
      </div>
      {expanded && (
        <div className="p-4 pt-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {noShows.map(ns => (
            <div key={ns.employee_id} className="bg-white p-3 rounded-lg border border-red-100 shadow-sm flex items-center justify-between">
              <div>
                <div className="font-bold text-[#1A1727] text-sm">{ns.employee_name}</div>
                <div className="text-[10px] text-[#9CA3AF] font-black uppercase tracking-widest">{ns.department_name}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-black text-[#534AB7] uppercase tracking-widest">{ns.shift_name}</div>
                <div className="text-[10px] font-black text-red-500 uppercase tracking-widest animate-pulse">{ns.minutes_late}m late</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
