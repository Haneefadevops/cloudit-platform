'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { Play, Check, AlertCircle, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface PayrollRun {
  id: string
  month: number
  year: number
  status: string
}

interface Employee {
  id: string
  first_name: string
  last_name: string
  employee_number: string
  basic_salary: number
  bank_name: string | null
  bank_account_number: string | null
}

interface PayrollItem {
  employee_id: string
  employee_name: string
  basic_salary: number
  days_worked: number
  days_on_leave: number
  days_absent: number
  overtime_hours: number
  overtime_amount: number
  custom_earnings: number
  custom_deductions: number
  earnings_breakdown: { name: string; amount: number }[]
  deductions_breakdown: { name: string; amount: number }[]
  gross_salary: number
  epf_employee: number
  epf_employer: number
  etf: number
  paye_tax: number
  total_deductions: number
  net_salary: number
  status: 'pending' | 'calculated' | 'error'
  error_message?: string
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export default function ProcessPayrollPage() {
  const params = useParams()
  const router = useRouter()
  const { organizationId } = useAuth()
  const [run, setRun] = useState<PayrollRun | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [items, setItems] = useState<PayrollItem[]>([])
  const [processing, setProcessing] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [totalSteps, setTotalSteps] = useState(0)

  useEffect(() => {
    if (organizationId && params.id) {
      loadPayrollRun()
      loadEmployees()
    }
  }, [organizationId, params.id])

  const loadPayrollRun = async () => {
    if (!organizationId || !params.id) return

    const { data, error } = await supabase
      .from('payroll_runs')
      .select('*')
      .eq('id', params.id)
      .eq('organization_id', organizationId)
      .single()

    if (error) {
      console.error('Error loading payroll run:', error)
      toast.error('Failed to load payroll run')
      return
    }

    if (data.status !== 'draft') {
      toast.error('This payroll run has already been processed')
      router.push(`/payroll/${params.id}`)
      return
    }

    setRun(data)
  }

  const loadEmployees = async () => {
    if (!organizationId) return

    const { data, error } = await supabase
      .from('employees')
      .select('id, first_name, last_name, employee_number, basic_salary, bank_name, bank_account_number')
      .eq('organization_id', organizationId)
      .eq('employment_status', 'active')
      .order('employee_number')

    if (error) {
      console.error('Error loading employees:', error)
      toast.error('Failed to load employees')
      return
    }

    setEmployees(data || [])
    setTotalSteps(data?.length || 0)
  }

  const processPayroll = async () => {
    if (!run || !organizationId) return

    setProcessing(true)
    setCurrentStep(0)

    const calculatedItems: PayrollItem[] = []

    try {
      // Update status to processing
      await supabase
        .from('payroll_runs')
        .update({ status: 'processing' })
        .eq('id', run.id)

      // Process each employee
      for (let i = 0; i < employees.length; i++) {
        const employee = employees[i]
        setCurrentStep(i + 1)

        try {
          // Calculate attendance-based salary
          const { data: attendanceData, error: attendanceError } = await supabase
            .rpc('calculate_attendance_based_salary', {
              p_employee_id: employee.id,
              p_basic_salary: employee.basic_salary || 0,
              p_month: run.month,
              p_year: run.year
            })

          if (attendanceError) throw attendanceError

          const attendance = attendanceData[0]

          // Get approved overtime for this month
          const { data: overtimeData } = await supabase
            .from('overtime_records')
            .select('hours, rate')
            .eq('employee_id', employee.id)
            .eq('status', 'approved')
            .gte('date', `${run.year}-${String(run.month).padStart(2, '0')}-01`)
            .lt('date', `${run.year}-${String(run.month + 1).padStart(2, '0')}-01`)

          const overtimeHours = overtimeData?.reduce((sum, ot) => sum + Number(ot.hours), 0) || 0
          const overtimeAmount = overtimeData?.reduce((sum, ot) => sum + (Number(ot.hours) * Number(ot.rate) * (employee.basic_salary || 0) / 160), 0) || 0

          // Calculate base gross (prorated basic + overtime)
          let grossSalary = Number(attendance.prorated_salary) + overtimeAmount

          // Fetch assigned salary components using two-step query (safer than join)
          const { data: assignedLinks } = await supabase
            .from('employee_salary_components')
            .select('component_id, override_amount')
            .eq('employee_id', employee.id)
            .eq('organization_id', organizationId)

          let customEarnings = 0
          let customDeductions = 0
          const earningsBreakdown: { name: string; amount: number }[] = []
          const deductionsBreakdown: { name: string; amount: number }[] = []

          if (assignedLinks && assignedLinks.length > 0) {
            const componentIds = assignedLinks.map(l => l.component_id)
            const { data: componentDefs } = await supabase
              .from('salary_components')
              .select('id, name, type, calculation_type, default_amount')
              .in('id', componentIds)

            for (const link of assignedLinks) {
              const comp = componentDefs?.find(c => c.id === link.component_id)
              if (!comp) continue

              let amount = 0
              if (comp.calculation_type === 'percentage') {
                // Percentage is of basic salary
                amount = (Number(comp.default_amount) / 100) * Number(employee.basic_salary)
              } else {
                amount = Number(link.override_amount ?? comp.default_amount ?? 0)
              }

              // QA-P5-002: Validation for negative adjustments
              amount = Math.max(0, amount)

              if (comp.type === 'earning') {
                customEarnings += amount
                earningsBreakdown.push({ name: comp.name, amount })
              } else {
                customDeductions += amount
                deductionsBreakdown.push({ name: comp.name, amount })
              }
            }
          }

          // Gross = prorated basic + overtime + all earning allowances
          grossSalary += customEarnings

          // Calculate statutory deductions (EPF on gross, correct PAYE slabs)
          const { data: deductionsData, error: deductionsError } = await supabase
            .rpc('calculate_statutory_deductions', {
              p_basic_salary: employee.basic_salary || 0,
              p_gross_salary: grossSalary
            })

          if (deductionsError) throw deductionsError

          const deductions = deductionsData[0]

          // Total deductions = EPF (8% of gross) + PAYE + custom deduction components
          const totalDeductions = Number(deductions.epf_employee) + Number(deductions.paye_tax) + customDeductions
          const netSalary = grossSalary - totalDeductions

          const item: PayrollItem = {
            employee_id: employee.id,
            employee_name: `${employee.first_name} ${employee.last_name}`,
            basic_salary: employee.basic_salary || 0,
            days_worked: Number(attendance.days_worked),
            days_on_leave: Number(attendance.days_on_leave),
            days_absent: Number(attendance.days_absent),
            overtime_hours: overtimeHours,
            overtime_amount: overtimeAmount,
            custom_earnings: customEarnings,
            custom_deductions: customDeductions,
            earnings_breakdown: earningsBreakdown,
            deductions_breakdown: deductionsBreakdown,
            gross_salary: grossSalary,
            epf_employee: Number(deductions.epf_employee),
            epf_employer: Number(deductions.epf_employer),
            etf: Number(deductions.etf),
            paye_tax: Number(deductions.paye_tax),
            total_deductions: totalDeductions,
            net_salary: netSalary,
            status: 'calculated'
          }

          calculatedItems.push(item)

          // Insert payroll item with full breakdown
          await supabase.from('payroll_items').insert({
            payroll_run_id: run.id,
            organization_id: organizationId,
            employee_id: employee.id,
            basic_salary: employee.basic_salary || 0,
            earnings_json: earningsBreakdown,
            deductions_json: deductionsBreakdown,
            total_days_in_month: attendance.total_days,
            days_worked: attendance.days_worked,
            days_on_leave: attendance.days_on_leave,
            days_absent: attendance.days_absent,
            overtime_hours: overtimeHours,
            overtime_amount: overtimeAmount,
            epf_employee: deductions.epf_employee,
            epf_employer: deductions.epf_employer,
            etf: deductions.etf,
            paye_tax: deductions.paye_tax,
            gross_salary: grossSalary,
            total_deductions: totalDeductions,
            net_salary: netSalary,
            bank_name: employee.bank_name,
            bank_account: employee.bank_account_number
          })

        } catch (error: any) {
          console.error(`Error processing employee ${employee.id}:`, error)
          calculatedItems.push({
            employee_id: employee.id,
            employee_name: `${employee.first_name} ${employee.last_name}`,
            basic_salary: employee.basic_salary || 0,
            days_worked: 0,
            days_on_leave: 0,
            days_absent: 0,
            overtime_hours: 0,
            overtime_amount: 0,
            custom_earnings: 0,
            custom_deductions: 0,
            earnings_breakdown: [],
            deductions_breakdown: [],
            gross_salary: 0,
            epf_employee: 0,
            epf_employer: 0,
            etf: 0,
            paye_tax: 0,
            total_deductions: 0,
            net_salary: 0,
            status: 'error',
            error_message: error.message
          })
        }
      }

      setItems(calculatedItems)

      // Update payroll run totals
      const totalGross = calculatedItems.reduce((sum, item) => sum + item.gross_salary, 0)
      const totalNet = calculatedItems.reduce((sum, item) => sum + item.net_salary, 0)
      const totalEpfEmployee = calculatedItems.reduce((sum, item) => sum + item.epf_employee, 0)
      const totalEpfEmployer = calculatedItems.reduce((sum, item) => sum + item.epf_employer, 0)
      const totalEtf = calculatedItems.reduce((sum, item) => sum + item.etf, 0)
      const totalPaye = calculatedItems.reduce((sum, item) => sum + item.paye_tax, 0)

      await supabase
        .from('payroll_runs')
        .update({
          status: 'draft',
          total_employees: employees.length,
          total_gross: totalGross,
          total_net: totalNet,
          total_epf_employee: totalEpfEmployee,
          total_epf_employer: totalEpfEmployer,
          total_etf: totalEtf,
          total_paye: totalPaye
        })
        .eq('id', run.id)

      toast.success(`Payroll processed successfully for ${employees.length} employees`)

    } catch (error) {
      console.error('Error processing payroll:', error)
      toast.error('Failed to process payroll')

      // Reset status to draft
      await supabase
        .from('payroll_runs')
        .update({ status: 'draft' })
        .eq('id', run.id)
    } finally {
      setProcessing(false)
    }
  }

  if (!run) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center">Loading...</div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link
              href="/payroll"
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-purple-600 mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Payroll
            </Link>
            <h1 className="text-3xl font-bold">
              Process Payroll - {MONTHS[run.month - 1]} {run.year}
            </h1>
            <p className="text-gray-600 mt-1">
              Calculate salaries for {employees.length} active employees
            </p>
          </div>
          <button
            onClick={processPayroll}
            disabled={processing || items.length > 0}
            className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Play className="w-5 h-5" />
            {processing ? 'Processing...' : items.length > 0 ? 'Already Processed' : 'Start Processing'}
          </button>
        </div>

        {/* Processing Progress */}
        {processing && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Processing employee {currentStep} of {totalSteps}
              </span>
              <span className="text-sm text-gray-500">
                {Math.round((currentStep / totalSteps) * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(currentStep / totalSteps) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Results Table */}
        {items.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Payroll Summary</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Employee
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Days
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      OT Hours
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Gross
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Deductions
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Net Salary
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((item) => (
                    <tr key={item.employee_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-gray-900">{item.employee_name}</div>
                        <div className="text-gray-500">Basic: LKR {item.basic_salary.toLocaleString()}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div>Worked: {item.days_worked}</div>
                        <div className="text-gray-500 text-xs">Leave: {item.days_on_leave}, Absent: {item.days_absent}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {item.overtime_hours > 0 ? `${item.overtime_hours}h` : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        <div>LKR {item.gross_salary.toLocaleString()}</div>
                        {item.earnings_breakdown.map(e => (
                          <div key={e.name} className="text-xs text-green-600">
                            +{e.name}: {e.amount.toLocaleString()}
                          </div>
                        ))}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div>EPF (8%): {item.epf_employee.toLocaleString()}</div>
                        <div className="text-xs text-gray-500">PAYE: {item.paye_tax.toLocaleString()}</div>
                        {item.deductions_breakdown.map(d => (
                          <div key={d.name} className="text-xs text-red-500">
                            {d.name}: {d.amount.toLocaleString()}
                          </div>
                        ))}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-green-600">
                        LKR {item.net_salary.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {item.status === 'calculated' ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <Check className="w-4 h-4" />
                            Success
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-600" title={item.error_message}>
                            <AlertCircle className="w-4 h-4" />
                            Error
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-sm font-bold text-gray-900">
                      TOTAL ({items.filter(i => i.status === 'calculated').length} employees)
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">
                      LKR {items.reduce((sum, item) => sum + item.gross_salary, 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">
                      LKR {items.reduce((sum, item) => sum + item.total_deductions, 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-green-600">
                      LKR {items.reduce((sum, item) => sum + item.net_salary, 0).toLocaleString()}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {items.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <Link
                  href="/payroll"
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </Link>
                <Link
                  href={`/payroll/${run.id}`}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  View Details & Finalize
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
