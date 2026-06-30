'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { WidgetShell } from './WidgetShell'
import type { WidgetProps } from '@/lib/widgets/types'
import { registerWidget } from '@/lib/widgets/registry'
import { GitMerge } from 'lucide-react'
import { CompactMetricLink, WidgetError } from './_shared/WidgetPrimitives'

export function PendingCompOffWidget({ organizationId, editMode, onRemove }: WidgetProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [data, setData] = useState({ count: 0 })

  async function loadData() {
    setLoading(true)
    setError(false)
    try {
      const { count } = await supabase
        .from('comp_off_records')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('status', 'pending')

      setData({ count: count ?? 0 })
    } catch (e) {
      console.error('Error loading comp-off widget data:', e)
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
      title="Pending Comp-Off"
      icon={GitMerge}
      tone="violet"
      editMode={editMode}
      onRemove={onRemove}
      loading={loading}
      onRefresh={loadData}
    >
      {error ? (
        <WidgetError onRetry={loadData} />
      ) : (
        <CompactMetricLink href="/comp-off" icon={GitMerge} tone="violet" value={data.count} label="Requests" detail="Pending approval" />
      )}
    </WidgetShell>
  )
}

registerWidget({
  type: 'pending-comp-off',
  title: 'Pending Comp-Off',
  description: 'Comp-off requests pending approval',
  category: 'attendance',
  component: PendingCompOffWidget,
  defaultSize: { w: 3, h: 2 },
  minSize: { w: 2, h: 2 }
})
