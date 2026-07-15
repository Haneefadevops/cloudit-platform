'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { usePermissions } from '@/hooks/use-permissions'
import {
  ArrowLeft,
  Save,
  UserX,
  User,
  Briefcase,
  CreditCard,
  Phone,
  MapPin,
  Clock,
  AlertCircle,
  DollarSign,
  FileText,
  Calendar,
  Shield,
  Key,
  Copy,
  Check,
  RefreshCcw,
  X,
  Eye,
  EyeOff,
  UserCheck,
  Plus,
  ChevronRight,
  Mail,
  TrendingUp,
  Pencil
} from 'lucide-react'
import { toast } from 'sonner'

import { ProfileHeader } from './components/ProfileHeader'
import { SidebarNav, type TabId } from './components/SidebarNav'
import { RightPanel } from './components/RightPanel'
import { OverviewTab } from './components/OverviewTab'
import { AttendanceTab } from './components/AttendanceTab'
import { LeaveTab } from './components/LeaveTab'
import { SalaryTab } from './components/SalaryTab'
import { DocumentsTab } from './components/DocumentsTab'
import { EmergencyTab } from './components/EmergencyTab'
import { EmploymentTab } from './components/EmploymentTab'
import { BankTab } from './components/BankTab'
import { HistoryTab } from './components/HistoryTab'
import { SkillsTab } from './components/SkillsTab'
import { PerformanceTab } from './components/PerformanceTab'
import { ActivityTab, type ActivityEvent } from './components/ActivityTab'

interface Employee {
  id: string
  organization_id: string
  user_id: string | null
  employee_number: string
  first_name: string
  last_name: string
  email: string
  phone: string
  nic: string
  date_of_birth: string
  hire_date: string
  employment_status: string
  job_title: string
  department: string
  department_id: string | null
  branch_id: string | null
  basic_salary: number
  bank_account_number: string
  bank_name: string
  bank_branch: string
  address_line1: string
  address_line2: string
  city: string
  postal_code: string
  termination_date: string | null
  termination_reason: string | null
  last_working_day: string | null
  photo_url: string | null
}

export default function EmployeeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { organizationId, userId, isOwner, role } = useAuth()
  const { can, loading: permissionLoading } = usePermissions([
    'employees.manage_app_access',
    'employees.terminate',
    'settings.manage_roles',
  ])
  const canManageSecurity = permissionLoading ? (isOwner || role === 'super_admin') : can('settings.manage_roles')
  const canManageAppAccess = permissionLoading ? (isOwner || role === 'super_admin') : can('employees.manage_app_access')
  const canTerminateEmployee = permissionLoading ? (isOwner || role === 'super_admin') : can('employees.terminate')
  const employeeId = params.id as string

  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [attendanceStats, setAttendanceStats] = useState({ workDays: 0, lateCount: 0, absenceCount: 0 })
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([])
  const [leaveHistory, setLeaveHistory] = useState<any[]>([])
  const [documents, setDocuments] = useState<any[]>([])
  const [tabLoading, setTabLoading] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showActionsMenu, setShowActionsMenu] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isCompact, setIsCompact] = useState(false)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const handler = () => setIsCompact(el.scrollTop > 60)
    el.addEventListener('scroll', handler)
    handler()
    return () => el.removeEventListener('scroll', handler)
  }, [])
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    job_title: '',
    department: '',
    basic_salary: 0
  })
  const [employmentForm, setEmploymentForm] = useState({ employee_number: '', hire_date: '', employment_status: '' })
  const [bankForm, setBankForm] = useState({ bank_name: '', bank_account_number: '', bank_branch: '' })
  const [emergencyContacts, setEmergencyContacts] = useState<any[]>([])
  const [savingTab, setSavingTab] = useState(false)
  const [tempPassword, setTempPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isProvisioningAccess, setIsProvisioningAccess] = useState(false)
  const [copiedUserId, setCopiedUserId] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [salaryHistory, setSalaryHistory] = useState<any[]>([])
  const [leaveBalances, setLeaveBalances] = useState<any[]>([])
  const [skills, setSkills] = useState<any[]>([])
  const [performanceReviews, setPerformanceReviews] = useState<any[]>([])
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([])
  const [showLeaveAdjust, setShowLeaveAdjust] = useState(false)
  const [leaveAdjustForm, setLeaveAdjustForm] = useState({ leave_type: 'annual', adjustment_type: 'add', days: '', reason: '' })
  const [savingLeaveAdjust, setSavingLeaveAdjust] = useState(false)
  const [userMetadata, setUserMetadata] = useState<any>(null)
  const [accessUser, setAccessUser] = useState<any>(null)
  const [accessRole, setAccessRole] = useState('employee')
  const [permissionGroups, setPermissionGroups] = useState<any[]>([])
  const [userPermissionGroups, setUserPermissionGroups] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [assignGroupId, setAssignGroupId] = useState('')
  const [assignScopeType, setAssignScopeType] = useState<'organization' | 'branch' | 'department' | 'self'>('organization')
  const [assignScopeId, setAssignScopeId] = useState('')

  useEffect(() => {
    if (organizationId && employeeId) {
      loadEmployee()
    }
  }, [organizationId, employeeId])

  useEffect(() => {
    if (employee && activeTab !== 'overview') {
      loadTabData(activeTab)
    }
  }, [activeTab, employee])

  async function loadEmployee() {
    setLoading(true)
    let coreLoaded = false
    try {
      const result = await api.get<any>(`/employees/${employeeId}`)
      if (!result.ok) throw new Error(result.error || 'Failed to load employee')
      const data = result.data
      const employeeRecord = { ...data, department: data.department_name || data.department || null }
      setEmployee(employeeRecord)
      setEditForm({
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone || '',
        job_title: data.job_title || '',
        department: data.department_name || data.department || '',
        basic_salary: data.basic_salary || 0
      })
      setEmploymentForm({ employee_number: data.employee_number || '', hire_date: data.hire_date || '', employment_status: data.employment_status || '' })
      setBankForm({ bank_name: data.bank_name || '', bank_account_number: data.bank_account_number || '', bank_branch: data.bank_branch || '' })
      coreLoaded = true
      setLoading(false)

      // Fetch user metadata if user_id exists
      if (data.user_id) {
        try {
          const res = await fetch('/api/check-user-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: data.user_id })
          })
          if (res.ok) {
            const status = await res.json()
            setUserMetadata(status)
          }
        } catch (err) {
          console.error('Error checking user status:', err)
        }
      }

      // Load current-month attendance stats
      const now = new Date()
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      const { data: events } = await supabase.from('clock_events').select('employee_id, timestamp, event_type').eq('employee_id', data.id).gte('timestamp', monthStart).eq('event_type', 'clock_in')
      if (events) {
        const workDays = new Set(events.map((e: any) => e.timestamp.split('T')[0])).size
        const lateCount = events.filter((e: any) => {
          const t = new Date(e.timestamp)
          return t.getHours() > 9 || (t.getHours() === 9 && t.getMinutes() > 15)
        }).length
        const daysInMonth = now.getDate()
        const absenceCount = Math.max(0, daysInMonth - workDays)
        setAttendanceStats({ workDays, lateCount, absenceCount })

      // Load salary history for sparkline
      const { data: revs } = await supabase.from('salary_revisions').select('previous_salary, new_salary, effective_date').eq('employee_id', data.id).order('effective_date', { ascending: true })
      setSalaryHistory(revs || [])
      }

      // Load activity feed data from multiple tables
      await loadActivityFeed(data.id)
    } catch (error) {
      if (coreLoaded) {
        console.error('Error loading optional employee data:', error)
      } else {
        toast.error('Failed to load employee')
      }
    } finally {
      setLoading(false)
    }
  }

  async function loadActivityFeed(empId: string) {
    try {
      const [
        { data: clockEvents },
        { data: leaveRecs },
        { data: historyEvents },
        { data: salaryRevs },
        { data: perfReviews },
        { data: empSkills },
      ] = await Promise.all([
        supabase.from('clock_events').select('id, timestamp, event_type, geofence_name').eq('employee_id', empId).order('timestamp', { ascending: false }).limit(15),
        supabase.from('leave_records').select('id, created_at, status, leave_type, start_date, end_date').eq('employee_id', empId).order('created_at', { ascending: false }).limit(10),
        supabase.from('employee_history').select('id, event_date, event_type, description').eq('employee_id', empId).order('event_date', { ascending: false }).limit(10),
        supabase.from('salary_revisions').select('id, effective_date, previous_salary, new_salary').eq('employee_id', empId).order('effective_date', { ascending: false }).limit(5),
        supabase.from('performance_reviews').select('id, created_at, overall_score').eq('employee_id', empId).order('created_at', { ascending: false }).limit(5),
        supabase.from('employee_skills').select('id, created_at, skill_name, category').eq('employee_id', empId).order('created_at', { ascending: false }).limit(10),
      ])

      const events: ActivityEvent[] = []

      clockEvents?.forEach((e: any) => {
        events.push({
          id: `clock-${e.id}`,
          type: 'clock',
          title: e.event_type === 'clock_in' ? 'Clocked In' : 'Clocked Out',
          description: e.geofence_name ? `At ${e.geofence_name}` : 'Location recorded',
          timestamp: e.timestamp,
          iconName: 'Clock',
          iconColor: 'text-emerald-600',
          iconBg: 'bg-emerald-100',
        })
      })

      leaveRecs?.forEach((e: any) => {
        const isApproved = e.status === 'approved'
        events.push({
          id: `leave-${e.id}`,
          type: 'leave',
          title: `${isApproved ? 'Approved' : 'Requested'} ${e.leave_type} Leave`,
          description: `${new Date(e.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} — ${new Date(e.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`,
          timestamp: e.created_at,
          iconName: isApproved ? 'CheckCircle' : 'Calendar',
          iconColor: isApproved ? 'text-emerald-600' : 'text-amber-600',
          iconBg: isApproved ? 'bg-emerald-100' : 'bg-amber-100',
        })
      })

      historyEvents?.forEach((e: any) => {
        events.push({
          id: `hist-${e.id}`,
          type: 'history',
          title: e.event_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
          description: e.description || 'Employment record updated',
          timestamp: e.event_date,
          iconName: 'Briefcase',
          iconColor: 'text-blue-600',
          iconBg: 'bg-blue-100',
        })
      })

      salaryRevs?.forEach((e: any) => {
        const change = e.new_salary - e.previous_salary
        events.push({
          id: `salary-${e.id}`,
          type: 'salary',
          title: 'Salary Updated',
          description: `LKR ${e.previous_salary?.toLocaleString?.() || e.previous_salary} → LKR ${e.new_salary?.toLocaleString?.() || e.new_salary} ${change >= 0 ? '(+' : ''}${change >= 0 ? change.toLocaleString() : change.toLocaleString()} LKR)`,
          timestamp: e.effective_date,
          iconName: 'DollarSign',
          iconColor: 'text-purple-600',
          iconBg: 'bg-purple-100',
        })
      })

      perfReviews?.forEach((e: any) => {
        events.push({
          id: `perf-${e.id}`,
          type: 'performance',
          title: 'Performance Review',
          description: `Overall score: ${e.overall_score ?? '—'} / 100`,
          timestamp: e.created_at,
          iconName: 'Star',
          iconColor: 'text-amber-600',
          iconBg: 'bg-amber-100',
        })
      })

      empSkills?.forEach((e: any) => {
        events.push({
          id: `skill-${e.id}`,
          type: 'skill',
          title: 'Skill Added',
          description: `${e.skill_name} (${e.category?.replace('_', ' ') || 'skill'})`,
          timestamp: e.created_at,
          iconName: 'Zap',
          iconColor: 'text-[#534AB7]',
          iconBg: 'bg-[#EDE9FE]',
        })
      })

      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      setActivityEvents(events)
    } catch (err) {
      console.error('Error loading activity feed:', err)
    }
  }

  async function loadTabData(tab: string) {
    setTabLoading(true)
    try {
      if (tab === 'attendance') {
        const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        const { data } = await supabase.from('clock_events').select('*').eq('employee_id', employeeId).gte('timestamp', thirtyDaysAgo.toISOString()).order('timestamp', { ascending: false })
        setAttendanceHistory(data || [])
      } else if (tab === 'leave') {
        const [recordsResult, balancesResult] = await Promise.all([
          api.get<any[]>(`/leave/requests?employee_id=${employeeId}`),
          api.get<any[]>(`/leave/balances/${employeeId}`),
        ])
        setLeaveHistory(recordsResult.ok ? (recordsResult.data || []) : [])
        setLeaveBalances(balancesResult.ok ? (balancesResult.data || []) : [])
      } else if (tab === 'documents') {
        const { data } = await supabase.from('employee_documents').select('*').eq('employee_id', employeeId).order('created_at', { ascending: false })
        setDocuments(data || [])
      } else if (tab === 'emergency') {
        const result = await api.get<any[]>(`/employees/${employeeId}/emergency-contacts`)
        setEmergencyContacts(result.ok ? (result.data || []) : [])
      } else if (tab === 'history') {
        const result = await api.get<any[]>(`/employees/${employeeId}/history`)
        setAttendanceHistory(result.ok ? (result.data || []) : []) // Using attendanceHistory as a temporary holder for generic history
      } else if (tab === 'salary') {
        const { data } = await supabase.from('salary_revisions').select('*').eq('employee_id', employeeId).order('effective_date', { ascending: false })
        setSalaryHistory(data || [])
      } else if (tab === 'skills') {
        const { data } = await supabase.from('employee_skills').select('*').eq('employee_id', employeeId).order('created_at', { ascending: false })
        setSkills(data || [])
      } else if (tab === 'performance') {
        const { data } = await supabase.from('performance_reviews').select('*').eq('employee_id', employeeId).order('created_at', { ascending: false })
        setPerformanceReviews(data || [])
      } else if (tab === 'activity') {
        if (employee) await loadActivityFeed(employee.id)
      } else if (tab === 'app-access') {
        await loadAccessData()
      }
    } catch { } finally {
      setTabLoading(false)
    }
  }

  async function loadAccessData() {
    const [{ data: groups }, { data: branchRows }, { data: deptRows }] = await Promise.all([
      supabase.from('permission_groups').select('id, name, description').or(`organization_id.eq.${organizationId},organization_id.is.null`).order('name'),
      supabase.from('branches').select('id, name').eq('organization_id', organizationId).order('name'),
      supabase.from('departments').select('id, name').eq('organization_id', organizationId).order('name'),
    ])
    setPermissionGroups(groups || [])
    setBranches(branchRows || [])
    setDepartments(deptRows || [])

    if (!employee?.user_id) {
      setAccessUser(null)
      setAccessRole('employee')
      setUserPermissionGroups([])
      return
    }

    const [{ data: user }, { data: roleRow }, { data: assignments }] = await Promise.all([
      supabase.from('users').select('id, email, first_name, last_name, role').eq('id', employee.user_id).single(),
      supabase.from('user_security_roles').select('*').eq('organization_id', organizationId).eq('user_id', employee.user_id).maybeSingle(),
      supabase.from('user_permission_groups').select('*').eq('organization_id', organizationId).eq('user_id', employee.user_id),
    ])

    setAccessUser(user)
    setAccessRole(roleRow?.system_role || user?.role || 'employee')
    setUserPermissionGroups(assignments || [])

    try {
      const res = await fetch('/api/check-user-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: employee.user_id })
      })
      if (res.ok) {
        const status = await res.json()
        setUserMetadata(status)
      }
    } catch (err) {
      console.error('Error checking user status:', err)
    }
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const result = await api.patch<any>(`/employees/${employeeId}`, editForm)
      if (!result.ok) throw new Error(result.error || 'Failed to update profile')
      toast.success('Profile updated')
      setShowEditDialog(false)
      loadEmployee()
    } catch (error) { toast.error('Failed to update profile') }
  }

  const handleResetPassword = async () => {
    if (!employee?.id) return
    if (!canManageAppAccess) {
      toast.error('You do not have permission to manage app access')
      return
    }
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#'
    const newPass = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    const result = await api.post<{ reset?: boolean }>(`/employees/${employee.id}/reset-password`, { password: newPass })
    if (!result.ok) {
      toast.error('Failed to reset password')
    } else {
      setTempPassword(newPass)
      setShowPassword(true)
      toast.success('Password reset — temporary password displayed')
    }
    setShowActionsMenu(false)
  }

  const handleSuspendAccess = async () => {
    if (!employee?.id) return
    if (!canManageAppAccess) {
      toast.error('You do not have permission to manage app access')
      return
    }
    setIsProvisioningAccess(true)
    try {
      const result = await api.post<{ enabled?: boolean }>(`/employees/${employee.id}/toggle-access`, { enabled: false })
      if (!result.ok) throw new Error(result.error || 'Failed to suspend access')

      toast.success('App access suspended')
      loadTabData('app-access')
    } catch (e: any) { toast.error(e.message || 'Failed to suspend access') } finally { setIsProvisioningAccess(false) }
  }

  const handleEnableAccess = async () => {
    if (!employee?.id) return
    if (!canManageAppAccess) {
      toast.error('You do not have permission to manage app access')
      return
    }
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#'
    const newPass = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')

    setIsProvisioningAccess(true)
    try {
      const toggleResult = await api.post<{ enabled?: boolean }>(`/employees/${employee.id}/toggle-access`, { enabled: true })
      if (!toggleResult.ok) throw new Error(toggleResult.error || 'Failed to enable access')

      // Also reset password
      const passResult = await api.post<{ reset?: boolean }>(`/employees/${employee.id}/reset-password`, { password: newPass })
      if (!passResult.ok) throw new Error(passResult.error || 'Failed to reset password')

      setTempPassword(newPass)
      setShowPassword(true)
      toast.success('App access enabled with new password')
      loadTabData('app-access')
    } catch (e: any) { toast.error(e.message || 'Failed to enable access') } finally { setIsProvisioningAccess(false) }
  }

  const handleTerminate = async () => {
    if (!canTerminateEmployee) {
      toast.error('You do not have permission to terminate employees')
      return
    }
    if (!confirm('Terminate this employee? This cannot be undone easily.')) return
    const today = new Date().toISOString().split('T')[0]
    const result = await api.post<any>(`/employees/${employeeId}/terminate`, {
      termination_date: today,
      last_working_day: today,
      termination_reason: 'Terminated by Admin',
    })
    if (!result.ok) toast.error(result.error || 'Termination failed')
    else {
      toast.success('Employee terminated')
      loadEmployee()
    }
    setShowActionsMenu(false)
  }

  const handleUpdateEmployment = async () => {
    setSavingTab(true)
    try {
      const result = await api.patch<any>(`/employees/${employeeId}`, employmentForm)
      if (!result.ok) throw new Error(result.error || 'Failed to update employment details')
      toast.success('Employment details updated')
      loadEmployee()
    } catch { toast.error('Failed to update employment details') } finally { setSavingTab(false) }
  }

  const handleUpdateBank = async () => {
    setSavingTab(true)
    try {
      const result = await api.patch<any>(`/employees/${employeeId}`, bankForm)
      if (!result.ok) throw new Error(result.error || 'Failed to update bank details')
      toast.success('Bank details updated')
      loadEmployee()
    } catch { toast.error('Failed to update bank details') } finally { setSavingTab(false) }
  }

  const handleSaveEmergencyContacts = async () => {
    setSavingTab(true)
    try {
      const toSave = emergencyContacts.filter(c => c.name && c.phone).map(c => ({
        name: c.name,
        relationship: c.relationship,
        phone: c.phone,
        email: c.email || null,
        is_primary: c.is_primary || false,
      }))
      const result = await api.put<any[]>(`/employees/${employeeId}/emergency-contacts`, toSave)
      if (!result.ok) throw new Error(result.error || 'Failed to save emergency contacts')
      toast.success('Emergency contacts saved')
      loadTabData('emergency')
    } catch { toast.error('Failed to save emergency contacts') } finally { setSavingTab(false) }
  }

  const handleLeaveAdjust = async () => {
    if (!leaveAdjustForm.days || !leaveAdjustForm.reason) { toast.error('All fields required'); return }
    const days = parseFloat(leaveAdjustForm.days)
    if (isNaN(days) || days <= 0) { toast.error('Enter a valid number of days'); return }
    setSavingLeaveAdjust(true)
    try {
      const delta = leaveAdjustForm.adjustment_type === 'add' ? days : -days
      const result = await api.post(`/leave/balances/${employeeId}/adjust`, {
        leave_type: leaveAdjustForm.leave_type,
        days: delta,
        reason: leaveAdjustForm.reason,
      })
      if (!result.ok) throw new Error(result.error || 'Failed to adjust balance')
      toast.success(`Leave balance ${leaveAdjustForm.adjustment_type === 'add' ? 'increased' : 'decreased'} by ${days} day${days !== 1 ? 's' : ''}`)
      setShowLeaveAdjust(false)
      setLeaveAdjustForm({ leave_type: 'annual', adjustment_type: 'add', days: '', reason: '' })
      loadTabData('leave')
    } catch (e: any) { toast.error(e.message || 'Failed to adjust balance') } finally { setSavingLeaveAdjust(false) }
  }

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#'
    setTempPassword(Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''))
  }

  const handleProvisionAccess = async () => {
    if (!employee?.id || !employee.email || !tempPassword || tempPassword.length < 8) { toast.error('Email and password (min 8 chars) required'); return }
    if (!canManageAppAccess) {
      toast.error('You do not have permission to manage app access')
      return
    }
    setIsProvisioningAccess(true)
    try {
      // Backend employee creation already linked a user record; just set the password.
      const result = await api.post<{ reset?: boolean }>(`/employees/${employee.id}/reset-password`, { password: tempPassword })
      if (!result.ok) throw new Error(result.error || 'Failed to provision access')

      // TODO: migrate security role and permission group assignment to backend endpoints
      toast.success('App access provisioned — credentials sent to employee')
      loadEmployee()
      loadAccessData()
    } catch (e: any) { toast.error(e.message || 'Failed to provision access') } finally { setIsProvisioningAccess(false) }
  }

  const handleSaveAccessRole = async () => {
    if (!employee?.user_id || !canManageSecurity) return
    if (employee.user_id === userId && accessRole !== 'owner') {
      toast.error('You cannot reduce your own owner access')
      return
    }

    const { error: roleError } = await supabase
      .from('user_security_roles')
      .upsert({
        organization_id: organizationId,
        user_id: employee.user_id,
        system_role: accessRole,
        created_by: userId,
        updated_at: new Date().toISOString()
      }, { onConflict: 'organization_id,user_id' })

    if (roleError) {
      toast.error('Failed to update security role')
      return
    }

    const { error: userError } = await supabase
      .from('users')
      .update({ role: accessRole })
      .eq('id', employee.user_id)
      .eq('organization_id', organizationId)

    if (userError) {
      toast.error('Security role saved, but legacy role sync failed')
      return
    }

    toast.success('App security role updated')
    loadAccessData()
  }

  const handleAssignAccessGroup = async () => {
    if (!employee?.user_id || !assignGroupId || !canManageSecurity) return
    if ((assignScopeType === 'branch' || assignScopeType === 'department') && !assignScopeId) {
      toast.error('Select a scope target')
      return
    }

    const { error } = await supabase.from('user_permission_groups').insert({
      organization_id: organizationId,
      user_id: employee.user_id,
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
    toast.success('Permission group assigned')
    loadAccessData()
  }

  const handleRemoveAccessGroup = async (assignmentId: string) => {
    if (!canManageSecurity) return
    const { error } = await supabase.from('user_permission_groups').delete().eq('id', assignmentId)
    if (error) {
      toast.error('Failed to remove permission group')
      return
    }
    toast.success('Permission group removed')
    loadAccessData()
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    try {
      const ext = file.name.split('.').pop()
      const key = `${employeeId}.${ext}`
      const presignResult = await api.post<{ uploadUrl: string; publicUrl: string }>(`/employees/${employeeId}/photo`, {
        bucket: 'employee-photos',
        key,
        contentType: file.type,
      })
      if (!presignResult.ok || !presignResult.data) throw new Error(presignResult.error || 'Failed to get photo upload URL')

      const uploadRes = await fetch(presignResult.data.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })
      if (!uploadRes.ok) throw new Error('Photo upload failed')

      setEmployee((prev: any) => ({ ...prev, photo_url: presignResult.data!.publicUrl }))
      toast.success('Photo updated')
    } catch (err: any) {
      toast.error(err.message || 'Photo upload failed')
    } finally {
      setUploadingPhoto(false)
    }
  }

  if (loading || !employee) return <div className="p-20 text-center animate-pulse font-black text-[#D1D5DB] uppercase tracking-widest">Loading Profile...</div>

  const groupName = (groupId: string) => permissionGroups.find((group) => group.id === groupId)?.name || 'Unknown group'
  const scopeLabel = (assignment: any) => {
    if (assignment.scope_type === 'organization') return 'Organization'
    if (assignment.scope_type === 'self') return 'Self'
    if (assignment.scope_type === 'branch') return branches.find((branch) => branch.id === assignment.scope_id)?.name || 'Branch'
    if (assignment.scope_type === 'department') return departments.find((dept) => dept.id === assignment.scope_id)?.name || 'Department'
    return assignment.scope_type
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'employment', label: 'Employment', icon: Briefcase },
    { id: 'bank', label: 'Bank', icon: CreditCard },
    { id: 'salary', label: 'Salary', icon: DollarSign },
    { id: 'attendance', label: 'Attendance', icon: Clock },
    { id: 'leave', label: 'Leave', icon: Calendar },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'emergency', label: 'Emergency', icon: Phone },
    { id: 'app-access', label: 'App Access', icon: Shield },
    { id: 'history', label: 'History', icon: RefreshCcw },
  ]

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full bg-[#ECECF1]">
        <ProfileHeader
          employee={employee}
          isCompact={isCompact}
          onEdit={() => setShowEditDialog(true)}
          canManageAppAccess={canManageAppAccess}
          canTerminateEmployee={canTerminateEmployee}
          onResetPassword={handleResetPassword}
          onTerminate={handleTerminate}
        />
        
        <div className="flex-1 flex overflow-hidden">
          <SidebarNav activeTab={activeTab} onTabChange={(tab) => setActiveTab(tab)} />
          
          <div
            ref={scrollRef}
            id={`employee-tabpanel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`employee-tab-${activeTab}`}
            className="flex-1 overflow-y-auto p-6"
          >

          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <OverviewTab employee={employee} onUpdate={loadEmployee} />
          )}
          {activeTab === 'attendance' && (
            <AttendanceTab events={attendanceHistory} isLoading={tabLoading} />
          )}
          {activeTab === 'leave' && (
            <LeaveTab
              employeeId={employeeId}
              organizationId={organizationId}
              balances={leaveBalances}
              history={leaveHistory}
              isLoading={tabLoading}
              onUpdate={() => loadTabData('leave')}
            />
          )}
          {activeTab === 'documents' && (
            <DocumentsTab documents={documents} isLoading={tabLoading} />
          )}
          {activeTab === 'employment' && (
            <EmploymentTab employee={employee} onUpdate={loadEmployee} />
          )}
          {activeTab === 'bank' && (
            <BankTab employee={employee} onUpdate={loadEmployee} />
          )}
          {activeTab === 'salary' && (
            <SalaryTab
              employee={employee}
              salaryHistory={salaryHistory}
              isLoading={tabLoading}
              userEmail={userId || ''}
              onUpdate={() => loadTabData('salary')}
            />
          )}

          {/* EMERGENCY CONTACTS TAB */}
          {activeTab === 'emergency' && (
            <EmergencyTab
              employeeId={employeeId}
              contacts={emergencyContacts}
              isLoading={tabLoading}
              onUpdate={() => loadTabData('emergency')}
            />
          )}
          {activeTab === 'app-access' && (
          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-2xl p-8 shadow-xl shadow-purple-900/5 border border-[#C7C3D0]">
              <h3 className="text-[13px] font-black text-[#1A1727] uppercase tracking-widest flex items-center gap-2 mb-6">
                <Shield size={16} className="text-[#534AB7]" /> Employee App Access
              </h3>
              {employee.user_id ? (
                <div className="space-y-6">
                  {userMetadata?.banned ? (
                    <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl">
                      <AlertCircle size={18} className="text-red-600" />
                      <div>
                        <div className="text-[12px] font-black text-red-700 uppercase tracking-widest">Account Suspended</div>
                        <div className="text-[11px] text-red-600 font-bold mt-0.5">Employee cannot log in to the mobile app</div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                      <UserCheck size={18} className="text-emerald-600" />
                      <div>
                        <div className="text-[12px] font-black text-emerald-700 uppercase tracking-widest">Account Active</div>
                        <div className="text-[11px] text-emerald-600 font-bold mt-0.5">Employee can log in to the mobile app</div>
                      </div>
                    </div>
                  )}

                  <div className="p-5 bg-[#F8F7F9] rounded-2xl border border-[#C7C3D0]">
                    <div className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-1.5">User ID</div>
                    <div className="flex items-center gap-3">
                      <code className="flex-1 text-[12px] font-mono text-[#374151] break-all">{employee.user_id}</code>
                      <button
                        onClick={() => { navigator.clipboard.writeText(employee.user_id!); setCopiedUserId(true); setTimeout(() => setCopiedUserId(false), 2000) }}
                        className="p-2 rounded-xl bg-white border border-[#C7C3D0] hover:bg-[#EDE9FE] transition-all"
                      >
                        {copiedUserId ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="text-[#9CA3AF]" />}
                      </button>
                    </div>
                  </div>
                  <div className="p-5 bg-[#F8F7F9] rounded-2xl border border-[#C7C3D0] space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-1">Security Role</div>
                        <div className="text-[11px] font-bold text-[#6B7280]">Controls broad admin/manager/employee access.</div>
                      </div>
                      <div className="flex gap-2">
                        <select
                          value={accessRole}
                          onChange={(e) => setAccessRole(e.target.value)}
                          disabled={!canManageSecurity}
                          className="px-3 py-2 bg-white border border-[#C7C3D0] rounded-xl text-xs font-bold text-[#1A1727] outline-none disabled:opacity-40"
                        >
                          {['owner', 'super_admin', 'admin', 'manager', 'employee'].map((item) => (
                            <option key={item} value={item}>{item.replace('_', ' ')}</option>
                          ))}
                        </select>
                        {canManageSecurity && (
                          <button onClick={handleSaveAccessRole} className="px-4 py-2 bg-[#534AB7] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#1E1854] transition-all">
                            Save
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2">Permission Groups</div>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {userPermissionGroups.map((assignment) => (
                          <button
                            key={assignment.id}
                            onClick={() => handleRemoveAccessGroup(assignment.id)}
                            disabled={!canManageSecurity}
                            className="px-2.5 py-1 rounded-lg bg-[#EDE9FE] text-[#534AB7] text-[9px] font-black uppercase tracking-widest hover:bg-red-50 hover:text-red-600 transition-colors disabled:hover:bg-[#EDE9FE] disabled:hover:text-[#534AB7]"
                          >
                            {groupName(assignment.group_id)} · {scopeLabel(assignment)}
                          </button>
                        ))}
                        {userPermissionGroups.length === 0 && (
                          <span className="text-[10px] font-bold text-[#D1D5DB]">No permission groups assigned</span>
                        )}
                      </div>

                      {canManageSecurity && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                          <select value={assignGroupId} onChange={(e) => setAssignGroupId(e.target.value)} className="px-3 py-2 bg-white border border-[#C7C3D0] rounded-xl text-xs font-bold text-[#1A1727] outline-none">
                            <option value="">Select group</option>
                            {permissionGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                          </select>
                          <select value={assignScopeType} onChange={(e) => { setAssignScopeType(e.target.value as any); setAssignScopeId('') }} className="px-3 py-2 bg-white border border-[#C7C3D0] rounded-xl text-xs font-bold text-[#1A1727] outline-none">
                            <option value="organization">Organization</option>
                            <option value="branch">Branch</option>
                            <option value="department">Department</option>
                            <option value="self">Self</option>
                          </select>
                          <select value={assignScopeId} onChange={(e) => setAssignScopeId(e.target.value)} disabled={assignScopeType === 'organization' || assignScopeType === 'self'} className="px-3 py-2 bg-white border border-[#C7C3D0] rounded-xl text-xs font-bold text-[#1A1727] outline-none disabled:opacity-40">
                            <option value="">Scope</option>
                            {assignScopeType === 'branch' && branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                            {assignScopeType === 'department' && departments.map((dept) => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
                          </select>
                          <button onClick={handleAssignAccessGroup} disabled={!assignGroupId} className="px-4 py-2 bg-[#534AB7] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#1E1854] transition-all disabled:opacity-40">
                            Assign
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                    {canManageAppAccess && (
                    <div className="flex gap-3">
                      <button onClick={handleResetPassword} className="flex items-center gap-2 px-5 py-2.5 bg-[#F8F7F9] border border-[#C7C3D0] text-[#374151] rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-[#F1F0F4] transition-all">
                        <Key size={13} /> Send Password Reset
                      </button>
                      {userMetadata?.banned ? (
                        <button onClick={handleEnableAccess} disabled={isProvisioningAccess} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50">
                          <UserCheck size={13} /> Enable Access
                        </button>
                      ) : (
                        <button onClick={handleSuspendAccess} disabled={isProvisioningAccess} className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-900/20 disabled:opacity-50">
                          <Shield size={13} /> Suspend Access
                        </button>
                      )}
                    </div>
                    )}

                    {tempPassword && (
                      <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-2xl animate-in zoom-in-95 duration-200">
                        <div className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1.5">New Temporary Password</div>
                        <div className="flex items-center gap-3">
                          <code className="flex-1 text-[16px] font-mono font-black text-emerald-900 tracking-wider">
                            {showPassword ? tempPassword : '••••••••••••'}
                          </code>
                          <button 
                            onClick={() => { navigator.clipboard.writeText(tempPassword); toast.success('Password copied') }}
                            className="p-2 rounded-xl bg-white border border-emerald-200 hover:bg-emerald-100 transition-all"
                          >
                            <Copy size={14} className="text-emerald-600" />
                          </button>
                        </div>
                        <p className="text-[10px] text-emerald-600 font-bold mt-2 italic">Copy this password and give it to the employee.</p>
                      </div>
                    )}
                  </div>
              ) : (
                <div className="space-y-6">
                  <div className="p-5 bg-amber-50 border border-amber-100 rounded-2xl">
                    <div className="text-[12px] font-black text-amber-700 uppercase tracking-widest mb-1">No App Access</div>
                    <div className="text-[11px] text-amber-600 font-bold">This employee does not have a login account yet. Provision access below.</div>
                  </div>
                  <div className="space-y-4">
                    {canManageSecurity && (
                      <div className="p-4 bg-[#F8F7F9] border border-[#C7C3D0] rounded-2xl space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-1.5">System Role</label>
                            <select value={accessRole} onChange={(e) => setAccessRole(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-[#C7C3D0] rounded-xl text-sm font-bold text-[#1A1727] outline-none">
                              {['employee', 'manager', 'admin', 'super_admin'].map((item) => (
                                <option key={item} value={item}>{item.replace('_', ' ')}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-1.5">Permission Group</label>
                            <select value={assignGroupId} onChange={(e) => setAssignGroupId(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-[#C7C3D0] rounded-xl text-sm font-bold text-[#1A1727] outline-none">
                              <option value="">No group</option>
                              {permissionGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-1.5">Scope Type</label>
                            <select value={assignScopeType} onChange={(e) => { setAssignScopeType(e.target.value as any); setAssignScopeId('') }} className="w-full px-4 py-2.5 bg-white border border-[#C7C3D0] rounded-xl text-sm font-bold text-[#1A1727] outline-none">
                              <option value="organization">Organization</option>
                              <option value="branch">Branch</option>
                              <option value="department">Department</option>
                              <option value="self">Self</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-1.5">Scope Target</label>
                            <select value={assignScopeId} onChange={(e) => setAssignScopeId(e.target.value)} disabled={assignScopeType === 'organization' || assignScopeType === 'self'} className="w-full px-4 py-2.5 bg-white border border-[#C7C3D0] rounded-xl text-sm font-bold text-[#1A1727] outline-none disabled:opacity-40">
                              <option value="">Scope</option>
                              {assignScopeType === 'branch' && branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                              {assignScopeType === 'department' && departments.map((dept) => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-1.5">Login Email</label>
                      <input value={employee.email || ''} readOnly className="w-full px-4 py-2.5 bg-[#F8F7F9] border border-[#C7C3D0] rounded-xl text-sm font-bold text-[#9CA3AF] cursor-not-allowed" />
                    </div>
                    {canManageAppAccess && (
                    <div>
                      <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-1.5">Temporary Password</label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={tempPassword}
                            onChange={e => setTempPassword(e.target.value)}
                            placeholder="Min 8 characters"
                            className="w-full px-4 py-2.5 bg-[#F8F7F9] border border-[#C7C3D0] rounded-xl text-sm font-bold text-[#1A1727] focus:outline-none focus:ring-2 focus:ring-[#534AB7]/20 pr-10"
                          />
                          <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]">
                            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                        <button onClick={generatePassword} className="flex items-center gap-2 px-4 py-2.5 bg-[#EDE9FE] text-[#534AB7] rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-[#DDD6FE] transition-all whitespace-nowrap">
                          <RefreshCcw size={12} /> Auto-Generate
                        </button>
                      </div>
                    </div>
                    )}
                    {canManageAppAccess && (
                    <button
                      onClick={handleProvisionAccess}
                      disabled={isProvisioningAccess || !employee.email || tempPassword.length < 8}
                      className="w-full py-3 bg-[#534AB7] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-purple-900/20 hover:bg-[#1E1854] transition-all disabled:opacity-50"
                    >
                      {isProvisioningAccess ? 'Provisioning...' : 'Provision App Access'}
                    </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          )}

          {/* HISTORY TAB */}
          {activeTab === 'skills' && (
            <SkillsTab
              employeeId={employeeId}
              organizationId={organizationId}
              skills={skills}
              isLoading={tabLoading}
              isAdmin={canManageAppAccess}
              onUpdate={() => loadTabData('skills')}
            />
          )}
          {activeTab === 'performance' && (
            <PerformanceTab
              employeeId={employeeId}
              organizationId={organizationId}
              reviews={performanceReviews}
              isLoading={tabLoading}
              isAdmin={canManageAppAccess}
              onUpdate={() => loadTabData('performance')}
            />
          )}
          {activeTab === 'activity' && (
            <ActivityTab events={activityEvents} isLoading={tabLoading} />
          )}
          {activeTab === 'history' && (
            <HistoryTab events={attendanceHistory} isLoading={tabLoading} />
          )}
          </div>
          
          <RightPanel
            firstName={employee.first_name}
            lastName={employee.last_name}
            jobTitle={employee.job_title}
            attendanceStats={attendanceStats}
            activityEvents={activityEvents}
          />
        </div>
      </div>

      {/* Edit Profile Dialog */}
      {showEditDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#1A1727]/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 border border-[#C7C3D0]">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-black text-[#1A1727] tracking-tight">Edit Profile</h2>
              <button onClick={() => setShowEditDialog(false)} className="p-2 text-[#9CA3AF] hover:text-[#1A1727] transition-all"><X size={20} strokeWidth={2.5} /></button>
            </div>
            <form onSubmit={handleUpdateProfile} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-1.5 ml-1">First Name</label>
                  <input required value={editForm.first_name} onChange={e => setEditForm({...editForm, first_name: e.target.value})} className="w-full px-4 py-2.5 bg-[#F8F7F9] border border-[#C7C3D0] rounded-xl text-sm font-bold text-[#1A1727]" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-1.5 ml-1">Last Name</label>
                  <input required value={editForm.last_name} onChange={e => setEditForm({...editForm, last_name: e.target.value})} className="w-full px-4 py-2.5 bg-[#F8F7F9] border border-[#C7C3D0] rounded-xl text-sm font-bold text-[#1A1727]" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-1.5 ml-1">Phone</label>
                <input value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} className="w-full px-4 py-2.5 bg-[#F8F7F9] border border-[#C7C3D0] rounded-xl text-sm font-bold text-[#1A1727]" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-1.5 ml-1">Job Title</label>
                <input required value={editForm.job_title} onChange={e => setEditForm({...editForm, job_title: e.target.value})} className="w-full px-4 py-2.5 bg-[#F8F7F9] border border-[#C7C3D0] rounded-xl text-sm font-bold text-[#1A1727]" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-1.5 ml-1">Department</label>
                <input required value={editForm.department} onChange={e => setEditForm({...editForm, department: e.target.value})} className="w-full px-4 py-2.5 bg-[#F8F7F9] border border-[#C7C3D0] rounded-xl text-sm font-bold text-[#1A1727]" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-1.5 ml-1">Basic Salary (LKR)</label>
                <input type="number" required value={editForm.basic_salary} onChange={e => setEditForm({...editForm, basic_salary: parseFloat(e.target.value)})} className="w-full px-4 py-2.5 bg-[#F8F7F9] border border-[#C7C3D0] rounded-xl text-sm font-bold text-[#1A1727]" />
              </div>
              <button type="submit" className="w-full py-4 bg-[#534AB7] text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-purple-900/20 mt-4 active:scale-95 transition-all">Save Changes</button>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}

function ChevronDown(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
}
