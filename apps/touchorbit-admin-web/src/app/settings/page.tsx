'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/lib/auth'
import { usePermissions } from '@/hooks/use-permissions'
import { supabase } from '@/lib/supabase'
import { Building2, Clock, Calendar, MapPin, Camera, Save, Shield, DollarSign, Plus, Edit2, X, RefreshCw, Users, Video, Bell } from 'lucide-react'
import { toast } from 'sonner'
import { OvertimePolicySettingsComponent } from '@/components/overtime-policy-settings'
import { MeetingProvidersSettings } from '@/components/settings/MeetingProvidersSettings'
import { NotificationPreferences } from '@/components/settings/NotificationPreferences'

interface OrganizationSettings {
  name: string
  timezone: string
  work_hours_start: string
  work_hours_end: string
  grace_period_minutes: number
  require_selfie: boolean
  require_geofence: boolean
  late_threshold_minutes: number
  annual_leave_days: number
  casual_leave_days: number
  sick_leave_days: number
  // GPS Anti-Spoofing (Sprint 2)
  expected_timezone_offset: number | null
  timezone_tolerance_minutes: number
  strict_location_mode: boolean
  // Carry-Forward & Encashment (Sprint 3)
  carry_forward_enabled?: boolean
  carry_forward_limit?: number
  encashment_allowed?: boolean
  encashment_max_days?: number
  comp_off_expiry_months?: number
}

function ExpensePolicyRow({ category, policy, inheritedPolicy, onSave, isSaving }: { 
  category: any, 
  policy: any, 
  inheritedPolicy?: any,
  onSave: (data: any) => void,
  isSaving: boolean
}) {
  const [formData, setFormData] = useState({
    limit_per_claim: policy?.limit_per_claim ?? '',
    limit_per_month: policy?.limit_per_month ?? '',
    receipt_required: policy?.receipt_required ?? false,
    auto_approve_below: policy?.auto_approve_below ?? '',
  })

  useEffect(() => {
    setFormData({
      limit_per_claim: policy?.limit_per_claim ?? '',
      limit_per_month: policy?.limit_per_month ?? '',
      receipt_required: policy?.receipt_required ?? false,
      auto_approve_below: policy?.auto_approve_below ?? '',
    })
  }, [policy])

  const hasChanges = 
    formData.limit_per_claim !== (policy?.limit_per_claim ?? '') ||
    formData.limit_per_month !== (policy?.limit_per_month ?? '') ||
    formData.receipt_required !== (policy?.receipt_required ?? false) ||
    formData.auto_approve_below !== (policy?.auto_approve_below ?? '')

  return (
    <tr className="hover:bg-[#F8F7F9]/50 transition-colors">
      <td className="px-6 py-4">
        <span className="font-bold text-[#1A1727]">{category.name}</span>
        <p className="text-[10px] text-[#9CA3AF] truncate max-w-[150px]">{category.description}</p>
      </td>
      <td className="px-6 py-4">
        <div className="relative">
          <input
            type="number"
            value={formData.limit_per_claim}
            onChange={(e) => setFormData({ ...formData, limit_per_claim: e.target.value === '' ? '' : parseFloat(e.target.value) })}
            className="w-28 px-3 py-1.5 bg-[#F8F7F9] border border-[#F1F0F4] rounded-lg text-sm font-bold focus:ring-2 focus:ring-[#534AB7] outline-none"
            placeholder={inheritedPolicy?.limit_per_claim ? `${inheritedPolicy.limit_per_claim}` : "No limit"}
          />
        </div>
      </td>
      <td className="px-6 py-4">
        <input
          type="number"
          value={formData.limit_per_month}
          onChange={(e) => setFormData({ ...formData, limit_per_month: e.target.value === '' ? '' : parseFloat(e.target.value) })}
          className="w-28 px-3 py-1.5 bg-[#F8F7F9] border border-[#F1F0F4] rounded-lg text-sm font-bold focus:ring-2 focus:ring-[#534AB7] outline-none"
          placeholder={inheritedPolicy?.limit_per_month ? `${inheritedPolicy.limit_per_month}` : "No limit"}
        />
      </td>
      <td className="px-4 py-4 text-center">
        <input
          type="checkbox"
          checked={formData.receipt_required}
          onChange={(e) => setFormData({ ...formData, receipt_required: e.target.checked })}
          className="w-4 h-4 text-purple-600 border-[#F1F0F4] rounded focus:ring-[#534AB7]"
        />
        {inheritedPolicy?.receipt_required && !policy && (
          <span className="ml-2 text-[8px] text-[#9CA3AF] uppercase font-black">Inherited</span>
        )}
      </td>
      <td className="px-6 py-4">
        <input
          type="number"
          value={formData.auto_approve_below}
          onChange={(e) => setFormData({ ...formData, auto_approve_below: e.target.value === '' ? '' : parseFloat(e.target.value) })}
          className="w-28 px-3 py-1.5 bg-[#F8F7F9] border border-[#F1F0F4] rounded-lg text-sm font-bold focus:ring-2 focus:ring-[#534AB7] outline-none"
          placeholder={inheritedPolicy?.auto_approve_below ? `${inheritedPolicy.auto_approve_below}` : "Manual"}
        />
      </td>
      <td className="px-6 py-4 text-right">
        <button
          onClick={() => onSave(formData)}
          disabled={!hasChanges || isSaving}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
            hasChanges 
              ? 'bg-purple-600 text-white shadow-md hover:bg-[#1E1854] active:scale-95' 
              : 'bg-[#F1F0F4] text-[#9CA3AF] cursor-default'
          }`}
        >
          {isSaving ? '...' : 'Save'}
        </button>
      </td>
    </tr>
  )
}

export default function SettingsPage() {
  const { organizationId, userId, isOwner, role } = useAuth()
  const { can: canCurrentUser, loading: permissionLoading } = usePermissions(['settings.manage_roles'])
  const canManageSecurity = permissionLoading ? (isOwner || role === 'super_admin') : canCurrentUser('settings.manage_roles')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'organization' | 'attendance' | 'leave' | 'overtime' | 'branches' | 'departments' | 'expense_policy' | 'security' | 'integrations' | 'notifications'>('organization')
  
  // Branch Management State
  const [branches, setBranches] = useState<any[]>([])
  const [showBranchDialog, setShowBranchDialog] = useState(false)
  const [editingBranch, setEditingBranch] = useState<any>(null)
  const [branchForm, setBranchForm] = useState({ name: '', code: '', city: '', address: '' })

  // Department Management State
  const [departments, setDepartments] = useState<any[]>([])
  const [showDepartmentDialog, setShowDepartmentDialog] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState<any>(null)
  const [departmentForm, setDepartmentForm] = useState({ name: '', code: '', branch_id: '' })

  // Policy Sync State
  const [showSyncDialog, setShowSyncDialog] = useState(false)
  const [syncLoading, setSyncLoading] = useState(false)

  // Expense Policy State
  const [expenseCategories, setExpenseCategories] = useState<any[]>([])
  const [expensePolicies, setExpensePolicies] = useState<any[]>([])
  const [activePolicyTab, setActivePolicyTab] = useState<'organization' | 'branch' | 'department' | 'employee'>('organization')
  const [selectedScopeId, setSelectedScopeId] = useState<string | null>(null)
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [foundEmployees, setFoundEmployees] = useState<any[]>([])
  const [policySaving, setPolicySaving] = useState<string | null>(null)

  // Approval Chain State
  const [approvalConfig, setApprovalConfig] = useState({
    auto_approve_below: 1000,
    level1_min_amount: 1000,
    level2_min_amount: 10000,
    level3_min_amount: 50000,
    parallel_approval: false,
    skip_if_no_manager: true
  })
  const [approvalLoading, setApprovalLoading] = useState(false)
  const [approvalSaving, setApprovalSaving] = useState(false)

  const [leaveApprovalConfig, setLeaveApprovalConfig] = useState({
    auto_approve_below_days: 1,
    level1_min_days: 1,
    level2_min_days: 3,
    level3_min_days: 14,
    parallel_approval: false,
    skip_if_no_manager: true
  })
  const [leaveApprovalLoading, setLeaveApprovalLoading] = useState(false)
  const [leaveApprovalSaving, setLeaveApprovalSaving] = useState(false)

  const [overtimeApprovalConfig, setOvertimeApprovalConfig] = useState({
    auto_approve_below_hours: 2,
    level1_min_hours: 2,
    level2_min_hours: 4,
    level3_min_hours: 8,
    parallel_approval: false,
    skip_if_no_manager: true
  })
  const [overtimeApprovalLoading, setOvertimeApprovalLoading] = useState(false)
  const [overtimeApprovalSaving, setOvertimeApprovalSaving] = useState(false)

  const [securityLoading, setSecurityLoading] = useState(false)
  const [securityUsers, setSecurityUsers] = useState<any[]>([])
  const [securityRoles, setSecurityRoles] = useState<any[]>([])
  const [permissions, setPermissions] = useState<any[]>([])
  const [permissionGroups, setPermissionGroups] = useState<any[]>([])
  const [groupPermissions, setGroupPermissions] = useState<any[]>([])
  const [userPermissionGroups, setUserPermissionGroups] = useState<any[]>([])
  const [securityAuditLog, setSecurityAuditLog] = useState<any[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const [groupForm, setGroupForm] = useState({ name: '', description: '' })
  const [assignUserId, setAssignUserId] = useState('')
  const [assignGroupId, setAssignGroupId] = useState('')
  const [assignScopeType, setAssignScopeType] = useState<'organization' | 'branch' | 'department' | 'self'>('organization')
  const [assignScopeId, setAssignScopeId] = useState('')

  const [overtimePolicy, setOvertimePolicy] = useState({
    max_daily_hours: 4.0,
    max_weekly_hours: 12.0,
    weekday_rate: 1.5,
    weekend_rate: 2.0,
    holiday_rate: 2.5,
    requires_approval: true,
    auto_detect: true,
  })

  const [settings, setSettings] = useState<OrganizationSettings>({
    name: '',
    timezone: 'Asia/Colombo',
    work_hours_start: '09:00',
    work_hours_end: '17:00',
    grace_period_minutes: 15,
    require_selfie: false,
    require_geofence: true,
    late_threshold_minutes: 15,
    annual_leave_days: 14,
    casual_leave_days: 7,
    sick_leave_days: 7,
    expected_timezone_offset: null,
    timezone_tolerance_minutes: 60,
    strict_location_mode: false,
  })

  useEffect(() => {
    if (organizationId) {
      loadSettings()
      loadBranches()
      loadDepartments()
      loadExpenseData()
    }
  }, [organizationId])

  useEffect(() => {
    if (organizationId && activeTab === 'expense_policy') {
      loadExpensePolicies()
    }
    if (organizationId && activeTab === 'security') {
      loadSecurityData()
    }
  }, [organizationId, activeTab, activePolicyTab, selectedScopeId])

  async function loadExpenseData() {
    const { data } = await supabase
      .from('expense_categories')
      .select('*')
      .eq('organization_id', organizationId)
      .order('name')
    setExpenseCategories(data || [])
    loadApprovalConfig()
    loadLeaveApprovalConfig()
    loadOvertimeApprovalConfig()
  }

  async function loadApprovalConfig() {
    setApprovalLoading(true)
    try {
      const { data, error } = await supabase
        .from('expense_approval_config')
        .select('*')
        .eq('organization_id', organizationId)
        .single()
      
      if (data) {
        setApprovalConfig({
          auto_approve_below: Number(data.auto_approve_below),
          level1_min_amount: Number(data.level1_min_amount),
          level2_min_amount: Number(data.level2_min_amount),
          level3_min_amount: Number(data.level3_min_amount),
          parallel_approval: data.parallel_approval,
          skip_if_no_manager: data.skip_if_no_manager
        })
      }
    } catch (error) {
      console.error('Error loading approval config:', error)
    } finally {
      setApprovalLoading(false)
    }
  }

  async function loadLeaveApprovalConfig() {
    setLeaveApprovalLoading(true)
    try {
      const { data, error } = await supabase
        .from('leave_approval_config')
        .select('*')
        .eq('organization_id', organizationId)
        .single()
      
      if (data) {
        setLeaveApprovalConfig({
          auto_approve_below_days: Number(data.auto_approve_below_days),
          level1_min_days: Number(data.level1_min_days),
          level2_min_days: Number(data.level2_min_days),
          level3_min_days: Number(data.level3_min_days),
          parallel_approval: data.parallel_approval,
          skip_if_no_manager: data.skip_if_no_manager
        })
      }
    } catch (error) {
      console.error('Error loading leave approval config:', error)
    } finally {
      setLeaveApprovalLoading(false)
    }
  }

  async function loadOvertimeApprovalConfig() {
    setOvertimeApprovalLoading(true)
    try {
      const { data, error } = await supabase
        .from('overtime_approval_config')
        .select('*')
        .eq('organization_id', organizationId)
        .single()
      
      if (data) {
        setOvertimeApprovalConfig({
          auto_approve_below_hours: Number(data.auto_approve_below_hours),
          level1_min_hours: Number(data.level1_min_hours),
          level2_min_hours: Number(data.level2_min_hours),
          level3_min_hours: Number(data.level3_min_hours),
          parallel_approval: data.parallel_approval,
          skip_if_no_manager: data.skip_if_no_manager
        })
      }
    } catch (error) {
      console.error('Error loading overtime approval config:', error)
    } finally {
      setOvertimeApprovalLoading(false)
    }
  }

  async function handleSaveApprovalConfig() {
    setApprovalSaving(true)
    try {
      const { error } = await supabase
        .from('expense_approval_config')
        .upsert({
          organization_id: organizationId,
          ...approvalConfig,
          updated_at: new Date().toISOString()
        }, { onConflict: 'organization_id' })

      if (error) throw error
      toast.success('Approval chain updated')
    } catch (error) {
      console.error('Error saving approval config:', error)
      toast.error('Failed to update approval chain')
    } finally {
      setApprovalSaving(false)
    }
  }

  async function handleSaveLeaveApprovalConfig() {
    setLeaveApprovalSaving(true)
    try {
      const { error } = await supabase
        .from('leave_approval_config')
        .upsert({
          organization_id: organizationId,
          ...leaveApprovalConfig,
          updated_at: new Date().toISOString()
        }, { onConflict: 'organization_id' })

      if (error) throw error
      toast.success('Leave approval chain updated')
    } catch (error) {
      console.error('Error saving leave approval config:', error)
      toast.error('Failed to update leave approval chain')
    } finally {
      setLeaveApprovalSaving(false)
    }
  }

  async function handleSaveOvertimeApprovalConfig() {
    setOvertimeApprovalSaving(true)
    try {
      const { error } = await supabase
        .from('overtime_approval_config')
        .upsert({
          organization_id: organizationId,
          ...overtimeApprovalConfig,
          updated_at: new Date().toISOString()
        }, { onConflict: 'organization_id' })

      if (error) throw error
      toast.success('Overtime approval chain updated')
    } catch (error) {
      console.error('Error saving overtime approval config:', error)
      toast.error('Failed to update overtime approval chain')
    } finally {
      setOvertimeApprovalSaving(false)
    }
  }

  async function loadExpensePolicies() {
    const { data } = await supabase
      .from('expense_policies')
      .select('*')
      .eq('organization_id', organizationId)

    setExpensePolicies(data || [])
  }

  async function loadSecurityData() {
    setSecurityLoading(true)
    try {
      const [
        { data: users },
        { data: roles },
        { data: permissionRows },
        { data: groups },
        { data: groupPermRows },
        { data: userGroupRows },
        { data: auditRows },
      ] = await Promise.all([
        supabase.from('users').select('id, email, first_name, last_name, role').eq('organization_id', organizationId).order('first_name'),
        supabase.from('user_security_roles').select('*').eq('organization_id', organizationId),
        supabase.from('permissions').select('*').order('module').order('action'),
        supabase.from('permission_groups').select('*').or(`organization_id.eq.${organizationId},organization_id.is.null`).order('name'),
        supabase.from('permission_group_permissions').select('*'),
        supabase.from('user_permission_groups').select('*').eq('organization_id', organizationId),
        supabase.from('security_audit_log').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(30),
      ])

      setSecurityUsers(users || [])
      setSecurityRoles(roles || [])
      setPermissions(permissionRows || [])
      setPermissionGroups(groups || [])
      setGroupPermissions(groupPermRows || [])
      setUserPermissionGroups(userGroupRows || [])
      setSecurityAuditLog(auditRows || [])
      setSelectedGroupId((current) => current || groups?.[0]?.id || '')
    } catch (error) {
      console.error('Error loading security data:', error)
      toast.error('Failed to load security roles')
    } finally {
      setSecurityLoading(false)
    }
  }

  async function handleSaveSystemRole(targetUserId: string, systemRole: string) {
    if (targetUserId === userId && systemRole !== 'owner') {
      toast.error('You cannot reduce your own owner access')
      return
    }

    const legacyRole = systemRole
    const { error: roleError } = await supabase
      .from('user_security_roles')
      .upsert({
        organization_id: organizationId,
        user_id: targetUserId,
        system_role: systemRole,
        created_by: userId,
        updated_at: new Date().toISOString()
      }, { onConflict: 'organization_id,user_id' })

    if (roleError) {
      toast.error('Failed to update security role')
      return
    }

    const { error: userError } = await supabase
      .from('users')
      .update({ role: legacyRole })
      .eq('id', targetUserId)
      .eq('organization_id', organizationId)

    if (userError) {
      toast.error('Security role saved, but legacy role sync failed')
      return
    }

    toast.success('Security role updated')
    loadSecurityData()
  }

  async function handleCreatePermissionGroup() {
    if (!groupForm.name.trim()) {
      toast.error('Group name is required')
      return
    }

    const { data, error } = await supabase
      .from('permission_groups')
      .insert({
        organization_id: organizationId,
        name: groupForm.name.trim(),
        description: groupForm.description.trim() || null,
        created_by: userId,
      })
      .select('id')
      .single()

    if (error) {
      toast.error('Failed to create permission group')
      return
    }

    setGroupForm({ name: '', description: '' })
    setSelectedGroupId(data.id)
    toast.success('Permission group created')
    loadSecurityData()
  }

  async function handleToggleGroupPermission(permissionKey: string, enabled: boolean) {
    if (!selectedGroupId) return

    const selectedGroup = permissionGroups.find((group) => group.id === selectedGroupId)
    if (selectedGroup?.is_system) {
      toast.error('System groups cannot be edited')
      return
    }

    const query = supabase.from('permission_group_permissions')
    const { error } = enabled
      ? await query.insert({ group_id: selectedGroupId, permission_key: permissionKey })
      : await query.delete().eq('group_id', selectedGroupId).eq('permission_key', permissionKey)

    if (error) {
      toast.error('Failed to update group permission')
      return
    }

    loadSecurityData()
  }

  async function handleAssignPermissionGroup() {
    if (!assignUserId || !assignGroupId) {
      toast.error('Select a user and permission group')
      return
    }

    if ((assignScopeType === 'branch' || assignScopeType === 'department') && !assignScopeId) {
      toast.error('Select a scope')
      return
    }

    const { error } = await supabase.from('user_permission_groups').insert({
      organization_id: organizationId,
      user_id: assignUserId,
      group_id: assignGroupId,
      scope_type: assignScopeType,
      scope_id: assignScopeType === 'organization' || assignScopeType === 'self' ? null : assignScopeId,
      created_by: userId,
    })

    if (error) {
      toast.error('Failed to assign permission group')
      return
    }

    setAssignGroupId('')
    setAssignScopeType('organization')
    setAssignScopeId('')
    toast.success('Permission group assigned')
    loadSecurityData()
  }

  async function handleRemovePermissionGroupAssignment(assignmentId: string) {
    const { error } = await supabase.from('user_permission_groups').delete().eq('id', assignmentId)
    if (error) {
      toast.error('Failed to remove assignment')
      return
    }
    toast.success('Permission assignment removed')
    loadSecurityData()
  }

  async function searchEmployees(term: string) {
    setEmployeeSearch(term)
    if (term.length < 2) {
      setFoundEmployees([])
      return
    }
    const { data } = await supabase
      .from('employees')
      .select('id, first_name, last_name, employee_number')
      .eq('organization_id', organizationId)
      .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,employee_number.ilike.%${term}%`)
      .limit(5)
    setFoundEmployees(data || [])
  }

  async function handleSavePolicy(categoryId: string, policyData: any) {
    setPolicySaving(categoryId)
    try {
      const toNum = (v: any) => (v === '' || v === null || v === undefined) ? null : Number(v)
      const { error } = await supabase
        .from('expense_policies')
        .upsert({
          organization_id: organizationId,
          category_id: categoryId,
          scope_type: activePolicyTab,
          scope_id: activePolicyTab === 'organization' ? organizationId : selectedScopeId,
          limit_per_claim: toNum(policyData.limit_per_claim),
          limit_per_month: toNum(policyData.limit_per_month),
          auto_approve_below: toNum(policyData.auto_approve_below),
          receipt_required: policyData.receipt_required,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'organization_id, category_id, scope_type, scope_id'
        })

      if (error) throw error
      toast.success('Policy updated')
      loadExpensePolicies()
    } catch (error) {
      console.error('Error saving policy:', error)
      toast.error('Failed to save policy')
    } finally {
      setPolicySaving(null)
    }
  }

  async function loadBranches() {
    const { data } = await supabase
      .from('branches')
      .select('*')
      .eq('organization_id', organizationId)
      .order('name')
    setBranches(data || [])
  }

  async function loadDepartments() {
    const { data } = await supabase
      .from('departments')
      .select(`
        *,
        branch:branches(name)
      `)
      .eq('organization_id', organizationId)
      .order('name')
    setDepartments(data || [])
  }

  async function handleSaveBranch(e: React.FormEvent) {
    e.preventDefault()
    try {
      const data = { ...branchForm, organization_id: organizationId }
      if (editingBranch) {
        const { error } = await supabase.from('branches').update(data).eq('id', editingBranch.id)
        if (error) throw error
        toast.success('Branch updated')
      } else {
        const { error } = await supabase.from('branches').insert(data)
        if (error) throw error
        toast.success('Branch created')
      }
      setShowBranchDialog(false)
      setEditingBranch(null)
      setBranchForm({ name: '', code: '', city: '', address: '' })
      loadBranches()
    } catch (error) {
      toast.error('Failed to save branch')
    }
  }

  async function handleSaveDepartment(e: React.FormEvent) {
    e.preventDefault()
    try {
      const data = {
        ...departmentForm,
        branch_id: departmentForm.branch_id || null,
        organization_id: organizationId
      }
      if (editingDepartment) {
        const { error } = await supabase.from('departments').update(data).eq('id', editingDepartment.id)
        if (error) throw error
        toast.success('Department updated')
      } else {
        const { error } = await supabase.from('departments').insert(data)
        if (error) throw error
        toast.success('Department created')
      }
      setShowDepartmentDialog(false)
      setEditingDepartment(null)
      setDepartmentForm({ name: '', code: '', branch_id: '' })
      loadDepartments()
    } catch (error) {
      toast.error('Failed to save department')
    }
  }

  async function loadSettings() {
    setLoading(true)
    try {
      const { data: org } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', organizationId)
        .single()

      if (org) {
        setSettings({
          name: org.name || '',
          timezone: org.timezone || 'Asia/Colombo',
          work_hours_start: org.work_hours_start || '09:00',
          work_hours_end: org.work_hours_end || '17:00',
          grace_period_minutes: org.grace_period_minutes || 15,
          require_selfie: org.require_selfie || false,
          require_geofence: org.require_geofence !== false,
          late_threshold_minutes: org.late_threshold_minutes || 15,
          annual_leave_days: org.annual_leave_days || 14,
          casual_leave_days: org.casual_leave_days || 7,
          sick_leave_days: org.sick_leave_days || 7,
          expected_timezone_offset: org.expected_timezone_offset ?? null,
          timezone_tolerance_minutes: org.timezone_tolerance_minutes || 60,
          strict_location_mode: org.strict_location_mode || false,
          carry_forward_enabled: org.carry_forward_enabled ?? true,
          carry_forward_limit: org.carry_forward_limit ?? 5,
          encashment_allowed: org.encashment_allowed ?? false,
          encashment_max_days: org.encashment_max_days ?? 10,
          comp_off_expiry_months: org.comp_off_expiry_months ?? 3,
        })
      }

      // Load overtime policy
      const { data: otPolicy } = await supabase
        .from('overtime_policies')
        .select('*')
        .eq('organization_id', organizationId)
        .single()

      if (otPolicy) {
        setOvertimePolicy({
          max_daily_hours: otPolicy.max_daily_hours || 4.0,
          max_weekly_hours: otPolicy.max_weekly_hours || 12.0,
          weekday_rate: otPolicy.weekday_rate || 1.5,
          weekend_rate: otPolicy.weekend_rate || 2.0,
          holiday_rate: otPolicy.holiday_rate || 2.5,
          requires_approval: otPolicy.requires_approval !== false,
          auto_detect: otPolicy.auto_detect !== false,
        })
      }
    } catch (error) {
      console.error('Error loading settings:', error)
      toast.error('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      // Save organization settings
      const { error: orgError } = await supabase
        .from('organizations')
        .update({
          name: settings.name,
          timezone: settings.timezone,
          work_hours_start: settings.work_hours_start,
          work_hours_end: settings.work_hours_end,
          grace_period_minutes: settings.grace_period_minutes,
          require_selfie: settings.require_selfie,
          require_geofence: settings.require_geofence,
          late_threshold_minutes: settings.late_threshold_minutes,
          expected_timezone_offset: settings.expected_timezone_offset,
          timezone_tolerance_minutes: settings.timezone_tolerance_minutes,
          strict_location_mode: settings.strict_location_mode,
          carry_forward_enabled: settings.carry_forward_enabled,
          carry_forward_limit: settings.carry_forward_limit,
          encashment_allowed: settings.encashment_allowed,
          encashment_max_days: settings.encashment_max_days,
          comp_off_expiry_months: settings.comp_off_expiry_months,
        })
        .eq('id', organizationId)

      if (orgError) throw orgError

      // Save or create overtime policy (explicitly handling conflict on organization_id)
      const { error: otError } = await supabase
        .from('overtime_policies')
        .upsert({
          organization_id: organizationId,
          max_daily_hours: overtimePolicy.max_daily_hours,
          max_weekly_hours: overtimePolicy.max_weekly_hours,
          weekday_rate: overtimePolicy.weekday_rate,
          weekend_rate: overtimePolicy.weekend_rate,
          holiday_rate: overtimePolicy.holiday_rate,
          requires_approval: overtimePolicy.requires_approval,
          auto_detect: overtimePolicy.auto_detect,
          updated_at: new Date().toISOString(),
        }, { 
          onConflict: 'organization_id' 
        })

      if (otError) throw otError

      toast.success('Settings saved successfully!')

      // If on leave tab, ask to sync policies
      if (activeTab === 'leave') {
        setShowSyncDialog(true)
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  async function handleSyncPolicies() {
    if (!organizationId) return
    setSyncLoading(true)
    try {
      const year = new Date().getFullYear()
      const { data: count, error } = await supabase.rpc('sync_leave_policy_to_employees', {
        p_org_id: organizationId,
        p_year: year,
        p_annual_days: settings.annual_leave_days,
        p_casual_days: settings.casual_leave_days,
        p_sick_days: settings.sick_leave_days
      })

      if (error) throw error
      toast.success(`Policy synced for ${count} employee balances`)
      setShowSyncDialog(false)
    } catch (error: any) {
      console.error('Sync error:', error)
      toast.error(error.message || 'Failed to sync policies')
    } finally {
      setSyncLoading(false)
    }
  }

  const timezones = [
    // Asia
    'Asia/Colombo',
    'Asia/Kolkata',
    'Asia/Dubai',
    'Asia/Singapore',
    'Asia/Tokyo',
    'Asia/Shanghai',
    // Europe
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Europe/Rome',
    'Europe/Madrid',
    'Europe/Athens',
    'Europe/Malta',
    'Europe/Amsterdam',
    'Europe/Brussels',
    'Europe/Vienna',
    // Americas
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Toronto',
    'America/Sao_Paulo',
    // Pacific
    'Australia/Sydney',
    'Pacific/Auckland',
    // UTC
    'UTC',
  ]

  const securityRoleForUser = (targetUserId: string) => {
    const explicitRole = securityRoles.find((item) => item.user_id === targetUserId)?.system_role
    const user = securityUsers.find((item) => item.id === targetUserId)
    if (explicitRole) return explicitRole
    if (user?.role === 'owner') return 'owner'
    if (user?.role === 'super_admin') return 'super_admin'
    if (['admin', 'hr_admin', 'finance'].includes(user?.role)) return 'admin'
    if (['manager', 'dept_manager', 'branch_manager'].includes(user?.role)) return 'manager'
    return 'employee'
  }

  const userName = (targetUserId: string) => {
    const user = securityUsers.find((item) => item.id === targetUserId)
    return user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email : 'Unknown user'
  }

  const groupName = (groupId: string) => permissionGroups.find((group) => group.id === groupId)?.name || 'Unknown group'

  const scopeLabel = (assignment: any) => {
    if (assignment.scope_type === 'organization') return 'Organization'
    if (assignment.scope_type === 'self') return 'Self'
    if (assignment.scope_type === 'branch') return branches.find((branch) => branch.id === assignment.scope_id)?.name || 'Branch'
    if (assignment.scope_type === 'department') return departments.find((dept) => dept.id === assignment.scope_id)?.name || 'Department'
    return assignment.scope_type
  }

  const selectedGroupPermissionKeys = new Set(
    groupPermissions
      .filter((item) => item.group_id === selectedGroupId)
      .map((item) => item.permission_key)
  )

  const permissionsByModule = permissions.reduce((acc: Record<string, any[]>, permission) => {
    acc[permission.module] = acc[permission.module] || []
    acc[permission.module].push(permission)
    return acc
  }, {})

  const tabs = [
    { id: 'organization' as const, label: 'Organization', icon: Building2 },
    { id: 'branches' as const, label: 'Branches', icon: MapPin },
    { id: 'departments' as const, label: 'Departments', icon: Building2 },
    { id: 'attendance' as const, label: 'Attendance', icon: Clock },
    { id: 'leave' as const, label: 'Leave Policies', icon: Calendar },
    { id: 'overtime' as const, label: 'Overtime', icon: DollarSign },
    { id: 'expense_policy' as const, label: 'Expense Policies', icon: Shield },
    ...(canManageSecurity ? [{ id: 'security' as const, label: 'Security Roles', icon: Users }] : []),
    { id: 'integrations' as const, label: 'Integrations', icon: Video },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
  ]

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-[10px] font-black text-[#D1D5DB] animate-pulse uppercase tracking-widest">Loading Settings...</div>
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
            <h1 className="text-[15px] font-bold text-[#1A1727]">Settings</h1>
            <p className="text-[11px] text-[#9CA3AF]">Configure your organization and system preferences</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-1.5 bg-[#534AB7] text-white rounded-lg hover:bg-[#1E1854] transition-all text-xs font-bold shadow-md shadow-purple-900/20 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {/* Tab Bar */}
        <div className="bg-white border-b border-[#F1F0F4] px-8 shrink-0 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-[#534AB7] text-[#534AB7]'
                      : 'border-transparent text-[#9CA3AF] hover:text-[#374151]'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">

        {/* Organization Settings */}
        {activeTab === 'organization' && (
          <div className="bg-white rounded-xl border border-[#F1F0F4] shadow-sm p-6 space-y-6 max-w-2xl animate-in fade-in duration-300">
            <div>
              <h2 className="text-[13px] font-black text-[#1A1727] mb-5 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#534AB7]" />
                Organization Information
              </h2>
              <div className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Organization Name</label>
                  <input
                    type="text"
                    value={settings.name}
                    onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                    className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none focus:border-[#534AB7] focus:ring-2 focus:ring-[#EDE9FE] transition-all"
                    placeholder="Your Company Name"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Timezone</label>
                  <select
                    value={settings.timezone}
                    onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                    className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none focus:border-[#534AB7] transition-all"
                  >
                    {timezones.map((tz) => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-[#9CA3AF] mt-2 ml-1">All timestamps will be displayed in this timezone</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Attendance Settings */}
        {activeTab === 'attendance' && (
          <div className="bg-white rounded-xl border border-[#F1F0F4] shadow-sm p-6 space-y-6 max-w-2xl animate-in fade-in duration-300">
            <div>
              <h2 className="text-[13px] font-black text-[#1A1727] mb-5 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#534AB7]" />
                Attendance & Work Hours
              </h2>
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Work Hours Start</label>
                    <input
                      type="time"
                      value={settings.work_hours_start}
                      onChange={(e) => setSettings({ ...settings, work_hours_start: e.target.value })}
                      className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none focus:border-[#534AB7] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Work Hours End</label>
                    <input
                      type="time"
                      value={settings.work_hours_end}
                      onChange={(e) => setSettings({ ...settings, work_hours_end: e.target.value })}
                      className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none focus:border-[#534AB7] transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Grace Period (Minutes)</label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={settings.grace_period_minutes}
                    onChange={(e) => setSettings({ ...settings, grace_period_minutes: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none focus:border-[#534AB7] focus:ring-2 focus:ring-[#EDE9FE] transition-all"
                  />
                  <p className="text-[10px] text-[#9CA3AF] mt-2 ml-1">Employees can clock in up to this many minutes late without being marked as late</p>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Late Threshold (Minutes)</label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={settings.late_threshold_minutes}
                    onChange={(e) => setSettings({ ...settings, late_threshold_minutes: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none focus:border-[#534AB7] focus:ring-2 focus:ring-[#EDE9FE] transition-all"
                  />
                  <p className="text-[10px] text-[#9CA3AF] mt-2 ml-1">Clock-ins after this threshold will be marked as late</p>
                </div>

                <div className="border-t border-[#F1F0F4] pt-5">
                  <h3 className="text-[11px] font-black text-[#1A1727] uppercase tracking-widest mb-4">Clock-in Requirements</h3>
                  <div className="space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.require_geofence}
                        onChange={(e) => setSettings({ ...settings, require_geofence: e.target.checked })}
                        className="w-4 h-4 text-[#534AB7] border-[#E5E3EA] rounded focus:ring-[#534AB7]"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-[#9CA3AF]" />
                          <span className="text-[12px] font-black text-[#1A1727]">Require Geofence Verification</span>
                        </div>
                        <p className="text-[10px] text-[#9CA3AF]">Employees must be within a defined location to clock in</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.require_selfie}
                        onChange={(e) => setSettings({ ...settings, require_selfie: e.target.checked })}
                        className="w-4 h-4 text-[#534AB7] border-[#E5E3EA] rounded focus:ring-[#534AB7]"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <Camera className="w-4 h-4 text-[#9CA3AF]" />
                          <span className="text-[12px] font-black text-[#1A1727]">Require Selfie on Clock-in</span>
                        </div>
                        <p className="text-[10px] text-[#9CA3AF]">Employees must take a selfie when clocking in</p>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="border-t border-[#F1F0F4] pt-5">
                  <h3 className="text-[11px] font-black text-[#1A1727] uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-[#534AB7]" />
                    GPS Anti-Spoofing
                  </h3>
                  <p className="text-[10px] text-[#9CA3AF] mb-5">Protect against fake GPS apps and location spoofing</p>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Expected Device Timezone</label>
                      <select
                        value={settings.expected_timezone_offset ?? ''}
                        onChange={(e) => setSettings({ ...settings, expected_timezone_offset: e.target.value === '' ? null : parseInt(e.target.value) })}
                        className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none focus:border-[#534AB7] transition-all"
                      >
                        <option value="">Disabled (Accept any timezone)</option>
                        <option value="-720">UTC-12:00 (Baker Island)</option>
                        <option value="-660">UTC-11:00 (American Samoa)</option>
                        <option value="-600">UTC-10:00 (Hawaii)</option>
                        <option value="-540">UTC-9:00 (Alaska)</option>
                        <option value="-480">UTC-8:00 (Pacific Time)</option>
                        <option value="-420">UTC-7:00 (Mountain Time)</option>
                        <option value="-360">UTC-6:00 (Central Time)</option>
                        <option value="-300">UTC-5:00 (Eastern Time)</option>
                        <option value="-240">UTC-4:00 (Atlantic Time)</option>
                        <option value="-180">UTC-3:00 (Brazil)</option>
                        <option value="-120">UTC-2:00 (South Georgia)</option>
                        <option value="-60">UTC-1:00 (Azores)</option>
                        <option value="0">UTC+0:00 (London, GMT)</option>
                        <option value="60">UTC+1:00 (Paris, Berlin)</option>
                        <option value="120">UTC+2:00 (Malta, Athens)</option>
                        <option value="180">UTC+3:00 (Moscow, Kenya)</option>
                        <option value="210">UTC+3:30 (Tehran)</option>
                        <option value="240">UTC+4:00 (Dubai)</option>
                        <option value="270">UTC+4:30 (Afghanistan)</option>
                        <option value="300">UTC+5:00 (Pakistan)</option>
                        <option value="330">UTC+5:30 (Sri Lanka, India)</option>
                        <option value="345">UTC+5:45 (Nepal)</option>
                        <option value="360">UTC+6:00 (Bangladesh)</option>
                        <option value="390">UTC+6:30 (Myanmar)</option>
                        <option value="420">UTC+7:00 (Thailand, Vietnam)</option>
                        <option value="480">UTC+8:00 (Singapore, China)</option>
                        <option value="525">UTC+8:45 (Australia Eucla)</option>
                        <option value="540">UTC+9:00 (Japan, Korea)</option>
                        <option value="570">UTC+9:30 (Australia Central)</option>
                        <option value="600">UTC+10:00 (Australia East)</option>
                        <option value="630">UTC+10:30 (Australia Lord Howe)</option>
                        <option value="660">UTC+11:00 (Solomon Islands)</option>
                        <option value="720">UTC+12:00 (New Zealand)</option>
                        <option value="765">UTC+12:45 (New Zealand Chatham)</option>
                        <option value="780">UTC+13:00 (Samoa)</option>
                        <option value="840">UTC+14:00 (Kiribati)</option>
                      </select>
                      <p className="text-[10px] text-[#9CA3AF] mt-2 ml-1">
                        {settings.expected_timezone_offset === null
                          ? 'Timezone checking is disabled - employees can clock in from any timezone'
                          : 'Employees clocking in from different timezones will be flagged as suspicious'}
                      </p>
                    </div>

                    {settings.expected_timezone_offset !== null && (
                      <div>
                        <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Timezone Tolerance (Minutes)</label>
                        <input
                          type="number"
                          min="0"
                          max="180"
                          value={settings.timezone_tolerance_minutes}
                          onChange={(e) => setSettings({ ...settings, timezone_tolerance_minutes: parseInt(e.target.value) || 60 })}
                          className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none focus:border-[#534AB7] focus:ring-2 focus:ring-[#EDE9FE] transition-all"
                        />
                        <p className="text-[10px] text-[#9CA3AF] mt-2 ml-1">Allow ±{settings.timezone_tolerance_minutes} minutes difference to account for DST and device settings</p>
                      </div>
                    )}

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.strict_location_mode}
                        onChange={(e) => setSettings({ ...settings, strict_location_mode: e.target.checked })}
                        className="w-4 h-4 text-[#534AB7] border-[#E5E3EA] rounded focus:ring-[#534AB7]"
                      />
                      <div>
                        <span className="text-[12px] font-black text-[#1A1727]">Strict Location Mode</span>
                        <p className="text-[10px] text-[#9CA3AF]">Reject clock-in entirely if location cannot be verified (otherwise flagged for admin review)</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Leave Policies */}
        {activeTab === 'leave' && (
          <div className="bg-white rounded-xl border border-[#F1F0F4] shadow-sm p-6 space-y-6 max-w-3xl animate-in fade-in duration-300">
            <div>
              <h2 className="text-[13px] font-black text-[#1A1727] mb-5 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#534AB7]" />
                Leave Entitlements
              </h2>
              <p className="text-[10px] text-[#9CA3AF] mb-5">Set default annual leave entitlements for new employees</p>

              <div className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Annual Leave Days</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={settings.annual_leave_days}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '')
                      const num = parseInt(val) || 0
                      setSettings({ ...settings, annual_leave_days: Math.min(365, num) })
                    }}
                    className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none focus:border-[#534AB7] focus:ring-2 focus:ring-[#EDE9FE] transition-all"
                    placeholder="0"
                  />
                  <p className="text-[10px] text-[#9CA3AF] mt-2 ml-1">Typical: 14 days per year in Sri Lanka</p>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Casual Leave Days</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={settings.casual_leave_days}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '')
                      const num = parseInt(val) || 0
                      setSettings({ ...settings, casual_leave_days: Math.min(365, num) })
                    }}
                    className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none focus:border-[#534AB7] focus:ring-2 focus:ring-[#EDE9FE] transition-all"
                    placeholder="0"
                  />
                  <p className="text-[10px] text-[#9CA3AF] mt-2 ml-1">Short-notice leave for personal matters</p>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Sick Leave Days</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={settings.sick_leave_days}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '')
                      const num = parseInt(val) || 0
                      setSettings({ ...settings, sick_leave_days: Math.min(365, num) })
                    }}
                    className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none focus:border-[#534AB7] focus:ring-2 focus:ring-[#EDE9FE] transition-all"
                    placeholder="0"
                  />
                  <p className="text-[10px] text-[#9CA3AF] mt-2 ml-1">Medical leave (may require certificate)</p>
                </div>

                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-xl">
                  <p className="text-[11px] text-blue-700 font-medium">
                    <strong>Note:</strong> These settings apply to new employees. After saving, you can sync changes to all existing employees for the current year.
                  </p>
                </div>
              </div>
            </div>

            {/* Leave Approval Chain Section */}
            <div className="border-t border-[#F1F0F4] pt-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-[#1A1727]">Leave Approval Chain</h3>
                  <p className="text-xs text-[#9CA3AF]">Configure multi-level approval routing based on leave duration (days).</p>
                </div>
                <button
                  onClick={handleSaveLeaveApprovalConfig}
                  disabled={leaveApprovalSaving || leaveApprovalLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-[#1E1854] disabled:opacity-50 text-sm font-bold shadow-md transition-all active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  {leaveApprovalSaving ? 'Saving...' : 'Save Chain'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                    <label className="block text-xs font-black text-purple-700 uppercase tracking-widest mb-2">Auto-approve if ≤ X days</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.5"
                        value={leaveApprovalConfig.auto_approve_below_days}
                        onChange={(e) => setLeaveApprovalConfig({ ...leaveApprovalConfig, auto_approve_below_days: Number(e.target.value) })}
                        className="w-full px-4 py-2 bg-white border border-purple-100 rounded-lg text-sm font-bold focus:ring-2 focus:ring-[#534AB7] outline-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400 text-xs font-bold uppercase">Days</span>
                    </div>
                    <p className="text-[10px] text-purple-600 mt-2 italic">Short leave requests below this threshold are approved automatically.</p>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div className="p-4 bg-[#F8F7F9] rounded-xl border border-[#F1F0F4]">
                      <label className="block text-xs font-black text-[#9CA3AF] uppercase tracking-widest mb-2">Level 1 (Manager) threshold</label>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-[#9CA3AF] uppercase">Above</span>
                        <div className="relative flex-1">
                          <input
                            type="number"
                            step="0.5"
                            value={leaveApprovalConfig.level1_min_days}
                            onChange={(e) => setLeaveApprovalConfig({ ...leaveApprovalConfig, level1_min_days: Number(e.target.value) })}
                            className="w-full px-4 py-2 bg-white border border-[#F1F0F4] rounded-lg text-sm font-bold focus:ring-2 focus:ring-[#534AB7] outline-none"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-xs font-bold uppercase">Days</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-[#F8F7F9] rounded-xl border border-[#F1F0F4]">
                      <label className="block text-xs font-black text-[#9CA3AF] uppercase tracking-widest mb-2">Level 2 (HR Admin) threshold</label>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-[#9CA3AF] uppercase">Above</span>
                        <div className="relative flex-1">
                          <input
                            type="number"
                            step="0.5"
                            value={leaveApprovalConfig.level2_min_days}
                            onChange={(e) => setLeaveApprovalConfig({ ...leaveApprovalConfig, level2_min_days: Number(e.target.value) })}
                            className="w-full px-4 py-2 bg-white border border-[#F1F0F4] rounded-lg text-sm font-bold focus:ring-2 focus:ring-[#534AB7] outline-none"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-xs font-bold uppercase">Days</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-[#F8F7F9] rounded-xl border border-[#F1F0F4]">
                      <label className="block text-xs font-black text-[#9CA3AF] uppercase tracking-widest mb-2">Level 3 (Owner) threshold</label>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-[#9CA3AF] uppercase">Above</span>
                        <div className="relative flex-1">
                          <input
                            type="number"
                            step="0.5"
                            value={leaveApprovalConfig.level3_min_days}
                            onChange={(e) => setLeaveApprovalConfig({ ...leaveApprovalConfig, level3_min_days: Number(e.target.value) })}
                            className="w-full px-4 py-2 bg-white border border-[#F1F0F4] rounded-lg text-sm font-bold focus:ring-2 focus:ring-[#534AB7] outline-none"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-xs font-bold uppercase">Days</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="p-6 bg-[#F8F7F9] rounded-2xl border border-[#F1F0F4] space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-sm font-bold text-[#1A1727]">Parallel Approval</label>
                        <p className="text-[10px] text-[#9CA3AF]">Notify all required levels at once. Any can approve.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={leaveApprovalConfig.parallel_approval}
                          onChange={(e) => setLeaveApprovalConfig({ ...leaveApprovalConfig, parallel_approval: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-[#F1F0F4] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#534AB7]/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#F1F0F4] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#534AB7]"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-sm font-bold text-[#1A1727]">Skip if no Manager</label>
                        <p className="text-[10px] text-[#9CA3AF]">Bypass Level 1 if no Dept/Branch manager is assigned.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={leaveApprovalConfig.skip_if_no_manager}
                          onChange={(e) => setLeaveApprovalConfig({ ...leaveApprovalConfig, skip_if_no_manager: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-[#F1F0F4] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#534AB7]/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#F1F0F4] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#534AB7]"></div>
                      </label>
                    </div>
                  </div>

                  <div className="bg-amber-50 border-l-4 border-amber-400 p-4">
                    <p className="text-xs text-amber-800 leading-relaxed font-medium">
                      <strong>Important:</strong> Changes to the approval chain only apply to <u>new</u> leave requests submitted after saving.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Carry-Forward & Encashment Settings */}
            <div className="border-t border-[#F1F0F4] pt-6">
              <h2 className="text-[13px] font-black text-[#1A1727] mb-2">Carry-Forward & Encashment</h2>
              <p className="text-[10px] text-[#9CA3AF] mb-5">Configure leave carry-forward and encashment policies</p>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-[#F8F7F9] rounded-xl border border-[#F1F0F4]">
                  <div>
                    <label className="block text-[12px] font-black text-[#1A1727]">Enable Carry-Forward</label>
                    <p className="text-[10px] text-[#9CA3AF] mt-0.5">Allow unused leave to carry forward to next year</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.carry_forward_enabled ?? true}
                      onChange={(e) => setSettings({ ...settings, carry_forward_enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[#F1F0F4] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#534AB7]/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#F1F0F4] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#534AB7]"></div>
                  </label>
                </div>

                {settings.carry_forward_enabled !== false && (
                  <div>
                    <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Maximum Days to Carry Forward</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={settings.carry_forward_limit ?? 5}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '')
                        const num = parseInt(val) || 0
                        setSettings({ ...settings, carry_forward_limit: Math.min(60, num) })
                      }}
                      className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none focus:border-[#534AB7] focus:ring-2 focus:ring-[#EDE9FE] transition-all"
                      placeholder="0"
                    />
                    <p className="text-[10px] text-[#9CA3AF] mt-2 ml-1">Maximum number of days that can be carried forward</p>
                  </div>
                )}

                <div className="flex items-center justify-between p-4 bg-[#F8F7F9] rounded-xl border border-[#F1F0F4]">
                  <div>
                    <label className="block text-[12px] font-black text-[#1A1727]">Allow Leave Encashment</label>
                    <p className="text-[10px] text-[#9CA3AF] mt-0.5">Allow employees to cash out unused leave</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.encashment_allowed ?? false}
                      onChange={(e) => setSettings({ ...settings, encashment_allowed: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[#F1F0F4] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#534AB7]/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#F1F0F4] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#534AB7]"></div>
                  </label>
                </div>

                {settings.encashment_allowed && (
                  <div>
                    <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Maximum Days for Encashment</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={settings.encashment_max_days ?? 10}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '')
                        const num = parseInt(val) || 0
                        setSettings({ ...settings, encashment_max_days: Math.min(60, num) })
                      }}
                      className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none focus:border-[#534AB7] focus:ring-2 focus:ring-[#EDE9FE] transition-all"
                      placeholder="0"
                    />
                    <p className="text-[10px] text-[#9CA3AF] mt-2 ml-1">Maximum days that can be encashed per year</p>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Comp-Off Expiry Period (Months)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={settings.comp_off_expiry_months ?? 3}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '')
                      const num = parseInt(val) || 1
                      setSettings({ ...settings, comp_off_expiry_months: Math.max(1, Math.min(12, num)) })
                    }}
                    className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none focus:border-[#534AB7] focus:ring-2 focus:ring-[#EDE9FE] transition-all"
                    placeholder="3"
                  />
                  <p className="text-[10px] text-[#9CA3AF] mt-2 ml-1">Number of months before comp-off days expire</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Overtime Policy */}
        {activeTab === 'overtime' && (
          <div className="space-y-6 max-w-3xl animate-in fade-in duration-300">
            <OvertimePolicySettingsComponent
              policy={overtimePolicy}
              onChange={setOvertimePolicy}
            />

            {/* Overtime Approval Chain Section */}
            <div className="bg-white rounded-xl border border-[#F1F0F4] shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-[#1A1727]">Overtime Approval Chain</h3>
                  <p className="text-xs text-[#9CA3AF]">Configure multi-level approval routing based on overtime duration (hours).</p>
                </div>
                <button
                  onClick={handleSaveOvertimeApprovalConfig}
                  disabled={overtimeApprovalSaving || overtimeApprovalLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-[#1E1854] disabled:opacity-50 text-sm font-bold shadow-md transition-all active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  {overtimeApprovalSaving ? 'Saving...' : 'Save Chain'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                    <label className="block text-xs font-black text-purple-700 uppercase tracking-widest mb-2">Auto-approve if ≤ X hours</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.5"
                        value={overtimeApprovalConfig.auto_approve_below_hours}
                        onChange={(e) => setOvertimeApprovalConfig({ ...overtimeApprovalConfig, auto_approve_below_hours: Number(e.target.value) })}
                        className="w-full px-4 py-2 bg-white border border-purple-100 rounded-lg text-sm font-bold focus:ring-2 focus:ring-[#534AB7] outline-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400 text-xs font-bold uppercase">Hours</span>
                    </div>
                    <p className="text-[10px] text-purple-600 mt-2 italic">Short overtime records below this threshold are approved automatically.</p>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div className="p-4 bg-[#F8F7F9] rounded-xl border border-[#F1F0F4]">
                      <label className="block text-xs font-black text-[#9CA3AF] uppercase tracking-widest mb-2">Level 1 (Manager) threshold</label>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-[#9CA3AF] uppercase">Above</span>
                        <div className="relative flex-1">
                          <input
                            type="number"
                            step="0.5"
                            value={overtimeApprovalConfig.level1_min_hours}
                            onChange={(e) => setOvertimeApprovalConfig({ ...overtimeApprovalConfig, level1_min_hours: Number(e.target.value) })}
                            className="w-full px-4 py-2 bg-white border border-[#F1F0F4] rounded-lg text-sm font-bold focus:ring-2 focus:ring-[#534AB7] outline-none"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-xs font-bold uppercase">Hours</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-[#F8F7F9] rounded-xl border border-[#F1F0F4]">
                      <label className="block text-xs font-black text-[#9CA3AF] uppercase tracking-widest mb-2">Level 2 (HR Admin) threshold</label>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-[#9CA3AF] uppercase">Above</span>
                        <div className="relative flex-1">
                          <input
                            type="number"
                            step="0.5"
                            value={overtimeApprovalConfig.level2_min_hours}
                            onChange={(e) => setOvertimeApprovalConfig({ ...overtimeApprovalConfig, level2_min_hours: Number(e.target.value) })}
                            className="w-full px-4 py-2 bg-white border border-[#F1F0F4] rounded-lg text-sm font-bold focus:ring-2 focus:ring-[#534AB7] outline-none"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-xs font-bold uppercase">Hours</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-[#F8F7F9] rounded-xl border border-[#F1F0F4]">
                      <label className="block text-xs font-black text-[#9CA3AF] uppercase tracking-widest mb-2">Level 3 (Owner) threshold</label>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-[#9CA3AF] uppercase">Above</span>
                        <div className="relative flex-1">
                          <input
                            type="number"
                            step="0.5"
                            value={overtimeApprovalConfig.level3_min_hours}
                            onChange={(e) => setOvertimeApprovalConfig({ ...overtimeApprovalConfig, level3_min_hours: Number(e.target.value) })}
                            className="w-full px-4 py-2 bg-white border border-[#F1F0F4] rounded-lg text-sm font-bold focus:ring-2 focus:ring-[#534AB7] outline-none"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-xs font-bold uppercase">Hours</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="p-6 bg-[#F8F7F9] rounded-2xl border border-[#F1F0F4] space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-sm font-bold text-[#1A1727]">Parallel Approval</label>
                        <p className="text-[10px] text-[#9CA3AF]">Notify all required levels at once. Any can approve.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={overtimeApprovalConfig.parallel_approval}
                          onChange={(e) => setOvertimeApprovalConfig({ ...overtimeApprovalConfig, parallel_approval: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-[#F1F0F4] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#534AB7]/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#F1F0F4] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#534AB7]"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-sm font-bold text-[#1A1727]">Skip if no Manager</label>
                        <p className="text-[10px] text-[#9CA3AF]">Bypass Level 1 if no Dept/Branch manager is assigned.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={overtimeApprovalConfig.skip_if_no_manager}
                          onChange={(e) => setOvertimeApprovalConfig({ ...overtimeApprovalConfig, skip_if_no_manager: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-[#F1F0F4] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#534AB7]/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#F1F0F4] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#534AB7]"></div>
                      </label>
                    </div>
                  </div>

                  <div className="bg-amber-50 border-l-4 border-amber-400 p-4">
                    <p className="text-xs text-amber-800 leading-relaxed font-medium">
                      <strong>Important:</strong> Changes to the approval chain only apply to <u>new</u> overtime records.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Expense Policy */}
        {activeTab === 'expense_policy' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white rounded-xl border border-[#F1F0F4] shadow-sm p-6">
              <h2 className="text-[13px] font-black text-[#1A1727] mb-2 flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#534AB7]" />
                Hierarchical Expense Policies
              </h2>
              <p className="text-[10px] text-[#9CA3AF] mb-6">
                Define spending limits and approval rules. More specific policies override more general ones:
                <span className="text-[#534AB7] font-bold ml-1">Employee → Department → Branch → Organization</span>
              </p>

              <div className="flex flex-col md:flex-row gap-4 mb-8">
                <div className="flex bg-[#F1F0F4] p-1 rounded-xl w-fit">
                  {(['organization', 'branch', 'department', 'employee'] as const).map((scope) => (
                    <button
                      key={scope}
                      onClick={() => {
                        setActivePolicyTab(scope)
                        setSelectedScopeId(null)
                        setEmployeeSearch('')
                      }}
                      className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                        activePolicyTab === scope ? 'bg-white shadow-sm text-[#534AB7]' : 'text-[#9CA3AF] hover:text-[#374151]'
                      }`}
                    >
                      {scope}
                    </button>
                  ))}
                </div>

                <div className="flex-1">
                  {activePolicyTab === 'branch' && (
                    <select
                      value={selectedScopeId || ''}
                      onChange={(e) => setSelectedScopeId(e.target.value)}
                      className="w-full md:w-64 px-4 py-2.5 bg-[#F8F7F9] border border-[#F1F0F4] rounded-xl text-sm font-bold text-[#1A1727] outline-none focus:border-[#534AB7] transition-all"
                    >
                      <option value="">Select Branch...</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  )}

                  {activePolicyTab === 'department' && (
                    <select
                      value={selectedScopeId || ''}
                      onChange={(e) => setSelectedScopeId(e.target.value)}
                      className="w-full md:w-64 px-4 py-2.5 bg-[#F8F7F9] border border-[#F1F0F4] rounded-xl text-sm font-bold text-[#1A1727] outline-none focus:border-[#534AB7] transition-all"
                    >
                      <option value="">Select Department...</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name} ({d.branch?.name})</option>
                      ))}
                    </select>
                  )}

                  {activePolicyTab === 'employee' && (
                    <div className="relative w-full md:w-80">
                      <input
                        type="text"
                        placeholder="Search employee name or number..."
                        value={employeeSearch}
                        onChange={(e) => searchEmployees(e.target.value)}
                        className="w-full px-4 py-2.5 bg-[#F8F7F9] border border-[#F1F0F4] rounded-xl text-sm font-bold text-[#1A1727] outline-none focus:border-[#534AB7] transition-all"
                      />
                      {foundEmployees.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#F1F0F4] rounded-xl shadow-lg z-10 overflow-hidden">
                          {foundEmployees.map((emp) => (
                            <button
                              key={emp.id}
                              onClick={() => {
                                setSelectedScopeId(emp.id)
                                setEmployeeSearch(`${emp.first_name} ${emp.last_name}`)
                                setFoundEmployees([])
                              }}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-[#F5F3FF] flex items-center justify-between transition-all"
                            >
                              <span className="font-bold text-[#1A1727]">{emp.first_name} {emp.last_name}</span>
                              <span className="text-[10px] text-[#9CA3AF] font-bold">#{emp.employee_number}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {(activePolicyTab === 'organization' || selectedScopeId) ? (
                <div className="overflow-hidden border border-[#F1F0F4] rounded-xl shadow-sm bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#F8F7F9] border-b border-[#F1F0F4] text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">
                      <tr>
                        <th className="px-6 py-4">Category</th>
                        <th className="px-6 py-4">Limit / Claim</th>
                        <th className="px-6 py-4">Limit / Month</th>
                        <th className="px-4 py-4 text-center">Receipt?</th>
                        <th className="px-6 py-4">Auto-Approve</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1F0F4]">
                      {expenseCategories.map((cat) => {
                        const activeScopeId = activePolicyTab === 'organization' ? organizationId : selectedScopeId
                        const policy = expensePolicies.find(p => p.category_id === cat.id && p.scope_type === activePolicyTab && p.scope_id === activeScopeId)
                        const orgPolicy = expensePolicies.find(p => p.category_id === cat.id && p.scope_type === 'organization')
                        
                        return (
                          <ExpensePolicyRow 
                            key={cat.id}
                            category={cat}
                            policy={policy}
                            inheritedPolicy={activePolicyTab !== 'organization' ? orgPolicy : undefined}
                            onSave={(data) => handleSavePolicy(cat.id, data)}
                            isSaving={policySaving === cat.id}
                          />
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-[#F8F7F9] rounded-xl p-12 text-center text-[#9CA3AF] text-[12px] font-bold border border-[#F1F0F4]">
                  Please select a {activePolicyTab} to view and edit its policies.
                </div>
              )}

              {/* Approval Chain Config Section */}
              <div className="mt-12 pt-8 border-t border-[#F1F0F4]">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-[#1A1727]">Expense Approval Chain</h3>
                    <p className="text-xs text-[#9CA3AF]">Configure multi-level approval routing based on claim amount.</p>
                  </div>
                  <button
                    onClick={handleSaveApprovalConfig}
                    disabled={approvalSaving || approvalLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-[#1E1854] disabled:opacity-50 text-sm font-bold shadow-md transition-all active:scale-95"
                  >
                    <Save className="w-4 h-4" />
                    {approvalSaving ? 'Saving...' : 'Save Chain'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                      <label className="block text-xs font-black text-purple-700 uppercase tracking-widest mb-2">Auto-Approve Below</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400 text-xs font-bold">LKR</span>
                        <input
                          type="number"
                          value={approvalConfig.auto_approve_below}
                          onChange={(e) => setApprovalConfig({ ...approvalConfig, auto_approve_below: Number(e.target.value) })}
                          className="w-full pl-12 pr-4 py-2 bg-white border border-purple-100 rounded-lg text-sm font-bold focus:ring-2 focus:ring-[#534AB7] outline-none"
                        />
                      </div>
                      <p className="text-[10px] text-purple-600 mt-2 italic">Claims below this amount bypass all managers and go straight to Finance.</p>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <div className="p-4 bg-[#F8F7F9] rounded-xl border border-[#F1F0F4]">
                        <label className="block text-xs font-black text-[#9CA3AF] uppercase tracking-widest mb-2">Level 1 (Dept/Branch Manager)</label>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-bold text-[#9CA3AF] uppercase">Above</span>
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-xs font-bold">LKR</span>
                            <input
                              type="number"
                              value={approvalConfig.level1_min_amount}
                              onChange={(e) => setApprovalConfig({ ...approvalConfig, level1_min_amount: Number(e.target.value) })}
                              className="w-full pl-12 pr-4 py-2 bg-white border border-[#F1F0F4] rounded-lg text-sm font-bold focus:ring-2 focus:ring-[#534AB7] outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-[#F8F7F9] rounded-xl border border-[#F1F0F4]">
                        <label className="block text-xs font-black text-[#9CA3AF] uppercase tracking-widest mb-2">Level 2 (HR Admin)</label>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-bold text-[#9CA3AF] uppercase">Above</span>
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-xs font-bold">LKR</span>
                            <input
                              type="number"
                              value={approvalConfig.level2_min_amount}
                              onChange={(e) => setApprovalConfig({ ...approvalConfig, level2_min_amount: Number(e.target.value) })}
                              className="w-full pl-12 pr-4 py-2 bg-white border border-[#F1F0F4] rounded-lg text-sm font-bold focus:ring-2 focus:ring-[#534AB7] outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-[#F8F7F9] rounded-xl border border-[#F1F0F4]">
                        <label className="block text-xs font-black text-[#9CA3AF] uppercase tracking-widest mb-2">Level 3 (Owner)</label>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-bold text-[#9CA3AF] uppercase">Above</span>
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-xs font-bold">LKR</span>
                            <input
                              type="number"
                              value={approvalConfig.level3_min_amount}
                              onChange={(e) => setApprovalConfig({ ...approvalConfig, level3_min_amount: Number(e.target.value) })}
                              className="w-full pl-12 pr-4 py-2 bg-white border border-[#F1F0F4] rounded-lg text-sm font-bold focus:ring-2 focus:ring-[#534AB7] outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="p-6 bg-[#F8F7F9] rounded-2xl border border-[#F1F0F4] space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="block text-sm font-bold text-[#1A1727]">Parallel Approval</label>
                          <p className="text-[10px] text-[#9CA3AF]">Notify all required levels at once. Any can approve.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={approvalConfig.parallel_approval}
                            onChange={(e) => setApprovalConfig({ ...approvalConfig, parallel_approval: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-[#F1F0F4] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#534AB7]/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#F1F0F4] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#534AB7]"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <label className="block text-sm font-bold text-[#1A1727]">Skip if no Manager</label>
                          <p className="text-[10px] text-[#9CA3AF]">Bypass Level 1 if no Dept/Branch manager is assigned.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={approvalConfig.skip_if_no_manager}
                            onChange={(e) => setApprovalConfig({ ...approvalConfig, skip_if_no_manager: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-[#F1F0F4] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#534AB7]/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#F1F0F4] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#534AB7]"></div>
                        </label>
                      </div>
                    </div>

                    <div className="bg-amber-50 border-l-4 border-amber-400 p-4">
                      <p className="text-xs text-amber-800 leading-relaxed font-medium">
                        <strong>Important:</strong> Changes to the approval chain only apply to <u>new</u> claims submitted after saving. Active claims will follow the chain they were assigned at submission.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Branches Management */}
        {activeTab === 'branches' && (
          <div className="bg-white rounded-xl border border-[#F1F0F4] shadow-sm p-6 animate-in fade-in duration-300">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-[13px] font-black text-[#1A1727] flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#534AB7]" />
                  Company Branches
                </h2>
                <p className="text-[10px] text-[#9CA3AF] mt-0.5">Manage your office locations and branches</p>
              </div>
              <button
                onClick={() => {
                  setEditingBranch(null)
                  setBranchForm({ name: '', code: '', city: '', address: '' })
                  setShowBranchDialog(true)
                }}
                className="flex items-center gap-2 px-4 py-1.5 bg-[#534AB7] text-white rounded-lg hover:bg-[#1E1854] text-xs font-bold shadow-md shadow-purple-900/20 transition-all"
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={3} /> Add Branch
              </button>
            </div>

            <div className="border border-[#F1F0F4] rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-[#F8F7F9] border-b border-[#F1F0F4] text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">
                  <tr>
                    <th className="px-6 py-4">Branch Name</th>
                    <th className="px-6 py-4">Code</th>
                    <th className="px-6 py-4">City</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F0F4]">
                  {branches.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-12 text-center text-[#9CA3AF] font-bold text-[12px]">No branches registered yet</td></tr>
                  ) : (
                    branches.map((branch) => (
                      <tr key={branch.id} className="hover:bg-[#F8F7F9] transition-colors">
                        <td className="px-6 py-4 text-[13px] font-black text-[#1A1727]">{branch.name}</td>
                        <td className="px-6 py-4 font-mono text-[12px] text-[#534AB7] font-bold">{branch.code}</td>
                        <td className="px-6 py-4 text-[12px] text-[#6B7280] font-medium">{branch.city}</td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => {
                              setEditingBranch(branch)
                              setBranchForm({ name: branch.name, code: branch.code || '', city: branch.city || '', address: branch.address || '' })
                              setShowBranchDialog(true)
                            }}
                            className="p-1.5 hover:bg-[#F3E8FF] text-[#9CA3AF] hover:text-[#534AB7] rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Departments Management */}
        {activeTab === 'departments' && (
          <div className="bg-white rounded-xl border border-[#F1F0F4] shadow-sm p-6 animate-in fade-in duration-300">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-[13px] font-black text-[#1A1727] flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#534AB7]" />
                  Departments
                </h2>
                <p className="text-[10px] text-[#9CA3AF] mt-0.5">Organize employees into departments</p>
              </div>
              <button
                onClick={() => {
                  setEditingDepartment(null)
                  setDepartmentForm({ name: '', code: '', branch_id: '' })
                  setShowDepartmentDialog(true)
                }}
                className="flex items-center gap-2 px-4 py-1.5 bg-[#534AB7] text-white rounded-lg hover:bg-[#1E1854] text-xs font-bold shadow-md shadow-purple-900/20 transition-all"
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={3} /> Add Department
              </button>
            </div>

            <div className="border border-[#F1F0F4] rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-[#F8F7F9] border-b border-[#F1F0F4] text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">
                  <tr>
                    <th className="px-6 py-4">Department Name</th>
                    <th className="px-6 py-4">Code</th>
                    <th className="px-6 py-4">Branch</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F0F4]">
                  {departments.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-12 text-center text-[#9CA3AF] font-bold text-[12px]">No departments created yet</td></tr>
                  ) : (
                    departments.map((dept) => (
                      <tr key={dept.id} className="hover:bg-[#F8F7F9] transition-colors">
                        <td className="px-6 py-4 text-[13px] font-black text-[#1A1727]">{dept.name}</td>
                        <td className="px-6 py-4 font-mono text-[12px] text-[#534AB7] font-bold">{dept.code || '—'}</td>
                        <td className="px-6 py-4 text-[12px] text-[#6B7280] font-medium">{dept.branch?.name || 'No Branch'}</td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => {
                              setEditingDepartment(dept)
                              setDepartmentForm({ name: dept.name, code: dept.code || '', branch_id: dept.branch_id || '' })
                              setShowDepartmentDialog(true)
                            }}
                            className="p-1.5 hover:bg-[#F3E8FF] text-[#9CA3AF] hover:text-[#534AB7] rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Security Roles */}
        {activeTab === 'security' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white rounded-xl border border-[#F1F0F4] shadow-sm p-6">
              <h2 className="text-[13px] font-black text-[#1A1727] mb-1 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#534AB7]" /> User Access
              </h2>
              <p className="text-[10px] text-[#9CA3AF] mb-4">Assign system roles and permission groups. Owner access is protected from self-demotion.</p>
              {securityLoading ? (
                <div className="py-8 text-center text-[10px] font-black text-[#D1D5DB] animate-pulse uppercase tracking-widest">Loading...</div>
              ) : (
                <div className="overflow-hidden border border-[#F1F0F4] rounded-xl">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-[#F8F7F9] border-b border-[#F1F0F4] text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">
                      <tr>
                        <th className="px-6 py-4">Name</th>
                        <th className="px-6 py-4">System Role</th>
                        <th className="px-6 py-4">Assigned Groups</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1F0F4]">
                      {securityUsers.map(u => (
                        <tr key={u.id} className="hover:bg-[#F8F7F9] transition-colors">
                          <td className="px-6 py-4">
                            <div className="text-[13px] font-black text-[#1A1727]">{u.first_name} {u.last_name}</div>
                            <div className="text-[10px] font-bold text-[#9CA3AF]">{u.email}</div>
                          </td>
                          <td className="px-6 py-4">
                            <select
                              value={securityRoleForUser(u.id)}
                              onChange={(e) => handleSaveSystemRole(u.id, e.target.value)}
                              disabled={u.id === userId && securityRoleForUser(u.id) === 'owner'}
                              className="px-3 py-1.5 border border-[#F1F0F4] rounded-lg text-xs font-bold bg-[#F8F7F9] text-[#1A1727] focus:border-[#534AB7] outline-none disabled:opacity-40"
                            >
                              {['owner','super_admin','admin','manager','employee'].map(r => (
                                <option key={r} value={r}>{r.replace('_', ' ')}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-2">
                              {userPermissionGroups.filter((assignment) => assignment.user_id === u.id).map((assignment) => (
                                <button
                                  key={assignment.id}
                                  onClick={() => handleRemovePermissionGroupAssignment(assignment.id)}
                                  className="px-2.5 py-1 rounded-lg bg-[#EDE9FE] text-[#534AB7] text-[9px] font-black uppercase tracking-widest hover:bg-red-50 hover:text-red-600 transition-colors"
                                >
                                  {groupName(assignment.group_id)} · {scopeLabel(assignment)}
                                </button>
                              ))}
                              {userPermissionGroups.filter((assignment) => assignment.user_id === u.id).length === 0 && (
                                <span className="text-[10px] font-bold text-[#D1D5DB]">No groups assigned</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-[#F1F0F4] shadow-sm p-6">
              <h2 className="text-[13px] font-black text-[#1A1727] mb-1">Assign Permission Group</h2>
              <p className="text-[10px] text-[#9CA3AF] mb-4">Use organization scope for admins, or branch/department scope for managers.</p>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <select value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)} className="px-3 py-2 border border-[#F1F0F4] rounded-lg text-xs font-bold bg-[#F8F7F9] outline-none">
                  <option value="">Select user</option>
                  {securityUsers.map((u) => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
                </select>
                <select value={assignGroupId} onChange={(e) => setAssignGroupId(e.target.value)} className="px-3 py-2 border border-[#F1F0F4] rounded-lg text-xs font-bold bg-[#F8F7F9] outline-none">
                  <option value="">Select group</option>
                  {permissionGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                </select>
                <select value={assignScopeType} onChange={(e) => { setAssignScopeType(e.target.value as any); setAssignScopeId('') }} className="px-3 py-2 border border-[#F1F0F4] rounded-lg text-xs font-bold bg-[#F8F7F9] outline-none">
                  <option value="organization">Organization</option>
                  <option value="branch">Branch</option>
                  <option value="department">Department</option>
                  <option value="self">Self</option>
                </select>
                <select
                  value={assignScopeId}
                  onChange={(e) => setAssignScopeId(e.target.value)}
                  disabled={assignScopeType === 'organization' || assignScopeType === 'self'}
                  className="px-3 py-2 border border-[#F1F0F4] rounded-lg text-xs font-bold bg-[#F8F7F9] outline-none disabled:opacity-40"
                >
                  <option value="">Scope</option>
                  {assignScopeType === 'branch' && branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                  {assignScopeType === 'department' && departments.map((dept) => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
                </select>
                <button onClick={handleAssignPermissionGroup} className="px-4 py-2 bg-[#534AB7] text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-[#1E1854] transition-all">
                  Assign
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
              <div className="bg-white rounded-xl border border-[#F1F0F4] shadow-sm p-6">
                <h2 className="text-[13px] font-black text-[#1A1727] mb-1">Permission Groups</h2>
                <p className="text-[10px] text-[#9CA3AF] mb-4">Create reusable access bundles for admins and managers.</p>
                <div className="space-y-3 mb-5">
                  <input value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} className="w-full px-3 py-2 border border-[#F1F0F4] rounded-lg text-xs font-bold bg-[#F8F7F9] outline-none" placeholder="Group name" />
                  <input value={groupForm.description} onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })} className="w-full px-3 py-2 border border-[#F1F0F4] rounded-lg text-xs font-bold bg-[#F8F7F9] outline-none" placeholder="Description" />
                  <button onClick={handleCreatePermissionGroup} className="w-full px-4 py-2 bg-[#534AB7] text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-[#1E1854] transition-all">Create Group</button>
                </div>
                <div className="space-y-2">
                  {permissionGroups.map((group) => (
                    <button
                      key={group.id}
                      onClick={() => setSelectedGroupId(group.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg border text-xs font-bold transition-all ${selectedGroupId === group.id ? 'border-[#534AB7] bg-[#EDE9FE] text-[#534AB7]' : 'border-[#F1F0F4] bg-[#F8F7F9] text-[#1A1727]'}`}
                    >
                      {group.name}
                      {group.is_system && <span className="ml-2 text-[8px] uppercase text-[#9CA3AF]">System</span>}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-[#F1F0F4] shadow-sm p-6">
                <h2 className="text-[13px] font-black text-[#1A1727] mb-1">Permissions</h2>
                <p className="text-[10px] text-[#9CA3AF] mb-4">Toggle permissions for the selected group.</p>
                {!selectedGroupId ? (
                  <div className="py-16 text-center text-[10px] font-black text-[#D1D5DB] uppercase tracking-widest">Select or create a group</div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {Object.entries(permissionsByModule).map(([module, modulePermissions]) => (
                      <div key={module} className="border border-[#F1F0F4] rounded-xl p-4">
                        <h3 className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-3">{module}</h3>
                        <div className="space-y-2">
                          {modulePermissions.map((permission) => (
                            <label key={permission.key} className="flex items-start gap-3 text-xs font-bold text-[#1A1727]">
                              <input
                                type="checkbox"
                                checked={selectedGroupPermissionKeys.has(permission.key)}
                                onChange={(e) => handleToggleGroupPermission(permission.key, e.target.checked)}
                                className="mt-0.5 w-4 h-4 text-[#534AB7] border-[#F1F0F4] rounded focus:ring-[#534AB7]"
                              />
                              <span>
                                {permission.key}
                                <span className="block text-[10px] font-medium text-[#9CA3AF]">{permission.description}</span>
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#F1F0F4] shadow-sm p-6">
              <h2 className="text-[13px] font-black text-[#1A1727] mb-1">Security Audit</h2>
              <p className="text-[10px] text-[#9CA3AF] mb-4">Recent sensitive authorization and approval events.</p>
              <div className="overflow-hidden border border-[#F1F0F4] rounded-xl">
                <table className="w-full text-sm text-left">
                  <thead className="bg-[#F8F7F9] border-b border-[#F1F0F4] text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">
                    <tr>
                      <th className="px-6 py-4">Action</th>
                      <th className="px-6 py-4">Actor</th>
                      <th className="px-6 py-4">Entity</th>
                      <th className="px-6 py-4">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F0F4]">
                    {securityAuditLog.length === 0 ? (
                      <tr><td colSpan={4} className="px-6 py-10 text-center text-[10px] font-black text-[#D1D5DB] uppercase tracking-widest">No audit events yet</td></tr>
                    ) : securityAuditLog.map((item) => (
                      <tr key={item.id} className="hover:bg-[#F8F7F9] transition-colors">
                        <td className="px-6 py-4 text-[12px] font-black text-[#1A1727]">{item.action}</td>
                        <td className="px-6 py-4 text-[12px] font-bold text-[#6B7280]">{userName(item.actor_user_id)}</td>
                        <td className="px-6 py-4 text-[12px] font-bold text-[#6B7280]">{item.entity_type || '—'}</td>
                        <td className="px-6 py-4 text-[11px] font-bold text-[#9CA3AF]">{new Date(item.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'integrations' && (
          <div className="animate-in fade-in duration-300">
            <MeetingProvidersSettings />
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="animate-in fade-in duration-300">
            <NotificationPreferences />
          </div>
        )}

        {/* Branch Dialog */}
        {showBranchDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#1A1727]/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 border border-[#F1F0F4]">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-black text-[#1A1727] tracking-tight">{editingBranch ? 'Edit' : 'New'} Branch</h2>
                <button onClick={() => setShowBranchDialog(false)} className="p-2 text-[#9CA3AF] hover:text-[#1A1727] transition-all"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleSaveBranch} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Branch Name *</label>
                  <input
                    required
                    value={branchForm.name}
                    onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                    className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none focus:border-[#534AB7] focus:ring-2 focus:ring-[#EDE9FE] transition-all"
                    placeholder="e.g. Colombo Head Office"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Branch Code</label>
                    <input
                      value={branchForm.code}
                      onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value })}
                      className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none font-mono focus:border-[#534AB7] transition-all"
                      placeholder="COL-01"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">City</label>
                    <input
                      value={branchForm.city}
                      onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })}
                      className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none focus:border-[#534AB7] transition-all"
                      placeholder="Colombo"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Address</label>
                  <textarea
                    rows={2}
                    value={branchForm.address}
                    onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                    className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none focus:border-[#534AB7] transition-all resize-none"
                    placeholder="Full street address..."
                  />
                </div>
                <div className="flex gap-4 pt-2">
                  <button type="button" onClick={() => setShowBranchDialog(false)} className="flex-1 py-3 text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] hover:bg-[#F8F7F9] rounded-xl transition-all">Cancel</button>
                  <button type="submit" className="flex-1 py-3 bg-[#534AB7] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-purple-900/20 active:scale-95 transition-all">Save Branch</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Department Dialog */}
        {showDepartmentDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#1A1727]/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 border border-[#F1F0F4]">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-black text-[#1A1727] tracking-tight">{editingDepartment ? 'Edit' : 'New'} Department</h2>
                <button onClick={() => setShowDepartmentDialog(false)} className="p-2 text-[#9CA3AF] hover:text-[#1A1727] transition-all"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleSaveDepartment} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Department Name *</label>
                  <input
                    required
                    value={departmentForm.name}
                    onChange={(e) => setDepartmentForm({ ...departmentForm, name: e.target.value })}
                    className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none focus:border-[#534AB7] focus:ring-2 focus:ring-[#EDE9FE] transition-all"
                    placeholder="e.g. Engineering"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Department Code</label>
                  <input
                    value={departmentForm.code}
                    onChange={(e) => setDepartmentForm({ ...departmentForm, code: e.target.value })}
                    className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none font-mono focus:border-[#534AB7] transition-all"
                    placeholder="ENG"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Assign to Branch</label>
                  <select
                    value={departmentForm.branch_id}
                    onChange={(e) => setDepartmentForm({ ...departmentForm, branch_id: e.target.value })}
                    className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none focus:border-[#534AB7] transition-all"
                  >
                    <option value="">No Branch</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-[#9CA3AF] mt-2 ml-1">Optional: Assign this department to a specific branch</p>
                </div>
                <div className="flex gap-4 pt-2">
                  <button type="button" onClick={() => setShowDepartmentDialog(false)} className="flex-1 py-3 text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] hover:bg-[#F8F7F9] rounded-xl transition-all">Cancel</button>
                  <button type="submit" className="flex-1 py-3 bg-[#534AB7] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-purple-900/20 active:scale-95 transition-all">Save Department</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Sync Policies Dialog */}
        {showSyncDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#1A1727]/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 border border-[#F1F0F4]">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 bg-amber-50 rounded-xl">
                  <RefreshCw className={`w-5 h-5 text-amber-600 ${syncLoading ? 'animate-spin' : ''}`} />
                </div>
                <h2 className="text-xl font-black text-[#1A1727] tracking-tight">Sync Leave Policies?</h2>
              </div>
              <p className="text-[12px] text-[#6B7280] mb-8 leading-relaxed">
                This will update the entitled days for all active employees to match your new settings for the current year. This action cannot be easily undone.
              </p>
              <div className="flex gap-4">
                <button
                  disabled={syncLoading}
                  onClick={() => setShowSyncDialog(false)}
                  className="flex-1 py-3 text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] hover:bg-[#F8F7F9] rounded-xl transition-all disabled:opacity-50"
                >
                  Later
                </button>
                <button
                  disabled={syncLoading}
                  onClick={handleSyncPolicies}
                  className="flex-1 py-3 bg-[#534AB7] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-purple-900/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {syncLoading ? 'Syncing...' : 'Sync Now'}
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </DashboardLayout>
  )
}
