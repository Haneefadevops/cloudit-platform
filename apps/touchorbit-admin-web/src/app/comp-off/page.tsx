'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { Calendar, CheckCircle, XCircle, Clock, Gift } from 'lucide-react'
import { toast } from 'sonner'
import { GrantCompOffDialog } from '@/components/grant-comp-off-dialog'
import { ToBadge } from '@/components/ui/ToBadge'
import { ToAvatar } from '@/components/ui/ToAvatar'
import { TableSkeleton } from '@/components/ui/ToSkeleton'
import { ToEmptyState } from '@/components/ui/ToEmptyState'

interface CompOffRecord {
  id: string
  employee_id: string
  worked_date: string
  holiday_id: string | null
  status: 'pending' | 'approved' | 'used' | 'expired'
  approved_by: string | null
  approved_at: string | null
  used_date: string | null
  expiry_date: string | null
  notes: string | null
  employees: {
    first_name: string
    last_name: string
    employee_number: string
  }
  holidays?: {
    name: string
    date: string
  }
}

export default function CompOffPage() {
  const { organizationId, userId, isLoaded } = useAuth()
  const [records, setRecords] = useState<CompOffRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'used' | 'expired'>('all')
  const [isGrantDialogOpen, setIsGrantDialogOpen] = useState(false)

  useEffect(() => {
    if (isLoaded && organizationId) {
      loadRecords()
    }
  }, [isLoaded, organizationId, filter])

  const loadRecords = async () => {
    if (!organizationId) return

    setLoading(true)
    try {
      let query = supabase
        .from('comp_off_records')
        .select(`
          id,
          employee_id,
          worked_date,
          holiday_id,
          status,
          approved_by,
          approved_at,
          used_date,
          expiry_date,
          notes,
          employees!comp_off_records_employee_id_fkey (
            first_name,
            last_name,
            employee_number
          ),
          holidays (
            name,
            date
          )
        `)
        .eq('organization_id', organizationId)
        .order('worked_date', { ascending: false })

      if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      const { data, error } = await query

      if (error) throw error

      const transformedData = (data || []).map((record: any) => ({
        ...record,
        employees: Array.isArray(record.employees) ? record.employees[0] : record.employees,
        holidays: Array.isArray(record.holidays) ? record.holidays[0] : record.holidays,
      }))

      setRecords(transformedData)
    } catch (error) {
      console.error('Error loading comp-off records:', error)
      toast.error('Failed to load comp-off records')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (recordId: string) => {
    if (!userId || !organizationId) return

    try {
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('comp_off_expiry_months')
        .eq('id', organizationId)
        .single()

      if (orgError) throw orgError

      const expiryMonths = org?.comp_off_expiry_months || 3

      const { data: record, error: recordError } = await supabase
        .from('comp_off_records')
        .select('worked_date')
        .eq('id', recordId)
        .single()

      if (recordError) throw recordError

      const workedDate = new Date(record.worked_date)
      const expiryDate = new Date(workedDate)
      expiryDate.setMonth(expiryDate.getMonth() + expiryMonths)

      const { error } = await supabase
        .from('comp_off_records')
        .update({
          status: 'approved',
          approved_by: userId,
          approved_at: new Date().toISOString(),
          expiry_date: expiryDate.toISOString().split('T')[0],
        })
        .eq('id', recordId)

      if (error) throw error

      toast.success('Comp-off approved!')
      await loadRecords()
    } catch (error) {
      console.error('Error approving comp-off:', error)
      toast.error('Failed to approve comp-off')
    }
  }

  const handleReject = async (recordId: string) => {
    if (!confirm('Are you sure you want to reject this comp-off request?')) return

    try {
      const { error } = await supabase
        .from('comp_off_records')
        .delete()
        .eq('id', recordId)

      if (error) throw error

      toast.success('Comp-off request rejected')
      await loadRecords()
    } catch (error) {
      console.error('Error rejecting comp-off:', error)
      toast.error('Failed to reject comp-off')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const pendingCount = records.filter((r) => r.status === 'pending').length

  const stats = [
    { label: 'Total Earned', value: `${records.filter(r => r.status === 'approved').length} Days`, color: '#2563EB', icon: Gift },
    { label: 'Pending Claims', value: `${pendingCount} Req`, color: '#F59E0B', icon: Clock },
    { label: 'Days Used', value: `${records.filter(r => r.status === 'used').length} Days`, color: '#10B981', icon: CheckCircle },
    { label: 'Expired Credits', value: `${records.filter(r => r.status === 'expired').length} Days`, color: '#EF4444', icon: XCircle },
  ]

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full bg-[#F8F7F9]">
        {/* Page Header */}
        <div className="bg-white border-b border-[#F1F0F4] px-8 py-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-[15px] font-bold text-[#1A1727]">Compensatory Off (Comp-Off)</h1>
            <p className="text-[11px] text-[#9CA3AF]">Manage time-off earned from working on holidays</p>
          </div>
          <div className="flex items-center gap-3">
            {pendingCount > 0 && (
              <div className="bg-amber-50 text-amber-600 border border-amber-100 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <Clock size={12} strokeWidth={3} />
                {pendingCount} Pending Approval
              </div>
            )}
            <button
              onClick={() => setIsGrantDialogOpen(true)}
              className="flex items-center gap-2 px-4 py-1.5 bg-[#534AB7] text-white rounded-lg hover:bg-[#1E1854] transition-all text-xs font-bold shadow-md shadow-purple-900/20"
            >
              <Gift size={13} strokeWidth={3} />
              Grant Comp-Off
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {stats.map(s => (
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
              {(['all', 'pending', 'approved', 'used', 'expired'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                    filter === status
                      ? 'bg-white text-[#534AB7] shadow-sm'
                      : 'text-[#9CA3AF] hover:text-[#374151]'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
            <div className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">
              Showing {records?.length || 0} entries
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-white rounded-xl border border-[#F1F0F4] shadow-sm overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#F8F7F9] text-left text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest border-b border-[#F1F0F4]">
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Worked Date</th>
                  <th className="px-6 py-4">Holiday Context</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-center">Expiry Status</th>
                  <th className="px-6 py-4 text-right px-8">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F0F4]">
                {loading ? (
                  <TableSkeleton rows={5} columns={6} />
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16">
                      <ToEmptyState
                        icon={<Calendar size={40} className="text-[#D1D5DB]" />}
                        title="No comp-off records found"
                        description="Grant comp-off days to employees who worked on holidays."
                        action={{ label: 'Grant Comp-Off', onClick: () => setIsGrantDialogOpen(true) }}
                      />
                    </td>
                  </tr>
                ) : (
                  records.map((record) => (
                    <tr key={record.id} className="hover:bg-[#F8F7F9] transition-all group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <ToAvatar initials={`${record.employees.first_name[0]}${record.employees.last_name[0]}`} size={32} />
                          <div>
                            <div className="text-[13px] font-black text-[#1A1727]">{record.employees.first_name} {record.employees.last_name}</div>
                            <div className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-tighter">{record.employees.employee_number}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-[13px] font-bold text-[#374151]">{formatDate(record.worked_date)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-[12px] font-medium text-[#6B7280]">{record.holidays?.name || 'Manual Grant'}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center">
                          <ToBadge status={record.status} />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {record.expiry_date ? (
                          <div>
                            <div className="text-[13px] font-bold text-[#374151]">{formatDate(record.expiry_date)}</div>
                            {new Date(record.expiry_date) < new Date() && (
                              <div className="text-[9px] text-red-500 font-black uppercase">Expired</div>
                            )}
                          </div>
                        ) : (
                          <div className="text-[#D1D5DB] font-bold text-xs">—</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right px-8">
                        {record.status === 'pending' ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleApprove(record.id)}
                              className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg transition-all"
                              title="Approve"
                            >
                              <CheckCircle size={15} strokeWidth={3} />
                            </button>
                            <button
                              onClick={() => handleReject(record.id)}
                              className="p-1.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition-all"
                              title="Reject"
                            >
                              <XCircle size={15} strokeWidth={3} />
                            </button>
                          </div>
                        ) : (
                          <div className="text-[11px] font-bold text-[#9CA3AF] italic">
                            {record.status === 'approved' && 'Awaiting usage'}
                            {record.status === 'used' && `Used ${formatDate(record.used_date!)}`}
                          </div>
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

      <GrantCompOffDialog
        isOpen={isGrantDialogOpen}
        onClose={() => setIsGrantDialogOpen(false)}
        onSuccess={loadRecords}
      />
    </DashboardLayout>
  )
}
