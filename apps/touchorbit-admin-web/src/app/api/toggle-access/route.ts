import { NextRequest, NextResponse } from 'next/server'
import { verifyPermission } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  try {
    // SECURITY: Verify the requester can manage employee app access
    const auth = await verifyPermission(request, 'employees.manage_app_access')
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { userId, suspend } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Verify the target user belongs to the same organization
    const { data: targetUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('organization_id')
      .eq('id', userId)
      .single()

    if (userError || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (targetUser.organization_id !== auth.profile.organization_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Update user's banned_until field
    if (suspend) {
      // Suspend indefinitely
      const { error } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { ban_duration: '876000h' } // ~100 years = permanent ban
      )

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }
    } else {
      // Remove ban
      const { error } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { ban_duration: 'none' }
      )

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }
    }

    // Log to employee_history (if table exists)
    const { data: employee } = await supabaseAdmin
      .from('employees')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (employee) {
      await supabaseAdmin
        .from('employee_history')
        .insert({
          employee_id: employee.id,
          event_type: suspend ? 'auth_suspended' : 'auth_reactivated',
          description: suspend ? 'App access suspended' : 'App access restored',
          changed_by: null, // TODO: Get from session
          changed_by_name: 'Admin'
        })
    }

    return NextResponse.json({
      success: true,
      message: suspend ? 'Access suspended' : 'Access restored'
    })

  } catch (error: any) {
    console.error('Error in toggle-access API:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to toggle access' },
      { status: 500 }
    )
  }
}
