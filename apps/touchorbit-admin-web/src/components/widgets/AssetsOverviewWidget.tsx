'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { WidgetShell } from './WidgetShell'
import type { WidgetProps } from '@/lib/widgets/types'
import { registerWidget } from '@/lib/widgets/registry'
import { Package, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { MiniStat, WidgetEmpty, WidgetError, WidgetIcon } from './_shared/WidgetPrimitives'

export function AssetsOverviewWidget({ organizationId, editMode, onRemove }: WidgetProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [data, setData] = useState({ available: 0, assigned: 0, maintenance: 0, damaged: 0 })

  async function loadData() {
    setLoading(true)
    setError(false)
    try {
      const { data: rows } = await supabase
        .from('assets')
        .select('status, condition')
        .eq('organization_id', organizationId)

      if (rows) {
        let available = 0, assigned = 0, maintenance = 0, damaged = 0
        for (const r of rows) {
          if (r.status === 'available') available++
          else if (r.status === 'assigned') assigned++
          else if (r.status === 'maintenance') maintenance++
          if (r.condition === 'damaged') damaged++
        }
        setData({ available, assigned, maintenance, damaged })
      }
    } catch (e) {
      console.error('Error loading assets overview widget data:', e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (organizationId) loadData()
  }, [organizationId])

  const total = data.available + data.assigned + data.maintenance

  return (
    <WidgetShell
      title="Assets Overview"
      icon={Package}
      tone="sky"
      editMode={editMode}
      onRemove={onRemove}
      loading={loading}
      onRefresh={loadData}
    >
      {error ? (
        <WidgetError onRetry={loadData} />
      ) : total === 0 ? (
        <WidgetEmpty icon={Package} label="No assets registered" />
      ) : (
        <Link href="/assets" className="block p-4 h-full group">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <WidgetIcon icon={Package} tone="sky" size="sm" />
              <span className="text-[11px] font-black text-[#9994A8] uppercase tracking-wider">Asset Status</span>
            </div>
            <ArrowRight size={16} className="text-[#D1D5DB] group-hover:text-[#534AB7] group-hover:translate-x-1 transition-all" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <MiniStat label="Available" value={data.available} tone="green" />
            <MiniStat label="Assigned" value={data.assigned} tone="blue" />
            <MiniStat label="Maintenance" value={data.maintenance} tone="amber" />
            <MiniStat label="Damaged" value={data.damaged} tone="red" />
          </div>
        </Link>
      )}
    </WidgetShell>
  )
}

registerWidget({
  type: 'assets-overview',
  title: 'Assets Overview',
  description: 'Asset inventory status breakdown',
  category: 'finance',
  component: AssetsOverviewWidget,
  defaultSize: { w: 4, h: 3 },
  minSize: { w: 3, h: 3 }
})
