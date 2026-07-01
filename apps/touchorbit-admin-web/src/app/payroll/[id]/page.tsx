'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/lib/auth'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api'
import { ArrowLeft, Download, Mail, Users, DollarSign, TrendingDown, Banknote } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface PayrollRun {
  id: string
  month: number
  year: number
  status: string
  total_employees: number
  total_gross: number
  total_net: number
  total_epf_employee: number
  total_epf_employer: number
  total_etf: number
  total_paye: number
  finalized_at: string | null
  finalized_by: string | null
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
  epf_employee: number
  paye_tax: number
  total_deductions: number
  net_salary: number
  bank_name: string | null
  bank_account: string | null
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export default function PayrollDetailPage() {
  const params = useParams()
  const { organizationId } = useAuth()
  const { can } = usePermissions(['payroll.send_payslips'])
  const [run, setRun] = useState<PayrollRun | null>(null)
  const [items, setItems] = useState<PayrollItem[]>([])
  const [loading, setLoading] = useState(true)
  const [sendingEmails, setSendingEmails] = useState(false)

  const runId = params.id as string

  useEffect(() => {
    if (organizationId && runId) {
      loadPayrollData()
    }
  }, [organizationId, runId])

  const loadPayrollData = async () => {
    if (!organizationId || !runId) return
    setLoading(true)
    try {
      const [runResult, itemsResult] = await Promise.all([
        api.get<PayrollRun>(`/payroll/runs/${runId}`),
        api.get<PayrollItem[]>(`/payroll/runs/${runId}/items`),
      ])
      if (!runResult.ok) throw new Error(runResult.error || 'Failed to load payroll run')
      if (!itemsResult.ok) throw new Error(itemsResult.error || 'Failed to load payroll items')
      setRun(runResult.data || null)
      setItems(itemsResult.data || [])
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load payroll data')
    } finally {
      setLoading(false)
    }
  }

  const downloadBankFile = () => {
    if (!items.length || !run) return
    const csvRows = [
      ['Account Number', 'Account Name', 'Amount', 'Bank Name', 'Reference'],
      ...items.map(item => [
        item.bank_account || 'N/A',
        item.employee_name,
        item.net_salary.toFixed(2),
        item.bank_name || 'N/A',
        `Salary ${MONTHS[run.month - 1]} ${run.year}`
      ])
    ]
    const csvContent = csvRows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.setAttribute('href', URL.createObjectURL(blob))
    link.setAttribute('download', `payroll_${run.year}_${run.month}_bank_file.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Bank file downloaded')
  }

  const sendPayslipEmails = async () => {
    if (!run || !items.length) return
    if (!confirm(`Send payslip emails to ${items.length} employees for ${MONTHS[run.month - 1]} ${run.year}?`)) return
    setSendingEmails(true)
    try {
      const result = await api.post<{ sent: boolean; run_id: string; employee_ids: string[] }>(
        '/payroll/payslips/send',
        { run_id: run.id }
      )
      if (!result.ok) throw new Error(result.error || 'Failed to send emails')
      const data = result.data
      toast.success(`Payslip send request submitted for ${data?.employee_ids?.length || items.length} employees`)
    } catch (error: any) {
      toast.error(error?.message || 'Failed to send payslip emails')
    } finally {
      setSendingEmails(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-[10px] font-black text-[#D1D5DB] animate-pulse uppercase tracking-widest">Loading Payroll Data...</div>
        </div>
      </DashboardLayout>
    )
  }

  if (!run) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-[13px] font-bold text-[#9CA3AF]">Payroll run not found</div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full bg-[#F8F7F9]">
        {/* Page Header */}
        <div className="bg-white border-b border-[#F1F0F4] px-8 py-4 flex items-center justify-between shrink-0">
          <div>
            <Link href="/payroll" className="flex items-center gap-1.5 text-[10px] font-black text-[#9CA3AF] hover:text-[#534AB7] uppercase tracking-widest mb-2 transition-all">
              <ArrowLeft size={12} strokeWidth={2.5} />
              Back to Payroll
            </Link>
            <h1 className="text-[15px] font-bold text-[#1A1727]">
              Payroll — {MONTHS[run.month - 1]} {run.year}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border flex items-center gap-1.5 ${
                run.status === 'finalized' || run.status === 'paid'
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                  : 'bg-amber-50 text-amber-600 border-amber-100'
              }`}>
                <div className="w-1 h-1 rounded-full bg-current" />
                {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
              </span>
              {run.finalized_at && (
                <span className="text-[10px] text-[#9CA3AF] font-bold">
                  Finalized {new Date(run.finalized_at).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            {(run.status === 'finalized' || run.status === 'paid') && (
              <>
                {can('payroll.send_payslips') && (
                  <button
                    onClick={sendPayslipEmails}
                    disabled={sendingEmails || items.length === 0}
                    className="flex items-center gap-2 px-4 py-1.5 border border-[#F1F0F4] bg-white text-[#374151] rounded-lg hover:bg-[#F8F7F9] disabled:opacity-50 text-xs font-bold transition-all shadow-sm"
                  >
                    <Mail size={13} strokeWidth={2.5} />
                    {sendingEmails ? 'Sending...' : 'Email Payslips'}
                  </button>
                )}
                <button
                  onClick={downloadBankFile}
                  className="flex items-center gap-2 px-4 py-1.5 border border-[#F1F0F4] bg-white text-[#374151] rounded-lg hover:bg-[#F8F7F9] text-xs font-bold transition-all shadow-sm"
                >
                  <Download size={13} strokeWidth={2.5} />
                  Bank File
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Stat Cards */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total Employees', value: run.total_employees, color: '#534AB7', format: 'number' as const, icon: Users },
              { label: 'Gross Salary', value: run.total_gross, color: '#2563EB', format: 'lkr' as const, icon: DollarSign },
              { label: 'Total Deductions', value: (run.total_gross || 0) - (run.total_net || 0), color: '#EF4444', format: 'lkr' as const, icon: TrendingDown },
              { label: 'Net Payable', value: run.total_net, color: '#10B981', format: 'lkr' as const, icon: Banknote },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-[#F1F0F4] shadow-sm p-4 flex items-center gap-4">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: s.color + '15' }}>
                  <s.icon size={16} style={{ color: s.color }} strokeWidth={2} />
                </div>
                <div>
                  <div className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-wider">{s.label}</div>
                  <div className="text-[18px] font-black text-[#1A1727]">
                    {s.format === 'lkr' ? `LKR ${s.value?.toLocaleString()}` : s.value}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Payroll Items Table */}
          {items.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#F1F0F4] shadow-sm p-12 text-center">
              <p className="text-[#9CA3AF] font-bold text-sm mb-4">No payroll items found. Please process payroll first.</p>
              <Link
                href={`/payroll/${run.id}/process`}
                className="inline-flex items-center gap-2 px-5 py-2 bg-[#534AB7] text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-md shadow-purple-900/20 hover:bg-[#1E1854] transition-all"
              >
                Process Payroll
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[#F1F0F4] shadow-sm overflow-hidden mb-6 animate-in fade-in duration-500">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-[#F8F7F9] text-left text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest border-b border-[#F1F0F4]">
                      <th className="px-6 py-4">Employee</th>
                      <th className="px-6 py-4">Attendance</th>
                      <th className="px-6 py-4">Overtime</th>
                      <th className="px-6 py-4">Gross</th>
                      <th className="px-6 py-4">EPF (8%)</th>
                      <th className="px-6 py-4">PAYE</th>
                      <th className="px-6 py-4 text-red-600">Other Ded.</th>
                      <th className="px-6 py-4">Net Salary</th>
                      <th className="px-6 py-4">Bank</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F0F4]">
                    {items.map((item) => {
                      const otherDeductions = Math.max(0, item.total_deductions - item.epf_employee - item.paye_tax);
                      const initials = item.employee_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                      return (
                        <tr key={item.id} className="hover:bg-[#F8F7F9] transition-all">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#F3E8FF] border-2 border-white flex items-center justify-center text-[#534AB7] font-black text-[10px]">
                                {initials}
                              </div>
                              <div>
                                <div className="text-[13px] font-black text-[#1A1727]">{item.employee_name}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-[12px] font-bold text-[#1A1727]">{item.days_worked} days</div>
                            <div className="text-[10px] text-[#9CA3AF]">Leave: {item.days_on_leave} · Absent: {item.days_absent}</div>
                          </td>
                          <td className="px-6 py-4">
                            {item.overtime_hours > 0 ? (
                              <>
                                <div className="text-[12px] font-bold text-[#534AB7]">{item.overtime_hours}h</div>
                                <div className="text-[10px] text-[#9CA3AF]">+{item.overtime_amount.toLocaleString()}</div>
                              </>
                            ) : <span className="text-[#D1D5DB] font-black text-[10px]">—</span>}
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-[12px] font-black text-[#2563EB]">LKR {item.gross_salary.toLocaleString()}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-[12px] font-bold text-[#EF4444]">-{item.epf_employee.toLocaleString()}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-[12px] font-bold text-[#EF4444]">-{item.paye_tax.toLocaleString()}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-[12px] font-bold text-[#EF4444]">
                              {otherDeductions > 0 ? `-${otherDeductions.toLocaleString()}` : <span className="text-[#D1D5DB]">—</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-[12px] font-black text-[#10B981]">LKR {item.net_salary.toLocaleString()}</div>
                          </td>
                          <td className="px-6 py-4">
                            {item.bank_account ? (
                              <>
                                <div className="text-[11px] font-bold text-[#374151]">{item.bank_name}</div>
                                <div className="text-[10px] font-mono text-[#9CA3AF]">{item.bank_account}</div>
                              </>
                            ) : (
                              <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Not Set</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Statutory Summary */}
          {items.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              {[
                {
                  label: 'EPF Summary', color: '#2563EB',
                  rows: [
                    { label: 'Employee (8%)', value: run.total_epf_employee },
                    { label: 'Employer (12%)', value: run.total_epf_employer || (run.total_gross * 0.12) },
                    { label: 'Total EPF', value: (run.total_epf_employee || 0) + (run.total_epf_employer || (run.total_gross * 0.12)), bold: true },
                  ]
                },
                {
                  label: 'ETF Summary', color: '#10B981',
                  rows: [
                    { label: 'Employer (3%)', value: run.total_etf || (run.total_gross * 0.03) },
                  ]
                },
                {
                  label: 'PAYE Tax Summary', color: '#534AB7',
                  rows: [
                    { label: 'Total PAYE', value: run.total_paye },
                  ]
                },
              ].map(card => (
                <div key={card.label} className="bg-white rounded-xl border border-[#F1F0F4] shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: card.color + '15' }}>
                      <DollarSign size={14} style={{ color: card.color }} strokeWidth={2.5} />
                    </div>
                    <div className="text-[11px] font-black text-[#1A1727] uppercase tracking-widest">{card.label}</div>
                  </div>
                  <div className="space-y-2">
                    {card.rows.map((row: { label: string; value: number | undefined; bold?: boolean }) => (
                      <div key={row.label} className={`flex justify-between items-center text-[12px] ${row.bold ? 'pt-2 border-t border-[#F1F0F4] font-black text-[#1A1727]' : 'font-medium text-[#6B7280]'}`}>
                        <span>{row.label}</span>
                        <span style={!row.bold ? { color: card.color } : {}}>LKR {row.value?.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
