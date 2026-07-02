'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { X, CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react'

interface AvailabilityOverlayProps {
  start: string // ISO datetime
  end: string
  onClose: () => void
}

interface AvailableEmployee {
  id: string
  first_name: string | null
  last_name: string | null
}

interface BlockedEntry {
  employee: AvailableEmployee
  reasons: { type: string; label: string }[]
}

export function AvailabilityOverlay({ start, end, onClose }: AvailabilityOverlayProps) {
  const { organizationId, isLoaded } = useAuth()
  const [loading, setLoading] = useState(true)
  const [available, setAvailable] = useState<AvailableEmployee[]>([])
  const [blocked, setBlocked] = useState<BlockedEntry[]>([])
  const [meta, setMeta] = useState<{ count: number; total_checked: number } | null>(null)

  useEffect(() => {
    if (!isLoaded || !organizationId) return
    fetchAvailability()
  }, [isLoaded, organizationId, start, end])

  async function fetchAvailability() {
    setLoading(true)
    try {
      const res = await fetch('/api/availability/slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start, end }),
      })
      if (res.ok) {
        const data = await res.json()
        setAvailable(data.available || [])
        setBlocked(data.blocked || [])
        setMeta(data.meta || null)
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const startDate = new Date(start)
  const endDate = new Date(end)
  const timeRange = `${startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} – ${endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`
  const dayStr = startDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-[#1A1727]/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white h-full w-full max-w-[480px] shadow-2xl animate-in slide-in-from-right-full duration-500 border-l border-[#F1F0F4] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-[#F1F0F4] bg-[#F8F7F9]/50 flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-black text-[#534AB7] uppercase tracking-[0.2em] mb-1">Availability Check</div>
            <h2 className="text-lg font-black text-[#1A1727] tracking-tight">{dayStr}</h2>
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#9CA3AF] mt-1">
              <Clock size={12} /> {timeRange}
            </div>
            {meta && (
              <div className="text-[10px] font-bold text-[#9CA3AF] mt-1">
                {meta.count} of {meta.total_checked} available
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-2.5 bg-white border border-[#F1F0F4] rounded-full text-[#9CA3AF] hover:text-red-500 transition-all hover:rotate-90 shadow-sm"
          >
            <X size={18} strokeWidth={3} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-[#9CA3AF]">
              <Loader2 size={20} className="animate-spin mr-2" />
              <span className="text-xs font-bold">Checking availability...</span>
            </div>
          ) : (
            <>
              {/* Available */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  <span className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">
                    Available ({available.length})
                  </span>
                </div>
                {available.length === 0 ? (
                  <div className="text-xs font-bold text-[#D1D5DB] text-center py-4">No one available</div>
                ) : (
                  <div className="space-y-2">
                    {available.map(emp => (
                      <div key={emp.id} className="flex items-center gap-3 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
                        <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] font-black text-emerald-700">
                          {emp.first_name?.[0]}{emp.last_name?.[0]}
                        </div>
                        <span className="text-xs font-bold text-emerald-800">
                          {emp.first_name} {emp.last_name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Blocked */}
              {blocked.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <XCircle size={14} className="text-red-500" />
                    <span className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">
                      Unavailable ({blocked.length})
                    </span>
                  </div>
                  <div className="space-y-2">
                    {blocked.map((entry, i) => (
                      <div key={i} className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl">
                        <div className="text-xs font-bold text-red-800">
                          {entry.employee.first_name} {entry.employee.last_name}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {entry.reasons.map((r, j) => (
                            <span key={j} className="text-[9px] font-black text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                              {r.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
