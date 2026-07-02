import { NextRequest, NextResponse } from 'next/server'
import { verifyPermission } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  try {
    // SECURITY: Verify the requester can terminate employees
    const auth = await verifyPermission(request, 'employees.terminate')
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { 
      employeeId, 
      terminationDate, 
      lastWorkingDay, 
      reason, 
      suspendAccess,
      adminId 
    } = await request.json()

    if (!employeeId || !terminationDate || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // 1. Get employee to find user_id and verify organization
    const { data: employee, error: empError } = await supabaseAdmin
      .from('employees')
      .select('user_id, organization_id')
      .eq('id', employeeId)
      .eq('organization_id', auth.profile.organization_id) // Ensure same org
      .single()

    if (empError || !employee) {
      return NextResponse.json(
        { error: 'Employee not found in your organization' },
        { status: 404 }
      )
    }

    // 2. Call the terminate_employee RPC
    // Note: The RPC handles the DB side (employment_status, history, etc.)
    const { error: rpcError } = await supabaseAdmin.rpc('terminate_employee', {
      p_employee_id: employeeId,
      p_termination_date: terminationDate,
      p_last_working_day: lastWorkingDay,
      p_reason: reason,
      p_terminated_by: adminId
    })

    if (rpcError) {
      console.error('RPC Error:', rpcError)
      return NextResponse.json(
        { error: rpcError.message },
        { status: 500 }
      )
    }

    // 3. Suspend Auth Access if requested
    if (suspendAccess && employee.user_id) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        employee.user_id,
        { ban_duration: '876000h' } // ~100 years
      )

      if (authError) {
        console.error('Auth Suspension Error:', authError)
        // We don't fail the whole request because the DB part succeeded
      }
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Error in terminate-employee API:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to terminate employee' },
      { status: 500 }
    )
  }
}
