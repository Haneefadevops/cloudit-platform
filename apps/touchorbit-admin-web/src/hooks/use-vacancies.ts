'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import type { Vacancy } from '@/components/ui-touchorbit'

export function useVacancies() {
  const { organizationId, isLoaded, isAdmin } = useAuth()

  return useQuery({
    queryKey: ['org-vacancies', organizationId],
    queryFn: async () => {
      if (!organizationId || !isAdmin) return []

      const { data, error } = await supabase.rpc('get_org_vacancies')

      if (error) {
        console.error('Error fetching vacancies:', error)
        throw error
      }

      return (data ?? []) as Vacancy[]
    },
    enabled: isLoaded && !!organizationId && isAdmin,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  })
}
