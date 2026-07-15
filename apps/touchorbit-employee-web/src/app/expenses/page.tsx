'use client'

import { useEffect, useState } from 'react'
import { EmployeeLayout } from '@/components/employee-layout'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { 
  Receipt, 
  ChevronRight, 
  X, 
  Check,
  Clock,
  Plus,
  Loader2,
  Calendar,
  FileText,
  AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'

interface ExpenseClaim {
  id: string
  amount: number | string
  currency: string
  claim_date: string
  description: string | null
  status: string
  category?: { name: string }
}

interface ExpenseCategory {
  id: string
  name: string
  max_claim_amount: number | string | null
}

interface Employee { id: string }

export default function EmployeeExpensesPage() {
  const { isLoaded } = useAuth()
  const [claims, setClaims] = useState<ExpenseClaim[]>([])
  const [loading, setLoading] = useState(true)
  const [employeeId, setEmployeeId] = useState<string | null>(null)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    category_id: '',
    amount: '',
    claim_date: new Date().toISOString().split('T')[0],
    description: '',
  })
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (isLoaded) {
      loadEmployeeAndData()
    }
  }, [isLoaded])

  const loadEmployeeAndData = async () => {
    try {
      const employeeResult = await api.get<Employee>('/employees/me')
      if (!employeeResult.ok || !employeeResult.data) throw new Error(employeeResult.error || 'Employee not found')
      setEmployeeId(employeeResult.data.id)
      await Promise.all([loadData(employeeResult.data.id), loadCategories()])
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Failed to load expense data')
      setLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      const result = await api.get<ExpenseCategory[]>('/expenses/categories')
      if (!result.ok) throw new Error(result.error || 'Failed to load expense categories')
      setCategories(result.data || [])
    } catch (error) { throw error }
  }

  const loadData = async (empId: string) => {
    setLoading(true)
    try {
      const result = await api.get<ExpenseClaim[]>(`/expenses?employee_id=${empId}`)
      if (!result.ok) throw new Error(result.error || 'Failed to load expense claims')
      setClaims(result.data || [])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    if (!formData.category_id) { setFormError('Please select a category'); return }
    if (!formData.amount || parseFloat(formData.amount) <= 0) { setFormError('Please enter a valid amount'); return }
    if (!formData.claim_date) { setFormError('Please select a date'); return }

    const selectedCategory = categories.find(c => c.id === formData.category_id)
    if (selectedCategory?.max_claim_amount && parseFloat(formData.amount) > Number(selectedCategory.max_claim_amount)) {
      setFormError(`Amount exceeds max claim limit of LKR ${Number(selectedCategory.max_claim_amount).toLocaleString()} for ${selectedCategory.name}`)
      return
    }

    setSubmitting(true)
    try {
      if (!employeeId) throw new Error('Employee not found')
      const result = await api.post<ExpenseClaim>('/expenses', {
        employee_id: employeeId,
        category_id: formData.category_id,
        amount: parseFloat(formData.amount),
        currency: 'LKR',
        claim_date: formData.claim_date,
        description: formData.description || null,
      })
      if (!result.ok) throw new Error(result.error || 'Failed to submit claim')

      toast.success('Expense claim submitted')
      setShowForm(false)
      setFormData({ category_id: '', amount: '', claim_date: new Date().toISOString().split('T')[0], description: '' })
      await loadData(employeeId)
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Failed to submit claim')
    } finally {
      setSubmitting(false)
    }
  }

  const totalAmount = claims.reduce((sum, c) => sum + Number(c.amount), 0)
  const pendingAmount = claims.filter(c => c.status === 'pending').reduce((sum, c) => sum + Number(c.amount), 0)
  const reimbursedAmount = claims.filter(c => c.status === 'reimbursed').reduce((sum, c) => sum + Number(c.amount), 0)

  const stats = [
    { label: 'Total',     value: `LKR ${totalAmount.toLocaleString()}`, color: '#1E1854' },
    { label: 'Pending',   value: `LKR ${pendingAmount.toLocaleString()}`,  color: '#F59E0B' },
    { label: 'Reimbursed',value: `LKR ${reimbursedAmount.toLocaleString()}`, color: '#10B981' },
  ]

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      reimbursed: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Reimbursed' },
      approved:   { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Approved' },
      pending:    { bg: 'bg-amber-100',   text: 'text-amber-700',   label: 'Pending' },
      rejected:   { bg: 'bg-red-100',     text: 'text-red-700',     label: 'Rejected' },
    }
    const s = map[status] || map.pending
    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${s.bg} ${s.text}`}>
        {s.label}
      </span>
    )
  }

  return (
    <EmployeeLayout showGreeting={false} title="Expenses" hideHeader>
      <div className="flex flex-col min-h-screen bg-[#F8F7F9] font-['Plus_Jakarta_Sans'] pb-24">
        
        {/* Header Summary */}
        <div className="bg-[#1E1854] px-4 pt-4 pb-12">
          <div className="flex justify-between items-center mb-6">
            <span className="text-white font-extrabold text-lg">My Expenses</span>
            <button className="text-white/60 p-2"><Receipt size={20} /></button>
          </div>

          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
            {stats.map(s => (
              <div key={s.label} className="bg-white/10 rounded-2xl p-4 min-w-[140px] shrink-0 border border-white/5">
                <div className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-1">{s.label}</div>
                <div className="text-[15px] font-black text-white">{s.value}</div>
                <div className="h-1 w-8 mt-3 rounded-full" style={{ backgroundColor: s.color === '#1E1854' ? '#534AB7' : s.color }} />
              </div>
            ))}
          </div>
        </div>

        {/* List Section */}
        <div className="px-4 -mt-6 flex-1">
          <div className="bg-white rounded-t-[32px] min-h-full border-t border-[#F1F0F4] p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.04)]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-[14px] font-black text-[#1A1727] uppercase tracking-wider">Expense History</h3>
              <span className="text-[11px] font-bold text-[#9CA3AF]">{claims.length} Claims Total</span>
            </div>

            <div className="space-y-3">
              {loading ? (
                <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-[#534AB7]" /></div>
              ) : claims.length === 0 ? (
                <div className="py-20 text-center text-[#9CA3AF] italic text-sm">No expenses found</div>
              ) : claims.map(claim => (
                <div key={claim.id} className="bg-white rounded-2xl p-4 border border-[#F1F0F4] flex items-center gap-3 active:scale-[0.98] transition-all cursor-pointer">
                  {/* Icon well */}
                  <div className="w-10 h-10 rounded-[10px] bg-purple-50 flex items-center justify-center shrink-0">
                    <Receipt size={18} className="text-[#534AB7]" strokeWidth={1.8} />
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-[#1A1727] truncate">{claim.description || claim.category?.name || 'Expense'}</div>
                    <div className="text-[10.5px] text-[#9CA3AF] mt-0.5">
                      {new Date(claim.claim_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} · {claim.category?.name || 'General'}
                    </div>
                  </div>
                  {/* Amount + Status */}
                  <div className="text-right shrink-0">
                    <div className="text-[14px] font-black text-[#1A1727]">LKR {claim.amount.toLocaleString()}</div>
                    <div className="mt-1">{statusBadge(claim.status)}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Float Action Button Space */}
            <div className="h-20" />
          </div>
        </div>

        {/* FAB */}
        <div className="fixed bottom-24 left-0 right-0 px-8">
          <button 
            onClick={() => setShowForm(true)}
            className="w-full h-14 bg-[#534AB7] text-white rounded-2xl font-black text-[13px] uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-purple-900/30 active:scale-95 transition-all"
          >
            <Plus size={20} strokeWidth={3} />
            New Expense Claim
          </button>
        </div>

        {/* Add Expense Claim Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-end">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowForm(false)} />
            <div className="relative bg-white rounded-t-[32px] w-full max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
              {/* Handle bar */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-gray-300" />
              </div>

              <div className="p-6 pb-10">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-[17px] font-black text-[#1A1727]">New Expense Claim</h2>
                  <button 
                    onClick={() => setShowForm(false)}
                    className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"
                  >
                    <X size={16} strokeWidth={3} />
                  </button>
                </div>

                {formError && (
                  <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 flex items-start gap-2">
                    <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                    <span className="text-[12px] font-semibold text-red-600">{formError}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Category */}
                  <div>
                    <label className="text-[11px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 block">Category</label>
                    <select
                      value={formData.category_id}
                      onChange={e => setFormData({ ...formData, category_id: e.target.value })}
                      className="w-full bg-[#F8F7F9] border border-[#F1F0F4] rounded-xl px-4 py-3 text-[13px] font-semibold text-[#1A1727] outline-none focus:border-[#534AB7] focus:ring-2 focus:ring-purple-100 transition-all"
                    >
                      <option value="">Select category...</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}{c.max_claim_amount ? ` (max LKR ${c.max_claim_amount.toLocaleString()})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="text-[11px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 block">Amount (LKR)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.amount}
                      onChange={e => setFormData({ ...formData, amount: e.target.value })}
                      placeholder="0.00"
                      className="w-full bg-[#F8F7F9] border border-[#F1F0F4] rounded-xl px-4 py-3 text-[13px] font-semibold text-[#1A1727] outline-none focus:border-[#534AB7] focus:ring-2 focus:ring-purple-100 transition-all"
                    />
                  </div>

                  {/* Date */}
                  <div>
                    <label className="text-[11px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 block">Claim Date</label>
                    <input
                      type="date"
                      value={formData.claim_date}
                      onChange={e => setFormData({ ...formData, claim_date: e.target.value })}
                      className="w-full bg-[#F8F7F9] border border-[#F1F0F4] rounded-xl px-4 py-3 text-[13px] font-semibold text-[#1A1727] outline-none focus:border-[#534AB7] focus:ring-2 focus:ring-purple-100 transition-all"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="text-[11px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 block">Description / Notes</label>
                    <textarea
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      placeholder="What was this expense for?"
                      rows={3}
                      className="w-full bg-[#F8F7F9] border border-[#F1F0F4] rounded-xl px-4 py-3 text-[13px] font-semibold text-[#1A1727] outline-none focus:border-[#534AB7] focus:ring-2 focus:ring-purple-100 transition-all resize-none"
                    />
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-14 bg-[#534AB7] text-white rounded-2xl font-black text-[14px] uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-purple-900/20 active:scale-95 transition-all disabled:opacity-60"
                  >
                    {submitting ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} strokeWidth={3} />}
                    {submitting ? 'Submitting...' : 'Submit Claim'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

      </div>
    </EmployeeLayout>
  )
}
