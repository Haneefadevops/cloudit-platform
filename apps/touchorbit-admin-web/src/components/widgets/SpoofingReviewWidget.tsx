'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { WidgetShell } from './WidgetShell'
import type { WidgetProps } from '@/lib/widgets/types'
import { registerWidget } from '@/lib/widgets/registry'
import { ShieldAlert, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { WidgetError, WidgetIcon } from './_shared/WidgetPrimitives'

interface FlagBreakdown {
  flag: string
  count: number
}

const FLAG_LABELS: Record<string, string> = {
  ip_distance_mismatch: 'IP/GPS mismatch',
  ip_proxy_detected: 'VPN/Proxy',
  low_variance: 'Identical samples',
  accuracy_too_precise: 'Too precise',
  accuracy_too_imprecise: 'Too imprecise',
  accuracy_too_stable: 'Stable accuracy',
  teleportation: 'Teleportation',
  outside_geofence: 'Outside geofence',
  timezone_mismatch: 'Timezone mismatch',
  mock_location_api_legacy: 'Mock API',
}

export function SpoofingReviewWidget({ organizationId, editMode, onRemove }: WidgetProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [count, setCount] = useState(0)
  const [topFlags, setTopFlags] = useState<FlagBreakdown[]>([])

  async function loadData() {
    setLoading(true)
    setError(false)
    try {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const { data: rows, count: total } = await supabase
        .from('clock_events')
        .select('suspicious_flags', { count: 'exact' })
        .eq('organization_id', organizationId)
        .eq('admin_review_status', 'flagged')
        .gte('timestamp', cutoff)

      if (rows) {
        const flagCounts = new Map<string, number>()
        for (const r of rows as { suspicious_flags: string[] | null }[]) {
          for (const f of r.suspicious_flags ?? []) {
            flagCounts.set(f, (flagCounts.get(f) ?? 0) + 1)
          }
        }
        const top = Array.from(flagCounts.entries())
          .map(([flag, c]) => ({ flag, count: c }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 3)
        setTopFlags(top)
      }
      setCount(total ?? 0)
    } catch (e) {
      console.error('Error loading spoofing review widget:', e)
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
      title="Suspicious Punches"
      icon={ShieldAlert}
      tone="red"
      editMode={editMode}
      onRemove={onRemove}
      loading={loading}
      onRefresh={loadData}
    >
      {error ? (
        <WidgetError onRetry={loadData} />
      ) : (
        <Link href="/spoofing-review" className="block p-4 h-full group">
          <div className="flex items-center justify-between mb-3">
            <WidgetIcon icon={ShieldAlert} tone="red" size="md" />
            <ArrowRight size={16} className="text-[#D1D5DB] group-hover:text-[#534AB7] group-hover:translate-x-1 transition-all" />
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[24px] font-black text-[#1A1727]">{count}</span>
              <span className="text-[12px] font-bold text-[#9994A8] uppercase">Flagged (30d)</span>
            </div>
            {topFlags.length > 0 ? (
              <div className="space-y-1 pt-1">
                {topFlags.map(f => (
                  <div key={f.flag} className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#6B6578]">{FLAG_LABELS[f.flag] ?? f.flag}</span>
                    <span className="text-[11px] font-mono font-bold text-[#534AB7]">{f.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] font-semibold text-emerald-600">No suspicious punches</p>
            )}
          </div>
        </Link>
      )}
    </WidgetShell>
  )
}

registerWidget({
  type: 'spoofing-review',
  title: 'Suspicious Punches',
  description: 'Flagged clock-ins pending review',
  category: 'attendance',
  component: SpoofingReviewWidget,
  defaultSize: { w: 4, h: 3 },
  minSize: { w: 3, h: 3 }
})
