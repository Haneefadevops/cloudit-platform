'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { offlineDB } from '@/lib/offline-db'
import type { OrgChartData } from '@/components/ui-touchorbit'

const CACHE_KEY = 'org-chart'

async function fetchOrgChart(employeeId: string | null): Promise<OrgChartData> {
  if (!employeeId) return []

  const { data, error } = await supabase.rpc('get_org_chart', {
    p_root_id: null,
    p_branch_id: null,
  })

  if (error) {
    // Try offline cache on error
    const cached = await offlineDB.orgChart.get(CACHE_KEY)
    if (cached) return cached.data as OrgChartData
    throw error
  }

  const result = (data ?? []) as OrgChartData

  // Write to cache
  await offlineDB.orgChart.put({
    id: CACHE_KEY,
    data: result,
    cachedAt: new Date().toISOString(),
  })

  return result
}

export function useOrgChart() {
  const { userId, isLoaded } = useAuth()

  return useQuery({
    queryKey: ['org-chart', userId],
    queryFn: () => fetchOrgChart(userId),
    enabled: isLoaded && !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  })
}

export async function getCachedOrgChart(): Promise<OrgChartData | null> {
  const cached = await offlineDB.orgChart.get(CACHE_KEY)
  return cached ? (cached.data as OrgChartData) : null
}
