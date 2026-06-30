'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/lib/auth'
import { usePermissions } from '@/hooks/use-permissions'
import { supabase } from '@/lib/supabase'
import { DollarSign, Play, Eye, Download, Plus, Settings, Trash2, RefreshCcw, Shield, TrendingUp } from 'lucide-react'
import { ToBadge } from '@/components/ui/ToBadge'
import { ToEmptyState } from '@/components/ui/ToEmptyState'
import { TableSkeleton } from '@/components/ui/ToSkeleton'
import { toast } from 'sonner'
import Link from 'next/link'

interface PayrollRun {
  id: string
  month: number
  year: number
  status: 'draft' | 'processing' | 'finalized' | 'paid'
  total_employees: number
  total_gross: number
  total_net: number
  total_epf_employee: number
  total_epf_employer: number
  total_etf: number
  total_paye: number
  finalized_at: string | null
  created_at: string
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const statusColors = {
  draft: 'draft',
  processing: 'pending',
  finalized: 'approved',
  paid: 'active',
}

export default function PayrollPage() {
  const { organizationId, isLoaded } = useAuth()
  const { can } = usePermissions(['payroll.process', 'payroll.delete_run', 'payroll.manage_components'])
  const [runs, setRuns] = useState<PayrollRun[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isLoaded && organizationId) {
      loadPayrollRuns()
    }
  }, [isLoaded, organizationId])

  const loadPayrollRuns = async () => {
    if (!organizationId) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('payroll_runs')
        .select('*')
        .eq('organization_id', organizationId)
        .order('year', { ascending: false })
        .order('month', { ascending: false })

      if (error) throw error

      setRuns(data || [])
    } catch (error) {
      console.error('Error loading payroll runs:', error)
      toast.error('Failed to load payroll runs')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (run: PayrollRun) => {
    const label = `${MONTHS[run.month - 1]} ${run.year}`
    if (!confirm(`Delete payroll run for ${label}? This will also delete all calculated payroll items and cannot be undone.`)) return

    try {
      const { error } = await supabase
        .from('payroll_runs')
        .delete()
        .eq('id', run.id)

      if (error) throw error

      toast.success(`Payroll run for ${label} deleted`)
      await loadPayrollRuns()
    } catch (error) {
      console.error('Error deleting payroll run:', error)
      toast.error('Failed to delete payroll run')
    }
  }

  const handleResetToDraft = async (run: PayrollRun) => {
    const label = `${MONTHS[run.month - 1]} ${run.year}`
    if (!confirm(`Reset ${label} payroll? This will delete all calculated items so you can re-process from scratch.`)) return

    try {
      // Delete all payroll items for this run
      const { error: itemsError } = await supabase
        .from('payroll_items')
        .delete()
        .eq('payroll_run_id', run.id)

      if (itemsError) throw itemsError

      // Reset run totals and status back to draft
      const { error: runError } = await supabase
        .from('payroll_runs')
        .update({
          status: 'draft',
          total_employees: 0,
          total_gross: 0,
          total_net: 0,
          total_epf_employee: 0,
          total_epf_employer: 0,
          total_etf: 0,
          total_paye: 0,
          finalized_at: null,
        })
        .eq('id', run.id)

      if (runError) throw runError

      toast.success(`${label} payroll reset to draft — ready to re-process`)
      await loadPayrollRuns()
    } catch (error) {
      console.error('Error resetting payroll run:', error)
      toast.error('Failed to reset payroll run')
    }
  }

  const createNewPayrollRun = async () => {
    if (!organizationId) return

    const today = new Date()
    const currentMonth = today.getMonth() + 1
    const currentYear = today.getFullYear()

    try {
      // Check if payroll run already exists for this month
      const { data: existing } = await supabase
        .from('payroll_runs')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .single()

      if (existing) {
        toast.error(`Payroll run for ${MONTHS[currentMonth - 1]} ${currentYear} already exists`)
        return
      }

      // Create new payroll run
      const { data, error } = await supabase
        .from('payroll_runs')
        .insert({
          organization_id: organizationId,
          month: currentMonth,
          year: currentYear,
          status: 'draft',
        })
        .select()
        .single()

      if (error) throw error

      toast.success('Payroll run created successfully')
      await loadPayrollRuns()
    } catch (error) {
      console.error('Error creating payroll run:', error)
      toast.error('Failed to create payroll run')
    }
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full bg-[#F8F7F9]">
        {/* Page Header */}
        <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-[15px] font-bold text-gray-900">Payroll Management</h1>
            <p className="text-[11px] text-gray-400 mt-0.5">Process monthly payroll and generate payslips</p>
          </div>
          <div className="flex items-center gap-2">
            {can('payroll.manage_components') && (
              <Link
                href="/payroll/salary-components"
                className="flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-[12px] font-semibold"
              >
                <Settings size={13} strokeWidth={2} />
                Components
              </Link>
            )}
            {can('payroll.process') && (
              <button
                onClick={createNewPayrollRun}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors text-[12px] font-semibold shadow-sm active:scale-[0.98]"
              >
                <Plus size={13} strokeWidth={2.5} />
                New Run
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-5 gap-3 mb-6">
            {[
              { label: 'Total Net Pay',  value: `LKR ${runs.reduce((s, r) => s + (r.total_net || 0), 0).toLocaleString()}`, color: '#534AB7', sub: `${runs.length} total runs`, icon: DollarSign },
              { label: 'Gross Salaries', value: `LKR ${runs.reduce((s, r) => s + (r.total_gross || 0), 0).toLocaleString()}`, color: '#2563EB', sub: 'incl. OT + allowances', icon: Play },
              { label: 'EPF (8%)',      value: `LKR ${runs.reduce((s, r) => s + (r.total_epf_employee || 0), 0).toLocaleString()}`, color: '#10B981', sub: 'Employee share', icon: TrendingUp },
              { label: 'EPF (12%)',     value: `LKR ${runs.reduce((s, r) => s + (r.total_epf_employer || 0), 0).toLocaleString()}`, color: '#D97706', sub: 'Employer share', icon: Shield },
              { label: 'ETF (3%)',      value: `LKR ${runs.reduce((s, r) => s + (r.total_etf || 0), 0).toLocaleString()}`, color: '#6366F1', sub: 'Employer share', icon: Shield },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: s.color + '18' }}>
                    <s.icon size={14} style={{ color: s.color }} strokeWidth={2} />
                  </div>
                </div>
                <div className="text-[11px] font-medium text-gray-400 mb-1">{s.label}</div>
                <div className="text-[18px] font-extrabold text-gray-900 leading-none">{s.value}</div>
                <div className="text-[10px] text-gray-400 mt-2 font-medium">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Trend Chart (Static simulation) */}
          <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm mb-6">
            <div className="flex justify-between items-center mb-6">
              <span className="text-[13px] font-semibold text-gray-900">Monthly Payroll Trend</span>
              <span className="text-[10px] font-medium text-gray-400">LAST 6 MONTHS</span>
            </div>
            <div className="flex items-end gap-3 h-20">
              {[72, 85, 78, 82, 88, 92].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div 
                    className="w-full rounded-md transition-all duration-500 shadow-sm" 
                    style={{ 
                      height: `${h}%`, 
                      backgroundColor: i === 5 ? '#534AB7' : '#E9E7F4'
                    }} 
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-[#F1F0F4] shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/30">
              <h3 className="text-[12px] font-semibold text-gray-900">Payroll Run History</h3>
              <span className="text-[10px] font-medium text-gray-400">{runs.length} total entries</span>
            </div>

            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-3 text-[10.5px] font-bold text-gray-400 uppercase tracking-wider">Period</th>
                  <th className="px-4 py-3 text-[10.5px] font-bold text-gray-400 uppercase tracking-wider text-center">Status</th>
                  <th className="px-4 py-3 text-[10.5px] font-bold text-gray-400 uppercase tracking-wider text-center">Employees</th>
                  <th className="px-4 py-3 text-[10.5px] font-bold text-gray-400 uppercase tracking-wider text-right">Gross Total</th>
                  <th className="px-4 py-3 text-[10.5px] font-bold text-gray-400 uppercase tracking-wider text-right">Net Total</th>
                  <th className="px-4 py-3 text-[10.5px] font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <TableSkeleton rows={4} columns={6} />
                ) : runs.length === 0 ? (
                  <tr><td colSpan={6}>
                    <ToEmptyState
                      icon={<DollarSign size={32} className="text-gray-300" />}
                      title="No payroll runs created yet"
                      description="Start your first payroll run to begin processing employee salaries."
                      action={
                        <button onClick={createNewPayrollRun} className="mt-2 text-purple-500 font-semibold text-[12px] hover:text-purple-600 transition-colors">
                          Start First Run →
                        </button>
                      }
                    />
                  </td></tr>
                ) : runs.map((run) => (
                  <tr key={run.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="text-[13px] font-semibold text-gray-900">{MONTHS[run.month - 1]} {run.year}</div>
                      <div className="text-[10px] text-gray-400 font-medium mt-0.5">
                        {run.finalized_at ? `Finalized on ${new Date(run.finalized_at).toLocaleDateString()}` : `Created on ${new Date(run.created_at).toLocaleDateString()}`}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ToBadge status={statusColors[run.status] as any} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="text-[13px] font-semibold text-gray-700">{run.total_employees || 0}</div>
                      <div className="text-[9px] text-gray-400 font-medium">Staff</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-[13px] font-medium text-gray-600 font-mono">LKR {run.total_gross?.toLocaleString() || '0'}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-[14px] font-extrabold text-gray-900 font-mono">LKR {run.total_net?.toLocaleString() || '0'}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                        <Link
                          href={`/payroll/${run.id}`}
                          className="p-1.5 hover:bg-purple-50 hover:text-purple-500 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye size={15} strokeWidth={2} />
                        </Link>
                        {run.status === 'draft' && can('payroll.process') && (
                          <Link
                            href={`/payroll/${run.id}/process`}
                            className="p-1.5 hover:bg-blue-50 hover:text-blue-500 rounded-lg transition-colors"
                            title="Process"
                          >
                            <Play size={15} strokeWidth={2} />
                          </Link>
                        )}
                        {can('payroll.process') && ((run.status === 'draft' && run.total_employees > 0) || run.status === 'finalized' || run.status === 'paid') ? (
                          <button
                            onClick={() => handleResetToDraft(run)}
                            className="p-1.5 hover:bg-amber-50 hover:text-amber-500 rounded-lg transition-colors"
                            title="Reset"
                          >
                            <RefreshCcw size={15} strokeWidth={2} />
                          </button>
                        ) : null}
                        {can('payroll.delete_run') && (
                          <button
                            onClick={() => handleDelete(run)}
                            className="p-1.5 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={15} strokeWidth={2} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

