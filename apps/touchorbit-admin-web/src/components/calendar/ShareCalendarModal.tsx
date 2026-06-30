'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { X, Link2, Copy, Check, Calendar, Clock } from 'lucide-react'

interface ShareCalendarModalProps {
  open: boolean
  onClose: () => void
}

export function ShareCalendarModal({ open, onClose }: ShareCalendarModalProps) {
  const [name, setName] = useState('Public Calendar')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [expiresDays, setExpiresDays] = useState('30')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ token: string; share_url: string } | null>(null)
  const [copied, setCopied] = useState(false)

  if (!open) return null

  async function generateLink() {
    setLoading(true)
    try {
      const expiresAt = expiresDays
        ? new Date(Date.now() + parseInt(expiresDays) * 86400000).toISOString()
        : null

      const res = await fetch('/api/calendar/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || 'Public Calendar',
          expires_at: expiresAt,
          allowed_start_date: startDate || null,
          allowed_end_date: endDate || null,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setResult(data)
        toast.success('Public link generated')
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Failed to generate link')
      }
    } catch (e) { toast.error('Failed to generate link') }
    setLoading(false)
  }

  function copyLink() {
    if (!result) return
    navigator.clipboard.writeText(result.share_url)
    setCopied(true)
    toast.success('Link copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1727]/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-[480px] mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-[10px] font-black text-[#534AB7] uppercase tracking-[0.2em] mb-1">Calendar Sharing</div>
            <h2 className="text-lg font-black text-[#1A1727] tracking-tight">Share Public Link</h2>
          </div>
          <button onClick={onClose} className="p-2.5 bg-white border border-[#F1F0F4] rounded-full text-[#9CA3AF] hover:text-red-500 transition-all hover:rotate-90 shadow-sm">
            <X size={18} strokeWidth={3} />
          </button>
        </div>

        {!result ? (
          <div className="space-y-5">
            <div>
              <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Link Name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none"
                placeholder="e.g. Q3 Public Calendar"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Visible From</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Visible Until</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Link Expires In</label>
              <div className="flex items-center gap-2">
                <select
                  value={expiresDays}
                  onChange={e => setExpiresDays(e.target.value)}
                  className="px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none"
                >
                  <option value="7">7 days</option>
                  <option value="14">14 days</option>
                  <option value="30">30 days</option>
                  <option value="60">60 days</option>
                  <option value="90">90 days</option>
                </select>
                <span className="text-xs font-bold text-[#9CA3AF]">days</span>
              </div>
            </div>

            <button
              onClick={generateLink}
              disabled={loading}
              className="w-full py-3 bg-[#534AB7] text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-purple-900/20 hover:bg-[#1E1854] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Clock size={14} className="animate-spin" /> : <Link2 size={14} />}
              {loading ? 'Generating...' : 'Generate Public Link'}
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-2">
                <Link2 size={18} className="text-emerald-600" />
              </div>
              <div className="text-sm font-black text-emerald-800">Link Generated!</div>
              <div className="text-[10px] font-bold text-emerald-600 mt-1">Anyone with this link can view your calendar</div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Share URL</label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={result.share_url}
                  className="flex-1 px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-xs font-bold text-[#1A1727] outline-none"
                />
                <button
                  onClick={copyLink}
                  className={`px-4 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all flex items-center gap-1.5 ${
                    copied
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-[#534AB7] text-white hover:bg-[#1E1854] shadow-lg shadow-purple-900/20'
                  }`}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <button
              onClick={() => { setResult(null); setName('Public Calendar'); setStartDate(''); setEndDate(''); setExpiresDays('30') }}
              className="w-full py-3 text-xs font-black uppercase tracking-widest text-[#9CA3AF] hover:bg-[#F8F7F9] rounded-2xl transition-all border border-[#F1F0F4]"
            >
              Generate Another Link
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
