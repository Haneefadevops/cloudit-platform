'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import type { MatrixEdge } from '@/components/ui-touchorbit'

export function useMatrixEdges() {
  const { organizationId, isLoaded, isAdmin } = useAuth()

  return useQuery({
    queryKey: ['matrix-edges', organizationId],
    queryFn: async () => {
      if (!organizationId || !isAdmin) return []

      const { data, error } = await supabase.rpc('get_org_chart_matrix_edges')

      if (error) {
        console.error('Error fetching matrix edges:', error)
        throw error
      }

      return (data ?? []) as MatrixEdge[]
    },
    enabled: isLoaded && !!organizationId && isAdmin,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  })
}
