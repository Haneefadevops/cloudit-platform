'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { WidgetShell } from './WidgetShell'
import type { WidgetProps } from '@/lib/widgets/types'
import { registerWidget } from '@/lib/widgets/registry'
import { FileSignature } from 'lucide-react'
import { CompactMetricLink, WidgetError } from './_shared/WidgetPrimitives'

export function PendingDocSignaturesWidget({ organizationId, editMode, onRemove }: WidgetProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [data, setData] = useState({ count: 0 })

  async function loadData() {
    setLoading(true)
    setError(false)
    try {
      const { count } = await supabase
        .from('sent_documents')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('status', 'pending')

      setData({ count: count ?? 0 })
    } catch (e) {
      console.error('Error loading doc signatures widget data:', e)
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
      title="Document Signatures"
      icon={FileSignature}
      tone="sky"
      editMode={editMode}
      onRemove={onRemove}
      loading={loading}
      onRefresh={loadData}
    >
      {error ? (
        <WidgetError onRetry={loadData} />
      ) : (
        <CompactMetricLink href="/documents" icon={FileSignature} tone="sky" value={data.count} label="Pending" detail="Awaiting signature" />
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
