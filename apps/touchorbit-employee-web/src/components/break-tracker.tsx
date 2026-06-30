'use client'

import { useState, useEffect } from 'react'
import { Coffee, Square } from 'lucide-react'
import { useBreakTracker } from '@/hooks/use-break-tracker'
import { toast } from 'sonner'

interface BreakTrackerProps {
  currentClockEventId: string | null
  isClockedIn: boolean
}

export function BreakTracker({ currentClockEventId, isClockedIn }: BreakTrackerProps) {
  const {
    isOnBreak,
    currentBreak,
    todayBreakMinutes,
    startBreak,
    endBreak,
    isLoading,
    isReady,
  } = useBreakTracker(currentClockEventId)

  const [currentBreakDuration, setCurrentBreakDuration] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Update current break duration every second
  useEffect(() => {
    if (!isOnBreak || !currentBreak) {
      setCurrentBreakDuration(0)
      return
    }

    const updateDuration = () => {
      const start = new Date(currentBreak.break_start)
      const now = new Date()
      const minutes = Math.floor((now.getTime() - start.getTime()) / 1000 / 60)
      setCurrentBreakDuration(minutes)
    }

    updateDuration()
    const interval = setInterval(updateDuration, 1000)
    return () => clearInterval(interval)
  }, [isOnBreak, currentBreak])

  const handleStartBreak = async () => {
    try {
      await startBreak('break')
      toast.success('Break started')
    } catch (error: any) {
      toast.error(error?.message || 'Failed to start break')
    }
  }

  const handleEndBreak = async () => {
    try {
      await endBreak()
      toast.success('Break ended')
    } catch (error: any) {
      toast.error(error?.message || 'Failed to end break')
    }
  }

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  // Hydration safety: Return a consistent icon until mounted or if not clocked in
  if (!mounted || !isClockedIn) {
    return <Coffee size={22} style={{ color: '#F59E0B' }} strokeWidth={2} />
  }

  return (
    <div
      className={`flex flex-col items-center justify-center gap-1 w-full h-full ${
        isLoading || !isReady ? 'opacity-50' : ''
      }`}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (isLoading || !isReady) return
        isOnBreak ? handleEndBreak() : handleStartBreak()
      }}
    >
      {isOnBreak ? (
        <>
          <Square size={20} className="text-amber-600 fill-amber-600 animate-pulse" />
          <span className="text-[9px] font-black text-amber-600 tabular-nums">
            {formatMinutes(currentBreakDuration)}
          </span>
        </>
      ) : (
        <>
          <Coffee size={22} style={{ color: '#F59E0B' }} strokeWidth={2} />
          {todayBreakMinutes > 0 && (
            <span className="text-[8px] font-bold text-[#9CA3AF] tabular-nums">
              {formatMinutes(todayBreakMinutes)} today
            </span>
          )}
        </>
      )}
    </div>
  )
}
