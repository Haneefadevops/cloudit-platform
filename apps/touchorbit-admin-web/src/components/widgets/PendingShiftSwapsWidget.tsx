'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { WidgetShell } from './WidgetShell'
import type { WidgetProps } from '@/lib/widgets/types'
import { registerWidget } from '@/lib/widgets/registry'
import { ArrowLeftRight } from 'lucide-react'
import { CompactMetricLink, WidgetError } from './_shared/WidgetPrimitives'

export function PendingShiftSwapsWidget({ organizationId, editMode, onRemove }: WidgetProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [data, setData] = useState({ count: 0 })

  async function loadData() {
    setLoading(true)
    setError(false)
    try {
      const { count } = await supabase
        .from('shift_swap_requests')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('status', 'pending')

      setData({ count: count ?? 0 })
    } catch (e) {
      console.error('Error loading shift swaps widget data:', e)
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
      title="Shift Swap Requests"
      icon={ArrowLeftRight}
      tone="purple"
      editMode={editMode}
      onRemove={onRemove}
      loading={loading}
      onRefresh={loadData}
    >
      {error ? (
        <WidgetError onRetry={loadData} />
      ) : (
        <CompactMetricLink href="/roster" icon={ArrowLeftRight} tone="purple" value={data.count} label="Pending" detail="Shift swaps" />
      )}
    </WidgetShell>
  )
}

registerWidget({
  type: 'pending-shift-swaps',
  title: 'Shift Swap Requests',
  description: 'Pending shift swap requests',
  category: 'attendance',
  component: PendingShiftSwapsWidget,
  defaultSize: { w: 3, h: 2 },
  minSize: { w: 2, h: 2 }
})
