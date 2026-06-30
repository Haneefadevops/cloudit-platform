'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { WidgetShell } from './WidgetShell'
import type { WidgetProps } from '@/lib/widgets/types'
import { registerWidget } from '@/lib/widgets/registry'
import { Timer } from 'lucide-react'
import { CompactMetricLink, WidgetError } from './_shared/WidgetPrimitives'

export function PendingOvertimeWidget({ organizationId, editMode, onRemove }: WidgetProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [data, setData] = useState({
    count: 0,
    totalHours: 0
  })

  async function loadData() {
    setLoading(true)
    setError(false)
    try {
      const { data: records } = await supabase
        .from('overtime_records')
        .select('hours')
        .eq('organization_id', organizationId)
        .ilike('status', 'awaiting%')

      if (records) {
        const totalHours = records.reduce((acc, curr) => acc + (Number(curr.hours) || 0), 0)
        setData({
          count: records.length,
          totalHours
        })
      }
    } catch (error) {
      console.error('Error loading overtime widget data:', error)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (organizationId) loadData()
  }, [organizationId])

  return (
    <WidgetShell
      title="Pending Overtime"
      icon={Timer}
      tone="green"
      editMode={editMode}
      onRemove={onRemove}
      loading={loading}
      onRefresh={loadData}
    >
      {error ? (
        <WidgetError onRetry={loadData} />
      ) : (
        <CompactMetricLink
          href="/overtime"
          icon={Timer}
          tone="green"
          value={data.count}
          label="Requests"
          detail={`${data.totalHours.toFixed(1)} hours pending`}
        />
      )}
    </WidgetShell>
  )
}

registerWidget({
  type: 'pending-overtime',
  title: 'Pending Overtime',
  description: 'Overtime requests pending approval',
  category: 'finance',
  component: PendingOvertimeWidget,
  defaultSize: { w: 2, h: 3 },
  minSize: { w: 2, h: 3 }
})
