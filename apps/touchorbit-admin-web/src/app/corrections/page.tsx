'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { AlertCircle, CheckCircle, XCircle, RefreshCw, Clock, ShieldAlert, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { ToBadge } from '@/components/ui/ToBadge'
import { ToAvatar } from '@/components/ui/ToAvatar'
import { TableSkeleton } from '@/components/ui/ToSkeleton'
import { ToEmptyState } from '@/components/ui/ToEmptyState'

interface AttendanceCorrection {
  id: string
  employee_id: string
  correction_type: 'forgot_in' | 'forgot_out' | 'wrong_time' | 'other'
  requested_time: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason: string | null
  created_at: string
  employee_name?: string
  employees?: {
    first_name: string
    last_name: string
    employee_number: string
  }
}

const correctionTypeLabels = {
  forgot_in: 'Forgot to Clock In',
  forgot_out: 'Forgot to Clock Out',
  wrong_time: 'Wrong Time Entry',
  other: 'Miscellaneous',
}

function normalizeCorrection(row: any): AttendanceCorrection {
  return {
    ...row,
    employee_name: row.employee_name || '',
    employees: row.employees || undefined,
  }
}

export default function CorrectionsPage() {
  const { organizationId, isLoaded } = useAuth()
  const [corrections, setCorrections] = useState<AttendanceCorrection[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')

  useEffect(() => {
    if (isLoaded && organizationId) {
      loadCorrections()
    }
  }, [isLoaded, organizationId])

  const loadCorrections = async () => {
    if (!organizationId) return
    setLoading(true)
    try {
      const result = await api.get<any[]>('/attendance/corrections')
      if (!result.ok) throw new Error(result.error || 'Failed to load corrections')
      setCorrections((result.data || []).map(normalizeCorrection))
    } catch (error) {
      console.error('Error loading corrections:', error)
      toast.error('Failed to load corrections')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (id: string) => {
    try {
      const result = await api.patch<AttendanceCorrection>(`/attendance/corrections/${id}/approve`, {})
      if (!result.ok) throw new Error(result.error || 'Approval failed')
      toast.success('Correction approved')
      await loadCorrections()
    } catch (error) { toast.error('Approval failed') }
  }

  const handleReject = async (id: string) => {
    const reason = prompt('Rejection reason (optional):')
    try {
      const result = await api.patch<AttendanceCorrection>(`/attendance/corrections/${id}/reject`, {
        reason: reason || null,
      })
      if (!result.ok) throw new Error(result.error || 'Rejection failed')
      toast.success('Correction rejected')
      await loadCorrections()
    } catch (error) { toast.error('Rejection failed') }
  }

  const filteredCorrections = corrections.filter((c) => filter === 'all' ? true : c.status === filter)
  const stats = {
    pending: corrections.filter((c) => c.status === 'pending').length,
    approved: corrections.filter((c) => c.status === 'approved').length,
    rejected: corrections.filter((c) => c.status === 'rejected').length,
  }

  const employeeDisplayName = (c: AttendanceCorrection) => {
    if (c.employees) return `${c.employees.first_name} ${c.employees.last_name}`
    if (c.employee_name) return c.employee_name
    return 'Unknown'
  }

  const employeeNumber = (c: AttendanceCorrection) => c.employees?.employee_number || ''

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full bg-[#F8F7F9]">
        {/* Page Header */}
        <div className="bg-white border-b border-[#F1F0F4] px-8 py-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-[15px] font-bold text-[#1A1727]">Attendance Corrections</h1>
            <p className="text-[11px] text-[#9CA3AF]">Review and resolve employee clock-in/out disputes</p>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={loadCorrections} className="p-2 hover:bg-[#F8F7F9] rounded-lg text-[#9CA3AF] transition-all"><RefreshCw size={16} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: 'Pending Requests', value: stats.pending, color: '#F59E0B', icon: Clock },
              { label: 'Approved Today',  value: stats.approved, color: '#10B981', icon: CheckCircle },
              { label: 'Total Rejected',   value: stats.rejected, color: '#EF4444', icon: XCircle },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl p-4 border border-[#F1F0F4] shadow-sm flex items-center gap-4">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: s.color + '15' }}>
                  <s.icon size={16} style={{ color: s.color }} strokeWidth={2.5} />
                </div>
                <div>
                  <div className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-wider">{s.label}</div>
                  <div className="text-[18px] font-black text-[#1A1727]">{s.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Filter Toolbar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex bg-[#F1F0F4] p-1 rounded-xl w-fit">
              {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                    filter === f ? 'bg-white text-[#534AB7] shadow-sm' : 'text-[#9CA3AF] hover:text-[#374151]'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">
              Queue: {filteredCorrections.length} items
            </div>
          </div>

          {/* List Container */}
          <div className="bg-white rounded-xl border border-[#F1F0F4] shadow-sm overflow-hidden animate-in fade-in duration-500">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#F8F7F9] text-left text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest border-b border-[#F1F0F4]">
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Correction Type</th>
                  <th className="px-6 py-4 text-center">Requested Time</th>
                  <th className="px-6 py-4">Reason for Change</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right px-8">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F0F4]">
                {loading ? (
                  <TableSkeleton rows={5} columns={6} />
                ) : filteredCorrections.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16">
                      <ToEmptyState
                        icon={<ShieldAlert size={40} className="text-[#D1D5DB]" />}
                        title="No correction requests found"
                        description="Employee clock-in/out disputes will appear here for review."
                      />
                    </td>
                  </tr>
                ) : (
                  filteredCorrections.map((item) => (
                    <tr key={item.id} className="hover:bg-[#F8F7F9] transition-all group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <ToAvatar initials={`${employeeDisplayName(item)[0]}`} size={32} />
                          <div>
                            <div className="text-[13px] font-black text-[#1A1727]">{employeeDisplayName(item)}</div>
                            <div className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-tighter">#{employeeNumber(item)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-[12px] font-bold text-[#374151]">{correctionTypeLabels[item.correction_type]}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="text-[11px] font-black text-[#534AB7] font-mono">{new Date(item.requested_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
                        <div className="text-[9px] font-bold text-[#9CA3AF] uppercase">{new Date(item.requested_time).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</div>
                      </td>
                      <td className="px-6 py-4 max-w-[220px]">
                        <div className="text-[12px] text-[#6B7280] truncate italic leading-relaxed">"{item.reason}"</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center">
                          <ToBadge status={item.status} />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right px-8">
                        {item.status === 'pending' ? (
                          <div className="flex items-center justify-end gap-2">
                             <button onClick={() => handleApprove(item.id)} className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg transition-all shadow-sm"><Check size={14} strokeWidth={3} /></button>
                             <button onClick={() => handleReject(item.id)} className="p-1.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition-all shadow-sm"><X size={14} strokeWidth={3} /></button>
                          </div>
                        ) : (
                          <div className="text-[#D1D5DB] font-black text-[9px] uppercase tracking-widest">—</div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
