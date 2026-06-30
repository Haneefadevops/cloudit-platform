'use client'

import { useEffect, useState } from 'react'
import { RefreshCcw, X } from 'lucide-react'
import { useCreateEmployee } from '@/hooks/use-employees'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

interface AddEmployeeDialogProps {
  open: boolean
  onClose: () => void
}

export function AddEmployeeDialog({ open, onClose }: AddEmployeeDialogProps) {
  const createEmployee = useCreateEmployee()
  const { organizationId } = useAuth()
  const [branches, setBranches] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [permissionGroups, setPermissionGroups] = useState<any[]>([])
  const [enableAppAccess, setEnableAppAccess] = useState(false)
  const [tempPassword, setTempPassword] = useState('')
  const [systemRole, setSystemRole] = useState('employee')
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
  const [scopeType, setScopeType] = useState<'organization' | 'branch' | 'department' | 'self'>('organization')
  const [scopeId, setScopeId] = useState('')
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    job_title: '',
    department: '',
    department_id: '',
    branch_id: '',
    hire_date: new Date().toISOString().split('T')[0],
    basic_salary: '',
  })

  useEffect(() => {
    if (open && organizationId) {
      loadDropdownData()
    }
  }, [open, organizationId])

  async function loadDropdownData() {
    // Load branches
    const { data: branchesData } = await supabase
      .from('branches')
      .select('id, name')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
    setBranches(branchesData || [])

    // Load departments
    const { data: departmentsData } = await supabase
      .from('departments')
      .select('id, name')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('name')
    setDepartments(departmentsData || [])

    const { data: groupsData } = await supabase
      .from('permission_groups')
      .select('id, name, description')
      .or(`organization_id.eq.${organizationId},organization_id.is.null`)
      .order('name')
    setPermissionGroups(groupsData || [])
  }

  function generatePassword() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#'
    setTempPassword(Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (enableAppAccess && (!tempPassword || tempPassword.length < 8)) {
      return
    }

    const employee = await createEmployee.mutateAsync({
      first_name: formData.first_name,
      last_name: formData.last_name,
      email: formData.email,
      phone: formData.phone || undefined,
      job_title: formData.job_title || undefined,
      department: formData.department || undefined,
      department_id: formData.department_id || undefined,
      branch_id: formData.branch_id || undefined,
      hire_date: formData.hire_date || undefined,
      basic_salary: formData.basic_salary ? parseFloat(formData.basic_salary) : undefined,
    })

    if (enableAppAccess) {
      const res = await fetch('/api/provision-employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: employee.id,
          email: formData.email,
          password: tempPassword,
          forceReset: true,
          systemRole,
          permissionGroupIds: selectedGroupIds,
          scopeType,
          scopeId: scopeType === 'branch' || scopeType === 'department' ? scopeId : null,
        })
      })
      const result = await res.json()
      if (result.error) throw new Error(result.error)
    }

    // Reset form and close
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      job_title: '',
      department: '',
      department_id: '',
      branch_id: '',
      hire_date: new Date().toISOString().split('T')[0],
      basic_salary: '',
    })
    setEnableAppAccess(false)
    setTempPassword('')
    setSystemRole('employee')
    setSelectedGroupIds([])
    setScopeType('organization')
    setScopeId('')
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        {/* Dialog */}
        <div className="relative w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Add New Employee</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              {/* First Name */}
              <div>
                <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  id="first_name"
                  required
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              {/* Last Name */}
              <div>
                <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  id="last_name"
                  required
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  id="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              {/* Phone */}
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              {/* Job Title */}
              <div>
                <label htmlFor="job_title" className="block text-sm font-medium text-gray-700 mb-1">
                  Job Title
                </label>
                <input
                  type="text"
                  id="job_title"
                  value={formData.job_title}
                  onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              {/* Department */}
              <div>
                <label htmlFor="department_id" className="block text-sm font-medium text-gray-700 mb-1">
                  Department
                </label>
                <select
                  id="department_id"
                  value={formData.department_id}
                  onChange={(e) => {
                    const deptId = e.target.value;
                    const deptName = departments.find(d => d.id === deptId)?.name || '';
                    setFormData({ ...formData, department_id: deptId, department: deptName });
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white text-sm"
                >
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>

              {/* Branch */}
              <div>
                <label htmlFor="branch_id" className="block text-sm font-medium text-gray-700 mb-1">
                  Branch
                </label>
                <select
                  id="branch_id"
                  value={formData.branch_id}
                  onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white"
                >
                  <option value="">No Branch (Default)</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              {/* Hire Date */}
              <div>
                <label htmlFor="hire_date" className="block text-sm font-medium text-gray-700 mb-1">
                  Hire Date
                </label>
                <input
                  type="date"
                  id="hire_date"
                  value={formData.hire_date}
                  onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              {/* Basic Salary */}
              <div>
                <label htmlFor="basic_salary" className="block text-sm font-medium text-gray-700 mb-1">
                  Basic Salary (LKR)
                </label>
                <input
                  type="number"
                  id="basic_salary"
                  step="0.01"
                  value={formData.basic_salary}
                  onChange={(e) => setFormData({ ...formData, basic_salary: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-4">
              <label className="flex items-center gap-3 text-sm font-bold text-gray-900">
                <input
                  type="checkbox"
                  checked={enableAppAccess}
                  onChange={(e) => setEnableAppAccess(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                Enable app login during onboarding
              </label>

              {enableAppAccess && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">System Role</label>
                    <select
                      value={systemRole}
                      onChange={(e) => setSystemRole(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white text-sm"
                    >
                      {['employee', 'manager', 'admin', 'super_admin'].map((role) => (
                        <option key={role} value={role}>{role.replace('_', ' ')}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password *</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={tempPassword}
                        onChange={(e) => setTempPassword(e.target.value)}
                        minLength={8}
                        required={enableAppAccess}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                      <button type="button" onClick={generatePassword} className="rounded-lg border border-purple-100 bg-purple-50 px-3 text-purple-700 hover:bg-purple-100">
                        <RefreshCcw className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Permission Groups</label>
                    <select
                      multiple
                      value={selectedGroupIds}
                      onChange={(e) => setSelectedGroupIds(Array.from(e.target.selectedOptions).map((option) => option.value))}
                      className="h-28 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white text-sm"
                    >
                      {permissionGroups.map((group) => (
                        <option key={group.id} value={group.id}>{group.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
                      <select
                        value={scopeType}
                        onChange={(e) => { setScopeType(e.target.value as any); setScopeId('') }}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white text-sm"
                      >
                        <option value="organization">Organization</option>
                        <option value="branch">Branch</option>
                        <option value="department">Department</option>
                        <option value="self">Self</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Scope Target</label>
                      <select
                        value={scopeId}
                        onChange={(e) => setScopeId(e.target.value)}
                        disabled={scopeType === 'organization' || scopeType === 'self'}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white text-sm disabled:opacity-40"
                      >
                        <option value="">Select</option>
                        {scopeType === 'branch' && branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                        {scopeType === 'department' && departments.map((dept) => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createEmployee.isPending}
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createEmployee.isPending ? 'Adding...' : 'Add Employee'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
