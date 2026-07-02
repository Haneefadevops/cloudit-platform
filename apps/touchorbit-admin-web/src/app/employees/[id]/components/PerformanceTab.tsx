'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Star, Plus, TrendingUp, Calendar, User, X } from 'lucide-react'

interface PerformanceReview {
  id: string
  review_period_start: string | null
  review_period_end: string | null
  overall_score: number | null
  attendance_score: number | null
  punctuality_score: number | null
  productivity_score: number | null
  teamwork_score: number | null
  reviewer_id: string | null
  notes: string | null
  created_at: string
}

interface PerformanceTabProps {
  employeeId: string
  organizationId: string | null | undefined
  reviews: PerformanceReview[]
  isLoading: boolean
  isAdmin: boolean
  onUpdate: () => void
}

function ScoreBar({ label, score, color }: { label: string; score: number | null; color: string }) {
  const pct = score != null ? score : 0
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">{label}</span>
        <span className="text-[12px] font-black text-[#1A1727]">{score != null ? score : '—'}</span>
      </div>
      <div className="w-full bg-[#F8F7F9] rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function OverallRing({ score }: { score: number | null }) {
  if (score == null) return <div className="text-[#D1D5DB] text-3xl font-black">—</div>
  const circumference = 2 * Math.PI * 40
  const offset = circumference - (score / 100) * circumference
  let color = '#EF4444'
  if (score >= 80) color = '#10B981'
  else if (score >= 60) color = '#F59E0B'
  else if (score >= 40) color = '#F97316'

  return (
    <div className="relative w-28 h-28 flex items-center justify-center">
      <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="#F8F7F9" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[22px] font-black text-[#1A1727] leading-none">{score}</span>
        <span className="text-[9px] font-black text-[#9994A8] uppercase tracking-widest mt-0.5">/ 100</span>
      </div>
    </div>
  )
}

export function PerformanceTab({ employeeId, organizationId, reviews, isLoading, isAdmin, onUpdate }: PerformanceTabProps) {
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    review_period_start: '',
    review_period_end: '',
    overall_score: 75,
    attendance_score: 75,
    punctuality_score: 75,
    productivity_score: 75,
    teamwork_score: 75,
    notes: '',
  })

  const sorted = [...reviews].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const latest = sorted[0]

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!organizationId) return
    setSaving(true)
    try {
      const { error } = await supabase.from('performance_reviews').insert({
        employee_id: employeeId,
        organization_id: organizationId,
        review_period_start: form.review_period_start || null,
        review_period_end: form.review_period_end || null,
        overall_score: form.overall_score,
        attendance_score: form.attendance_score,
        punctuality_score: form.punctuality_score,
        productivity_score: form.productivity_score,
        teamwork_score: form.teamwork_score,
        notes: form.notes.trim() || null,
      })
      if (error) throw error
      toast.success('Performance review added')
      setForm({
        review_period_start: '',
        review_period_end: '',
        overall_score: 75,
        attendance_score: 75,
        punctuality_score: 75,
        productivity_score: 75,
        teamwork_score: 75,
        notes: '',
      })
      setShowAdd(false)
      onUpdate()
    } catch (err: any) {
      toast.error(err.message || 'Failed to add review')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center animate-pulse font-black text-[#D1D5DB] uppercase tracking-widest text-[10px]">
        Loading performance data...
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[13px] font-black text-[#1A1727] uppercase tracking-widest flex items-center gap-2">
            <Star size={16} className="text-[#534AB7]" /> Performance Reviews
          </h3>
          <p className="text-[11px] text-[#9994A8] font-bold mt-1">{reviews.length} review{reviews.length !== 1 ? 's' : ''} on record</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 px-4 py-2 bg-[#534AB7] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-purple-900/20 hover:bg-[#1E1854] transition-all"
          >
            <Plus size={13} strokeWidth={3} /> Add Review
          </button>
        )}
      </div>

      {/* Add Form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="bg-white rounded-2xl p-6 border border-[#C7C3D0] shadow-xl shadow-purple-900/5 space-y-5 animate-in zoom-in-95 duration-200">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-1.5">Period Start</label>
              <input type="date" value={form.review_period_start} onChange={(e) => setForm({ ...form, review_period_start: e.target.value })} className="w-full px-4 py-2.5 bg-[#F8F7F9] border border-[#C7C3D0] rounded-xl text-sm font-bold text-[#1A1727] outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-1.5">Period End</label>
              <input type="date" value={form.review_period_end} onChange={(e) => setForm({ ...form, review_period_end: e.target.value })} className="w-full px-4 py-2.5 bg-[#F8F7F9] border border-[#C7C3D0] rounded-xl text-sm font-bold text-[#1A1727] outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { key: 'overall_score', label: 'Overall' },
              { key: 'attendance_score', label: 'Attendance' },
              { key: 'punctuality_score', label: 'Punctuality' },
              { key: 'productivity_score', label: 'Productivity' },
              { key: 'teamwork_score', label: 'Teamwork' },
            ].map((field) => (
              <div key={field.key}>
                <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-1.5">{field.label}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={form[field.key as keyof typeof form] as number}
                    onChange={(e) => setForm({ ...form, [field.key]: parseInt(e.target.value) })}
                    className="flex-1 accent-[#534AB7]"
                  />
                  <span className="text-sm font-black text-[#534AB7] w-8 text-right">{form[field.key as keyof typeof form]}</span>
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-1.5">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-2.5 bg-[#F8F7F9] border border-[#C7C3D0] rounded-xl text-sm font-bold text-[#1A1727] outline-none resize-none"
              placeholder="Review feedback and observations..."
            />
          </div>

          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowAdd(false)} className="px-5 py-2.5 text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] hover:bg-[#F8F7F9] rounded-xl transition-all">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-[#534AB7] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-purple-900/20 hover:bg-[#1E1854] transition-all disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Review'}
            </button>
          </div>
        </form>
      )}

      {/* Latest Review Hero */}
      {latest ? (
        <div className="bg-white rounded-2xl border border-[#C7C3D0] p-8 shadow-sm">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="text-[10px] font-black text-[#534AB7] uppercase tracking-widest mb-1 flex items-center gap-2">
                <TrendingUp size={12} /> Latest Review
              </div>
              <div className="text-[11px] text-[#9994A8] font-bold flex items-center gap-3">
                {latest.review_period_start && latest.review_period_end && (
                  <span className="flex items-center gap-1">
                    <Calendar size={11} />
                    {new Date(latest.review_period_start).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} — {new Date(latest.review_period_end).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>
            </div>
            <OverallRing score={latest.overall_score} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <ScoreBar label="Attendance" score={latest.attendance_score} color="bg-blue-500" />
            <ScoreBar label="Punctuality" score={latest.punctuality_score} color="bg-emerald-500" />
            <ScoreBar label="Productivity" score={latest.productivity_score} color="bg-purple-500" />
            <ScoreBar label="Teamwork" score={latest.teamwork_score} color="bg-pink-500" />
          </div>

          {latest.notes && (
            <div className="mt-6 pt-5 border-t border-[#F8F7F9]">
              <div className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2">Reviewer Notes</div>
              <p className="text-[13px] font-bold text-[#374151] leading-relaxed">{latest.notes}</p>
            </div>
          )}
        </div>
      ) : reviews.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#C7C3D0] p-12 text-center">
          <div className="w-14 h-14 bg-[#F8F7F9] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Star size={24} className="text-[#D1D5DB]" />
          </div>
          <p className="text-[13px] font-bold text-[#9CA3AF]">No performance reviews yet</p>
          {isAdmin && <p className="text-[11px] text-[#D1D5DB] font-bold mt-1">Click Add Review to record the first evaluation</p>}
        </div>
      ) : null}

      {/* Review History */}
      {sorted.length > 1 && (
        <div className="bg-white rounded-2xl border border-[#C7C3D0] p-6 shadow-sm">
          <h4 className="text-[11px] font-black text-[#1A1727] uppercase tracking-widest mb-4">Previous Reviews</h4>
          <div className="space-y-3">
            {sorted.slice(1).map((review) => (
              <div key={review.id} className="flex items-center gap-4 p-4 bg-[#F8F7F9] rounded-xl border border-[#F1F0F4] hover:border-[#C7C3D0] transition-all">
                <div className="w-12 h-12 rounded-xl bg-[#1A1727] flex items-center justify-center text-white text-[14px] font-black shrink-0">
                  {review.overall_score ?? '—'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[12px] font-black text-[#1A1727]">
                      {review.review_period_start && review.review_period_end
                        ? `${new Date(review.review_period_start).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })} — ${new Date(review.review_period_end).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`
                        : 'Review'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-bold text-[#9994A8]">
                    <span>A: {review.attendance_score ?? '—'}</span>
                    <span>P: {review.punctuality_score ?? '—'}</span>
                    <span>Pr: {review.productivity_score ?? '—'}</span>
                    <span>T: {review.teamwork_score ?? '—'}</span>
                  </div>
                </div>
                <div className="text-[10px] font-black text-[#D1D5DB] uppercase tracking-widest shrink-0">
                  {new Date(review.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
