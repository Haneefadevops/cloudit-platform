'use client'

import { useDashboard } from '@/lib/dashboard/dashboard-context'
import { WidgetShell } from './WidgetShell'
import type { WidgetProps } from '@/lib/widgets/types'
import { registerWidget } from '@/lib/widgets/registry'
import { Banknote } from 'lucide-react'
import { CompactMetricLink, WidgetError } from './_shared/WidgetPrimitives'

export function PendingEncashmentWidget({ editMode, onRemove }: WidgetProps) {
  const { summary, loading, error, refresh } = useDashboard()

  return (
    <WidgetShell
      title="Pending Encashment"
      icon={Banknote}
      tone="green"
      editMode={editMode}
      onRemove={onRemove}
      loading={loading}
    >
      {error ? (
        <WidgetError onRetry={refresh} />
      ) : (
        <CompactMetricLink
          href="/encashment"
          icon={Banknote}
          tone="green"
          value={summary.pendingEncashmentCount}
          label="Requests"
          detail={`LKR ${summary.pendingEncashmentAmount.toLocaleString()}`}
        />
      )}
    </WidgetShell>
  )
}

registerWidget({
  type: 'pending-encashment',
  title: 'Pending Encashment',
  description: 'Leave encashment requests pending approval',
  category: 'finance',
  component: PendingEncashmentWidget,
  defaultSize: { w: 3, h: 2 },
  minSize: { w: 2, h: 2 }
})
