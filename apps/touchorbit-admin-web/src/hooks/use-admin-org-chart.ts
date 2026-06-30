'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import type { OrgChartData } from '@/components/ui-touchorbit'

export function useAdminOrgChart() {
  const { organizationId, isLoaded } = useAuth()

  return useQuery({
    queryKey: ['admin-org-chart', organizationId],
    queryFn: async () => {
      if (!organizationId) return []

      const { data, error } = await supabase.rpc('get_admin_org_chart', {
        p_root_id: null,
        p_branch_id: null,
      })

      if (error) {
        console.error('Error fetching admin org chart:', error)
        throw error
      }

      return (data ?? []) as OrgChartData
    },
    enabled: isLoaded && !!organizationId,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  })
}
