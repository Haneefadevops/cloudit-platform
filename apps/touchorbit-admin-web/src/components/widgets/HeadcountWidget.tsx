'use client'

import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useDashboard } from '@/lib/dashboard/dashboard-context'
import { WidgetShell } from './WidgetShell'
import type { WidgetProps } from '@/lib/widgets/types'
import { registerWidget } from '@/lib/widgets/registry'
import { UserCheck, Users } from 'lucide-react'
import { ProgressBar, WidgetEmpty, WidgetError } from './_shared/WidgetPrimitives'

interface DeptCount {
  name: string
  count: number
  pct: number
}

export function HeadcountWidget({ organizationId, editMode, onRemove }: WidgetProps) {
  const { summary } = useDashboard()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [data, setData] = useState({
    total: 0,
    departments: [] as DeptCount[]
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const result = await api.get<any[]>('/employees?status=active&limit=500')
      if (!result.ok) throw new Error(result.error || 'Failed to load employees')

      const employees = result.data || []
      const total = summary?.activeEmployees ?? employees.length
      const counts: Record<string, number> = {}

      employees.forEach((emp: any) => {
        const deptName = emp.department_name || emp.department || 'Unassigned'
        counts[deptName] = (counts[deptName] || 0) + 1
      })

      const deptCounts: DeptCount[] = Object.entries(counts)
        .map(([name, count]) => ({
          name,
          count,
          pct: total > 0 ? Math.round((count / total) * 100) : 0
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 4)

      setData({ total, departments: deptCounts })
    } catch (error) {
      console.error('Error loading headcount widget data:', error)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [summary?.activeEmployees])

  useEffect(() => {
    if (organizationId) loadData()
  }, [organizationId, loadData])

  return (
    <WidgetShell
      title="Headcount"
      icon={UserCheck}
      tone="green"
      editMode={editMode}
      onRemove={onRemove}
      loading={loading}
      onRefresh={loadData}
    >
      {error ? (
        <WidgetError onRetry={loadData} />
      ) : (
      <div className="flex h-full flex-col p-6 pt-5">
        <div className="grid grid-cols-[120px_1fr] gap-6">
          <div>
            <p className="text-sm text-slate-500">Total Active Staff</p>
            <p className="mt-3 text-5xl font-black leading-none text-slate-950">{data.total}</p>
            <p className="mt-3 text-sm text-slate-500">Active employees</p>
          </div>

          <div className="space-y-3 overflow-hidden">
            {data.departments.map((dept) => (
              <div key={dept.name}>
                <div className="mb-1 flex justify-between gap-3 text-xs font-semibold">
                  <span className="truncate text-slate-950">{dept.name}</span>
                  <span className="shrink-0 text-slate-700">{dept.count} ({dept.pct}%)</span>
                </div>
                <ProgressBar value={dept.pct * 2.4} tone="purple" />
              </div>
            ))}
            {data.departments.length === 0 && (
              <WidgetEmpty icon={Users} label="No active employees found" />
            )}
          </div>
        </div>
      </div>
      )}
    </WidgetShell>
  )
}

registerWidget({
  type: 'headcount',
  title: 'Headcount',
  description: 'Active employee breakdown by department',
  category: 'people',
  component: HeadcountWidget,
  defaultSize: { w: 4, h: 4 },
  minSize: { w: 3, h: 3 }
})
