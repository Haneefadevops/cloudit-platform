'use client'

import { useEffect, useState } from 'react'
import { EmployeeLayout } from '@/components/employee-layout'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { Download, FileText, ChevronLeft, ChevronRight, DollarSign, PieChart, TrendingUp, Building2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

interface PayrollItem {
  id: string
  basic_salary: number
  days_worked: number
  days_on_leave: number
  days_absent: number
  total_days_in_month: number
  overtime_hours: number
  overtime_amount: number
  gross_salary: number
  epf_employee: number
  epf_employer: number
  etf: number
  paye_tax: number
  total_deductions: number
  net_salary: number
  earnings_json: { component_name: string; amount: number }[] | null
  deductions_json: { component_name: string; amount: number }[] | null
  payroll_runs: {
    month: number
    year: number
    status: string
    finalized_at: string | null
  }
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export default function PayslipsPage() {
  const { userId, isLoaded } = useAuth()
  const [payslips, setPayslips] = useState<PayrollItem[]>([])
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    if (isLoaded && userId) {
      loadEmployeeAndPayslips()
    }
  }, [isLoaded, userId])

  const loadEmployeeAndPayslips = async () => {
    try {
      const { data: emp } = await supabase.from('employees').select('id').eq('user_id', userId).single()
      if (emp) {
        const { data } = await supabase
          .from('payroll_items')
          .select('*, payroll_runs(*)')
          .eq('employee_id', emp.id)
          .order('created_at', { ascending: false })
        setPayslips(data || [])
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    if (!p) { toast.error('No payslip to download'); return }
    const content = `
PAYSLIP - ${MONTHS[p.payroll_runs.month - 1]} ${p.payroll_runs.year}
${'='.repeat(60)}

EARNINGS
Basic Salary:                 LKR ${p.basic_salary.toLocaleString()}
Overtime (${p.overtime_hours}h):           LKR ${p.overtime_amount.toLocaleString()}
${'-'.repeat(60)}
Gross Salary:                 LKR ${p.gross_salary.toLocaleString()}

ATTENDANCE
Days in Month:                ${p.total_days_in_month}
Days Worked:                  ${p.days_worked}
Days on Leave:                ${p.days_on_leave}
Days Absent:                  ${p.days_absent}

DEDUCTIONS
EPF Employee (8%):            LKR ${p.epf_employee.toLocaleString()}
PAYE Tax:                     LKR ${p.paye_tax.toLocaleString()}
${'-'.repeat(60)}
Total Deductions:             LKR ${p.total_deductions.toLocaleString()}

EMPLOYER CONTRIBUTIONS
EPF Employer (12%):           LKR ${(p.epf_employer || 0).toLocaleString()}
ETF (3%):                     LKR ${(p.etf || 0).toLocaleString()}

${'='.repeat(60)}
NET SALARY:                   LKR ${p.net_salary.toLocaleString()}
${'='.repeat(60)}

Generated: ${new Date().toLocaleString()}
    `.trim()
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payslip_${p.payroll_runs.year}_${p.payroll_runs.month}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Payslip downloaded')
  }

  const p = payslips[currentIndex]

  // Earnings from JSON or fallback
  const earnings = p?.earnings_json && Array.isArray(p.earnings_json) && p.earnings_json.length > 0
    ? p.earnings_json
    : [
        { component_name: 'Basic Salary', amount: p?.basic_salary || 0 },
        { component_name: 'Overtime Pay', amount: p?.overtime_amount || 0 },
      ].filter(e => e.amount > 0)

  // Deductions from JSON or fallback
  const deductions = p?.deductions_json && Array.isArray(p.deductions_json) && p.deductions_json.length > 0
    ? p.deductions_json
    : [
        { component_name: 'EPF Employee (8%)', amount: p?.epf_employee || 0 },
        { component_name: 'PAYE Tax', amount: p?.paye_tax || 0 },
      ].filter(d => d.amount > 0)

  return (
    <EmployeeLayout showGreeting={false} title="Payslips" hideHeader>
      <div className="flex flex-col min-h-screen bg-[#F8F7F9] font-['Plus_Jakarta_Sans'] pb-24">
        
        {/* Month Selector */}
        <div className="bg-[#1E1854] px-4 pt-4 pb-12">
          <div className="flex justify-between items-center mb-6">
            <span className="text-white font-extrabold text-lg">My Payslip</span>
            <button onClick={handleDownload} className="text-white/60 p-2" title="Download payslip"><Download size={20} /></button>
          </div>

          <div className="flex items-center justify-between bg-white/10 rounded-2xl p-4 border border-white/5">
            <button 
              disabled={currentIndex >= payslips.length - 1}
              onClick={() => setCurrentIndex(currentIndex + 1)}
              className="text-white/40 disabled:opacity-0"
            >
              <ChevronLeft size={24} />
            </button>
            <div className="text-center">
              <div className="text-white font-black text-lg">{p ? MONTHS[p.payroll_runs.month - 1] : 'No Data'}</div>
              <div className="text-white/40 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">{p?.payroll_runs.year || '—'}</div>
            </div>
            <button 
              disabled={currentIndex <= 0}
              onClick={() => setCurrentIndex(currentIndex - 1)}
              className="text-white/40 disabled:opacity-0"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </div>

        {/* Payslip Content */}
        <div className="px-4 -mt-6 space-y-4">
          
          {loading ? (
            <div className="bg-white rounded-[32px] p-12 text-center text-[#9CA3AF]">Loading payslip...</div>
          ) : !p ? (
            <div className="bg-white rounded-[32px] p-12 text-center text-[#9CA3AF] italic">No payslip data found for this period.</div>
          ) : (
            <>
              {/* Summary Card */}
              <div className="bg-white rounded-[32px] p-6 shadow-lg shadow-purple-900/5 border border-[#F1F0F4]">
                <div className="flex flex-col items-center text-center">
                  <div className="text-[11px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2">Net Salary Disbursed</div>
                  <div className="text-4xl font-black text-[#1A1727] tracking-tighter mb-4">LKR {p.net_salary.toLocaleString()}</div>
                  <div className="px-4 py-1.5 bg-emerald-50 rounded-full border border-emerald-100 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Paid on {p.payroll_runs.finalized_at ? new Date(p.payroll_runs.finalized_at).toLocaleDateString() : '—'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-8 pt-8 border-t border-[#F8F7F9]">
                  <div>
                    <div className="text-[10px] font-black text-[#D1D5DB] uppercase tracking-widest mb-1 text-center">Gross Salary</div>
                    <div className="text-[15px] font-black text-[#374151] text-center">LKR {p.gross_salary.toLocaleString()}</div>
                  </div>
                  <div className="border-l border-[#F8F7F9]">
                    <div className="text-[10px] font-black text-[#D1D5DB] uppercase tracking-widest mb-1 text-center">Total Deductions</div>
                    <div className="text-[15px] font-black text-red-500 text-center">-LKR {p.total_deductions.toLocaleString()}</div>
                  </div>
                </div>
              </div>

              {/* Earnings Section */}
              <div className="bg-white rounded-3xl border border-[#F1F0F4] p-6 space-y-3 shadow-sm">
                <h3 className="text-[12px] font-black text-[#1A1727] uppercase tracking-wider flex items-center gap-2 mb-2">
                  <TrendingUp size={14} className="text-emerald-500" /> Earnings
                </h3>
                {earnings.map((e, i) => (
                  <div key={i} className="flex justify-between items-center py-1 border-b border-[#F8F7F9] last:border-0">
                    <span className="text-[13px] font-bold text-[#374151]">{e.component_name}</span>
                    <span className="text-[13px] font-black text-[#1A1727]">LKR {e.amount.toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2">
                  <span className="text-[13px] font-black text-[#1A1727]">Gross Total</span>
                  <span className="text-[14px] font-black text-[#1A1727]">LKR {p.gross_salary.toLocaleString()}</span>
                </div>
              </div>

              {/* Deductions Section */}
              <div className="bg-white rounded-3xl border border-[#F1F0F4] p-6 space-y-3 shadow-sm">
                <h3 className="text-[12px] font-black text-[#1A1727] uppercase tracking-wider flex items-center gap-2 mb-2">
                  <PieChart size={14} className="text-red-500" /> Deductions
                </h3>
                {deductions.map((d, i) => (
                  <div key={i} className="flex justify-between items-center py-1 border-b border-[#F8F7F9] last:border-0">
                    <span className="text-[13px] font-bold text-red-500">{d.component_name}</span>
                    <span className="text-[13px] font-black text-red-500">-LKR {d.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>

              {/* Net Pay Bar */}
              <div className="bg-[#1E1854] rounded-2xl p-5 flex justify-between items-center">
                <span className="text-[14px] font-black text-white">Net Pay</span>
                <span className="text-[22px] font-black text-white">LKR {p.net_salary.toLocaleString()}</span>
              </div>

              {/* Employer Contributions */}
              {(p.epf_employer > 0 || p.etf > 0) && (
                <div className="bg-white rounded-3xl border border-[#F1F0F4] p-6 space-y-3 shadow-sm">
                  <h3 className="text-[12px] font-black text-[#1A1727] uppercase tracking-wider flex items-center gap-2 mb-2">
                    <Building2 size={14} className="text-blue-500" /> Employer Contributions
                  </h3>
                  {p.epf_employer > 0 && (
                    <div className="flex justify-between items-center py-1 border-b border-[#F8F7F9]">
                      <span className="text-[13px] font-bold text-[#374151]">EPF Employer (12%)</span>
                      <span className="text-[13px] font-black text-blue-600">LKR {p.epf_employer.toLocaleString()}</span>
                    </div>
                  )}
                  {p.etf > 0 && (
                    <div className="flex justify-between items-center py-1">
                      <span className="text-[13px] font-bold text-[#374151]">ETF (3%)</span>
                      <span className="text-[13px] font-black text-green-600">LKR {p.etf.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Past Payslips */}
              {payslips.length > 1 && (
                <div className="pt-2">
                  <h3 className="text-[12px] font-black text-[#374151] uppercase tracking-wider mb-3">Past Payslips</h3>
                  <div className="space-y-2">
                    {payslips.filter((_, i) => i !== currentIndex).map((past, i) => (
                      <button
                        key={past.id}
                        onClick={() => setCurrentIndex(payslips.findIndex(ps => ps.id === past.id))}
                        className="w-full bg-white rounded-2xl p-4 border border-[#F1F0F4] flex justify-between items-center active:scale-[0.98] transition-all"
                      >
                        <span className="text-[13px] font-semibold text-[#374151]">
                          {MONTHS[past.payroll_runs.month - 1]} {past.payroll_runs.year}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-[13px] font-black text-[#1A1727]">LKR {past.net_salary.toLocaleString()}</span>
                          <ChevronRight size={16} className="text-[#534AB7]" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </EmployeeLayout>
  )
}
