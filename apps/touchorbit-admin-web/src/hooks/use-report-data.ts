'use client'

import { useCallback, useState } from 'react'
import type { ReportFilters, ReportResponse } from '@/lib/reports/fetch'

interface ReportState<T> {
  data:      T[]
  meta:      Record<string, unknown>
  loading:   boolean
  error:     string | null
  generated: boolean
}

// Generic hook for any report module.
//
// Usage:
//   const { data, meta, loading, error, generate } =
//     useReportData(reportFetch.attendance)
//
//   // on Generate button click:
//   generate({ startDate, endDate, departmentId, employeeIds, mode: 'summary' })
export function useReportData<T>(
  fetchFn: (filters: ReportFilters) => Promise<ReportResponse<T>>,
) {
  const [state, setState] = useState<ReportState<T>>({
    data:      [],
    meta:      {},
    loading:   false,
    error:     null,
    generated: false,
  })

  const generate = useCallback(async (filters: ReportFilters) => {
    setState(s => ({ ...s, loading: true, error: null }))
    const result = await fetchFn(filters)
    if (result.error) console.error('[useReportData]', result.error)
    setState({
      data:      result.data,
      meta:      result.meta,
      loading:   false,
      error:     result.error,
      generated: true,
    })
  }, [fetchFn])

  return {
    data:      state.data,
    meta:      state.meta,
    loading:   state.loading,
    error:     state.error,
    hasData:   state.data.length > 0,
    generated: state.generated,
    generate,
  }
}
