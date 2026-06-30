'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { WidgetShell } from './WidgetShell'
import type { WidgetProps } from '@/lib/widgets/types'
import { registerWidget } from '@/lib/widgets/registry'
import { DollarSign, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useWidgetSize } from './WidgetShell'
import { SoftBadge, WidgetEmpty, WidgetError, WidgetIcon } from './_shared/WidgetPrimitives'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const STATUS_CONFIG: Record<string, { bg: string; text: string }> = {
  draft:      { bg: 'bg-gray-100',   text: 'text-gray-600' },
  processing: { bg: 'bg-amber-100',  text: 'text-amber-700' },
  finalized:  { bg: 'bg-blue-100',   text: 'text-blue-700' },
  paid:       { bg: 'bg-green-100',  text: 'text-green-700' },
}

interface PayrollRun {
  month: number
  year: number
  total_net: number
  total_gross: number
  employee_count: number
  status: string
}

export function PayrollSummaryWidget({ organizationId, editMode, onRemove }: WidgetProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [data, setData] = useState<PayrollRun | null>(null)

  async function loadData() {
    setLoading(true)
    setError(false)
    try {
      const { data: run } = await supabase
        .from('payroll_runs')
        .select('month, year, total_net, total_gross, employee_count, status')
        .eq('organization_id', organizationId)
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .limit(1)
        .maybeSingle()

      setData(run ?? null)
    } catch (e) {
      console.error('Error loading payroll summary widget data:', e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (organizationId) loadData()
  }, [organizationId])

  const statusCfg = data ? (STATUS_CONFIG[data.status] ?? STATUS_CONFIG.draft) : null
  const widgetSize = useWidgetSize()

  return (
    <WidgetShell
      title="Payroll Summary"
      icon={DollarSign}
      tone="green"
      editMode={editMode}
      onRemove={onRemove}
      loading={loading}
      onRefresh={loadData}
    >
      {error ? (
        <WidgetError onRetry={loadData} />
      ) : !data ? (
        <WidgetEmpty icon={DollarSign} label="No payroll runs yet" />
      ) : (
        <Link href="/payroll" className="block p-4 h-full group">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <WidgetIcon icon={DollarSign} tone="green" size="sm" />
              <span className="text-[13px] font-black text-[#1A1727]">
                {MONTH_NAMES[data.month - 1]} {data.year}
              </span>
              {statusCfg && (
                <SoftBadge tone={data.status === 'paid' ? 'green' : data.status === 'processing' ? 'amber' : data.status === 'finalized' ? 'blue' : 'gray'}>{data.status}</SoftBadge>
              )}
            </div>
            <ArrowRight size={16} className="text-[#D1D5DB] group-hover:text-[#534AB7] group-hover:translate-x-1 transition-all" />
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#9994A8] uppercase tracking-wider">Net Pay</span>
              <span className="text-[14px] font-black text-[#1A1727]">
                LKR {(data.total_net ?? 0).toLocaleString()}
              </span>
            </div>
            {widgetSize !== 'xs' && widgetSize !== 'sm' && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#9994A8] uppercase tracking-wider">Gross Pay</span>
                  <span className="text-[13px] font-semibold text-[#6B6578]">
                    LKR {(data.total_gross ?? 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-[#F1F0F4]">
                  <span className="text-[11px] font-bold text-[#9994A8] uppercase tracking-wider">Employees</span>
                  <span className="text-[13px] font-bold text-[#534AB7]">{data.employee_count ?? 0}</span>
                </div>
              </>
            )}
          </div>
        </Link>
      )}
    </WidgetShell>
  )
}

registerWidget({
  type: 'payroll-summary',
  title: 'Payroll Summary',
  description: 'Latest payroll run overview',
  category: 'finance',
  component: PayrollSummaryWidget,
  defaultSize: { w: 4, h: 3 },
  minSize: { w: 3, h: 3 }
})
