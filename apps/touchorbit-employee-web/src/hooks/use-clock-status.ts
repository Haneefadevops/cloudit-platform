import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { toast } from 'sonner'

export interface ClockEvent {
  id: string
  event_type: 'clock_in' | 'clock_out'
  timestamp: string
  latitude: number | null
  longitude: number | null
  location_verified: boolean
  selfie_url: string | null
}

export interface ClockInData {
  event_type: 'clock_in' | 'clock_out'
  latitude: number
  longitude: number
  location_verified: boolean
  selfie_url?: string | null
}

export function useClockStatus() {
  const { userId, organizationId, isLoaded } = useAuth()
  const queryClient = useQueryClient()

  // Get employee ID
  const { data: employeeData } = useQuery({
    queryKey: ['employee', userId],
    queryFn: async () => {
      if (!userId) return null

      const { data: employee } = await supabase
        .from('employees')
        .select('id, organization_id')
        .eq('user_id', userId)
        .single()

      return employee
    },
    enabled: isLoaded && !!userId,
  })

  // Get today's clock events
  const { data: todayEvents, isLoading } = useQuery({
    queryKey: ['clock-events', 'today', employeeData?.id],
    queryFn: async () => {
      if (!employeeData?.id) return []

      // Get today's events
      const today = new Date().toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('clock_events')
        .select('*')
        .eq('employee_id', employeeData.id)
        .gte('timestamp', today)
        .order('timestamp', { ascending: true })

      if (error) {
        console.error('Error fetching clock events:', error)
        return []
      }

      return data as ClockEvent[]
    },
    enabled: !!employeeData?.id,
  })

  // Determine current status
  const latestEvent = todayEvents?.[todayEvents.length - 1]
  const isClockedIn = latestEvent?.event_type === 'clock_in'
  const clockInTime = isClockedIn ? latestEvent?.timestamp : null

  // Clock in/out mutation
  const clockMutation = useMutation({
    mutationFn: async (data: ClockInData) => {
      if (!userId) throw new Error('Not authenticated')

      // Get employee ID
      const { data: employee } = await supabase
        .from('employees')
        .select('id, organization_id')
        .eq('user_id', userId)
        .single()

      if (!employee) throw new Error('Employee not found')

      // Insert clock event
      const { data: event, error } = await supabase
        .from('clock_events')
        .insert({
          organization_id: employee.organization_id,
          employee_id: employee.id,
          event_type: data.event_type,
          timestamp: new Date().toISOString(),
          latitude: data.latitude,
          longitude: data.longitude,
          location_verified: data.location_verified,
          selfie_url: data.selfie_url || null,
          method: 'mobile_app',
        })
        .select()
        .single()

      if (error) throw error

      return event as ClockEvent
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['clock-events'] })

      if (data.event_type === 'clock_in') {
        toast.success('Clocked in successfully!', {
          description: data.location_verified
            ? 'Location verified ✓'
            : 'Outside geofence - location not verified',
        })
      } else {
        toast.success('Clocked out successfully!', {
          description: 'Have a great day!',
        })
      }
    },
    onError: (error) => {
      toast.error('Failed to clock ' + (isClockedIn ? 'out' : 'in'), {
        description: error instanceof Error ? error.message : 'Please try again',
      })
    },
  })

  return {
    todayEvents: todayEvents || [],
    employeeId: employeeData?.id || null,
    organizationId: employeeData?.organization_id || organizationId,
    isClockedIn,
    clockInTime,
    isLoading,
    clockIn: (data: ClockInData) => clockMutation.mutate(data),
    clockOut: (data: ClockInData) => clockMutation.mutate({ ...data, event_type: 'clock_out' }),
    isClocking: clockMutation.isPending,
    refreshStatus: () => queryClient.invalidateQueries({ queryKey: ['clock-events'] }),
  }
}

// Hook to get geofences for the organization
export function useGeofences() {
  const { organizationId, isLoaded } = useAuth()

  return useQuery({
    queryKey: ['geofences', organizationId],
    queryFn: async () => {
      if (!organizationId) return []

      const { data, error } = await supabase
        .from('geofences')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('status', 'active')

      if (error) {
        console.error('Error fetching geofences:', error)
        return []
      }

      return data
    },
    enabled: isLoaded && !!organizationId,
  })
}
