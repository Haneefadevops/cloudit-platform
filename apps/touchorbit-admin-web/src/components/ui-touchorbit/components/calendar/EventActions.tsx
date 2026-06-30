'use client'

import React from 'react'
import { Check, X, HelpCircle, CalendarDays } from 'lucide-react'
import { cn } from '../../lib/utils'

export type RsvpStatus = 'pending' | 'accepted' | 'declined' | 'tentative'

interface EventActionsProps {
  rsvpStatus?: RsvpStatus
  onRsvp?: (status: RsvpStatus) => void
  onRescheduleRequest?: () => void
  canReschedule?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function EventActions({
  rsvpStatus,
  onRsvp,
  onRescheduleRequest,
  canReschedule = true,
  size = 'md',
  className,
}: EventActionsProps) {
  const btnSize = size === 'sm' ? 'px-2 py-1 text-[9px]' : 'px-3 py-1.5 text-[11px]'
  const iconSize = size === 'sm' ? 10 : 12

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {onRsvp && (
        <>
          <button
            onClick={() => onRsvp('accepted')}
            className={cn(
              'rounded-xl font-black uppercase tracking-wider border transition-all flex items-center gap-1',
              btnSize,
              rsvpStatus === 'accepted'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-white text-[#9CA3AF] border-[#F1F0F4] hover:bg-emerald-50 hover:text-emerald-600'
            )}
          >
            <Check size={iconSize} /> Accept
          </button>
          <button
            onClick={() => onRsvp('declined')}
            className={cn(
              'rounded-xl font-black uppercase tracking-wider border transition-all flex items-center gap-1',
              btnSize,
              rsvpStatus === 'declined'
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-white text-[#9CA3AF] border-[#F1F0F4] hover:bg-red-50 hover:text-red-600'
            )}
          >
            <X size={iconSize} /> Decline
          </button>
          <button
            onClick={() => onRsvp('tentative')}
            className={cn(
              'rounded-xl font-black uppercase tracking-wider border transition-all flex items-center gap-1',
              btnSize,
              rsvpStatus === 'tentative'
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-white text-[#9CA3AF] border-[#F1F0F4] hover:bg-blue-50 hover:text-blue-600'
            )}
          >
            <HelpCircle size={iconSize} /> Maybe
          </button>
        </>
      )}

      {canReschedule && onRescheduleRequest && (
        <button
          onClick={onRescheduleRequest}
          className={cn(
            'rounded-xl font-black uppercase tracking-wider border transition-all flex items-center gap-1',
            btnSize,
            'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
          )}
        >
          <CalendarDays size={iconSize} /> Reschedule
        </button>
      )}
    </div>
  )
}
