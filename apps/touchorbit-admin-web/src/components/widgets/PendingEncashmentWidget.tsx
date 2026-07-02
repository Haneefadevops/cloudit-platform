'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { WidgetShell } from './WidgetShell'
import type { WidgetProps } from '@/lib/widgets/types'
import { registerWidget } from '@/lib/widgets/registry'
import { Banknote } from 'lucide-react'
import { CompactMetricLink, WidgetError } from './_shared/WidgetPrimitives'

export function PendingEncashmentWidget({ organizationId, editMode, onRemove }: WidgetProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [data, setData] = useState({ count: 0, totalAmount: 0 })

  async function loadData() {
    setLoading(true)
    setError(false)
    try {
      const { data: records } = await supabase
        .from('leave_encashment_requests')
        .select('amount')
        .eq('organization_id', organizationId)
        .eq('status', 'pending')

      if (records) {
        const totalAmount = records.reduce((acc, r) => acc + (Number(r.amount) || 0), 0)
        setData({ count: records.length, totalAmount })
      }
    } catch (e) {
      console.error('Error loading encashment widget data:', e)
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
      title="Pending Encashment"
      icon={Banknote}
      tone="green"
      editMode={editMode}
      onRemove={onRemove}
      loading={loading}
      onRefresh={loadData}
    >
      {error ? (
        <WidgetError onRetry={loadData} />
      ) : (
        <CompactMetricLink href="/encashment" icon={Banknote} tone="green" value={data.count} label="Requests" detail={`LKR ${data.totalAmount.toLocaleString()}`} />
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
