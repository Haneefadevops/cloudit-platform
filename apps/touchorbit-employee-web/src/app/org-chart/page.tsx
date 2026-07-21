'use client'

import { useEffect, useState } from 'react'
import { EmployeeLayout } from '@/components/employee-layout'
import { useAuth } from '@/lib/auth'
import { useOrgChart, getCachedOrgChart } from '@/hooks/use-org-chart'
import { OrgChart } from '@/components/ui-touchorbit'
import type { OrgChartData } from '@/components/ui-touchorbit'

export default function EmployeeOrgChartPage() {
  const { userId, isLoaded } = useAuth()
  const { data, isLoading, isError } = useOrgChart()
  const [offlineData, setOfflineData] = useState<OrgChartData | null>(null)

  // Load from dexie cache immediately for instant render
  useEffect(() => {
    getCachedOrgChart().then((cached) => {
      if (cached) setOfflineData(cached)
    })
  }, [])

  const chartData = data ?? offlineData ?? []
  const showLoading = isLoading && !offlineData
  const showEmpty = !showLoading && !isError && chartData.length === 0

  // Map supabase user id to employee id if possible
  // For now we use the userId as a fallback; the mock data has 'e005' as current user
  // In production, the RPC sets is_current_user based on the caller
  const currentUserNode = chartData.find((n) => n.is_current_user)
  const currentUserEmployeeId = currentUserNode?.employee_id

  return (
    <EmployeeLayout title="Org Chart" backHref="/" hideHeader={false}>
      <div className="h-[calc(100vh-7rem)] relative">
        {isError && !offlineData && (
          <div className="absolute inset-0 z-20 flex items-center justify-center">
            <div className="text-center px-6">
              <div className="text-sm font-medium text-gray-900">Unable to load org chart</div>
              <div className="text-xs text-gray-500 mt-1">
                Check your connection and try again
              </div>
            </div>
          </div>
        )}
        {showEmpty && (
          <div className="absolute inset-0 z-20 flex items-center justify-center">
            <div className="text-center px-6">
              <div className="text-sm font-medium text-gray-900">No organization structure yet</div>
              <div className="text-xs text-gray-500 mt-1">Employees will appear here once reporting lines are configured.</div>
            </div>
          </div>
        )}
        <OrgChart
          data={chartData}
          viewerRole="employee"
          currentUserId={currentUserEmployeeId}
          isLoading={showLoading}
        />
      </div>
    </EmployeeLayout>
  )
}
