'use client'

import { useDashboard } from '@/lib/dashboard/dashboard-context'
import { WidgetShell } from './WidgetShell'
import type { WidgetProps } from '@/lib/widgets/types'
import { registerWidget } from '@/lib/widgets/registry'
import { DollarSign, Wallet } from 'lucide-react'
import { CompactMetricLink, WidgetError } from './_shared/WidgetPrimitives'

export function PendingExpensesWidget({ organizationId: _organizationId, editMode, onRemove }: WidgetProps) {
  const { summary, loading, error, refresh } = useDashboard()

  return (
    <WidgetShell
      title="Pending Expenses"
      icon={DollarSign}
      tone="blue"
      editMode={editMode}
      onRemove={onRemove}
      loading={loading}
      onRefresh={refresh}
    >
      {error ? (
        <WidgetError onRetry={refresh} />
      ) : (
        <CompactMetricLink
          href="/expenses"
          icon={Wallet}
          tone="blue"
          value={summary.pendingExpenses}
          label="Reports"
          detail="Awaiting approval"
        />
      )}
    </WidgetShell>
  )
}

registerWidget({
  type: 'pending-expenses',
  title: 'Pending Expenses',
  description: 'Expense claims awaiting approval',
  category: 'finance',
  component: PendingExpensesWidget,
  defaultSize: { w: 2, h: 3 },
  minSize: { w: 2, h: 3 }
})
