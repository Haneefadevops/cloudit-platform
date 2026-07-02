'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import type { OrgChartData } from '@/components/ui-touchorbit'

export function useOrgChartAsOf(date: string | null) {
  const { organizationId, isLoaded, isAdmin } = useAuth()

  return useQuery({
    queryKey: ['admin-org-chart-as-of', organizationId, date],
    queryFn: async () => {
      if (!organizationId || !date || !isAdmin) return []

      const { data, error } = await supabase.rpc('get_org_chart_as_of', {
        p_date: date,
      })

      if (error) {
        console.error('Error fetching historical org chart:', error)
        throw error
      }

      return (data ?? []) as OrgChartData
    },
    enabled: isLoaded && !!organizationId && isAdmin && !!date,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  })
}
