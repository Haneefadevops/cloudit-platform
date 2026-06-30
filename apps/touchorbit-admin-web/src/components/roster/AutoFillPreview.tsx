'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { X, Loader2, Check, AlertTriangle, CalendarPlus, Sparkles, Users } from 'lucide-react'

interface Suggestion {
  date: string
  employee_id: string
  employee_name: string
  shift_id: string
  shift_name: string | null
  projected_weekly_hours: number
  confidence: number
  reason: string
}

interface SkippedShift {
  date: string
  shift_id: string
  shift_name: string | null
  reason: string
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
  const [result, setResult] = useState<{
    suggestions: Suggestion[]
    skipped: SkippedShift[]
    meta: { week_start: string; week_end: string; strategy: string; max_weekly_hours: number }
  } | null>(null)

  async function preview() {
    setLoading(true)
    try {
      const res = await fetch('/api/roster/auto-fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week_start: weekStart, strategy }),
      })
      if (res.ok) {
        const data = await res.json()
        setResult(data)
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Auto-fill preview failed')
      }
    } catch (e) { toast.error('Auto-fill preview failed') }
    setLoading(false)
  }

  async function applySuggestions() {
    if (!result || result.suggestions.length === 0) return
    setApplying(true)
    try {
      // Apply each suggestion as a roster assignment
      const { supabase } = await import('@/lib/supabase')
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Get organization_id
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single()

      const orgId = profile?.organization_id
      if (!orgId) throw new Error('No organization')

      // Batch insert roster assignments
      const assignments = result.suggestions.map((s) => ({
        organization_id: orgId,
        employee_id: s.employee_id,
        date: s.date,
        shift_id: s.shift_id,
        status: 'draft',
        created_by: user.id,
      }))

      const { error } = await supabase.from('roster_assignments').insert(assignments)
      if (error) throw error

      toast.success(`Applied ${assignments.length} assignment(s)`)
      onApplied?.()
      onClose()
    } catch (e: any) {
      toast.error(e.message || 'Failed to apply suggestions')
    }
    setApplying(false)
  }

  const weekDates = result?.suggestions
    ? [...new Set(result.suggestions.map(s => s.date))].sort()
    : []

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

        {/* Strategy + Preview */}
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
              onClick={preview}
              disabled={loading}
              className="px-4 py-2 bg-[#534AB7] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#1E1854] transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {loading ? 'Calculating...' : 'Preview'}
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-6">
          {!result ? (
            <div className="text-center py-12 text-[#D1D5DB]">
              <CalendarPlus size={40} className="mx-auto mb-3" />
              <p className="text-sm font-bold">Select a strategy and click Preview</p>
              <p className="text-xs mt-1">We'll suggest optimal shift assignments</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
                  <div className="text-lg font-black text-purple-700">{result.suggestions.length}</div>
                  <div className="text-[9px] font-black text-purple-400 uppercase tracking-wider">Suggested</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                  <div className="text-lg font-black text-amber-700">{result.skipped.length}</div>
                  <div className="text-[9px] font-black text-amber-400 uppercase tracking-wider">Skipped</div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                  <div className="text-lg font-black text-emerald-700">{Math.round(result.suggestions.reduce((a, s) => a + s.confidence, 0) / Math.max(result.suggestions.length, 1) * 100)}%</div>
                  <div className="text-[9px] font-black text-emerald-400 uppercase tracking-wider">Avg Confidence</div>
                </div>
              </div>

              {/* Suggestions by day */}
              {weekDates.map(date => {
                const daySuggestions = result.suggestions.filter(s => s.date === date)
                return (
                  <div key={date}>
                    <div className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2">
                      {new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </div>
                    <div className="space-y-1.5">
                      {daySuggestions.map((s, i) => (
                        <div key={i} className="flex items-center gap-3 px-3 py-2 bg-[#F8F7F9] rounded-xl border border-[#F1F0F4]">
                          <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-[10px] font-black text-purple-700 shrink-0">
                            {s.employee_name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-[#1A1727] truncate">{s.employee_name}</div>
                            <div className="text-[10px] font-bold text-[#9CA3AF]">{s.shift_name}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-[10px] font-black text-purple-600">{s.projected_weekly_hours}h/wk</div>
                            <div className="text-[9px] font-bold text-[#D1D5DB]">{Math.round(s.confidence * 100)}% match</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}

              {/* Skipped */}
              {result.skipped.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={12} className="text-amber-500" />
                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Skipped Shifts</span>
                  </div>
                  <div className="space-y-1">
                    {result.skipped.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-[10px] font-bold text-amber-700">
                        {s.shift_name} on {new Date(s.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} — {s.reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {result && result.suggestions.length > 0 && (
          <div className="p-6 border-t border-[#F1F0F4] bg-[#F8F7F9]/50 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 text-xs font-black uppercase tracking-widest text-[#9CA3AF] hover:bg-white rounded-xl transition-all border border-[#F1F0F4]"
            >
              Cancel
            </button>
            <button
              onClick={applySuggestions}
              disabled={applying}
              className="flex-1 py-3 bg-[#534AB7] text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-purple-900/20 hover:bg-[#1E1854] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {applying ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {applying ? 'Applying...' : `Apply ${result.suggestions.length} Assignments`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
