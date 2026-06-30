'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { AlertTriangle, X } from 'lucide-react'

export function FlaggedPunchBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    async function check() {
      const raw = localStorage.getItem('to_flagged_punch')
      if (!raw) return
      const { id, ts } = JSON.parse(raw)
      // Auto-clear after 7 days
      if (Date.now() - ts > 7 * 24 * 3600 * 1000) {
        localStorage.removeItem('to_flagged_punch')
        return
      }
      // Check if still pending review
      const { data } = await supabase
        .from('clock_events')
        .select('admin_review_status')
        .eq('id', id)
        .single()
      if (!data || data.admin_review_status !== 'flagged') {
        localStorage.removeItem('to_flagged_punch')
        return
      }
      setShow(true)
    }
    check()
  }, [])

  if (!show) return null

  return (
    <div className="mx-4 mt-3 flex items-start gap-3 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3">
      <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
      <p className="flex-1 text-[12px] font-semibold text-amber-800 leading-snug">
        Your recent punch is being reviewed. If you have questions, contact your manager.
      </p>
      <button onClick={() => setShow(false)}>
        <X size={14} className="text-amber-400" />
      </button>
    </div>
  )
}
