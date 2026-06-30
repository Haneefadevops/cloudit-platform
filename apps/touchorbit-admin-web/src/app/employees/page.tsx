'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard-layout'
import {
  Plus, Search, Download, Upload, X, UserX
} from 'lucide-react'
import { AddEmployeeDialog } from '@/components/add-employee-dialog'
import { useEmployees } from '@/hooks/use-employees'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { ToEmptyState } from '@/components/ui/ToEmptyState'

import { KPIStrip } from './components/KPIStrip'
import { ViewModeToggle, type ViewMode } from './components/ViewModeToggle'
import { EmployeeTableView } from './components/EmployeeTableView'
import { EmployeeGridCard } from './components/EmployeeGridCard'
import { EmployeeCompactView } from './components/EmployeeCompactView'
import { EmployeePreviewDrawer } from './components/EmployeePreviewDrawer'
import { BulkActionBar } from './components/BulkActionBar'

import type { Employee } from '@/hooks/use-employees'

/* ── CSV Export ─────────────────────────────────────────────────────────── */

function handleExportCSV(employees: Employee[]) {
  if (!employees || employees.length === 0) return
  const headers = [
    'Employee Number', 'First Name', 'Last Name', 'Email', 'Phone', 'NIC',
    'Date of Birth', 'Hire Date', 'Job Title', 'Department', 'Employment Status',
    'Basic Salary', 'Bank Name', 'Bank Account Number', 'Bank Branch',
    'Address Line 1', 'Address Line 2', 'City', 'Postal Code',
    'Termination Date', 'Last Working Day', 'Termination Reason',
  ]
  const rows = employees.map((emp) => [
    emp.employee_number || '', emp.first_name || '', emp.last_name || '',
    emp.email || '', emp.phone || '', emp.nic || '', emp.date_of_birth || '',
    emp.hire_date || '', emp.job_title || '', emp.department || '',
    emp.employment_status || '', emp.basic_salary || '', emp.bank_name || '',
    emp.bank_account_number || '', emp.bank_branch || '', emp.address_line1 || '',
    emp.address_line2 || '', emp.city || '', emp.postal_code || '',
    emp.termination_date || '', emp.last_working_day || '', emp.termination_reason || '',
  ])
  const csv = [headers.join(','), ...rows.map(r => r.map((c: any) => `"${c}"`).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `employees_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function EmployeesPage() {
  const router = useRouter()
  const { organizationId, isLoaded, isDeptManager, isBranchManager, isOwner, role } = useAuth()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [departmentFilter, setDepartmentFilter] = useState<string>('all')
  const [managedScopeId, setManagedScopeId] = useState<string | null>(null)

  /* View mode with localStorage */
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  useEffect(() => {
    const saved = localStorage.getItem('touchorbit_employees_view') as ViewMode | null
    if (saved && ['grid', 'table', 'compact'].includes(saved)) {
      setViewMode(saved)
    }
  }, [])
  const handleSetViewMode = useCallback((mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem('touchorbit_employees_view', mode)
  }, [])

  /* Preview drawer */
  const [previewEmployee, setPreviewEmployee] = useState<Employee | null>(null)

  /* Bulk selection */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])
  const handleSelectAll = useCallback((ids: string[]) => {
    if (ids.length === 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(ids))
    }
  }, [])

  /* Keyboard shortcut: / to focus search, Escape to clear */
  const searchRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === 'Escape') {
        if (previewEmployee) {
          setPreviewEmployee(null)
        } else if (selectedIds.size > 0) {
          setSelectedIds(new Set())
        } else if (searchQuery) {
          setSearchQuery('')
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [previewEmployee, selectedIds.size, searchQuery])

  const { data: employees, isLoading, refetch } = useEmployees({
    departmentId: isDeptManager ? managedScopeId : null,
    branchId: isBranchManager ? managedScopeId : null,
  })

  useEffect(() => {
    if (isLoaded && organizationId) {
      if (isDeptManager) {
        supabase.rpc('get_my_managed_dept_id').then(({ data }) => setManagedScopeId(data))
      } else if (isBranchManager) {
        supabase.rpc('get_my_managed_branch_id').then(({ data }) => setManagedScopeId(data))
      }
    }
  }, [isLoaded, organizationId, isDeptManager, isBranchManager])

  const departments = useMemo(
    () => Array.from(new Set(employees?.map((emp: any) => emp.department).filter(Boolean) || [])),
    [employees]
  )

  const filteredEmployees = useMemo(() => {
    return employees?.filter((emp: any) => {
      const matchesSearch = `${emp.first_name} ${emp.last_name} ${emp.email} ${emp.phone || ''} ${emp.employee_number || ''}`.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === 'all' || emp.employment_status === statusFilter
      const matchesDepartment = departmentFilter === 'all' || emp.department === departmentFilter
      return matchesSearch && matchesStatus && matchesDepartment
    }) || []
  }, [employees, searchQuery, statusFilter, departmentFilter])

  const stats = useMemo(() => {
    const total = employees?.length || 0
    const active = employees?.filter((e: any) => e.employment_status === 'active').length || 0
    const onLeave = employees?.filter((e: any) => e.employment_status === 'on_leave').length || 0
    const terminated = employees?.filter((e: any) => e.employment_status === 'terminated').length || 0
    return { total, active, onLeave, terminated }
  }, [employees])

  const recentHires = useMemo(() => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    return employees?.filter((e: any) => e.hire_date && new Date(e.hire_date) >= thirtyDaysAgo) || []
  }, [employees])

  const handleKPIFilter = useCallback((filter: string) => {
    setStatusFilter(filter)
  }, [])

  const selectedEmployees = useMemo(() => {
    return employees?.filter((e: any) => selectedIds.has(e.id)) || []
  }, [employees, selectedIds])

  const hasFilters = searchQuery || statusFilter !== 'all' || departmentFilter !== 'all'

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full bg-[#ECECF1] font-['Plus_Jakarta_Sans']">

        {/* ── Command Header ── */}
        <div className="px-6 py-4 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-black text-[#1A1727] tracking-tight">Employees</h1>
              <p className="text-[11px] font-black text-[#6B6578] mt-0.5">
                {stats.total} total · {stats.active} active
                {recentHires.length > 0 && ` · ${recentHires.length} new this month`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExportCSV((employees as Employee[]) || [])}
                className="flex items-center gap-2 px-3 py-2 bg-[#F4F3F7] border border-[#C7C3D0] rounded-xl text-[11px] font-black text-[#1A1727] hover:bg-white transition-colors shadow-sm"
              >
                <Download size={14} strokeWidth={2.5} /> Export
              </button>
              {!isDeptManager && !isBranchManager && (
                <button
                  onClick={() => setShowImportDialog(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-[#F4F3F7] border border-[#C7C3D0] rounded-xl text-[11px] font-black text-[#1A1727] hover:bg-white transition-colors shadow-sm"
                >
                  <Upload size={14} strokeWidth={2.5} /> Import
                </button>
              )}
              <button
                onClick={() => setIsAddDialogOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#534AB7] text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-[#1E1854] transition-colors shadow-lg shadow-purple-900/20"
              >
                <Plus size={14} strokeWidth={2.5} /> Add Employee
              </button>
            </div>
          </div>
        </div>

        {/* ── KPI Strip ── */}
        <div className="px-6 pb-3 shrink-0">
          <KPIStrip stats={stats} activeFilter={statusFilter} onFilter={handleKPIFilter} />
        </div>

        {/* ── Recent Hires ── */}
        {recentHires.length > 0 && (
          <div className="px-6 pb-3 shrink-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-[#6B6578] mb-2">Recent Hires</div>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
              {recentHires.map((emp: any) => (
                <button
                  key={emp.id}
                  onClick={() => setPreviewEmployee(emp)}
                  className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-[#C7C3D0] shadow-sm hover:shadow-md hover:border-[#534AB7]/30 transition-all shrink-0"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0"
                    style={{ backgroundColor: '#534AB7' }}
                  >
                    {emp.photo_url ? (
                      <img src={emp.photo_url} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      `${emp.first_name?.[0] || ''}${emp.last_name?.[0] || ''}`
                    )}
                  </div>
                  <div className="text-left">
                    <div className="text-[11px] font-black text-[#1A1727] truncate max-w-[120px]">{emp.first_name} {emp.last_name}</div>
                    <div className="text-[9px] font-black uppercase tracking-wider text-[#9994A8]">
                      {emp.hire_date ? new Date(emp.hire_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}
                    </div>
                  </div>
                  <span className="ml-1 w-2 h-2 bg-emerald-500 rounded-full" title="New hire" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Toolbar ── */}
        <div className="px-6 py-3 flex items-center gap-3 flex-shrink-0">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9994A8]" size={16} />
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search employees... (press / to focus)"
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#C7C3D0] rounded-xl text-[12.5px] font-semibold text-[#1A1727] placeholder:text-[#9994A8] outline-none focus:border-[#534AB7] focus:ring-2 focus:ring-[#534AB7]/10 transition-all shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9994A8] hover:text-[#1A1727] transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Status Segmented Toggle */}
          <div className="flex bg-[#E3E2EA] rounded-xl p-1 gap-1 border border-[#C7C3D0] shadow-sm">
            {[
              { id: 'all', label: 'All' },
              { id: 'active', label: 'Active' },
              { id: 'on_leave', label: 'On Leave' },
              { id: 'terminated', label: 'Terminated' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  statusFilter === f.id
                    ? 'bg-white text-[#534AB7] shadow-sm'
                    : 'text-[#6B6578] hover:text-[#1A1727]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Department Filter */}
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-[#C7C3D0] shadow-sm">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#9994A8]">Dept</span>
            <select
              value={departmentFilter}
              onChange={e => setDepartmentFilter(e.target.value)}
              className="bg-transparent text-[11px] font-black text-[#1A1727] outline-none cursor-pointer"
            >
              <option value="all">All</option>
              {departments.map((d: string) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div className="h-6 w-px bg-[#C7C3D0]" />

          <ViewModeToggle value={viewMode} onChange={handleSetViewMode} />
        </div>

        {/* ── Active Filter Pills ── */}
        {hasFilters && (
          <div className="px-6 pb-2 flex items-center gap-2 flex-wrap shrink-0">
            {searchQuery && (
              <span className="flex items-center gap-1 px-2.5 py-1 bg-white border border-[#F1F0F4] rounded-lg text-[10px] font-black text-[#534AB7]">
                Search: {searchQuery}
                <button onClick={() => setSearchQuery('')}><X size={10} /></button>
              </span>
            )}
            {statusFilter !== 'all' && (
              <span className="flex items-center gap-1 px-2.5 py-1 bg-white border border-[#F1F0F4] rounded-lg text-[10px] font-black text-[#534AB7]">
                Status: {statusFilter.replace('_', ' ')}
                <button onClick={() => setStatusFilter('all')}><X size={10} /></button>
              </span>
            )}
            {departmentFilter !== 'all' && (
              <span className="flex items-center gap-1 px-2.5 py-1 bg-white border border-[#F1F0F4] rounded-lg text-[10px] font-black text-[#534AB7]">
                Dept: {departmentFilter}
                <button onClick={() => setDepartmentFilter('all')}><X size={10} /></button>
              </span>
            )}
            <button
              onClick={() => { setSearchQuery(''); setStatusFilter('all'); setDepartmentFilter('all'); }}
              className="text-[10px] font-black text-[#9994A8] uppercase tracking-widest hover:text-red-500 transition-colors"
            >
              Clear All
            </button>
          </div>
        )}

        {/* ── Content Area ── */}
        <div className="flex-1 px-6 pb-6 overflow-hidden">
          {viewMode === 'grid' && (
            <div className="h-full overflow-y-auto no-scrollbar">
              {isLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="bg-white rounded-xl border border-[#C7C3D0] p-4 animate-pulse">
                      <div className="w-14 h-14 bg-[#F1F0F4] rounded-full mx-auto mb-3" />
                      <div className="h-3 bg-[#F1F0F4] rounded w-3/4 mx-auto mb-2" />
                      <div className="h-2 bg-[#F1F0F4] rounded w-1/2 mx-auto" />
                    </div>
                  ))}
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <ToEmptyState
                    title="No employees found"
                    description="Try adjusting your search or filters."
                    action={!hasFilters ? (
                      <button
                        onClick={() => setIsAddDialogOpen(true)}
                        className="px-4 py-2 bg-[#534AB7] text-white rounded-xl text-[12px] font-black uppercase tracking-wider hover:bg-[#1E1854] transition-colors shadow-sm"
                      >
                        Add Employee
                      </button>
                    ) : undefined}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {filteredEmployees.map((emp: any) => (
                    <EmployeeGridCard
                      key={emp.id}
                      employee={emp}
                      isSelected={selectedIds.has(emp.id)}
                      onToggleSelect={handleToggleSelect}
                      onClick={setPreviewEmployee}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {viewMode === 'table' && (
            <EmployeeTableView
              employees={filteredEmployees}
              isLoading={isLoading}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onSelectAll={handleSelectAll}
              onRowClick={setPreviewEmployee}
              emptyAction={!hasFilters ? (
                <button
                  onClick={() => setIsAddDialogOpen(true)}
                  className="px-4 py-2 bg-[#534AB7] text-white rounded-xl text-[12px] font-black uppercase tracking-wider hover:bg-[#1E1854] transition-colors shadow-sm"
                >
                  Add Employee
                </button>
              ) : undefined}
            />
          )}

          {viewMode === 'compact' && (
            <EmployeeCompactView
              employees={filteredEmployees}
              isLoading={isLoading}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onRowClick={setPreviewEmployee}
              emptyAction={!hasFilters ? (
                <button
                  onClick={() => setIsAddDialogOpen(true)}
                  className="px-4 py-2 bg-[#534AB7] text-white rounded-xl text-[12px] font-black uppercase tracking-wider hover:bg-[#1E1854] transition-colors shadow-sm"
                >
                  Add Employee
                </button>
              ) : undefined}
            />
          )}
        </div>
      </div>

      {/* ── Preview Drawer ── */}
      {previewEmployee && (
        <EmployeePreviewDrawer
          employee={previewEmployee}
          onClose={() => setPreviewEmployee(null)}
          canTerminate={isOwner || role === 'super_admin'}
        />
      )}

      {/* ── Bulk Action Bar ── */}
      <BulkActionBar
        count={selectedIds.size}
        onExport={() => handleExportCSV(selectedEmployees as Employee[])}
        onEmail={() => {
          const emails = selectedEmployees.map((e: any) => e.email).filter(Boolean).join(',')
          if (emails) window.location.href = `mailto:?bcc=${emails}`
        }}
        onClear={() => setSelectedIds(new Set())}
      />

      {/* ── Dialogs ── */}
      <AddEmployeeDialog open={isAddDialogOpen} onClose={() => setIsAddDialogOpen(false)} />
      {showImportDialog && (
        <ImportCSVDialog
          onClose={() => setShowImportDialog(false)}
          onSuccess={() => { setShowImportDialog(false); refetch() }}
        />
      )}
    </DashboardLayout>
  )
}

/* ── Import CSV Dialog ──────────────────────────────────────────────────── */

function ImportCSVDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { organizationId, userId } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [preview, setPreview] = useState<any[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])

  useEffect(() => {
    if (!organizationId) return
    Promise.all([
      supabase.from('branches').select('id, name, code').eq('organization_id', organizationId),
      supabase.from('departments').select('id, name, code').eq('organization_id', organizationId),
    ]).then(([branchRows, deptRows]) => {
      setBranches(branchRows.data || [])
      setDepartments(deptRows.data || [])
    })
  }, [organizationId])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    setFile(selectedFile)
    setErrors([])
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const lines = text.split('\n').filter(line => line.trim())
      if (lines.length < 2) { setErrors(['CSV file must contain headers and at least one employee']); return }
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
      const rows = lines.slice(1, 6).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
        const obj: any = {}
        headers.forEach((h, i) => { obj[h] = values[i] || '' })
        return obj
      })
      setPreview(rows)
    }
    reader.readAsText(selectedFile)
  }

  function downloadTemplate() {
    const template = `Employee Number,First Name,Last Name,Email,Phone,NIC,Date of Birth,Hire Date,Job Title,Department,Basic Salary,Bank Name,Bank Account Number,Bank Branch,System Role,Permission Groups,Scope Type,Scope Code,Temporary Password
EMP001,John,Doe,john@example.com,0771234567,123456789V,1990-01-15,2024-01-01,Software Engineer,Engineering,150000,Commercial Bank,123456789,Colombo,employee,,,,
EMP002,Jane,Smith,jane@example.com,0771234568,987654321V,1992-05-20,2024-02-01,HR Manager,Human Resources,120000,Bank of Ceylon,987654321,Colombo,manager,Leave Approver,department,Engineering,`
    const blob = new Blob([template], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'employee_import_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport() {
    if (!file || !organizationId) return
    setImporting(true)
    setErrors([])
    try {
      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
      const rows = lines.slice(1)
      const columnMapping: Record<string, string> = {
        'bank_account': 'bank_account_number',
        'account_number': 'bank_account_number',
        'emp_number': 'employee_number',
        'emp_no': 'employee_number',
        'system_role': 'system_role',
        'permission_group': 'permission_groups',
        'permission_groups': 'permission_groups',
        'scope_type': 'scope_type',
        'scope_code': 'scope_code',
        'temporary_password': 'temporary_password',
        'temp_password': 'temporary_password',
      }
      const parsedRows = rows.map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
        const obj: any = { organization_id: organizationId }
        headers.forEach((h, i) => {
          let key = h.toLowerCase().replace(/ /g, '_')
          if (columnMapping[key]) key = columnMapping[key]
          obj[key] = values[i] || null
        })
        return obj
      })
      const securityColumns = ['system_role', 'permission_groups', 'scope_type', 'scope_code', 'temporary_password']
      const employeesToImport = parsedRows.map((row) => {
        const employee = { ...row }
        securityColumns.forEach((key) => delete employee[key])
        return employee
      })
      const { data, error } = await supabase.from('employees').insert(employeesToImport).select()
      if (error) throw error
      const tempPasswordFor = (seed: string) => {
        const suffix = Math.random().toString(36).slice(2, 8)
        return `${seed.slice(0, 3) || 'Tmp'}#${suffix}9A`
      }
      const resolveScopeId = (scopeType: string, scopeCode: string | null) => {
        if (!scopeCode) return null
        const wanted = scopeCode.toLowerCase()
        if (scopeType === 'branch') return branches.find((branch) => [branch.id, branch.name, branch.code].filter(Boolean).map(String).map(v => v.toLowerCase()).includes(wanted))?.id || null
        if (scopeType === 'department') return departments.find((dept) => [dept.id, dept.name, dept.code].filter(Boolean).map(String).map(v => v.toLowerCase()).includes(wanted))?.id || null
        return null
      }

      for (let i = 0; i < data.length; i++) {
        const emp = data[i]
        const sourceRow = parsedRows[i]
        await supabase.from('employee_history').insert({ employee_id: emp.id, event_type: 'imported', details: { source: 'csv_import', imported_by: userId }, changed_by: userId })

        const requestedRole = sourceRow.system_role
        const requestedGroups = sourceRow.permission_groups
        if (requestedRole || requestedGroups) {
          const groupNames = String(requestedGroups || '').split('|').map((value: string) => value.trim()).filter(Boolean)
          const password = sourceRow.temporary_password || tempPasswordFor(sourceRow.first_name || 'Tmp')
          const scopeType = sourceRow.scope_type || 'organization'
          const provisionRes = await fetch('/api/provision-employee', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              employeeId: emp.id,
              email: emp.email,
              password,
              forceReset: true,
              systemRole: requestedRole || 'employee',
              permissionGroupNames: groupNames,
              scopeType,
              scopeId: resolveScopeId(scopeType, sourceRow.scope_code),
            })
          })
          const provisionResult = await provisionRes.json()
          if (provisionResult.error) throw new Error(`Access setup failed for ${emp.email}: ${provisionResult.error}`)
        }
      }
      toast.success(`Successfully imported ${data.length} employees`)
      onSuccess()
    } catch (error: any) {
      console.error('Import error:', error)
      setErrors([error.message || 'Failed to import employees'])
      toast.error('Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-6 border-b border-[#F1F0F4] flex items-center justify-between">
          <h2 className="text-lg font-black text-[#1A1727]">Import Employees from CSV</h2>
          <button onClick={onClose} className="text-[#9994A8] hover:text-[#1A1727] text-xl font-black transition-colors">✕</button>
        </div>
        <div className="p-6 space-y-5">
          <div className="bg-[#F4F3F7] border border-[#C7C3D0] rounded-xl p-4">
            <p className="text-sm font-black text-[#1A1727] mb-1">Instructions</p>
            <p className="text-xs text-[#6B6578]">Upload a CSV file with employee data. Column headers must exactly match the template. Use &quot;Bank Account Number&quot; (not &quot;Bank Account&quot;), &quot;Employee Number&quot; (not &quot;Emp ID&quot;), etc.</p>
          </div>
          <button onClick={downloadTemplate} className="flex items-center gap-2 text-[#534AB7] hover:text-[#1E1854] text-sm font-black transition-colors">
            <Download size={14} /> Download CSV Template
          </button>
          <div>
            <label className="block text-xs font-black text-[#1A1727] uppercase tracking-wider mb-2">Select CSV File</label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-[#9994A8] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-black file:bg-[#F4F3F7] file:text-[#534AB7] hover:file:bg-[#ECECF1]"
            />
          </div>
          {preview.length > 0 && (
            <div>
              <h3 className="text-xs font-black text-[#1A1727] uppercase tracking-wider mb-2">Preview (first {preview.length} rows)</h3>
              <div className="overflow-x-auto border border-[#F1F0F4] rounded-xl">
                <table className="min-w-full divide-y divide-[#F1F0F4] text-sm">
                  <thead className="bg-[#F4F3F7]">
                    <tr>
                      {['Name','Email','Job Title','Department'].map(h => (
                        <th key={h} className="px-4 py-2 text-left text-[10px] font-black text-[#6B6578] uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F0F4]">
                    {preview.map((row, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2 text-[13px] font-black text-[#1A1727]">{row['First Name']} {row['Last Name']}</td>
                        <td className="px-4 py-2 text-[13px] text-[#6B6578]">{row['Email']}</td>
                        <td className="px-4 py-2 text-[13px] text-[#6B6578]">{row['Job Title']}</td>
                        <td className="px-4 py-2 text-[13px] text-[#6B6578]">{row['Department']}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-4">
              <p className="text-xs font-black text-red-700 uppercase tracking-wider mb-2">Import Errors</p>
              <ul className="text-sm text-red-600 list-disc list-inside space-y-1">
                {errors.map((error, i) => <li key={i}>{error}</li>)}
              </ul>
            </div>
          )}
        </div>
        <div className="p-6 border-t border-[#F1F0F4] flex gap-3">
          <button onClick={onClose} disabled={importing} className="flex-1 py-2.5 border border-[#C7C3D0] rounded-xl text-sm font-black text-[#1A1727] hover:bg-[#F4F3F7] transition-colors">Cancel</button>
          <button
            onClick={handleImport}
            disabled={!file || importing || errors.length > 0}
            className="flex-1 py-2.5 bg-[#534AB7] text-white rounded-xl text-sm font-black hover:bg-[#1E1854] transition-colors disabled:opacity-40"
          >
            {importing ? 'Importing...' : `Import ${preview.length > 0 ? preview.length + '+' : ''} Employees`}
          </button>
        </div>
      </div>
    </div>
  )
}
