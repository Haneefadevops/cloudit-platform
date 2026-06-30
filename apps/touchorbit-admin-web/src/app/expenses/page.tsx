'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { usePermissions } from '@/hooks/use-permissions'
import {
  Wallet,
  Receipt,
  Plus,
  Edit2,
  Trash2,
  Image as ImageIcon,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  Eye,
  X,
  FileText,
  Shield,
  TrendingUp
} from 'lucide-react'
import { ToBadge } from '@/components/ui/ToBadge'
import { ToAvatar } from '@/components/ui/ToAvatar'
import { ToEmptyState } from '@/components/ui/ToEmptyState'
import { TableSkeleton } from '@/components/ui/ToSkeleton'
import { toast } from 'sonner'

interface ExpenseCategory {
  id: string
  name: string
  description: string | null
  max_claim_amount: number | null
  is_active: boolean
}

interface ExpenseClaim {
  id: string
  employee_id: string
  category_id: string | null
  amount: number
  currency: string
  claim_date: string
  description: string | null
  receipt_url: string | null
  status: 'pending' | 'awaiting_level1' | 'awaiting_level2' | 'awaiting_level3' | 'awaiting_finance' | 'approved' | 'rejected' | 'reimbursed'
  admin_notes: string | null
  created_at: string
  employee?: {
    first_name: string
    last_name: string
    department: string
    department_id: string
    branch_id: string
  }
  category?: {
    name: string
  }
}

export default function ExpensesAdminPage() {
  const { organizationId, userId, isLoaded, isFinance, isDeptManager, isBranchManager, userRole, isAdmin } = useAuth()
  const { can } = usePermissions(['expenses.approve', 'expenses.reimburse'])
  const [activeTab, setActiveTab] = useState<'claims' | 'categories'>('claims')
  const [claims, setClaims] = useState<ExpenseClaim[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [loading, setLoading] = useState(true)
  
  // Default filters based on role
  const getInitialFilter = () => {
    if (isFinance) return 'awaiting_finance'
    if (isDeptManager || isBranchManager) return 'awaiting_level1'
    if (isAdmin || userRole === 'owner') return 'awaiting_level2'
    return 'pending'
  }
  const [filter, setFilter] = useState<string>(getInitialFilter())

  // Category Dialog State
  const [showCategoryDialog, setShowCategoryDialog] = useState(false)
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null)
  const [categoryName, setCategoryName] = useState('')
  const [categoryDesc, setCategoryNameDesc] = useState('')
  const [maxClaimAmount, setMaxClaimAmount] = useState('')

  // Claim Review State
  const [reviewingClaim, setReviewingClaim] = useState<ExpenseClaim | null>(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [approvalTimeline, setApprovalTimeline] = useState<any[]>([])

  // Finance reimbursement state
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer')

  // Scoped manager state
  const [managedScopeId, setManagedScopeId] = useState<string | null>(null)

  useEffect(() => {
    if (isLoaded && organizationId) {
      setFilter(getInitialFilter()) // Re-set if roles load late
      if (isDeptManager) {
        supabase.rpc('get_my_managed_dept_id').then(({ data }) => {
          setManagedScopeId(data)
          loadData(data, 'dept')
        })
      } else if (isBranchManager) {
        supabase.rpc('get_my_managed_branch_id').then(({ data }) => {
          setManagedScopeId(data)
          loadData(data, 'branch')
        })
      } else {
        loadData()
      }
    }
  }, [isLoaded, organizationId])

  useEffect(() => {
    if (reviewingClaim) {
      loadApprovalTimeline(reviewingClaim.id)
    }
  }, [reviewingClaim])

  async function loadApprovalTimeline(claimId: string) {
    const { data } = await supabase
      .from('expense_claim_approvals')
      .select(`
        *,
        approver:users(first_name, last_name)
      `)
      .eq('claim_id', claimId)
      .order('level')
    setApprovalTimeline(data || [])
  }

  async function loadData(scopeId?: string | null, scopeType?: 'dept' | 'branch') {
    setLoading(true)
    try {
      // 1. Load Categories (not needed for finance)
      if (!isFinance) {
        const { data: catData } = await supabase
          .from('expense_categories')
          .select('*')
          .eq('organization_id', organizationId)
          .order('name')
        setCategories(catData || [])
      }

      // 2. Load Claims — scoped by role
      let query = supabase
        .from('expense_claims')
        .select(`*, employee:employees(first_name, last_name, department, department_id, branch_id), category:expense_categories(name)`)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })

      // Role-based restrictions on what they can see initially
      if (isFinance) {
        // Finance can see awaiting_finance and reimbursed
      } else if (isDeptManager || isBranchManager) {
        // Managers see their scoped employees
        if (scopeType === 'dept' && scopeId) {
          query = query.eq('employee.department_id', scopeId)
        } else if (scopeType === 'branch' && scopeId) {
          query = query.eq('employee.branch_id', scopeId)
        }
      }

      const { data: claimData } = await query
      setClaims(claimData || [])
    } catch (error) {
      console.error('Error loading expenses:', error)
      toast.error('Failed to load expense data')
    } finally {
      setLoading(false)
    }
  }

  const handleReviewClaim = async (action: 'approved' | 'rejected' | 'reimbursed') => {
    if (!reviewingClaim || !userId) return
    if (action === 'reimbursed' && !can('expenses.reimburse')) {
      toast.error('You do not have permission to reimburse expense claims')
      return
    }
    if (action !== 'reimbursed' && !can('expenses.approve')) {
      toast.error('You do not have permission to approve expense claims')
      return
    }

    try {
      if (action === 'reimbursed') {
        const { error } = await supabase
          .from('expense_claims')
          .update({
            status: 'reimbursed',
            payment_reference: paymentReference,
            payment_method: paymentMethod,
            reviewed_by: userId,
            reviewed_at: new Date().toISOString()
          })
          .eq('id', reviewingClaim.id)
        if (error) throw error
      } else {
        // Use multi-level approval RPC
        let level = 0
        if (reviewingClaim.status === 'awaiting_level1') level = 1
        else if (reviewingClaim.status === 'awaiting_level2') level = 2
        else if (reviewingClaim.status === 'awaiting_level3') level = 3
        else if (reviewingClaim.status === 'pending') level = 1 // Fallback

        const { error } = await supabase.rpc('advance_expense_claim', {
          p_claim_id: reviewingClaim.id,
          p_level: level,
          p_status: action === 'approved' ? 'approved' : 'rejected',
          p_notes: adminNotes
        })
        if (error) throw error
      }

      toast.success(`Claim ${action}`)
      setReviewingClaim(null)
      setAdminNotes('')
      setPaymentReference('')
      setPaymentMethod('Bank Transfer')
      loadData(managedScopeId, isDeptManager ? 'dept' : isBranchManager ? 'branch' : undefined)
    } catch (error) {
      toast.error('Failed to update claim')
    }
  }

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organizationId) return
    try {
      const categoryData = {
        name: categoryName,
        description: categoryDesc || null,
        max_claim_amount: maxClaimAmount ? parseFloat(maxClaimAmount) : null
      }

      if (editingCategory) {
        const { error } = await supabase
          .from('expense_categories')
          .update(categoryData)
          .eq('id', editingCategory.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('expense_categories')
          .insert({ 
            ...categoryData,
            organization_id: organizationId, 
            is_active: true 
          })
        if (error) throw error
      }
      toast.success(editingCategory ? 'Category updated' : 'Category added')
      setShowCategoryDialog(false)
      setEditingCategory(null)
      setCategoryName('')
      setCategoryNameDesc('')
      setMaxClaimAmount('')
      loadData(managedScopeId, isDeptManager ? 'dept' : isBranchManager ? 'branch' : undefined)
    } catch {
      toast.error('Failed to save category')
    }
  }

  const filteredClaims = filter === 'all' ? claims : claims.filter(c => c.status === filter)

  const statusOptions = isFinance 
    ? ['awaiting_finance', 'reimbursed', 'all'] 
    : isDeptManager || isBranchManager
      ? ['awaiting_level1', 'rejected', 'all']
      : ['awaiting_level2', 'awaiting_level3', 'awaiting_finance', 'rejected', 'reimbursed', 'all']

  const statusLabels: Record<string, string> = {
    pending: 'Routing...',
    awaiting_level1: 'Level 1 (Manager)',
    awaiting_level2: 'Level 2 (HR)',
    awaiting_level3: 'Level 3 (Owner)',
    awaiting_finance: 'Finance Queue',
    approved: 'Approved',
    rejected: 'Rejected',
    reimbursed: 'Reimbursed',
    all: 'All Claims'
  }

  const statusMap: Record<string, string> = {
    pending: 'pending',
    awaiting_level1: 'pending',
    awaiting_level2: 'pending',
    awaiting_level3: 'pending',
    awaiting_finance: 'pending',
    approved: 'approved',
    rejected: 'rejected',
    reimbursed: 'active',
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full bg-[#F8F7F9]">
        {/* Page Header */}
        <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-[15px] font-bold text-gray-900">Expense Management</h1>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {isFinance ? 'Process approved claims and confirm payments' : 'Review employee claims and manage approvals'}
            </p>
          </div>
          {activeTab === 'categories' && (
            <button
              onClick={() => setShowCategoryDialog(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors text-[12px] font-semibold shadow-sm active:scale-[0.98]"
            >
              <Plus size={13} strokeWidth={2.5} />
              Add Category
            </button>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="bg-white border-b border-gray-100 px-6 flex items-center gap-6 shrink-0">
          <button
            onClick={() => setActiveTab('claims')}
            className={`pb-2.5 pt-3 px-1 text-[12px] font-semibold transition-all relative ${activeTab === 'claims' ? 'text-purple-500' : 'text-gray-400 hover:text-gray-700'}`}
          >
            Claims Queue
            {activeTab === 'claims' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 rounded-full" />}
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`pb-2.5 pt-3 px-1 text-[12px] font-semibold transition-all relative ${activeTab === 'categories' ? 'text-purple-500' : 'text-gray-400 hover:text-gray-700'}`}
          >
            Categories
            {activeTab === 'categories' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 rounded-full" />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'claims' ? (
            <>
              {/* Filter Toolbar */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex bg-gray-50 p-1 rounded-lg w-fit overflow-x-auto no-scrollbar max-w-full">
                  {statusOptions.map((s) => (
                    <button
                      key={s}
                      onClick={() => setFilter(s)}
                      className={`px-3 py-1.5 rounded-md text-[10px] font-semibold transition-all whitespace-nowrap ${
                        filter === s
                          ? 'bg-white text-purple-600 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {statusLabels[s] || s}
                    </button>
                  ))}
                </div>
                <div className="text-[11px] font-medium text-gray-400 ml-4 shrink-0">
                  {filteredClaims.length} claims
                </div>
              </div>

              {/* Claims Table Container */}
              <div className="bg-white rounded-xl border border-[#F1F0F4] shadow-sm overflow-hidden">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-left text-[10.5px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3">Category & Date</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-center">Receipt</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading ? (
                      <TableSkeleton rows={4} columns={6} />
                    ) : filteredClaims.length === 0 ? (
                      <tr><td colSpan={6}>
                        <ToEmptyState
                          icon={<Receipt size={32} className="text-gray-300" />}
                          title={`No ${statusLabels[filter]} found`}
                          description="No expense claims match the current filter."
                        />
                      </td></tr>
                    ) : (
                      filteredClaims.map((claim) => (
                        <tr key={claim.id} className="hover:bg-gray-50 transition-colors group">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <ToAvatar
                                initials={`${claim.employee?.first_name?.[0] || ''}${claim.employee?.last_name?.[0] || ''}`}
                                size={28}
                              />
                              <div>
                                <div className="text-[12.5px] font-semibold text-gray-900">{claim.employee?.first_name} {claim.employee?.last_name}</div>
                                <div className="text-[10px] text-gray-400 font-medium">{claim.employee?.department}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-[12.5px] font-medium text-gray-700">{claim.category?.name || 'Uncategorized'}</div>
                            <div className="text-[10px] text-gray-400 font-medium">{new Date(claim.claim_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="text-[14px] font-extrabold text-gray-900 font-mono">{claim.currency} {claim.amount.toLocaleString()}</div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <ToBadge status={statusMap[claim.status] || claim.status} showDot={false} />
                          </td>
                          <td className="px-4 py-3 text-center">
                            {claim.receipt_url ? (
                              <div className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-purple-500 mx-auto shadow-sm group-hover:scale-110 transition-transform cursor-zoom-in">
                                <ImageIcon size={14} />
                              </div>
                            ) : (
                              <span className="text-gray-300 text-[10px] font-medium">None</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                             <button
                               onClick={() => { setReviewingClaim(claim); setAdminNotes(claim.admin_notes || ''); }}
                               className="p-1.5 hover:bg-purple-50 text-gray-300 hover:text-purple-500 rounded-lg transition-colors"
                             >
                               <Eye size={16} strokeWidth={2} />
                             </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            /* Categories Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {loading ? (
                <div className="col-span-full py-20 text-center">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm mb-3">
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 animate-pulse" />
                      </div>
                      <div className="w-24 h-4 bg-gray-100 rounded animate-pulse mb-2" />
                      <div className="w-full h-3 bg-gray-100 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : categories.length === 0 ? (
                <div className="col-span-full">
                  <ToEmptyState
                    icon={<Plus size={32} className="text-gray-300" />}
                    title="No categories defined"
                    description="Create expense categories to help employees classify their claims."
                    action={
                      <button onClick={() => setShowCategoryDialog(true)} className="mt-2 text-purple-500 font-semibold text-[12px] hover:text-purple-600 transition-colors">
                        Create First Category →
                      </button>
                    }
                  />
                </div>
              ) : (
                categories.map(cat => (
                  <div key={cat.id} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all group relative">
                    <div className="flex justify-between items-start mb-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center text-purple-500 shadow-sm">
                        <Receipt size={18} strokeWidth={2} />
                      </div>
                      <button
                        onClick={() => {
                          setEditingCategory(cat);
                          setCategoryName(cat.name);
                          setCategoryNameDesc(cat.description || '');
                          setMaxClaimAmount(cat.max_claim_amount?.toString() || '');
                          setShowCategoryDialog(true);
                        }}
                        className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-gray-50 rounded-lg transition-all text-gray-400 hover:text-gray-700"
                      >
                        <Edit2 size={14} strokeWidth={2} />
                      </button>
                    </div>
                    <h3 className="text-[14px] font-bold text-gray-900 mb-1">{cat.name}</h3>
                    <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2 h-8">{cat.description || 'No description provided.'}</p>

                    <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between">
                       <ToBadge status={cat.is_active ? 'active' : 'inactive'} showDot={false} />
                       {cat.max_claim_amount && (
                         <div className="text-right">
                            <div className="text-[9px] font-medium text-gray-400 leading-none">Max Limit</div>
                            <div className="text-[12px] font-bold text-purple-500 mt-1">LKR {cat.max_claim_amount.toLocaleString()}</div>
                         </div>
                       )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Category Dialog */}
        {showCategoryDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl border border-gray-100">
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-[16px] font-bold text-gray-900">{editingCategory ? 'Edit' : 'New'} Category</h2>
                <button onClick={() => setShowCategoryDialog(false)} className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors"><X size={18} strokeWidth={2} /></button>
              </div>
              <form onSubmit={handleSaveCategory} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1.5">Category Name</label>
                  <input
                    required
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-[13px] text-gray-700 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                    placeholder="e.g. Travel, Business Meals"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1.5">Max Claim Amount (LKR)</label>
                  <input
                    type="number"
                    value={maxClaimAmount}
                    onChange={(e) => setMaxClaimAmount(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-[13px] text-gray-700 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                    placeholder="e.g. 5000"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1.5">Description (Optional)</label>
                  <textarea
                    rows={3}
                    value={categoryDesc}
                    onChange={(e) => setCategoryNameDesc(e.target.value)}
                    className="w-full p-3 bg-white border border-gray-200 rounded-lg text-[13px] text-gray-700 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 resize-none"
                    placeholder="Brief details about claim eligibility..."
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowCategoryDialog(false)}
                    className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-lg text-[12px] font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-purple-500 text-white rounded-lg text-[12px] font-semibold hover:bg-purple-600 transition-colors active:scale-[0.98]"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Review Modal */}
        {reviewingClaim && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
            <div className="bg-white rounded-xl max-w-5xl w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-gray-100">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white relative z-10">
                <div>
                   <div className="text-[10px] font-bold text-purple-500 uppercase tracking-wider mb-1">Expense Review</div>
                   <h2 className="text-[18px] font-bold text-gray-900">{reviewingClaim.employee?.first_name} {reviewingClaim.employee?.last_name}</h2>
                   <p className="text-gray-400 text-[11px] font-medium mt-0.5">{reviewingClaim.category?.name} · {new Date(reviewingClaim.claim_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </div>
                <button onClick={() => setReviewingClaim(null)} className="w-9 h-9 flex items-center justify-center bg-gray-50 rounded-full text-gray-400 hover:text-red-500 transition-all hover:rotate-90">
                  <X size={18} strokeWidth={2} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 grid md:grid-cols-5 gap-6">
                <div className="md:col-span-3 space-y-6">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Claim Amount</div>
                        <div className="text-[22px] font-extrabold text-gray-900 leading-none">{reviewingClaim.currency} {reviewingClaim.amount.toLocaleString()}</div>
                    </div>
                    <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                        <div className="text-[10px] font-bold text-purple-500 uppercase tracking-wider mb-2">Current Status</div>
                        <div className="flex items-center gap-2">
                           <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                           <span className="text-[13px] font-bold text-purple-500">{statusLabels[reviewingClaim.status]}</span>
                        </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-bold text-gray-900 uppercase tracking-wider mb-3 ml-1">Approval Sequence</h4>
                    <div className="space-y-3 relative">
                      <div className="absolute left-[13px] top-5 bottom-3 w-0.5 bg-gray-200" />
                      {approvalTimeline.length === 0 ? (
                        <div className="p-4 text-center text-[11px] font-medium text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">No approvals recorded yet</div>
                      ) : (
                        approvalTimeline.map((step) => (
                          <div key={step.id} className="flex gap-3 relative z-10">
                             <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border border-white shadow-sm ${
                               step.status === 'approved' ? 'bg-green-50 text-green-500' : step.status === 'rejected' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'
                             }`}>
                               {step.status === 'approved' ? <CheckCircle size={12} strokeWidth={2} /> : step.status === 'rejected' ? <XCircle size={12} strokeWidth={2} /> : <Clock size={12} strokeWidth={2} />}
                             </div>
                             <div className="bg-white rounded-xl border border-gray-100 p-3 flex-1 shadow-sm">
                                <div className="flex justify-between items-center mb-1">
                                   <span className="text-[11px] font-semibold text-gray-900">Level {step.level}: {step.approver_role.replace('_', ' ')}</span>
                                   <span className="text-[9px] font-medium text-gray-400">{new Date(step.decided_at || step.created_at).toLocaleDateString()}</span>
                                </div>
                                {step.approver && <div className="text-[10.5px] font-medium text-purple-500 mb-1">{step.approver.first_name} {step.approver.last_name}</div>}
                                {step.notes && <p className="text-[11px] text-gray-500 italic leading-relaxed bg-gray-50 p-2 rounded-lg border border-gray-100">&ldquo;{step.notes}&rdquo;</p>}
                             </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-bold text-gray-900 uppercase tracking-wider mb-2 ml-1">Claim Justification</h4>
                    <div className="p-4 bg-gray-50 rounded-xl text-[13px] text-gray-600 font-medium leading-relaxed italic border border-gray-100">
                      &ldquo;{reviewingClaim.description || 'No detailed description provided for this claim.'}&rdquo;
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 flex flex-col gap-5">
                  <div>
                    <h4 className="text-[10px] font-bold text-gray-900 uppercase tracking-wider mb-3 ml-1">Receipt Evidence</h4>
                    {reviewingClaim.receipt_url ? (
                      <div className="bg-gray-50 rounded-xl border border-gray-100 h-[280px] overflow-hidden flex items-center justify-center relative group shadow-inner">
                        <img
                          src={reviewingClaim.receipt_url}
                          alt="Receipt"
                          className="max-h-full max-w-full object-contain p-3 group-hover:scale-105 transition-transform duration-500"
                        />
                        <a
                          href={reviewingClaim.receipt_url}
                          target="_blank"
                          className="absolute bottom-4 right-4 bg-white border border-gray-100 p-2 rounded-xl shadow-lg text-purple-500 opacity-0 group-hover:opacity-100 transition-all active:scale-90"
                          title="Open Full Size"
                        >
                          <ImageIcon size={18} strokeWidth={2} />
                        </a>
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-100 h-48 flex flex-col items-center justify-center text-gray-300">
                        <ImageIcon size={28} className="mb-2 opacity-30" />
                        <span className="text-[10px] font-medium uppercase tracking-wider">No attachment provided</span>
                      </div>
                    )}
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <h4 className="text-[10px] font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                       <FileText size={12} strokeWidth={2} /> Reviewer Response
                    </h4>
                    <textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Add feedback or notes for the employee..."
                      rows={4}
                      className="w-full p-3 bg-white border border-gray-100 rounded-lg text-[12px] text-gray-700 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none transition-all resize-none shadow-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
                {can('expenses.approve') && ((reviewingClaim.status === 'awaiting_level1' && (isDeptManager || isBranchManager)) ||
                  (reviewingClaim.status === 'awaiting_level2' && (isAdmin || userRole === 'owner' || userRole === 'hr_admin')) ||
                  (reviewingClaim.status === 'awaiting_level3' && (userRole === 'owner'))) && (
                  <>
                    <button
                      onClick={() => handleReviewClaim('rejected')}
                      className="flex-1 py-3 bg-white border border-red-100 text-red-500 rounded-lg font-semibold text-[12px] hover:bg-red-50 transition-colors active:scale-[0.98]"
                    >
                      Reject Request
                    </button>
                    <button
                      onClick={() => handleReviewClaim('approved')}
                      className="flex-1 py-3 bg-purple-500 text-white rounded-lg font-semibold text-[12px] hover:bg-purple-600 transition-colors shadow-sm active:scale-[0.98]"
                    >
                      Approve & Advance
                    </button>
                  </>
                )}

                {reviewingClaim.status === 'awaiting_finance' && isFinance && can('expenses.reimburse') && (
                  <div className="flex-1 flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider ml-1">Payment Channel</label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-[13px] text-gray-700 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                        >
                          {['Bank Transfer','Cash','Added to Payslip','Other'].map(m => (
                            <option key={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider ml-1">Reference Code</label>
                        <input
                          type="text"
                          value={paymentReference}
                          onChange={(e) => setPaymentReference(e.target.value)}
                          placeholder="e.g. TRX-992381"
                          className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-[13px] text-gray-700 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => handleReviewClaim('reimbursed')}
                      className="w-full py-3 bg-blue-500 text-white rounded-lg font-semibold text-[12px] hover:bg-blue-600 transition-colors shadow-sm active:scale-[0.98]"
                    >
                      Mark as Reimbursed
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

