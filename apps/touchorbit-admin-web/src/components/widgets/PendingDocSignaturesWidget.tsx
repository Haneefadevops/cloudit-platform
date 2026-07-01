'use client'

import { useMemo } from 'react'
import { useDashboard } from '@/lib/dashboard/dashboard-context'
import { WidgetShell } from './WidgetShell'
import type { WidgetProps } from '@/lib/widgets/types'
import { registerWidget } from '@/lib/widgets/registry'
import { FileSignature } from 'lucide-react'
import { CompactMetricLink, WidgetError } from './_shared/WidgetPrimitives'

export function PendingDocSignaturesWidget({ organizationId: _organizationId, editMode, onRemove }: WidgetProps) {
  const { widgets, loading, error, refresh } = useDashboard()

  const count = useMemo(() => {
    const found = widgets.find(w => w.id === 'documents')
    return found?.pending_signatures ?? 0
  }, [widgets])

  return (
    <WidgetShell
      title="Document Signatures"
      icon={FileSignature}
      tone="sky"
      editMode={editMode}
      onRemove={onRemove}
      loading={loading}
      onRefresh={refresh}
    >
      {error ? (
        <WidgetError onRetry={refresh} />
      ) : (
        <CompactMetricLink href="/documents" icon={FileSignature} tone="sky" value={count} label="Pending" detail="Awaiting signature" />
      )}
    </WidgetShell>
  )
}

registerWidget({
  type: 'pending-doc-signatures',
  title: 'Document Signatures',
  description: 'Documents awaiting employee signature',
  category: 'comms',
  component: PendingDocSignaturesWidget,
  defaultSize: { w: 3, h: 2 },
  minSize: { w: 2, h: 2 }
})
