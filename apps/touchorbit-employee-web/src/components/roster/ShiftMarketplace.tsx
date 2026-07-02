'use client'

import { useState } from 'react'
import { ShoppingBag, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface OpenSwap {
  id: string
  requester_date: string
  requester_shift_name?: string | null
  requester?: { first_name: string; last_name: string }
}

interface ShiftMarketplaceProps {
  swaps: OpenSwap[]
  onClaim: (swapId: string) => Promise<void>
}

export function ShiftMarketplace({ swaps, onClaim }: ShiftMarketplaceProps) {
  const [claimingId, setClaimingId] = useState<string | null>(null)

  if (swaps.length === 0) return null

  const handleClaim = async (swapId: string) => {
    setClaimingId(swapId)
    try {
      await onClaim(swapId)
    } finally {
      setClaimingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-[12px] font-black text-[#1A1727] uppercase tracking-wider flex items-center gap-2">
        <ShoppingBag size={16} /> Open Swaps ({swaps.length})
      </h3>
      <div className="space-y-3">
        {swaps.map(swap => (
          <div
            key={swap.id}
            className="p-4 bg-purple-50 rounded-[24px] border border-purple-100 flex items-center justify-between shadow-sm"
          >
            <div>
              <div className="text-[11px] font-black text-[#1A1727]">
                {swap.requester?.first_name} {swap.requester?.last_name}
              </div>
              <div className="text-[10px] font-bold text-[#9CA3AF] uppercase mt-1 tracking-tighter">
                {new Date(swap.requester_date).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                })}{' '}
                · {swap.requester_shift_name || 'Open to claim'}
              </div>
            </div>
            <button
              onClick={() => handleClaim(swap.id)}
              disabled={claimingId === swap.id}
              className="px-3 py-1.5 bg-[#534AB7] text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-[#1E1854] transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1"
            >
              {claimingId === swap.id ? (
                <Loader2 size={10} className="animate-spin" />
              ) : (
                'Claim'
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
