'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { offlineDB } from '@/lib/offline-db'
import type { OrgChartData } from '@/components/ui-touchorbit'

const CACHE_KEY = 'org-chart'

async function fetchOrgChart(employeeId: string | null): Promise<OrgChartData> {
  if (!employeeId) return []

  const result = await api.get<OrgChartData>('/employees/org-chart')
  if (!result.ok) {
    // Try offline cache on error
    const cached = await offlineDB.orgChart.get(CACHE_KEY)
    if (cached) return cached.data as OrgChartData
    throw new Error(result.error || 'Unable to load org chart')
  }

  const data = result.data ?? []

  // Write to cache
  await offlineDB.orgChart.put({
    id: CACHE_KEY,
    data,
    cachedAt: new Date().toISOString(),
  })

  return data
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
