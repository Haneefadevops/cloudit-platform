'use client'

import { useDashboard } from '@/lib/dashboard/dashboard-context'
import { WidgetShell } from './WidgetShell'
import type { WidgetProps } from '@/lib/widgets/types'
import { registerWidget } from '@/lib/widgets/registry'
import { GitMerge } from 'lucide-react'
import { CompactMetricLink, WidgetError } from './_shared/WidgetPrimitives'

export function PendingCompOffWidget({ editMode, onRemove }: WidgetProps) {
  const { summary, loading, error, refresh } = useDashboard()

  return (
    <WidgetShell
      title="Pending Comp-Off"
      icon={GitMerge}
      tone="violet"
      editMode={editMode}
      onRemove={onRemove}
      loading={loading}
    >
      {error ? (
        <WidgetError onRetry={refresh} />
      ) : (
        <CompactMetricLink href="/comp-off" icon={GitMerge} tone="violet" value={summary.pendingCompOff} label="Requests" detail="Pending approval" />
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
