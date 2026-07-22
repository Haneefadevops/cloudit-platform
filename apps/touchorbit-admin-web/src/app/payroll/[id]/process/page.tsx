'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { Play, Check, ArrowLeft } from 'lucide-react'
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
}

interface PayrollItem {
  id: string
  employee_id: string
  employee_name: string
  basic_salary: number
  days_worked: number
  days_on_leave: number
  days_absent: number
  overtime_hours: number
  overtime_amount: number
  gross_salary: number
  total_deductions: number
  net_salary: number
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

function num(value: number | string | null | undefined) {
  return Number(value ?? 0)
}

function fmtLKR(value: number | string | null | undefined) {
  return num(value).toLocaleString()
}

export default function ProcessPayrollPage() {
  const params = useParams()
  const router = useRouter()
  const { organizationId } = useAuth()
  const [run, setRun] = useState<PayrollRun | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [items, setItems] = useState<PayrollItem[]>([])
  const [processing, setProcessing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const idParam = params?.id
  const runId = Array.isArray(idParam) ? idParam[0] : idParam

  useEffect(() => {
    if (organizationId && runId) {
      loadPayrollRun()
      loadEmployees()
    }
  }, [organizationId, runId])

  const loadPayrollRun = async () => {
    if (!organizationId || !runId) return

    const result = await api.get<PayrollRun>(`/payroll/runs/${runId}`)
    if (!result.ok) {
      console.error('Error loading payroll run:', result.error)
      const message = result.error || 'Failed to load payroll run'
      setLoadError(message)
      toast.error(message)
      return
    }

    if (result.data?.status !== 'draft') {
      toast.error('This payroll run has already been processed')
      router.push(`/payroll/${runId}`)
      return
    }

    if (!result.data) {
      setLoadError('Payroll run was not found')
      return
    }
    setLoadError(null)
    setRun(result.data)
  }

  const loadEmployees = async () => {
    if (!organizationId) return

    const result = await api.get<Employee[]>(`/employees?status=active&limit=1000`)
    if (!result.ok) {
      console.error('Error loading employees:', result.error)
      toast.error(result.error || 'Failed to load employees')
      return
    }

    setEmployees(result.data || [])
  }

  const processPayroll = async () => {
    if (!run || !organizationId) return

    setProcessing(true)

    try {
      const processResult = await api.post<{ id: string; processed_count: number }>(
        `/payroll/runs/${run.id}/process`,
        {}
      )
      if (!processResult.ok) throw new Error(processResult.error || 'Failed to process payroll')

      const [runResult, itemsResult] = await Promise.all([
        api.get<PayrollRun>(`/payroll/runs/${run.id}`),
        api.get<PayrollItem[]>(`/payroll/runs/${run.id}/items`),
      ])

      if (!runResult.ok) throw new Error(runResult.error || 'Failed to reload payroll run')
      if (!itemsResult.ok) throw new Error(itemsResult.error || 'Failed to reload payroll items')

      setRun(runResult.data || null)
      setItems(itemsResult.data || [])

      toast.success(`Payroll processed successfully for ${processResult.data?.processed_count || itemsResult.data?.length || 0} employees`)
    } catch (error: any) {
      console.error('Error processing payroll:', error)
      toast.error(error?.message || 'Failed to process payroll')
    } finally {
      setProcessing(false)
    }
  }

  if (loadError) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center">
          <h1 className="text-xl font-bold text-gray-900">Unable to load payroll run</h1>
          <p className="mt-2 text-sm text-gray-600">{loadError}</p>
          <Link href="/payroll" className="mt-5 inline-flex text-sm font-semibold text-purple-600 hover:text-purple-700">
            Back to Payroll
          </Link>
        </div>
      </DashboardLayout>
    )
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
              Process Payroll - {MONTHS[num(run.month) - 1] || 'Unknown period'} {run.year}
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
                Processing payroll...
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-purple-600 h-2 rounded-full transition-all duration-300 animate-pulse w-full" />
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
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-gray-900">{item.employee_name}</div>
                        <div className="text-gray-500">Basic: LKR {fmtLKR(item.basic_salary)}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div>Worked: {item.days_worked}</div>
                        <div className="text-gray-500 text-xs">Leave: {item.days_on_leave}, Absent: {item.days_absent}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {num(item.overtime_hours) > 0 ? `${item.overtime_hours}h` : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        <div>LKR {fmtLKR(item.gross_salary)}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        LKR {fmtLKR(item.total_deductions)}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-green-600">
                        LKR {fmtLKR(item.net_salary)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="flex items-center gap-1 text-green-600">
                          <Check className="w-4 h-4" />
                          Calculated
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-sm font-bold text-gray-900">
                      TOTAL ({items.length} employees)
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">
                      LKR {items.reduce((sum, item) => sum + num(item.gross_salary), 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">
                      LKR {items.reduce((sum, item) => sum + num(item.total_deductions), 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-green-600">
                      LKR {items.reduce((sum, item) => sum + num(item.net_salary), 0).toLocaleString()}
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
                  Close
                </Link>
                <Link
                  href={`/payroll/${run.id}`}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  View Details
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
