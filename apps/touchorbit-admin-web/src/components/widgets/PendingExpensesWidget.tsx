'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { WidgetShell } from './WidgetShell'
import type { WidgetProps } from '@/lib/widgets/types'
import { registerWidget } from '@/lib/widgets/registry'
import { DollarSign, Wallet } from 'lucide-react'
import { CompactMetricLink, WidgetError } from './_shared/WidgetPrimitives'

export function PendingExpensesWidget({ organizationId, editMode, onRemove }: WidgetProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [data, setData] = useState({
    count: 0,
    totalAmount: 0
  })

  async function loadData() {
    setLoading(true)
    setError(false)
    try {
      const { data: claims } = await supabase
        .from('expense_claims')
        .select('amount')
        .eq('organization_id', organizationId)
        .ilike('status', 'awaiting%')

      if (claims) {
        const totalAmount = claims.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)
        setData({
          count: claims.length,
          totalAmount
        })
      }
    } catch (error) {
      console.error('Error loading expenses widget data:', error)
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
      title="Pending Expenses"
      icon={DollarSign}
      tone="blue"
      editMode={editMode}
      onRemove={onRemove}
      loading={loading}
      onRefresh={loadData}
    >
      {error ? (
        <WidgetError onRetry={loadData} />
      ) : (
        <CompactMetricLink
          href="/expenses"
          icon={Wallet}
          tone="blue"
          value={data.count}
          label="Reports"
          detail={`LKR ${data.totalAmount.toLocaleString()}`}
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
