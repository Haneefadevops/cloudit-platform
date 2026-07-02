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

    const { userId, newPassword, forcePasswordChange } = await request.json()

    if (!userId || !newPassword) {
      return NextResponse.json(
        { error: 'User ID and new password required' },
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
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    if (targetUser.organization_id !== auth.profile.organization_id) {
      return NextResponse.json(
        { error: 'Forbidden: User belongs to another organization' },
        { status: 403 }
      )
    }

    // Update user password using Admin API
    const { data: user, error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        password: newPassword,
        user_metadata: {
          force_password_change: forcePasswordChange || false
        }
      }
    )

    if (error) {
      console.error('Error resetting password:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, user })
  } catch (error: any) {
    console.error('Reset password error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to reset password' },
      { status: 500 }
    )
  }
}
