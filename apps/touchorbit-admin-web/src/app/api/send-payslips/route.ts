import { NextRequest, NextResponse } from 'next/server'
import { sendBulkPayslipEmails } from '@/lib/email'
import { verifyPermission } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

type PayslipEmail = {
  to: string
  employeeName: string
  month: string
  year: number
  grossSalary: number
  netSalary: number
  totalDeductions: number
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export async function POST(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  try {
    // SECURITY: Verify the requester can send payroll emails
    const auth = await verifyPermission(request, 'payroll.send_payslips')
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { payrollRunId } = await request.json()

    if (!payrollRunId) {
      return NextResponse.json(
        { error: 'Payroll run ID is required' },
        { status: 400 }
      )
    }

    const { data: run, error: runError } = await supabaseAdmin
      .from('payroll_runs')
      .select('id, organization_id, month, year')
      .eq('id', payrollRunId)
      .eq('organization_id', auth.profile.organization_id)
      .single()

    if (runError || !run) {
      return NextResponse.json(
        { error: 'Payroll run not found in your organization' },
        { status: 404 }
      )
    }

    const { data: items, error: itemsError } = await supabaseAdmin
      .from('payroll_items')
      .select(`
        employee_id,
        gross_salary,
        net_salary,
        total_deductions,
        employees!inner (
          email,
          first_name,
          last_name,
          organization_id
        )
      `)
      .eq('payroll_run_id', payrollRunId)
      .eq('organization_id', auth.profile.organization_id)
      .eq('employees.organization_id', auth.profile.organization_id)

    if (itemsError) {
      console.error('Error loading payslip data:', itemsError)
      return NextResponse.json(
        { error: 'Failed to load payslip data' },
        { status: 500 }
      )
    }

    const payslips = (items || [])
      .map((item: any) => {
        const employee = Array.isArray(item.employees) ? item.employees[0] : item.employees
        if (!employee?.email) return null
        return {
          to: employee.email,
          employeeName: `${employee.first_name} ${employee.last_name}`,
          month: MONTHS[run.month - 1],
          year: run.year,
          grossSalary: Number(item.gross_salary || 0),
          netSalary: Number(item.net_salary || 0),
          totalDeductions: Number(item.total_deductions || 0),
        }
      })
      .filter((p): p is PayslipEmail => p != null)

    if (payslips.length === 0) {
      return NextResponse.json(
        { error: 'No employees with email addresses found' },
        { status: 400 }
      )
    }

    const result = await sendBulkPayslipEmails(payslips)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in send-payslips API:', error)
    return NextResponse.json(
      { error: 'Failed to send emails' },
      { status: 500 }
    )
  }
}
