import { supabase } from './supabase'

// Notify all admins in the organization
export async function notifyAdmins(
  orgId: string,
  type: string,
  title: string,
  message: string
) {
  try {
    const { data: admins } = await supabase
      .from('users')
      .select('id')
      .eq('organization_id', orgId)
      .in('role', ['owner', 'super_admin', 'admin', 'manager', 'hr_admin', 'dept_manager', 'branch_manager'])

    if (!admins?.length) return

    await supabase.from('notifications').insert(
      admins.map(a => ({
        organization_id: orgId,
        user_id: a.id,
        type,
        title,
        message,
      }))
    )
  } catch (e) {
    console.error('notifyAdmins failed:', e)
  }
}
