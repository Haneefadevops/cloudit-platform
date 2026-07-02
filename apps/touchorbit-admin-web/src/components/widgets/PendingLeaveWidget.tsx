'use client'

import { useDashboard } from '@/lib/dashboard/dashboard-context'
import { WidgetShell } from './WidgetShell'
import type { WidgetProps } from '@/lib/widgets/types'
import { registerWidget } from '@/lib/widgets/registry'
import { Calendar } from 'lucide-react'
import { CompactMetricLink, WidgetError } from './_shared/WidgetPrimitives'

export function PendingLeaveWidget({ organizationId: _organizationId, editMode, onRemove }: WidgetProps) {
  const { summary, loading, error, refresh } = useDashboard()

  return (
    <WidgetShell
      title="Pending Leave"
      icon={Calendar}
      tone="amber"
      editMode={editMode}
      onRemove={onRemove}
      loading={loading}
      onRefresh={refresh}
    >
      {error ? (
        <WidgetError onRetry={refresh} />
      ) : (
        <CompactMetricLink
          href="/leave"
          icon={Calendar}
          tone="amber"
          value={summary.pendingLeave}
          label="Requests"
          detail="Awaiting approval"
        />
      )}
    </WidgetShell>
  )
}

registerWidget({
  type: 'pending-leave',
  title: 'Pending Leave',
  description: 'Leave requests awaiting approval',
  category: 'attendance',
  component: PendingLeaveWidget,
  defaultSize: { w: 3, h: 3 },
  minSize: { w: 2, h: 2 }
})
