'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { 
  DollarSign, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Search,
  Filter,
  RefreshCw,
  TrendingUp,
  History,
  Check
} from 'lucide-react'
import { toast } from 'sonner'

interface EncashmentRequest {
  id: string
  employee_id: string
  year: number
  days_requested: number
  amount: number
  status: 'pending' | 'approved' | 'rejected' | 'paid'
  reason: string
  created_at: string
  employee: {
    first_name: string
    last_name: string
    employee_number: string
  }
}

export default function AdminEncashmentPage() {
  const { organizationId, isLoaded } = useAuth()
  const [requests, setRequests] = useState<EncashmentRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (isLoaded && organizationId) {
      loadRequests()
    }
  }, [isLoaded, organizationId])

  async function loadRequests() {
    setLoading(true)
    try {
      const result = await api.get<EncashmentRequest[]>('/leave/encashment')
      if (!result.ok) throw new Error(result.error || 'Failed to load requests')
      setRequests(result.data || [])
    } catch (error) {
      toast.error('Failed to load requests')
    } finally {
      setLoading(false)
    }
  }

  async function handleAction(requestId: string, status: 'approved' | 'rejected') {
    try {
      const result = await api.post<EncashmentRequest>(`/leave/encashment/${requestId}/${status}`, {})
      if (!result.ok) throw new Error(result.error || 'Failed to update request')
      toast.success(`Request ${status} successfully`)
      loadRequests()
    } catch (error) { toast.error('Failed to update request') }
  }

  const filteredRequests = requests.filter(req => {
    const matchesStatus = filterStatus === 'all' || req.status === filterStatus
    const fullName = `${req.employee?.first_name} ${req.employee?.last_name}`.toLowerCase()
    return matchesStatus && (fullName.includes(searchQuery.toLowerCase()) || req.employee?.employee_number?.toLowerCase().includes(searchQuery.toLowerCase()))
  })

  const stats = [
    { label: 'Pending Payouts', value: requests.filter(r => r.status === 'pending').length, color: '#F59E0B', icon: Clock },
    { label: 'Total Approved', value: requests.filter(r => r.status === 'approved' || r.status === 'paid').length, color: '#10B981', icon: CheckCircle },
    { label: 'Encashment Vol', value: `LKR ${requests.filter(r => r.status !== 'rejected').reduce((s, r) => s + (r.amount || 0), 0).toLocaleString()}`, color: '#534AB7', icon: TrendingUp },
  ]

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full bg-[#F8F7F9]">
        {/* Page Header */}
        <div className="bg-white border-b border-[#F1F0F4] px-8 py-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-[15px] font-bold text-[#1A1727]">Leave Encashment</h1>
            <p className="text-[11px] text-[#9CA3AF]">Monetize unused leave balances for eligible employees</p>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={loadRequests} className="p-2 hover:bg-[#F8F7F9] rounded-lg text-[#9CA3AF] transition-all"><RefreshCw size={16} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3 mb-6">
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
          <div className="bg-white p-4 rounded-2xl border border-[#F1F0F4] shadow-sm mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#D1D5DB]" size={16} />
               <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search employee..." className="w-full pl-10 pr-4 py-2 bg-[#F8F7F9] border-none rounded-xl text-sm font-bold placeholder:text-[#D1D5DB] outline-none" />
            </div>
            <div className="flex bg-[#F1F0F4] p-1 rounded-xl w-fit">
              {['all', 'pending', 'approved', 'rejected', 'paid'].map(f => (
                <button key={f} onClick={() => setFilterStatus(f)} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${filterStatus === f ? 'bg-white text-[#534AB7] shadow-sm' : 'text-[#9CA3AF] hover:text-[#374151]'}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-white rounded-xl border border-[#F1F0F4] shadow-sm overflow-hidden animate-in fade-in duration-500">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#F8F7F9] text-left text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest border-b border-[#F1F0F4]">
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4 text-center">Entitlement Year</th>
                  <th className="px-6 py-4 text-center">Days</th>
                  <th className="px-6 py-4 text-right">Settlement Amount</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right px-8">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F0F4]">
                {loading ? (
                  <tr><td colSpan={6} className="py-20 text-center font-bold text-[#D1D5DB] animate-pulse uppercase tracking-widest text-[10px]">Processing Records...</td></tr>
                ) : filteredRequests.length === 0 ? (
                  <tr><td colSpan={6} className="py-20 text-center flex flex-col items-center text-[#9CA3AF]">
                    <History size={40} className="mb-4 opacity-20" />
                    <div className="text-[13px] font-bold">No encashment requests found</div>
                  </td></tr>
                ) : (
                  filteredRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-[#F8F7F9] transition-all group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#F3E8FF] border-2 border-white flex items-center justify-center text-[#534AB7] font-black text-[10px]">
                            {req.employee?.first_name[0]}
                          </div>
                          <div>
                            <div className="text-[13px] font-black text-[#1A1727]">{req.employee?.first_name} {req.employee?.last_name}</div>
                            <div className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-tighter">#{req.employee?.employee_number}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                         <div className="text-[12px] font-black text-[#374151]">{req.year}</div>
                      </td>
                      <td className="px-6 py-4 text-center text-[13px] font-bold text-[#534AB7]">{req.days_requested} Days</td>
                      <td className="px-6 py-4 text-right">
                         <div className="text-[14px] font-black text-[#1A1727] font-mono">LKR {req.amount.toLocaleString()}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border flex items-center justify-center gap-1.5 w-fit mx-auto ${
                          req.status === 'paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                          req.status === 'approved' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                          req.status === 'rejected' ? 'bg-red-50 text-red-600 border-red-100' :
                          'bg-amber-50 text-amber-600 border-amber-100'
                        }`}>
                          <div className="w-1 h-1 rounded-full bg-current" />
                          {req.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right px-8">
                         {req.status === 'pending' ? (
                           <div className="flex items-center justify-end gap-2">
                             <button onClick={() => handleAction(req.id, 'approved')} className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg transition-all shadow-sm"><Check size={14} strokeWidth={3} /></button>
                             <button onClick={() => handleAction(req.id, 'rejected')} className="p-1.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition-all shadow-sm"><XCircle size={14} strokeWidth={3} /></button>
                           </div>
                         ) : <div className="text-[#D1D5DB] font-black text-[9px] uppercase tracking-widest">—</div>}
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
