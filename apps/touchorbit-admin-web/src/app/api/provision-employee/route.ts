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

    const {
      employeeId,
      email,
      password,
      forceReset,
      systemRole = 'employee',
      permissionGroupIds = [],
      permissionGroupNames = [],
      scopeType = 'organization',
      scopeId = null,
    } = await request.json()

    if (!employeeId || !email || !password) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const allowedRoles = ['owner', 'super_admin', 'admin', 'manager', 'employee']
    const requestedRole = allowedRoles.includes(systemRole) ? systemRole : 'employee'
    const allowedScopes = ['organization', 'branch', 'department', 'team', 'self']
    const requestedScope = allowedScopes.includes(scopeType) ? scopeType : 'organization'

    // 1. Get employee details
    const { data: employee, error: empError } = await supabaseAdmin
      .from('employees')
      .select('id, organization_id, first_name, last_name')
      .eq('id', employeeId)
      .eq('organization_id', auth.profile.organization_id) // Ensure same org
      .single()

    if (empError || !employee) {
      return NextResponse.json(
        { error: 'Employee not found in your organization' },
        { status: 404 }
      )
    }

    // 2. Create Supabase Auth account
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Skip email confirmation
      user_metadata: {
        force_password_change: forceReset,
        employee_id: employeeId,
        first_name: employee.first_name,
        last_name: employee.last_name
      }
    })

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      )
    }

    // 3. Create users record
    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        organization_id: employee.organization_id,
        email,
        first_name: employee.first_name,
        last_name: employee.last_name,
        role: requestedRole
      })

    if (userError && userError.code !== '23505') { // Ignore duplicate key error
      console.error('Error creating user record:', userError)
    }

    // 4a. Assign security role and permission groups for Phase 4 onboarding.
    await supabaseAdmin
      .from('user_security_roles')
      .upsert({
        organization_id: employee.organization_id,
        user_id: authData.user.id,
        system_role: requestedRole,
        created_by: auth.user.id,
        updated_at: new Date().toISOString()
      }, { onConflict: 'organization_id,user_id' })

    let groupIds: string[] = Array.isArray(permissionGroupIds) ? permissionGroupIds.filter(Boolean) : []
    const groupNames: string[] = Array.isArray(permissionGroupNames) ? permissionGroupNames.filter(Boolean) : []

    if (groupNames.length > 0) {
      const { data: groups } = await supabaseAdmin
        .from('permission_groups')
        .select('id, name')
        .or(`organization_id.eq.${employee.organization_id},organization_id.is.null`)
        .in('name', groupNames)

      groupIds = [...groupIds, ...(groups || []).map((group) => group.id)]
    }

    const uniqueGroupIds = Array.from(new Set(groupIds))
    if (uniqueGroupIds.length > 0) {
      const assignments = uniqueGroupIds.map((groupId) => ({
        organization_id: employee.organization_id,
        user_id: authData.user.id,
        group_id: groupId,
        scope_type: requestedScope,
        scope_id: requestedScope === 'organization' || requestedScope === 'self' ? null : scopeId,
        created_by: auth.user.id,
      }))

      const { error: assignmentError } = await supabaseAdmin
        .from('user_permission_groups')
        .insert(assignments)

      if (assignmentError) {
        console.error('Error assigning permission groups:', assignmentError)
      }
    }

    // 5. Link employee to auth user
    const { error: linkError } = await supabaseAdmin
      .from('employees')
      .update({ user_id: authData.user.id })
      .eq('id', employeeId)

    if (linkError) {
      return NextResponse.json(
        { error: 'Failed to link employee to auth account' },
        { status: 500 }
      )
    }

    // 6. Log to employee_history (if table exists)
    await supabaseAdmin
      .from('employee_history')
      .insert({
        employee_id: employeeId,
        event_type: 'auth_provisioned',
        description: `App access enabled as ${requestedRole}`,
        details: { system_role: requestedRole, permission_group_ids: uniqueGroupIds, scope_type: requestedScope, scope_id: scopeId },
        changed_by: auth.user.id,
        changed_by_name: auth.user.email || 'Admin'
      })

    await supabaseAdmin
      .from('security_audit_log')
      .insert({
        organization_id: employee.organization_id,
        actor_user_id: auth.user.id,
        target_user_id: authData.user.id,
        target_employee_id: employeeId,
        action: 'employees.provision_access',
        entity_type: 'user',
        entity_id: authData.user.id,
        new_value: { system_role: requestedRole, permission_group_ids: uniqueGroupIds, scope_type: requestedScope, scope_id: scopeId }
      })

    return NextResponse.json({
      success: true,
      userId: authData.user.id
    })

  } catch (error: any) {
    console.error('Error in provision-employee API:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to provision employee' },
      { status: 500 }
    )
  }
}
