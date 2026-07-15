'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { 
  DollarSign, 
  ArrowLeft, 
  Info, 
  AlertCircle, 
  CheckCircle,
  Clock,
  History,
  TrendingUp,
  XCircle,
  ChevronRight
} from 'lucide-react'
import { toast } from 'sonner'
import { EmployeeLayout } from '@/components/employee-layout'

interface LeaveBalance {
  leave_type: string
  year: number
  remaining_days: number
}

interface EncashmentRequest {
  id: string
  year: number
  days_requested: number
  amount: number
  status: 'pending' | 'approved' | 'rejected' | 'paid'
  created_at: string
}

export default function EmployeeEncashmentPage() {
  const { userId, organizationId, isLoaded } = useAuth()
  const router = useRouter()
  
  const [employee, setEmployee] = useState<any>(null)
  const [balance, setBalance] = useState<number>(0)
  const [requests, setRequests] = useState<EncashmentRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSaving] = useState(false)
  const [orgSettings, setSettings] = useState<any>(null)

  const [daysToEncash, setDaysToEncash] = useState<string>('')
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (isLoaded && userId && organizationId) {
      loadData()
    }
  }, [isLoaded, userId, organizationId])

  async function loadData() {
    setLoading(true)
    try {
      const [empResult, settingsResult] = await Promise.all([
        api.get<any>('/employees/me'),
        api.get<{ organization: any }>('/organizations/settings'),
      ])
      if (!empResult.ok || !empResult.data) throw new Error(empResult.error || 'Employee not found')
      if (!settingsResult.ok) throw new Error(settingsResult.error || 'Failed to load organization settings')
      const emp = empResult.data
      setEmployee(emp)
      setSettings(settingsResult.data?.organization || null)

      const year = new Date().getFullYear()
      const [balResult, reqResult] = await Promise.all([
        api.get<LeaveBalance[]>(`/leave/balances/${emp.id}`),
        api.get<EncashmentRequest[]>(`/leave/encashment?employee_id=${emp.id}`),
      ])
      const annualBalance = (balResult.data || []).find((b) => b.leave_type === 'annual' && b.year === year)
      setBalance(annualBalance?.remaining_days || 0)
      setRequests(reqResult.data || [])
    } catch (error: any) {
      toast.error(error.message || 'Failed to load encashment data')
    } finally {
      setLoading(false)
    }
  }

  const dailyRate = employee?.basic_salary ? employee.basic_salary / 30 : 0
  const estimatedAmount = parseFloat(daysToEncash) > 0 ? dailyRate * parseFloat(daysToEncash) : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const days = parseFloat(daysToEncash)
    if (!days || days <= 0) { toast.error('Enter valid days'); return }
    if (!employee) { toast.error('Employee not found'); return }

    setSaving(true)
    try {
      const year = new Date().getFullYear()
      const result = await api.post<EncashmentRequest>('/leave/encashment', {
        employee_id: employee.id,
        year,
        days_requested: days,
        amount: estimatedAmount,
        reason,
      })
      if (!result.ok) throw new Error(result.error || 'Failed to submit')
      toast.success('Request submitted!'); setDaysToEncash(''); setReason(''); loadData()
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit')
    } finally {
      setSaving(false)
    }
  }

  if (!loading && !orgSettings?.encashment_allowed) {
    return (
      <EmployeeLayout showGreeting={false} title="Encashment" backHref="/">
         <div className="p-8 text-center bg-white m-4 rounded-[32px] border border-[#F1F0F4] shadow-sm">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4 opacity-20" />
            <h2 className="text-xl font-black text-[#1A1727] tracking-tight">Feature Disabled</h2>
            <p className="text-[#9CA3AF] text-sm font-medium mt-2">Leave encashment is not currently enabled for your organization.</p>
         </div>
      </EmployeeLayout>
    )
  }

  return (
    <EmployeeLayout showGreeting={false} title="Encashment">
      <div className="flex flex-col min-h-screen bg-[#F8F7F9] font-['Plus_Jakarta_Sans'] pb-24">
        <div className="bg-[#1E1854] px-4 pt-4 pb-12">
          <div className="flex justify-between items-center mb-6">
            <span className="text-white font-extrabold text-lg">Leave Encashment</span>
            <DollarSign className="text-white/60" size={20} />
          </div>
          <div className="bg-white/10 rounded-2xl p-6 border border-white/5 flex items-center justify-between">
             <div>
                <div className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-1">Available Annual Balance</div>
                <div className="text-3xl font-black text-white tracking-tight">{balance} Days</div>
             </div>
             <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-white"><TrendingUp size={24} /></div>
          </div>
        </div>

        <div className="px-4 -mt-6 space-y-4">
           {/* Form Card */}
           <div className="bg-white rounded-[32px] border border-[#F1F0F4] p-6 shadow-lg shadow-purple-900/5">
              <h3 className="text-[14px] font-black text-[#1A1727] uppercase tracking-wider mb-6 flex items-center gap-2">
                 <CheckCircle size={16} className="text-emerald-500" /> New Claim Request
              </h3>
              <form onSubmit={handleSubmit} className="space-y-6">
                 <div>
                    <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Days to Monetize</label>
                    <input 
                       type="number" step="0.5" required
                       value={daysToEncash}
                       onChange={e => setDaysToEncash(e.target.value)}
                       placeholder="Enter number of days..."
                       className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none" 
                    />
                 </div>
                 <div>
                    <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Reason (Optional)</label>
                    <textarea 
                       value={reason}
                       onChange={e => setReason(e.target.value)}
                       rows={2}
                       placeholder="Brief reason for encashment..."
                       className="w-full p-4 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none resize-none" 
                    />
                 </div>

                 {estimatedAmount > 0 && (
                   <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center justify-between">
                      <div>
                         <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Est. Settlement</div>
                         <div className="text-lg font-black text-emerald-700">LKR {estimatedAmount.toLocaleString()}</div>
                      </div>
                      <Info size={20} className="text-emerald-300" />
                   </div>
                 )}

                 <button 
                  type="submit"
                  disabled={loading || submitting || !employee || !daysToEncash}
                  className="w-full py-4 bg-[#534AB7] text-white rounded-2xl font-black text-[13px] uppercase tracking-widest shadow-xl shadow-purple-900/30 active:scale-95 transition-all disabled:opacity-50"
                 >
                   {submitting ? 'Submitting...' : 'Submit Request'}
                 </button>
              </form>
           </div>

           {/* History Card */}
           <div className="bg-white rounded-[32px] border border-[#F1F0F4] p-6 shadow-sm">
              <h3 className="text-[12px] font-black text-[#1A1727] uppercase tracking-widest mb-6 flex items-center gap-2">
                 <History size={16} className="text-[#9CA3AF]" /> Encashment Log
              </h3>
              <div className="space-y-4">
                 {loading ? (
                   <div className="py-10 text-center text-[#9CA3AF] animate-pulse font-bold text-xs uppercase">Fetching History...</div>
                 ) : requests.length === 0 ? (
                   <div className="py-10 text-center text-[#D1D5DB] italic text-xs">No previous requests found.</div>
                 ) : requests.map(req => (
                   <div key={req.id} className="flex items-center justify-between p-4 bg-[#F8F7F9] rounded-2xl border border-[#F1F0F4]">
                      <div>
                         <div className="text-[14px] font-black text-[#1A1727]">{req.days_requested} Days ({req.year})</div>
                         <div className="text-[10px] font-bold text-[#9CA3AF] mt-0.5">{new Date(req.created_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short' })}</div>
                      </div>
                      <div className="text-right">
                         <div className="text-[13px] font-black text-[#534AB7] font-mono">LKR {req.amount.toLocaleString()}</div>
                         <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                           req.status === 'approved' || req.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                           req.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                         }`}>{req.status}</span>
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      </div>
    </EmployeeLayout>
  )
}
