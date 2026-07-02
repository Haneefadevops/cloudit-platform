'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from '@/lib/api'

export interface DashboardSummary {
  activeEmployees: number
  newHires30d: number
  pendingLeave: number
  pendingOvertime: number
  pendingExpenses: number
  scheduledToday: number
  clockedInToday: number
  attendanceRateToday: number
}

export interface DashboardWidget {
  id: string
  type: 'metric' | 'queue' | 'asset-summary' | 'document-summary' | 'payroll-summary'
  title: string
  value?: number
  suffix?: string
  tone?: string
  breakdown?: {
    leave?: number
    overtime?: number
    expenses?: number
  }
  total_assets?: number
  assigned_assets?: number
  available_assets?: number
  pending_signatures?: number
  signed_documents?: number
  data?: {
    id?: string
    month?: number
    year?: number
    status?: string
    total_employees?: number
    total_gross?: number
    total_net?: number
  } | null
}

export interface DashboardActivity {
  id: string
  module: string
  action: string
  severity: string
  entity_type: string
  entity_id: string
  title: string
  actor_name: string
  created_at: string
  metadata?: Record<string, unknown>
}

interface DashboardData {
  summary: DashboardSummary
  widgets: DashboardWidget[]
  activities: DashboardActivity[]
  loading: boolean
  error: string | null
  refresh: () => void
}

const EMPTY_SUMMARY: DashboardSummary = {
  activeEmployees: 0,
  newHires30d: 0,
  pendingLeave: 0,
  pendingOvertime: 0,
  pendingExpenses: 0,
  scheduledToday: 0,
  clockedInToday: 0,
  attendanceRateToday: 0,
}

const DashboardContext = createContext<DashboardData>({
  summary: EMPTY_SUMMARY,
  widgets: [],
  activities: [],
  loading: false,
  error: null,
  refresh: () => {},
})

export function useDashboard() {
  return useContext(DashboardContext)
}

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [widgets, setWidgets] = useState<DashboardWidget[]>([])
  const [activities, setActivities] = useState<DashboardActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [summaryResult, widgetsResult, activitiesResult] = await Promise.all([
      api.get<DashboardSummary>('/dashboard/summary'),
      api.get<DashboardWidget[]>('/dashboard/widgets'),
      api.get<DashboardActivity[]>('/dashboard/activities'),
    ])

    let hasError = false

    if (summaryResult.ok && summaryResult.data) {
      setSummary(summaryResult.data)
    } else {
      hasError = true
      console.error('Failed to load dashboard summary:', summaryResult.error)
    }

    if (widgetsResult.ok && widgetsResult.data) {
      setWidgets(widgetsResult.data)
    } else {
      hasError = true
      console.error('Failed to load dashboard widgets:', widgetsResult.error)
    }

    if (activitiesResult.ok && activitiesResult.data) {
      setActivities(activitiesResult.data)
    } else {
      hasError = true
      console.error('Failed to load dashboard activities:', activitiesResult.error)
    }

    if (hasError) {
      setError('Some dashboard data could not be loaded.')
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <DashboardContext.Provider
      value={{
        summary: summary ?? EMPTY_SUMMARY,
        widgets,
        activities,
        loading,
        error,
        refresh: load,
      }}
    >
      {children}
    </DashboardContext.Provider>
  )
}
