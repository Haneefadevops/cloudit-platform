'use client'

import { useEffect, useState, Fragment } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'
import { usePermissions } from '@/hooks/use-permissions'
import { Clock, CheckCircle, XCircle, X, Settings, Filter, Plus, Timer, Users, Download, ChevronRight, ChevronDown, AlertCircle, Calendar, Search, DollarSign, TrendingUp, Shield } from 'lucide-react'
import { ToBadge } from '@/components/ui/ToBadge'
import { ToAvatar } from '@/components/ui/ToAvatar'
import { ToEmptyState } from '@/components/ui/ToEmptyState'
import { TableSkeleton } from '@/components/ui/ToSkeleton'
import { toast } from 'sonner'

interface OvertimeRecord {
  id: string
  employee_id: string
  date: string
  start_time: string | null
  end_time: string | null
  hours: number
  rate: number
  reason: string | null
  status: 'pending' | 'awaiting_level1' | 'awaiting_level2' | 'awaiting_level3' | 'approved' | 'rejected'
  rejection_reason: string | null
  created_at: string
  employees: {
    first_name: string
    last_name: string
    employee_number: string
  }
  approvals?: ApprovalRecord[]
}

interface ApprovalRecord {
  id: string
  level: number
  approver_role: string
  status: 'pending' | 'approved' | 'rejected'
  notes?: string
  decided_at?: string
  approver?: {
    first_name: string
    last_name: string
  }
}

const statusColors = {
  pending: 'bg-gray-100 text-gray-700',
  awaiting_level1: 'bg-amber-100 text-amber-700',
  awaiting_level2: 'bg-purple-100 text-purple-700',
  awaiting_level3: 'bg-indigo-100 text-indigo-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

const statusLabels: Record<string, string> = {
  pending: 'Submitted',
  awaiting_level1: 'Awaiting Manager',
  awaiting_level2: 'Awaiting HR',
  awaiting_level3: 'Awaiting Owner',
  approved: 'Approved',
  rejected: 'Rejected',
}

interface OvertimePolicy {
  max_daily_hours: number
  max_weekly_hours: number
  weekday_rate: number
  weekend_rate: number
  holiday_rate: number
  requires_approval: boolean
}

export default function OvertimePage() {
  const { organizationId, isLoaded, isAdmin, isHrAdmin, isOwner, isDeptManager, isBranchManager, userRole } = useAuth()
  const { can } = usePermissions(['overtime.approve'])
  const [records, setRecords] = useState<OvertimeRecord[]>([])
  const [policy, setPolicy] = useState<OvertimePolicy | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('pending')
  const [managedScopeId, setManagedScopeId] = useState<string | null>(null)
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null)
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [employees, setEmployees] = useState<any[]>([])
  const [compOffEarned, setCompOffEarned] = useState(0)
  const [compOffPending, setCompOffPending] = useState(0)
  const [manualForm, setManualForm] = useState({
    employee_id: '',
    date: new Date().toISOString().split('T')[0],
    hours: '2.0',
    reason: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Helper for 12h format
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':')
    const h = parseInt(hours)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 || 12
    return `${h12}:${minutes} ${ampm}`
  }

  useEffect(() => {
    if (isLoaded && organizationId) {
      loadEmployees()
      loadCompOffStats()
      // Set default filter based on role
      if (isDeptManager || isBranchManager) setFilter('awaiting_level1')
      else if (isHrAdmin) setFilter('awaiting_level2')
      else if (isOwner) setFilter('all')
      else setFilter('pending')

      if (isDeptManager) {
        supabase.rpc('get_my_managed_dept_id').then(({ data }) => {
          setManagedScopeId(data)
          loadData(data)
        })
      } else if (isBranchManager) {
        supabase.rpc('get_my_managed_branch_id').then(({ data }) => {
          setManagedScopeId(data)
          loadData(data)
        })
      } else {
        loadData()
      }
    }
  }, [isLoaded, organizationId, userRole])

  const loadEmployees = async () => {
    const result = await api.get<any[]>('/employees?status=active&limit=500')
    if (result.ok) {
      setEmployees(result.data || [])
    } else {
      setEmployees([])
      toast.error(result.error || 'Failed to load employees')
    }
  }

  const loadCompOffStats = async () => {
    const [earned, pending] = await Promise.all([
      api.get<any[]>('/leave/comp-off?status=approved'),
      api.get<any[]>('/leave/comp-off?status=pending'),
    ])
    setCompOffEarned(earned.ok ? earned.data?.length || 0 : 0)
    setCompOffPending(pending.ok ? pending.data?.length || 0 : 0)
  }

  const handleManualEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const result = await api.post<OvertimeRecord>('/overtime', {
        employee_id: manualForm.employee_id,
        date: manualForm.date,
        hours: parseFloat(manualForm.hours),
        reason: manualForm.reason,
        rate: 1.5,
      })
      if (!result.ok) throw new Error(result.error || 'Failed to create record')
      toast.success('Overtime record created')
      setShowManualEntry(false)
      setManualForm({
        employee_id: '',
        date: new Date().toISOString().split('T')[0],
        hours: '2.0',
        reason: '',
      })
      loadData(managedScopeId)
    } catch (error) {
      toast.error('Failed to create record')
    } finally {
      setIsSubmitting(false)
    }
  }

  const loadData = async (scopeId?: string | null) => {
    if (!organizationId) return

    setLoading(true)
    try {
      const recordsResult = await api.get<OvertimeRecord[]>('/overtime')
      if (!recordsResult.ok) throw new Error(recordsResult.error || 'Failed to load overtime')
      let recordsData = recordsResult.data || []
      if ((isDeptManager || isBranchManager) && scopeId) {
        const scopedEmployees = await api.get<any[]>('/employees?status=active&limit=500')
        const scopedIds = new Set(
          (scopedEmployees.data || [])
            .filter((employee: any) =>
              isDeptManager ? employee.department_id === scopeId : employee.branch_id === scopeId,
            )
            .map((employee: any) => employee.id),
        )
        recordsData = recordsData.filter((record) => scopedIds.has(record.employee_id))
      }
      setRecords(recordsData)

      // Policy is supplementary to the records table. Load it through the API
      // and never leave the table in a loading state when policy retrieval fails.
      const policyResult = await api.get<{ overtimePolicy?: OvertimePolicy | null }>('/organizations/settings')
      setPolicy(policyResult.ok ? policyResult.data?.overtimePolicy || null : null)
    } catch (error) {
      console.error('Error loading overtime data:', error)
      toast.error('Failed to load overtime data')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (record: OvertimeRecord) => {
    if (!can('overtime.approve')) {
      toast.error('You do not have permission to approve overtime')
      return
    }

    try {
      const level = record.status === 'awaiting_level1' ? 1
                   : record.status === 'awaiting_level2' ? 2
                   : record.status === 'awaiting_level3' ? 3 : 1

      const { error } = await supabase.rpc('advance_overtime_record', {
        p_record_id: record.id,
        p_level: level,
        p_status: 'approved',
        p_notes: null
      })

      if (error) throw error

      toast.success('Overtime approved')
      await loadData(managedScopeId)
    } catch (error) {
      console.error('Error approving overtime:', error)
      toast.error('Failed to approve overtime')
    }
  }

  const handleReject = async (record: OvertimeRecord) => {
    if (!can('overtime.approve')) {
      toast.error('You do not have permission to reject overtime')
      return
    }

    const reason = prompt('Rejection reason (optional):')

    try {
      const level = record.status === 'awaiting_level1' ? 1
                   : record.status === 'awaiting_level2' ? 2
                   : record.status === 'awaiting_level3' ? 3 : 1

      const { error } = await supabase.rpc('advance_overtime_record', {
        p_record_id: record.id,
        p_level: level,
        p_status: 'rejected',
        p_notes: reason || null
      })

      if (error) throw error

      toast.success('Overtime rejected')
      await loadData(managedScopeId)
    } catch (error) {
      console.error('Error rejecting overtime:', error)
      toast.error('Failed to reject overtime')
    }
  }

  const filteredRecords = records.filter((r) => (filter === 'all' ? true : r.status === filter))

  const stats = {
    pending: records.filter((r) => ['pending', 'awaiting_level1', 'awaiting_level2', 'awaiting_level3'].includes(r.status)).length,
    approved: records.filter((r) => r.status === 'approved').length,
    rejected: records.filter((r) => r.status === 'rejected').length,
    totalHours: records
      .filter((r) => r.status === 'approved')
      .reduce((sum, r) => sum + Number(r.hours), 0),
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full bg-[#F8F7F9]">
        {/* Page Header */}
        <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-[15px] font-bold text-gray-900">Overtime & Comp-Off</h1>
            <p className="text-[11px] text-gray-400 mt-0.5">{stats.pending} requests pending approval</p>
          </div>
          <button
            onClick={() => setShowManualEntry(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors text-[12px] font-semibold shadow-sm active:scale-[0.98]"
          >
            <Plus size={13} strokeWidth={2.5} />
            Manual Entry
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { label: 'OT Hours (Month)', value: `${stats.totalHours.toFixed(1)}h`, color: '#D97706', icon: Clock },
              { label: 'OT Pay (Est.)',     value: `LKR ${(stats.totalHours * 1500).toLocaleString()}`, color: '#059669', icon: DollarSign },
              { label: 'Comp-Off Earned',  value: `${compOffEarned} days`, color: '#2563EB', icon: TrendingUp },
              { label: 'Comp-Off Pending', value: `${compOffPending} days`,  color: '#534AB7', icon: Calendar },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: s.color + '18' }}>
                  <s.icon size={16} style={{ color: s.color }} strokeWidth={2} />
                </div>
                <div>
                  <div className="text-[11px] font-medium text-gray-400">{s.label}</div>
                  <div className="text-[18px] font-extrabold text-gray-900 leading-none">{s.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Table Container */}
          <div className="bg-white rounded-xl border border-[#F1F0F4] shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/30">
              <div className="flex items-center gap-3">
                <h3 className="text-[12px] font-semibold text-gray-900">Overtime Requests</h3>
                <div className="h-4 w-px bg-gray-200" />
                <div className="flex gap-1">
                  {['all', 'pending', 'approved', 'rejected'].map(f => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
                        filter === f
                          ? 'bg-purple-50 text-purple-600'
                          : 'bg-white text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-3 text-[10.5px] font-bold text-gray-400 uppercase tracking-wider">Employee</th>
                  <th className="px-4 py-3 text-[10.5px] font-bold text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-[10.5px] font-bold text-gray-400 uppercase tracking-wider text-center">Hours</th>
                  <th className="px-4 py-3 text-[10.5px] font-bold text-gray-400 uppercase tracking-wider">Reason</th>
                  <th className="px-4 py-3 text-[10.5px] font-bold text-gray-400 uppercase tracking-wider text-center">Status</th>
                  <th className="px-4 py-3 text-[10.5px] font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <TableSkeleton rows={4} columns={6} />
                ) : filteredRecords.length === 0 ? (
                  <tr><td colSpan={6}>
                    <ToEmptyState
                      icon={<Clock size={32} className="text-gray-300" />}
                      title="No overtime requests found"
                      description="No overtime records match the current filter."
                    />
                  </td></tr>
                ) : filteredRecords.map((record) => (
                  <Fragment key={record.id}>
                    <tr
                      className={`hover:bg-gray-50 transition-colors cursor-pointer group ${expandedRecordId === record.id ? 'bg-purple-50/30' : ''}`}
                      onClick={() => setExpandedRecordId(expandedRecordId === record.id ? null : record.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <ToAvatar
                            initials={`${record.employees.first_name[0]}${record.employees.last_name[0]}`}
                            size={28}
                          />
                          <div>
                            <div className="text-[12.5px] font-semibold text-gray-900">{record.employees.first_name} {record.employees.last_name}</div>
                            <div className="text-[10px] text-gray-400 font-medium">{record.employees.employee_number}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-[12.5px] font-medium text-gray-700">{new Date(record.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</div>
                        <div className="text-[10px] text-gray-400 font-medium">{record.start_time?.slice(0,5)} - {record.end_time?.slice(0,5)}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="text-[14px] font-extrabold text-amber-500 font-mono leading-none">{record.hours}h</div>
                        <div className="text-[9px] text-gray-400 font-medium mt-1">{record.rate}x Rate</div>
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <div className="text-[11px] text-gray-500 truncate italic">&ldquo;{record.reason || 'No reason provided'}&rdquo;</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <ToBadge status={statusColors[record.status] || record.status} showDot={false} />
                      </td>
                      <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                        {can('overtime.approve') && ['pending', 'awaiting_level1', 'awaiting_level2', 'awaiting_level3'].includes(record.status) ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleApprove(record)}
                              className="p-1.5 bg-green-50 text-green-500 hover:bg-green-500 hover:text-white rounded-lg transition-colors"
                              title="Approve"
                            >
                              <CheckCircle size={14} strokeWidth={2} />
                            </button>
                            <button
                              onClick={() => handleReject(record)}
                              className="p-1.5 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors"
                              title="Reject"
                            >
                              <XCircle size={14} strokeWidth={2} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-300 text-[11px] font-medium">—</span>
                        )}
                      </td>
                    </tr>
                    {expandedRecordId === record.id && (
                      <tr className="bg-gray-50/50 border-y border-gray-100">
                        <td colSpan={6} className="px-8 py-5">
                           <div className="grid grid-cols-2 gap-8">
                              <div>
                                <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
                                  <Clock size={12} strokeWidth={2} /> Approval Path
                                </h4>
                                <div className="space-y-4 relative">
                                  <div className="absolute left-[11px] top-5 bottom-0 w-0.5 bg-gray-200" />

                                  <div className="flex gap-3 relative z-10">
                                    <div className="w-5 h-5 rounded-full bg-green-50 border border-green-100 flex items-center justify-center shrink-0">
                                      <CheckCircle size={10} className="text-green-600" />
                                    </div>
                                    <div className="text-[11px]">
                                      <span className="font-semibold text-gray-900 block">Submitted</span>
                                      <span className="text-gray-400">{new Date(record.created_at).toLocaleString()}</span>
                                    </div>
                                  </div>

                                  {record.approvals?.sort((a, b) => a.level - b.level).map((appr) => (
                                    <div key={appr.id} className="flex gap-3 relative z-10">
                                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border border-white ${
                                        appr.status === 'approved' ? 'bg-green-50' :
                                        appr.status === 'rejected' ? 'bg-red-50' : 'bg-amber-50'
                                      }`}>
                                        {appr.status === 'approved' && <CheckCircle size={10} className="text-green-600" />}
                                        {appr.status === 'rejected' && <XCircle size={10} className="text-red-600" />}
                                        {appr.status === 'pending' && <Clock size={10} className="text-amber-600" />}
                                      </div>
                                      <div className="text-[11px] flex-1">
                                        <div className="flex items-center justify-between">
                                          <span className="font-semibold text-gray-900">
                                            {appr.approver_role.replace('_', ' ')} (L{appr.level})
                                          </span>
                                        </div>
                                        {appr.notes && <p className="mt-1.5 text-gray-500 bg-white p-2.5 rounded-lg border border-gray-100 italic text-[11px] leading-relaxed">&ldquo;{appr.notes}&rdquo;</p>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="space-y-4">
                                <div>
                                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Original Reason</h4>
                                  <p className="text-[12px] text-gray-600 bg-white p-3 rounded-xl border border-gray-100 italic leading-relaxed">
                                    {record.reason ? `&ldquo;${record.reason}&rdquo;` : "No reason provided."}
                                  </p>
                                </div>
                                {record.rejection_reason && (
                                  <div className="p-3 bg-red-50 border border-red-100 rounded-xl">
                                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-red-600 mb-1">Final Rejection Reason</h4>
                                    <p className="text-[12px] text-red-700 font-medium">{record.rejection_reason}</p>
                                  </div>
                                )}
                              </div>
                           </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Manual Entry Dialog */}
      {showManualEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl border border-gray-100">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-[16px] font-bold text-gray-900">Manual Overtime Entry</h2>
              <button onClick={() => setShowManualEntry(false)} className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors"><X size={18} strokeWidth={2} /></button>
            </div>
            <form onSubmit={handleManualEntry} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1.5">Employee</label>
                <select
                  required
                  value={manualForm.employee_id}
                  onChange={e => setManualForm({...manualForm, employee_id: e.target.value})}
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-[13px] text-gray-700 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                >
                  <option value="">Select Employee</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1.5">Date</label>
                  <input
                    type="date"
                    required
                    value={manualForm.date}
                    onChange={e => setManualForm({...manualForm, date: e.target.value})}
                    className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-[13px] text-gray-700 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1.5">Hours</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="12"
                    required
                    value={manualForm.hours}
                    onChange={e => setManualForm({...manualForm, hours: e.target.value})}
                    className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-[13px] text-gray-700 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1.5">Reason</label>
                <textarea
                  required
                  value={manualForm.reason}
                  onChange={e => setManualForm({...manualForm, reason: e.target.value})}
                  className="w-full p-3 bg-white border border-gray-200 rounded-lg text-[13px] text-gray-700 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 h-20 resize-none"
                  placeholder="Why is this OT being added manually?"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowManualEntry(false)} className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-lg text-[12px] font-semibold hover:bg-gray-50 transition-colors">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 py-2.5 bg-purple-500 text-white rounded-lg text-[12px] font-semibold hover:bg-purple-600 transition-colors disabled:opacity-50 active:scale-[0.98]">Create Record</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
