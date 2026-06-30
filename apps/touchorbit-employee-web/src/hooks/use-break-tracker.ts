import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

// duration_minutes is a DB-generated column; fall back to client calculation if null
const breakMins = (b: { duration_minutes: number | null; break_start: string; break_end: string | null }) =>
  b.duration_minutes != null
    ? b.duration_minutes
    : b.break_end
      ? Math.round((new Date(b.break_end).getTime() - new Date(b.break_start).getTime()) / 60000)
      : 0

interface BreakEvent {
  id: string
  employee_id: string
  clock_event_id: string
  break_start: string
  break_end: string | null
  break_type: 'break' | 'lunch' | 'other'
  duration_minutes: number | null
}

interface UseBreakTrackerReturn {
  isOnBreak: boolean
  currentBreak: BreakEvent | null
  todayBreakMinutes: number
  todayBreakEvents: BreakEvent[]
  startBreak: (type?: 'break' | 'lunch' | 'other') => Promise<void>
  endBreak: () => Promise<void>
  isLoading: boolean
  error: string | null
  isReady: boolean
}

export function useBreakTracker(currentClockEventId: string | null): UseBreakTrackerReturn {
  const { userId } = useAuth()
  const [employeeId, setEmployeeId] = useState<string | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isOnBreak, setIsOnBreak] = useState(false)
  const [currentBreak, setCurrentBreak] = useState<BreakEvent | null>(null)
  const [todayBreakMinutes, setTodayBreakMinutes] = useState(0)
  const [todayBreakEvents, setTodayBreakEvents] = useState<BreakEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch employee ID and organization_id from employees table
  useEffect(() => {
    if (!userId) {
      setIsReady(false)
      return
    }

    const fetchEmployee = async () => {
      try {
        const { data, error: empError } = await supabase
          .from('employees')
          .select('id, organization_id')
          .eq('user_id', userId)
          .single()

        if (empError) {
          console.error('useBreakTracker: failed to fetch employee:', empError)
          setError('Failed to load employee data')
          setIsReady(false)
          return
        }

        if (data) {
          setEmployeeId(data.id)
          setOrganizationId(data.organization_id)
          setIsReady(true)
        } else {
          setError('Employee record not found')
          setIsReady(false)
        }
      } catch (err) {
        console.error('useBreakTracker: unexpected error fetching employee:', err)
        setError('Unexpected error loading employee data')
        setIsReady(false)
      }
    }

    fetchEmployee()
  }, [userId])

  // Fetch current break status and today's total break time
  useEffect(() => {
    if (!employeeId || !currentClockEventId) {
      setIsOnBreak(false)
      setCurrentBreak(null)
      setTodayBreakMinutes(0)
      setTodayBreakEvents([])
      return
    }

    const fetchBreakStatus = async () => {
      try {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const todayStart = today.toISOString()
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)
        const todayEnd = tomorrow.toISOString()

        // Fetch ALL today's breaks (for the current clock session and any others)
        const { data: todayBreaks, error: todayError } = await supabase
          .from('break_events')
          .select('*')
          .eq('employee_id', employeeId)
          .gte('break_start', todayStart)
          .lt('break_start', todayEnd)
          .order('break_start', { ascending: true })

        if (todayError) throw todayError

        setTodayBreakEvents(todayBreaks || [])

        // Check for active break (break_end is null) for current clock session
        const activeBreak = (todayBreaks || []).find(
          (b) => b.clock_event_id === currentClockEventId && b.break_end === null
        ) ?? null

        if (activeBreak) {
          setIsOnBreak(true)
          setCurrentBreak(activeBreak)
        } else {
          setIsOnBreak(false)
          setCurrentBreak(null)
        }

        // Calculate total completed break time today
        const totalMinutes = (todayBreaks || []).reduce(
          (sum, b) => sum + breakMins(b),
          0
        )
        setTodayBreakMinutes(totalMinutes)
      } catch (err) {
        console.error('Error fetching break status:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch break status')
      }
    }

    fetchBreakStatus()

    // Poll every 10 seconds to update break duration
    const interval = setInterval(fetchBreakStatus, 10000)
    return () => clearInterval(interval)
  }, [employeeId, currentClockEventId])

  const startBreak = async (type: 'break' | 'lunch' | 'other' = 'break') => {
    if (!isReady) {
      throw new Error('Break tracker not ready yet. Please wait a moment and try again.')
    }
    if (!employeeId) {
      throw new Error('Employee data not loaded. Please refresh the page.')
    }
    if (!organizationId) {
      throw new Error('Organization data not loaded. Please refresh the page.')
    }
    if (!currentClockEventId) {
      throw new Error('You must be clocked in to start a break.')
    }
    if (isOnBreak) {
      throw new Error('You are already on a break.')
    }

    setIsLoading(true)
    setError(null)

    try {
      const { data, error: insertError } = await supabase
        .from('break_events')
        .insert({
          organization_id: organizationId,
          employee_id: employeeId,
          clock_event_id: currentClockEventId,
          break_start: new Date().toISOString(),
          break_type: type,
        })
        .select()
        .single()

      if (insertError) {
        console.error('❌ Break insert error:', insertError)
        throw insertError
      }

      setIsOnBreak(true)
      setCurrentBreak(data)
      setTodayBreakEvents((prev) => [...prev, data])
    } catch (err) {
      console.error('Error starting break:', err)
      const msg = err instanceof Error ? err.message : 'Failed to start break'
      setError(msg)
      throw new Error(msg)
    } finally {
      setIsLoading(false)
    }
  }

  const endBreak = async () => {
    if (!currentBreak || !isOnBreak) {
      throw new Error('No active break to end.')
    }

    setIsLoading(true)
    setError(null)

    try {
      const { data, error: updateError } = await supabase
        .from('break_events')
        .update({ break_end: new Date().toISOString() })
        .eq('id', currentBreak.id)
        .select()
        .single()

      if (updateError) throw updateError

      setIsOnBreak(false)
      setCurrentBreak(null)

      // Refresh today's total
      setTodayBreakMinutes((prev) => prev + breakMins(data))

      // Update the break in today's list
      setTodayBreakEvents((prev) =>
        prev.map((b) => (b.id === data.id ? data : b))
      )
    } catch (err) {
      console.error('Error ending break:', err)
      const msg = err instanceof Error ? err.message : 'Failed to end break'
      setError(msg)
      throw new Error(msg)
    } finally {
      setIsLoading(false)
    }
  }

  return {
    isOnBreak,
    currentBreak,
    todayBreakMinutes,
    todayBreakEvents,
    startBreak,
    endBreak,
    isLoading,
    error,
    isReady,
  }
}
