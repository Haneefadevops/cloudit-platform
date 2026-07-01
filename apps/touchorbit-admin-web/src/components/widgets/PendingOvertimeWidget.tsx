'use client'

import { useDashboard } from '@/lib/dashboard/dashboard-context'
import { WidgetShell } from './WidgetShell'
import type { WidgetProps } from '@/lib/widgets/types'
import { registerWidget } from '@/lib/widgets/registry'
import { Timer } from 'lucide-react'
import { CompactMetricLink, WidgetError } from './_shared/WidgetPrimitives'

export function PendingOvertimeWidget({ organizationId: _organizationId, editMode, onRemove }: WidgetProps) {
  const { summary, loading, error, refresh } = useDashboard()

  return (
    <WidgetShell
      title="Pending Overtime"
      icon={Timer}
      tone="green"
      editMode={editMode}
      onRemove={onRemove}
      loading={loading}
      onRefresh={refresh}
    >
      {error ? (
        <WidgetError onRetry={refresh} />
      ) : (
        <CompactMetricLink
          href="/overtime"
          icon={Timer}
          tone="green"
          value={summary.pendingOvertime}
          label="Requests"
          detail="Awaiting approval"
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
