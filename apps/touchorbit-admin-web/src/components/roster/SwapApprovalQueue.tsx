'use client'

import { useState } from 'react'
import { Check, X, Loader2, ArrowRight, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'

interface SwapRequest {
  id: string
  requester_employee_id: string
  target_employee_id: string | null
  claimed_by: string | null
  requester_date: string
  target_date: string
  status: 'pending' | 'claimed' | 'approved' | 'rejected'
  created_at?: string
  requester?: { first_name: string; last_name: string }
  target?: { first_name: string; last_name: string }
  claimer?: { first_name: string; last_name: string }
}

interface SwapApprovalQueueProps {
  swaps: SwapRequest[]
  onAction: () => void
}

export function SwapApprovalQueue({ swaps, onAction }: SwapApprovalQueueProps) {
  const [actingId, setActingId] = useState<string | null>(null)

  const handleApprove = async (swapId: string) => {
    setActingId(swapId)
    try {
      const res = await api.post(`/shift-swaps/${swapId}/approve`, {})
      if (!res.ok) throw new Error(res.error)
      toast.success('Swap approved')
      onAction()
    } catch {
      toast.error('Approval failed')
    } finally {
      setActingId(null)
    }
  }

  const handleReject = async (swapId: string) => {
    setActingId(swapId)
    try {
      const res = await api.post(`/shift-swaps/${swapId}/reject`, {})
      if (!res.ok) throw new Error(res.error)
      toast.success('Swap rejected')
      onAction()
    } catch {
      toast.error('Rejection failed')
    } finally {
      setActingId(null)
    }
  }

  const pending = swaps.filter(s => s.status === 'pending' || s.status === 'claimed')

  if (pending.length === 0) {
    return (
      <div className="p-6 bg-[#F8F7F9] rounded-2xl border border-[#F1F0F4] text-center">
        <RefreshCw size={20} className="mx-auto text-[#D1D5DB] mb-2" />
        <div className="text-xs font-bold text-[#9CA3AF]">No pending swaps</div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {pending.map(swap => (
        <div
          key={swap.id}
          className="p-4 bg-white rounded-[20px] border border-[#F1F0F4] shadow-sm flex items-center justify-between gap-4"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-black text-[#1A1727]">
              <span>{swap.requester?.first_name} {swap.requester?.last_name}</span>
              <ArrowRight size={12} className="text-[#9CA3AF] shrink-0" />
              {swap.claimed_by && swap.claimer ? (
                <span>{swap.claimer.first_name} {swap.claimer.last_name}</span>
              ) : swap.target ? (
                <span>{swap.target.first_name} {swap.target.last_name}</span>
              ) : (
                <span className="text-purple-600">Open</span>
              )}
            </div>
            <div className="text-[10px] font-bold text-[#9CA3AF] uppercase mt-1 tracking-tighter">
              {new Date(swap.requester_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
              {' → '}
              {new Date(swap.target_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
              <span className={`ml-2 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                swap.status === 'claimed' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {swap.status}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleApprove(swap.id)}
              disabled={actingId === swap.id}
              className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all active:scale-95 disabled:opacity-50"
              title="Approve"
            >
              {actingId === swap.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} strokeWidth={3} />}
            </button>
            <button
              onClick={() => handleReject(swap.id)}
              disabled={actingId === swap.id}
              className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all active:scale-95 disabled:opacity-50"
              title="Reject"
            >
              <X size={14} strokeWidth={3} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
