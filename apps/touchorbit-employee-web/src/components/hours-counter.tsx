'use client'

import { useEffect, useState } from 'react'
import { useClockStatus } from '@/hooks/use-clock-status'
import { calculateHours } from '@/lib/utils'

function formatDuration(totalHours: number): string {
  const h = Math.floor(totalHours)
  const m = Math.floor((totalHours - h) * 60)
  const s = Math.floor(((totalHours - h) * 60 - m) * 60)
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function HoursCounter() {
  const { todayEvents, isClockedIn } = useClockStatus()
  const [currentHours, setCurrentHours] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const calculateCurrentSession = () => {
      // If not clocked in, show 00:00:00 (reset after clock out)
      if (!isClockedIn) {
        return 0
      }

      // Find the MOST RECENT clock_in event (current session only)
      let lastClockIn: string | null = null
      for (let i = todayEvents.length - 1; i >= 0; i--) {
        if (todayEvents[i].event_type === 'clock_in') {
          lastClockIn = todayEvents[i].timestamp
          break
        }
      }

      if (!lastClockIn) {
        return 0
      }

      // Return hours since the most recent clock_in
      return calculateHours(lastClockIn)
    }

    setCurrentHours(calculateCurrentSession())

    // Update every second if clocked in so the timer feels live
    if (isClockedIn) {
      const interval = setInterval(() => {
        setCurrentHours(calculateCurrentSession())
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [todayEvents, isClockedIn, mounted])

  // Hydration safety: Return a consistent placeholder on server and first client render
  if (!mounted) {
    return <span className="tabular-nums">00:00:00</span>
  }

  return (
    <span className="tabular-nums">
      {formatDuration(currentHours)}
    </span>
  )
}
