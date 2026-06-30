'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { WidgetShell } from './WidgetShell'
import type { WidgetProps } from '@/lib/widgets/types'
import { registerWidget } from '@/lib/widgets/registry'
import { Calendar, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { SoftBadge, WidgetError, WidgetFooterLink, WidgetIcon } from './_shared/WidgetPrimitives'

export function PendingLeaveWidget({ organizationId, editMode, onRemove }: WidgetProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [data, setData] = useState({
    total: 0,
    l1: 0,
    l2: 0,
    l3: 0
  })

  async function loadData() {
    setLoading(true)
    setError(false)
    try {
      const { data: leaves } = await supabase
        .from('leave_records')
        .select('status')
        .eq('organization_id', organizationId)
        .ilike('status', 'awaiting%')

      if (leaves) {
        const l1 = leaves.filter(l => l.status.includes('L1')).length
        const l2 = leaves.filter(l => l.status.includes('L2')).length
        const l3 = leaves.filter(l => l.status.includes('L3')).length
        setData({
          total: leaves.length,
          l1,
          l2,
          l3
        })
      }
    } catch (error) {
      console.error('Error loading leave widget data:', error)
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
      title="Pending Leave"
      icon={Calendar}
      tone="amber"
      editMode={editMode}
      onRemove={onRemove}
      loading={loading}
      onRefresh={loadData}
    >
      {error ? (
        <WidgetError onRetry={loadData} />
      ) : (
      <div className="flex h-full flex-col">
        <div className="px-4 pb-3">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-[12px] font-semibold text-[#6B6578]">Total Pending Requests</p>
              <p className="mt-1 text-[30px] font-black leading-none text-orange-600">{data.total}</p>
            </div>
            <WidgetIcon icon={Calendar} tone="amber" size="md" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <SoftBadge tone="amber">Manager {data.l1}</SoftBadge>
            <SoftBadge tone="blue">HR {data.l2}</SoftBadge>
            <SoftBadge tone="green">Owner {data.l3}</SoftBadge>
          </div>
        </div>

        <div className="flex-1 space-y-1 px-2">
          {[
            { label: 'Manager (L1)', count: data.l1, color: '#3B82F6' },
            { label: 'HR (L2)', count: data.l2, color: '#8B5CF6' },
            { label: 'Owner (L3)', count: data.l3, color: '#EC4899' },
          ].map((row) => (
            <Link
              key={row.label}
              href="/leave"
              className="flex items-center justify-between p-2 rounded-lg hover:bg-[#F8F7F9] transition-colors group"
            >
              <div className="flex items-center gap-2">
                <div className="w-1 h-3 rounded-full" style={{ backgroundColor: row.color }} />
                <span className="text-[12px] font-semibold text-[#3D3849]">{row.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold text-[#1A1727]">{row.count}</span>
                <ChevronRight size={12} className="text-[#D1D5DB] group-hover:text-[#534AB7] transition-colors" />
              </div>
            </Link>
          ))}
        </div>
        <WidgetFooterLink href="/leave">View all leave requests</WidgetFooterLink>
      </div>
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
