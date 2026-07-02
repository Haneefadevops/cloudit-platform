'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import type { PresenceInfo } from '@/components/ui-touchorbit'

export function usePresence() {
  const { organizationId, isLoaded, isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const [realtimeUpdates, setRealtimeUpdates] = useState<PresenceInfo[]>([])

  // Base fetch via RPC
  const { data, isLoading } = useQuery({
    queryKey: ['presence', organizationId],
    queryFn: async () => {
      if (!organizationId) return []
      if (!isAdmin) return []

      const { data, error } = await supabase.rpc('get_present_employee_ids', {
        p_branch_id: null,
      })

      if (error) {
        console.error('Error fetching presence:', error)
        throw error
      }

      return (data ?? []) as PresenceInfo[]
    },
    enabled: isLoaded && !!organizationId && isAdmin,
    staleTime: 1000 * 30, // 30 seconds
    gcTime: 1000 * 60 * 5,
  })

  // Debounced merge of realtime updates into query cache
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const mergePresence = useCallback(
    (updates: PresenceInfo[]) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        queryClient.setQueryData<PresenceInfo[]>(['presence', organizationId], (old) => {
          if (!old) return updates
          const map = new Map(old.map((p) => [p.employee_id, p]))
          for (const u of updates) {
            map.set(u.employee_id, u)
          }
          return Array.from(map.values())
        })
        setRealtimeUpdates([])
      }, 300)
    },
    [organizationId, queryClient]
  )

  // Realtime subscription (admin-only)
  useEffect(() => {
    if (!isLoaded || !organizationId || !isAdmin) return

    const channel = supabase
      .channel(`org-chart-presence-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'org_chart_presence_events',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          const row = payload.new as any
          if (!row?.employee_id) return

          const update: PresenceInfo = {
            employee_id: row.employee_id,
            status: row.event_type === 'clock_in' ? 'clocked_in' : row.event_type === 'leave' ? 'on_leave' : 'offline',
            since: row.occurred_at,
          }

          setRealtimeUpdates((prev) => {
            const next = [...prev]
            const idx = next.findIndex((p) => p.employee_id === update.employee_id)
            if (idx >= 0) next[idx] = update
            else next.push(update)
            return next
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isLoaded, organizationId, isAdmin])

  // Apply debounced updates
  useEffect(() => {
    if (realtimeUpdates.length > 0) {
      mergePresence(realtimeUpdates)
    }
  }, [realtimeUpdates, mergePresence])

  return { presence: data ?? [], isLoading }
}
