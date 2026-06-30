'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard-layout'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { ArrowLeft, Save, Edit2, Check, X, Calendar } from 'lucide-react'
import { toast } from 'sonner'

interface LeaveBalance {
  id: string
  leave_type: string
  entitled_days: number
  used_days: number
  remaining_days: number
  year: number
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

export default function ManualLeaveEditor() {
  const { id: employeeId } = useParams()
  const { organizationId } = useAuth()
  const router = useRouter()
  
  const [employee, setEmployee] = useState<any>(null)
  const [balances, setBalances] = useState<LeaveBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (organizationId && employeeId) {
      loadData()
    }
  }, [organizationId, employeeId])

  async function loadData() {
    setLoading(true)
    try {
      // 1. Load employee info
      const { data: emp } = await supabase
        .from('employees')
        .select('first_name, last_name, employee_number')
        .eq('id', employeeId)
        .single()
      setEmployee(emp)

      // 2. Load current year balances
      const year = new Date().getFullYear()
      const { data: balData, error } = await supabase
        .from('leave_balances')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('year', year)
        .order('leave_type')
      
      if (error) throw error
      setBalances(balData || [])
    } catch (error) {
      console.error('Error loading balances:', error)
      toast.error('Failed to load leave balances')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveEntitlement(balanceId: string) {
    const newVal = parseFloat(editValue)
    if (isNaN(newVal) || newVal < 0) {
      toast.error('Please enter a valid number')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('leave_balances')
        .update({ 
          entitled_days: newVal,
          // remaining_days will be updated by database trigger or we can calculate here
          remaining_days: newVal - balances.find(b => b.id === balanceId)!.used_days
        })
        .eq('id', balanceId)

      if (error) throw error
      
      toast.success('Entitlement updated')
      setEditingId(null)
      loadData()
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Failed to update entitlement')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 mb-6 hover:text-purple-600 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Profile
        </button>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Adjust Leave Balances</h1>
            <p className="text-gray-500 mt-1">
              {employee ? `${employee.first_name} ${employee.last_name} (${employee.employee_number})` : 'Loading...'}
            </p>
          </div>
          <div className="bg-purple-50 px-4 py-2 rounded-xl flex items-center gap-2 text-purple-700 font-bold">
            <Calendar className="w-4 h-4" /> {new Date().getFullYear()} Entitlements
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Leave Type</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Entitled (Days)</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Used</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Remaining</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">Loading balances...</td></tr>
              ) : balances.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">No balances initialized for this employee.</td></tr>
              ) : (
                balances.map((bal) => (
                  <tr key={bal.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-bold text-gray-900">{leaveTypeLabels[bal.leave_type] || bal.leave_type}</span>
                    </td>
                    <td className="px-6 py-4">
                      {editingId === bal.id ? (
                        <input
                          autoFocus
                          type="number"
                          step="0.5"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-24 px-2 py-1 border-2 border-purple-500 rounded-lg outline-none font-bold"
                        />
                      ) : (
                        <span className="font-bold text-gray-700">{bal.entitled_days}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-500">{bal.used_days}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                        bal.remaining_days > 2 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {bal.remaining_days}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {editingId === bal.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleSaveEntitlement(bal.id)}
                            className="p-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all"
                            title="Save"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1.5 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 transition-all"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingId(bal.id)
                            setEditValue(bal.entitled_days.toString())
                          }}
                          className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
                          title="Edit entitlement"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-8 p-4 bg-blue-50 border-l-4 border-blue-400 rounded-r-xl">
          <div className="flex gap-3">
            <Calendar className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-blue-900">Administrative Manual Adjustment</p>
              <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                Use this tool to manually override entitled days for individual employees. 
                Common reasons include custom hiring terms or compensatory balance adjustments.
                Changes are reflected immediately in the employee's app.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
