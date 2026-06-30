'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { WidgetShell } from './WidgetShell'
import type { WidgetProps } from '@/lib/widgets/types'
import { registerWidget } from '@/lib/widgets/registry'
import { ClipboardEdit } from 'lucide-react'
import { CompactMetricLink, WidgetError } from './_shared/WidgetPrimitives'

export function PendingCorrectionsWidget({ organizationId, editMode, onRemove }: WidgetProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [data, setData] = useState({ count: 0 })

  async function loadData() {
    setLoading(true)
    setError(false)
    try {
      const { count } = await supabase
        .from('attendance_corrections')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('status', 'pending')

      setData({ count: count ?? 0 })
    } catch (e) {
      console.error('Error loading corrections widget data:', e)
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
      title="Attendance Corrections"
      icon={ClipboardEdit}
      tone="orange"
      editMode={editMode}
      onRemove={onRemove}
      loading={loading}
      onRefresh={loadData}
    >
      {error ? (
        <WidgetError onRetry={loadData} />
      ) : (
        <CompactMetricLink href="/corrections" icon={ClipboardEdit} tone="orange" value={data.count} label="Pending" detail="Review corrections" />
      )}
    </WidgetShell>
  )
}

registerWidget({
  type: 'pending-corrections',
  title: 'Attendance Corrections',
  description: 'Attendance correction requests pending review',
  category: 'attendance',
  component: PendingCorrectionsWidget,
  defaultSize: { w: 3, h: 2 },
  minSize: { w: 2, h: 2 }
})
