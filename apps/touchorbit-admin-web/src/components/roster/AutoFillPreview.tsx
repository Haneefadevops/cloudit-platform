'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { X, Loader2, Check, AlertTriangle, CalendarPlus, Sparkles } from 'lucide-react'
import { api } from '@/lib/api'

interface Assignment {
  id: string
  employee_id: string
  date: string
  shift_id: string
  notes: string | null
  acknowledgment_status: string
}

interface AutoFillResult {
  created: number
  assignments: Assignment[]
}

interface AutoFillPreviewProps {
  weekStart: string
  onClose: () => void
  onApplied?: () => void
}

export function AutoFillPreview({ weekStart, onClose, onApplied }: AutoFillPreviewProps) {
  const [strategy, setStrategy] = useState<'fair' | 'availability' | 'seniority'>('fair')
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [result, setResult] = useState<AutoFillResult | null>(null)

  async function runAutoFill() {
    setLoading(true)
    try {
      // Backend currently only accepts week_start; strategy is reserved for future use.
      const res = await api.post<AutoFillResult>('/roster/auto-fill', { week_start: weekStart })
      if (!res.ok) {
        toast.error(res.error || 'Auto-fill failed')
        return
      }
      setResult(res.data || { created: 0, assignments: [] })
      if ((res.data?.created ?? 0) === 0) {
        toast.info('No empty slots to auto-fill')
      }
    } catch (e) {
      toast.error('Auto-fill failed')
    } finally {
      setLoading(false)
    }
  }

  async function applyAndClose() {
    if (!result || result.created === 0) return
    setApplying(true)
    try {
      toast.success(`Applied ${result.created} assignment(s)`)
      onApplied?.()
      onClose()
    } catch (e: any) {
      toast.error(e.message || 'Failed to apply')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1727]/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-[720px] max-h-[85vh] flex flex-col mx-4">
        {/* Header */}
        <div className="p-6 border-b border-[#F1F0F4] flex items-center justify-between">
          <div>
            <div className="text-[10px] font-black text-[#534AB7] uppercase tracking-[0.2em] mb-1">Auto-Fill Shifts</div>
            <h2 className="text-lg font-black text-[#1A1727] tracking-tight">Week of {weekStart}</h2>
          </div>
          <button onClick={onClose} className="p-2.5 bg-white border border-[#F1F0F4] rounded-full text-[#9CA3AF] hover:text-red-500 transition-all hover:rotate-90 shadow-sm">
            <X size={18} strokeWidth={3} />
          </button>
        </div>

        {/* Strategy + Run */}
        <div className="p-6 border-b border-[#F1F0F4]">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">Strategy</span>
              {(['fair', 'availability', 'seniority'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => { setStrategy(s); setResult(null) }}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${
                    strategy === s
                      ? 'bg-purple-50 border-purple-200 text-purple-700'
                      : 'bg-white border-[#F1F0F4] text-[#9CA3AF] hover:bg-[#F8F7F9]'
                  }`}
                >
                  {s === 'fair' ? '⚖️ Fair' : s === 'availability' ? '✅ Availability' : '⭐ Seniority'}
                </button>
              ))}
            </div>
            <button
              onClick={runAutoFill}
              disabled={loading}
              className="px-4 py-2 bg-[#534AB7] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#1E1854] transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {loading ? 'Running...' : 'Run Auto-Fill'}
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-6">
          {!result ? (
            <div className="text-center py-12 text-[#D1D5DB]">
              <CalendarPlus size={40} className="mx-auto mb-3" />
              <p className="text-sm font-bold">Select a strategy and run auto-fill</p>
              <p className="text-xs mt-1">We&apos;ll fill empty weekday slots for active employees</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
                  <div className="text-lg font-black text-purple-700">{result.created}</div>
                  <div className="text-[9px] font-black text-purple-400 uppercase tracking-wider">Assignments Created</div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                  <div className="text-lg font-black text-emerald-700">{weekStart}</div>
                  <div className="text-[9px] font-black text-emerald-400 uppercase tracking-wider">Week Start</div>
                </div>
              </div>

              {/* Assignment list */}
              {result.assignments.length > 0 && (
                <div>
                  <div className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2">Created Assignments</div>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {result.assignments.map(a => (
                      <div key={a.id} className="flex items-center gap-3 px-3 py-2 bg-[#F8F7F9] rounded-xl border border-[#F1F0F4]">
                        <div className="text-[10px] font-black text-purple-700 bg-purple-100 rounded-lg px-2 py-1">
                          {a.date}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-[#1A1727] truncate">Employee {a.employee_id.slice(0, 8)}</div>
                          <div className="text-[10px] font-bold text-[#9CA3AF]">Shift {a.shift_id.slice(0, 8)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.created === 0 && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-700">
                  <AlertTriangle size={16} className="shrink-0" />
                  <p className="text-[10px] font-bold uppercase tracking-tight">No missing slots found for this week.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {result && result.created > 0 && (
          <div className="p-6 border-t border-[#F1F0F4] bg-[#F8F7F9]/50 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 text-xs font-black uppercase tracking-widest text-[#9CA3AF] hover:bg-white rounded-xl transition-all border border-[#F1F0F4]"
            >
              Cancel
            </button>
            <button
              onClick={applyAndClose}
              disabled={applying}
              className="flex-1 py-3 bg-[#534AB7] text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-purple-900/20 hover:bg-[#1E1854] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {applying ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {applying ? 'Applying...' : `Apply ${result.created} Assignments`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
