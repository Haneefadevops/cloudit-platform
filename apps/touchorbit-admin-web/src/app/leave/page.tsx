'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/lib/auth'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { Calendar, Clock, CheckCircle, XCircle, FileText, ExternalLink, ShieldCheck, Plus, X } from 'lucide-react'
import { ToBadge } from '@/components/ui/ToBadge'
import { ToAvatar } from '@/components/ui/ToAvatar'
import { ToEmptyState } from '@/components/ui/ToEmptyState'
import { TableSkeleton } from '@/components/ui/ToSkeleton'
import { toast } from 'sonner'

interface LeaveRequest {
  id: string
  employee_id: string
  leave_type: string
  start_date: string
  end_date: string
  half_day: boolean
  days_count: number
  reason: string
  status: 'pending' | 'awaiting_level1' | 'awaiting_level2' | 'awaiting_level3' | 'approved' | 'rejected' | 'cancelled'
  created_at: string
  rejection_reason?: string
  medical_certificate_url?: string
  cancellation_requested?: boolean
  cancellation_reason?: string
  employee?: {
    id: string
    first_name: string
    last_name: string
    job_title: string
    department: string
    department_id?: string | null
    branch_id?: string | null
    photo_url?: string | null
    employee_number?: string
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

interface ApiEmployee {
  id: string
  first_name: string
  last_name: string
  employee_number?: string
}

const leaveTypeLabels: Record<string, string> = {
  annual: 'Annual Leave',
  casual: 'Casual Leave',
  sick: 'Sick Leave',
  comp_off: 'Comp Off',
  maternity: 'Maternity Leave',
  paternity: 'Paternity Leave',
  unpaid: 'Unpaid Leave',
}

export default function LeavePage() {
  const { organizationId, userId, isLoaded, isSignedIn, isAdmin, isHrAdmin, isOwner, isDeptManager, isBranchManager, userRole } = useAuth()
  const { can } = usePermissions(['leave.approve', 'leave.adjust_balance'])
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('pending')
  const [selected, setSelected] = useState<LeaveRequest | null>(null)
  const [rejectionNote, setRejectionNote] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [managedScopeId, setManagedScopeId] = useState<string | null>(null)
  const [showAdjustDialog, setShowAdjustDialog] = useState(false)
  const [adjustEmployees, setAdjustEmployees] = useState<ApiEmployee[]>([])
  const [adjustForm, setAdjustForm] = useState({ employee_id: '', leave_type: 'annual', adjustment_type: 'add', days: '', reason: '' })
  const [savingAdjust, setSavingAdjust] = useState(false)

  useEffect(() => {
    if (isLoaded && organizationId) {
      if (isDeptManager) setFilter('awaiting_level1')
      else if (isHrAdmin) setFilter('awaiting_level2')
      else if (isOwner) setFilter('awaiting_level3')
      else setFilter('pending')

      if (isDeptManager) supabase.rpc('get_my_managed_dept_id').then(({ data }) => { setManagedScopeId(data); loadLeaveData(data, 'dept') })
      else if (isBranchManager) supabase.rpc('get_my_managed_branch_id').then(({ data }) => { setManagedScopeId(data); loadLeaveData(data, 'branch') })
      else loadLeaveData()
    }
  }, [isLoaded, organizationId])

  async function loadLeaveData(scopeId?: string | null, scopeType?: 'dept' | 'branch') {
    setLoading(true)
    try {
      const result = await api.get<LeaveRequest[]>('/leave/requests')
      if (!result.ok) {
        toast.error(result.error || 'Failed to load leave requests')
        setRequests([])
        setLoading(false)
        return
      }
      let data = result.data || []
      if (scopeType === 'dept' && scopeId) {
        data = data.filter((r) => r.employee?.department_id === scopeId)
      } else if (scopeType === 'branch' && scopeId) {
        data = data.filter((r) => r.employee?.branch_id === scopeId)
      }
      setRequests(data)
    } catch (e: any) {
      toast.error(e.message || 'Failed to load leave requests')
      setRequests([])
    } finally {
      setLoading(false)
    }
  }

  async function handleApproveCancellation(requestId: string) {
    if (!confirm('Approve this cancellation? The leave will be marked cancelled and the balance restored.')) return
    setProcessingId(requestId)
    const result = await api.patch<LeaveRequest>(`/leave/requests/${requestId}`, {
      status: 'cancelled',
      cancellation_requested: false,
    })
    setProcessingId(null)
    if (!result.ok) { toast.error('Failed to approve cancellation: ' + result.error) }
    else {
      toast.success('Cancellation approved — leave balance restored')
      setSelected(null)
      loadLeaveData(managedScopeId, isDeptManager ? 'dept' : isBranchManager ? 'branch' : undefined)
    }
  }

  async function handleRejectCancellation(requestId: string) {
    if (!confirm('Reject this cancellation request? The leave will remain approved.')) return
    setProcessingId(requestId)
    const result = await api.patch<LeaveRequest>(`/leave/requests/${requestId}`, {
      cancellation_requested: false,
    })
    setProcessingId(null)
    if (!result.ok) { toast.error('Failed to reject cancellation') }
    else {
      toast.success('Cancellation request rejected')
      setSelected(null)
      loadLeaveData(managedScopeId, isDeptManager ? 'dept' : isBranchManager ? 'branch' : undefined)
    }
  }

  async function openAdjustDialog() {
    if (adjustEmployees.length === 0) {
      const result = await api.get<ApiEmployee[]>('/employees?status=active&limit=500')
      setAdjustEmployees(result.ok ? (result.data || []) : [])
      if (!result.ok) toast.error(result.error || 'Failed to load employees')
    }
    setAdjustForm({ employee_id: '', leave_type: 'annual', adjustment_type: 'add', days: '', reason: '' })
    setShowAdjustDialog(true)
  }

  async function handleAdjustLeave() {
    if (!adjustForm.employee_id || !adjustForm.days || !adjustForm.reason) { toast.error('All fields required'); return }
    const days = parseFloat(adjustForm.days)
    if (isNaN(days) || days <= 0) { toast.error('Enter a valid number of days'); return }
    setSavingAdjust(true)
    try {
      const delta = adjustForm.adjustment_type === 'add' ? days : -days
      const result = await api.post<LeaveRequest>(`/leave/balances/${adjustForm.employee_id}/adjust`, {
        leave_type: adjustForm.leave_type,
        days: delta,
        reason: adjustForm.reason,
      })
      if (!result.ok) throw new Error(result.error || 'Failed to adjust balance')
      toast.success(`Leave balance ${adjustForm.adjustment_type === 'add' ? 'increased' : 'decreased'} by ${days} day${days !== 1 ? 's' : ''}`)
      setShowAdjustDialog(false)
    } catch (e: any) { toast.error(e.message || 'Failed to adjust balance') } finally { setSavingAdjust(false) }
  }

  async function handleAction(status: 'approved' | 'rejected') {
    if (!selected) return
    if (status === 'rejected' && !rejectionNote) { toast.error('Please enter a reason'); return }

    setProcessingId(selected.id)
    const result = await api.post<{ id: string; status: string }>(`/leave/requests/${selected.id}/${status}`, {
      notes: rejectionNote || undefined,
    })

    if (!result.ok) { toast.error(result.error || 'Failed to process request') } else {
      toast.success(`Request ${status} successfully`)
      setSelected(null); setRejectionNote('')
      loadLeaveData(managedScopeId, isDeptManager ? 'dept' : isBranchManager ? 'branch' : undefined)
    }
    setProcessingId(null)
  }

  const filtered = requests.filter(r => filter === 'all' ? true : (filter === 'cancellation' ? r.cancellation_requested : r.status === filter))

  // Role-level gate: each role can only approve at their designated level
  const canApproveSelected = (() => {
    if (!selected) return false
    const s = selected.status
    if (!can('leave.approve')) return false
    if (isOwner || isAdmin) return ['pending', 'awaiting_level1', 'awaiting_level2', 'awaiting_level3'].includes(s)
    if (isHrAdmin) return s === 'awaiting_level2'
    if (isDeptManager || isBranchManager) return s === 'awaiting_level1'
    return false
  })()

  const stats = [
    { label: 'Pending', value: requests.filter(r => ['pending','awaiting_level1','awaiting_level2','awaiting_level3'].includes(r.status)).length, color: '#F59E0B' },
    { label: 'Approved', value: requests.filter(r => r.status === 'approved').length, color: '#10B981' },
    { label: 'Cancelled', value: requests.filter(r => r.status === 'cancelled').length, color: '#9CA3AF' },
    { label: 'On Leave', value: requests.filter(r => r.status === 'approved' && new Date(r.start_date) <= new Date() && new Date(r.end_date) >= new Date()).length, color: '#3B82F6' },
  ]

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full bg-[#F8F7F9] font-['Plus_Jakarta_Sans']">
        
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-[15px] font-bold text-gray-900">Leave Management</h1>
            <p className="text-[11px] text-gray-400 mt-0.5">Review and approve employee time-off requests</p>
          </div>
          <div className="flex items-center gap-2">
            {can('leave.adjust_balance') && (
              <button onClick={openAdjustDialog} className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg text-[12px] font-semibold hover:bg-purple-600 transition-colors shadow-sm active:scale-[0.98]">
                <Plus size={14} strokeWidth={2.5} /> Adjust Balances
              </button>
            )}
            <button onClick={() => loadLeaveData(managedScopeId)} className="p-2 bg-gray-50 text-purple-500 rounded-lg hover:bg-gray-100 transition-colors">
              <RefreshCw size={18} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="px-6 pt-4 pb-2">
          <div className="grid grid-cols-4 gap-3">
            {stats.map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <div className="text-[11px] font-semibold text-gray-400 mb-1">{s.label}</div>
                <div className="text-[22px] font-extrabold text-gray-900 leading-none">{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Area */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left List */}
          <div className="w-[420px] border-r border-gray-100 bg-white flex flex-col">
            <div className="p-3 border-b border-gray-100">
              <div className="flex flex-wrap gap-1">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'awaiting_level1', label: 'Manager (L1)' },
                  { id: 'awaiting_level2', label: 'HR (L2)' },
                  { id: 'awaiting_level3', label: 'Owner (L3)' },
                  { id: 'approved', label: 'Approved' },
                  { id: 'cancellation', label: 'Cancel Req.' },
                ].map(f => (
                  <button key={f.id} onClick={() => setFilter(f.id)} className={`px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all ${filter === f.id ? 'bg-purple-50 text-purple-600' : 'bg-gray-50 text-gray-500 hover:text-gray-700'}`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="px-4 py-3 space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 py-2">
                      <div className="w-9 h-9 rounded-full bg-gray-100 animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div className="w-32 h-3 bg-gray-100 rounded animate-pulse" />
                        <div className="w-20 h-2.5 bg-gray-100 rounded animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <ToEmptyState
                  title="No requests found"
                  description="No leave requests match the current filter."
                />
              ) : filtered.map(r => (
                <div
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className={`p-3 flex items-center gap-3 cursor-pointer transition-all border-b border-gray-50 ${selected?.id === r.id ? 'bg-purple-50' : 'hover:bg-gray-50'}`}
                >
                  <ToAvatar
                    initials={`${r.employee?.first_name?.[0] || ''}${r.employee?.last_name?.[0] || ''}`}
                    photoUrl={r.employee?.photo_url}
                    size={32}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-0.5">
                      <div className="text-[12.5px] font-semibold text-gray-900 truncate">{r.employee?.first_name} {r.employee?.last_name}</div>
                      <div className="text-[11px] font-bold text-purple-500">{r.days_count}d</div>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="text-[10.5px] text-gray-400">{leaveTypeLabels[r.leave_type]}</div>
                      <ToBadge status={r.status} showDot={false} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Detail */}
          <div className="flex-1 bg-gray-50 p-6 overflow-hidden relative">
            {selected ? (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 max-w-3xl mx-auto overflow-y-auto max-h-full">
                <div className="flex justify-between items-start mb-6">
                   <div className="flex gap-4 items-center">
                      <ToAvatar
                        initials={`${selected.employee?.first_name?.[0] || ''}${selected.employee?.last_name?.[0] || ''}`}
                        photoUrl={selected.employee?.photo_url}
                        size={48}
                      />
                      <div>
                        <h2 className="text-[16px] font-bold text-gray-900">{selected.employee?.first_name} {selected.employee?.last_name}</h2>
                        <p className="text-[11px] text-gray-400 mt-0.5">{selected.employee?.job_title} · {selected.employee?.department}</p>
                      </div>
                   </div>
                   <button onClick={() => setSelected(null)} className="p-1.5 text-gray-300 hover:text-gray-700 transition-colors"><XCircle size={20} /></button>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                   <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Leave Period</div>
                      <div className="text-[13px] font-semibold text-gray-900">{new Date(selected.start_date).toLocaleDateString()} — {new Date(selected.end_date).toLocaleDateString()}</div>
                   </div>
                   <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Duration</div>
                      <div className="text-[13px] font-semibold text-purple-500">{selected.days_count} Working Days</div>
                   </div>
                </div>

                <div className="mb-6">
                   <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Reason / Notes</div>
                   <div className="p-3 bg-gray-50 rounded-xl text-[13px] text-gray-600 italic border border-gray-100">&ldquo;{selected.reason}&rdquo;</div>
                </div>

                {/* Approval Trail */}
                {(selected.approvals && selected.approvals.length > 0) && (
                  <div className="mb-6">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Approval History</div>
                    <div className="space-y-2">
                      {selected.approvals.sort((a,b) => a.level - b.level).map((ap) => (
                        <div key={ap.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${ap.status === 'approved' ? 'bg-green-50 text-green-600' : ap.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                            {ap.status === 'approved' ? <CheckCircle size={14} /> : ap.status === 'rejected' ? <XCircle size={14} /> : <Clock size={14} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                              <div className="text-[11px] font-semibold text-gray-900">Level {ap.level}: {ap.approver_role.replace('_', ' ')}</div>
                              {ap.decided_at && (
                                <div className="text-[9px] font-medium text-gray-400">{new Date(ap.decided_at).toLocaleDateString()}</div>
                              )}
                            </div>
                            <div className="text-[10.5px] font-medium text-purple-500">
                              {ap.approver ? `${ap.approver.first_name} ${ap.approver.last_name}` : 'System / Pending'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Medical certificate (sick leave) */}
                {selected.leave_type === 'sick' && selected.medical_certificate_url && (
                  <div className="mb-5 p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText size={15} className="text-blue-500 shrink-0" />
                      <div>
                        <div className="text-[11px] font-semibold text-blue-700">Medical Certificate</div>
                        <div className="text-[10.5px] text-blue-500 font-medium">Document attached</div>
                      </div>
                    </div>
                    <a
                      href={selected.medical_certificate_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-[11px] font-semibold hover:bg-blue-200 transition-colors"
                    >
                      View <ExternalLink size={10} />
                    </a>
                  </div>
                )}

                {/* Cancellation request section */}
                {selected.cancellation_requested && (
                  <div className="mb-5 pt-5 border-t border-amber-100">
                    <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl mb-3">
                      <div className="text-[11px] font-semibold text-amber-700 mb-1">Cancellation Requested</div>
                      {selected.cancellation_reason && (
                        <div className="text-[13px] text-amber-800 italic">&ldquo;{selected.cancellation_reason}&rdquo;</div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        disabled={!!processingId}
                        onClick={() => handleRejectCancellation(selected.id)}
                        className="flex-1 py-2.5 bg-white border border-red-100 text-red-500 rounded-lg font-semibold text-[12px] hover:bg-red-50 transition-colors"
                      >
                        Reject Cancellation
                      </button>
                      <button
                        disabled={!!processingId}
                        onClick={() => handleApproveCancellation(selected.id)}
                        className="flex-1 py-2.5 bg-green-500 text-white rounded-lg font-semibold text-[12px] hover:bg-green-600 transition-colors shadow-sm"
                      >
                        Approve Cancellation
                      </button>
                    </div>
                  </div>
                )}

                {['pending','awaiting_level1','awaiting_level2','awaiting_level3'].includes(selected.status) && !selected.cancellation_requested && (
                  <div className="pt-5 border-t border-gray-100 space-y-4">
                    {canApproveSelected ? (
                      <>
                        <textarea
                          placeholder="Enter rejection reason or internal notes..."
                          value={rejectionNote}
                          onChange={e => setRejectionNote(e.target.value)}
                          className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-[13px] text-gray-700 placeholder:text-gray-400 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 h-20 resize-none"
                        />
                        <div className="flex gap-3">
                          <button
                            disabled={!!processingId}
                            onClick={() => handleAction('rejected')}
                            className="flex-1 py-3 bg-white border border-red-100 text-red-500 rounded-lg font-semibold text-[12px] hover:bg-red-50 transition-colors"
                          >
                            Reject
                          </button>
                          <button
                            disabled={!!processingId}
                            onClick={() => handleAction('approved')}
                            className="flex-1 py-3 bg-purple-500 text-white rounded-lg font-semibold text-[12px] hover:bg-purple-600 transition-colors shadow-sm active:scale-[0.98]"
                          >
                            Approve Request
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <ShieldCheck size={16} className="text-gray-400 shrink-0" />
                        <p className="text-[12px] font-medium text-gray-400">
                          This request is awaiting approval at a different level — your role ({userRole?.replace('_', ' ')}) cannot act on it yet.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <ToEmptyState
                icon={<Calendar size={32} className="text-gray-300" />}
                title="Select a Request"
                description="Click on a leave request from the list to view details and take action."
              />
            )}
          </div>

        </div>
      </div>
      {/* Adjust Leave Balances Dialog */}
      {showAdjustDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl border border-gray-100">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-[16px] font-bold text-gray-900">Adjust Leave Balance</h2>
              <button onClick={() => setShowAdjustDialog(false)} className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors"><X size={18} strokeWidth={2} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1.5">Employee</label>
                <select
                  value={adjustForm.employee_id}
                  onChange={e => setAdjustForm({...adjustForm, employee_id: e.target.value})}
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-[13px] text-gray-700 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                >
                  <option value="">Select employee...</option>
                  {adjustEmployees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1.5">Leave Type</label>
                <select
                  value={adjustForm.leave_type}
                  onChange={e => setAdjustForm({...adjustForm, leave_type: e.target.value})}
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-[13px] text-gray-700 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                >
                  <option value="annual">Annual Leave</option>
                  <option value="casual">Casual Leave</option>
                  <option value="sick">Sick Leave</option>
                  <option value="maternity">Maternity Leave</option>
                  <option value="paternity">Paternity Leave</option>
                  <option value="unpaid">Unpaid Leave</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1.5">Adjustment</label>
                <div className="flex rounded-lg overflow-hidden border border-gray-200">
                  {[{val:'add',label:'Add Days'},{val:'deduct',label:'Deduct Days'}].map(opt => (
                    <button
                      key={opt.val}
                      onClick={() => setAdjustForm({...adjustForm, adjustment_type: opt.val})}
                      className={`flex-1 py-2 text-[12px] font-semibold transition-all ${adjustForm.adjustment_type === opt.val ? (opt.val === 'add' ? 'bg-green-500 text-white' : 'bg-red-500 text-white') : 'bg-gray-50 text-gray-500 hover:text-gray-700'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1.5">Number of Days</label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={adjustForm.days}
                  onChange={e => setAdjustForm({...adjustForm, days: e.target.value})}
                  placeholder="e.g. 1.5"
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-[13px] text-gray-700 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1.5">Reason</label>
                <textarea
                  value={adjustForm.reason}
                  onChange={e => setAdjustForm({...adjustForm, reason: e.target.value})}
                  placeholder="e.g. Annual carry-forward, Manual correction..."
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-[13px] text-gray-700 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 h-16 resize-none"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowAdjustDialog(false)}
                  className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-[12px] font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdjustLeave}
                  disabled={savingAdjust}
                  className="flex-1 py-2.5 bg-purple-500 text-white rounded-lg text-[12px] font-semibold hover:bg-purple-600 transition-colors disabled:opacity-50 active:scale-[0.98]"
                >
                  {savingAdjust ? 'Saving...' : 'Apply Adjustment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}

function RefreshCw(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
}
