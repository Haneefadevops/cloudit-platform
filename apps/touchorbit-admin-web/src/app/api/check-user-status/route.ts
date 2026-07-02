import { NextRequest, NextResponse } from 'next/server'
import { verifyPermission } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  try {
    // SECURITY: Verify the requester can read employee auth status
    const auth = await verifyPermission(request, 'employees.read_auth_status')
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
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

    // Get user from Supabase Auth Admin API
    const { data: user, error } = await supabaseAdmin.auth.admin.getUserById(userId)

    if (error) {
      console.error('Error fetching user:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Check if user is banned
    const banned = user.user?.banned_until ? new Date(user.user.banned_until) > new Date() : false

    return NextResponse.json({ banned })
  } catch (error: any) {
    console.error('Check user status error:', error)
    return NextResponse.json({ error: error.message || 'Failed to check user status' }, { status: 500 })
  }
}
