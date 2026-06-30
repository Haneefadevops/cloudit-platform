'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { usePermissions } from '@/hooks/use-permissions'
import { supabase } from '@/lib/supabase'
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Database,
  Download,
  Eye,
  EyeOff,
  Filter,
  Loader2,
  MonitorSmartphone,
  RefreshCcw,
  ScrollText,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

type AuditEvent = {
  id: string
  organization_id: string
  source_table: string
  actor_user_id: string | null
  actor_name: string | null
  actor_email: string | null
  target_user_id: string | null
  target_employee_id: string | null
  target_name: string | null
  module: string
  action: string
  severity: 'info' | 'notice' | 'sensitive' | 'critical'
  entity_type: string
  entity_id: string | null
  entity_label: string | null
  old_value: Record<string, unknown>
  new_value: Record<string, unknown>
  changed_fields: unknown[]
  metadata: Record<string, unknown>
  source: string
  ip_address: string | null
  user_agent: string | null
  created_at: string
  is_sensitive: boolean
  is_redacted: boolean
  total_count: number
}

type AuditPolicy = {
  id: string
  organization_id: string
  capture_ip_mode: 'sensitive_only' | 'all' | 'security_only' | 'off'
  retention_days: number | null
  optional_modules: Record<string, boolean>
  created_at: string
  updated_at: string
}

type DirectoryUser = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
}

type DirectoryEmployee = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  employee_number?: string | null
}

const MODULES = [
  'employees',
  'org_chart',
  'security',
  'access',
  'salary',
  'payroll',
  'attendance',
  'leave',
  'overtime',
  'expenses',
  'roster',
  'calendar',
  'documents',
  'tasks',
  'settings',
  'imports',
  'exports',
  'system',
]

const ACTIONS = [
  'created',
  'updated',
  'deleted',
  'approved',
  'rejected',
  'cancelled',
  'imported',
  'exported',
  'downloaded',
  'enabled',
  'disabled',
  'assigned',
  'unassigned',
  'reassigned',
  'finalized',
  'published',
  'revoked',
  'reviewed',
  'terminated',
]

const OPTIONAL_MODULES = [
  'employees',
  'org_chart',
  'attendance',
  'leave',
  'overtime',
  'expenses',
  'roster',
  'calendar',
  'documents',
  'tasks',
  'settings',
  'imports',
  'exports',
  'system',
]

const REQUIRED_MODULES = ['salary', 'payroll', 'security', 'access']

const CAPTURE_MODES = [
  { value: 'sensitive_only', label: 'Sensitive only', description: 'Store IP/device on locked security events.' },
  { value: 'all', label: 'All audit events', description: 'Store IP/device whenever it is provided.' },
  { value: 'security_only', label: 'Security only', description: 'Store IP/device only for access and permissions.' },
  { value: 'off', label: 'Off', description: 'Do not store IP/device context.' },
] as const

function humanize(value: string | null | undefined) {
  if (!value) return 'Unknown'
  return value
    .replace(/[._-]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Unknown time'
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function displayName(record: DirectoryUser | DirectoryEmployee) {
  const name = [record.first_name, record.last_name].filter(Boolean).join(' ')
  return name || record.email || ('employee_number' in record ? record.employee_number : null) || record.id
}

function jsonSummary(value: unknown) {
  if (!value || (typeof value === 'object' && Object.keys(value as Record<string, unknown>).length === 0)) {
    return 'None'
  }
  if (typeof value === 'object' && (value as Record<string, unknown>).redacted) {
    return '[REDACTED]'
  }
  return JSON.stringify(value, null, 2)
}

function severityClasses(severity: AuditEvent['severity']) {
  switch (severity) {
    case 'critical':
      return 'bg-red-50 text-red-700 border-red-200'
    case 'sensitive':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'notice':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    default:
      return 'bg-gray-50 text-gray-600 border-gray-200'
  }
}

function sourceLabel(source: string) {
  return humanize(source === 'legacy' ? 'legacy log' : source)
}

function sourceDetailLabel(event: AuditEvent) {
  if (event.source_table === 'audit_events') return sourceLabel(event.source)
  if (event.source_table === 'security_audit_log') return 'Legacy security log'
  if (event.source_table === 'employee_history') return 'Legacy employee history'
  return `${sourceLabel(event.source)} from ${humanize(event.source_table)}`
}

function auditActionLabel(event: AuditEvent) {
  const action = event.action.toLowerCase()
  const legacyAction = String(event.metadata?.legacy_action ?? '').toLowerCase()
  const combined = `${action} ${legacyAction}`

  if (combined.includes('reassign')) return 'Reassigned manager'
  if (combined.includes('review spoofing')) return 'Reviewed spoofing'
  if (combined.includes('overtime') && combined.includes('approve')) return 'Approved overtime'
  if (combined.includes('roster') && combined.includes('edit')) return 'Edited roster'
  if (event.module === 'employees' && action === 'updated') return 'Updated employee'
  if (event.module === 'org_chart' && action === 'reassigned') return 'Reassigned manager'
  return humanize(event.action)
}

function compactEntityId(value: string) {
  return value.length > 18 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value
}

function DetailBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-widest text-[#9994A8]">{label}</div>
      <div className="mt-1 text-[13px] font-bold text-[#1A1727]">{children}</div>
    </div>
  )
}

function JsonBox({ value }: { value: unknown }) {
  return (
    <pre className="max-h-52 overflow-auto rounded-lg border border-[#ECE9F2] bg-[#F8F7F9] p-3 text-[11px] leading-relaxed text-[#4B465C]">
      {jsonSummary(value)}
    </pre>
  )
}

export default function AuditPage() {
  const { can, loading: permissionLoading } = usePermissions([
    'audit.read',
    'audit.read_sensitive',
    'audit.export',
    'settings.manage_security',
    'audit.manage_retention',
  ])

  const [events, setEvents] = useState<AuditEvent[]>([])
  const [policy, setPolicy] = useState<AuditPolicy | null>(null)
  const [users, setUsers] = useState<DirectoryUser[]>([])
  const [employees, setEmployees] = useState<DirectoryEmployee[]>([])
  const [selected, setSelected] = useState<AuditEvent | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [policyLoading, setPolicyLoading] = useState(true)
  const [isSavingPolicy, setIsSavingPolicy] = useState(false)
  const [showPolicy, setShowPolicy] = useState(false)

  const [search, setSearch] = useState('')
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [moduleFilter, setModuleFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [actorFilter, setActorFilter] = useState('')
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [page, setPage] = useState(0)
  const limit = 50

  const canRead = can('audit.read')
  const canReadSensitive = can('audit.read_sensitive')
  const canExport = can('audit.export')
  const canManagePolicy = can('settings.manage_security') || can('audit.manage_retention')
  const totalCount = events[0]?.total_count ?? 0
  const pageCount = Math.max(1, Math.ceil(totalCount / limit))
  const employeeById = useMemo(() => new Map(employees.map((employee) => [employee.id, displayName(employee)])), [employees])

  const activeFilters = useMemo(
    () => [search, startAt, endAt, moduleFilter, actionFilter, severityFilter, actorFilter, employeeFilter].filter(Boolean).length,
    [search, startAt, endAt, moduleFilter, actionFilter, severityFilter, actorFilter, employeeFilter]
  )

  const stats = useMemo(() => {
    return events.reduce(
      (acc, event) => {
        acc.total += 1
        if (event.is_sensitive) acc.sensitive += 1
        if (event.severity === 'critical') acc.critical += 1
        if (event.source_table !== 'audit_events') acc.legacy += 1
        return acc
      },
      { total: 0, sensitive: 0, critical: 0, legacy: 0 }
    )
  }, [events])

  const displayChangedFields = useCallback((event: AuditEvent) => {
    if (Array.isArray(event.changed_fields) && event.changed_fields.length > 0) {
      return event.changed_fields.map((field) => humanize(String(field)))
    }

    const oldKeys = event.old_value && typeof event.old_value === 'object' ? Object.keys(event.old_value) : []
    const newKeys = event.new_value && typeof event.new_value === 'object' ? Object.keys(event.new_value) : []
    return Array.from(new Set([...oldKeys, ...newKeys])).map((field) => humanize(field))
  }, [])

  const displayAuditValue = useCallback((value: unknown): unknown => {
    if (!value || typeof value !== 'object') return value
    if (Array.isArray(value)) return value.map(displayAuditValue)

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, rawValue]) => {
        if (typeof rawValue === 'string' && key.endsWith('_id')) {
          const label = employeeById.get(rawValue)
          return [humanize(key), label ? `${label} (${compactEntityId(rawValue)})` : rawValue]
        }

        return [humanize(key), displayAuditValue(rawValue)]
      })
    )
  }, [employeeById])

  const loadDirectory = useCallback(async () => {
    const [{ data: userRows }, { data: employeeRows }] = await Promise.all([
      supabase.from('users').select('id, email, first_name, last_name').order('first_name', { ascending: true }).limit(500),
      supabase.from('employees').select('id, first_name, last_name, email, employee_number').order('first_name', { ascending: true }).limit(500),
    ])
    setUsers((userRows ?? []) as DirectoryUser[])
    setEmployees((employeeRows ?? []) as DirectoryEmployee[])
  }, [])

  const loadPolicy = useCallback(async () => {
    if (!canRead && !canManagePolicy) {
      setPolicyLoading(false)
      return
    }

    setPolicyLoading(true)
    const { data, error } = await supabase.rpc('get_audit_policy_settings')
    if (error) {
      console.error('[audit policy]', error)
      toast.error('Could not load audit policy settings')
    } else {
      setPolicy(((data ?? [])[0] ?? null) as AuditPolicy | null)
    }
    setPolicyLoading(false)
  }, [canManagePolicy, canRead])

  const loadEvents = useCallback(async () => {
    if (!canRead) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const { data, error } = await supabase.rpc('get_audit_events', {
      p_start_at: startAt ? new Date(startAt).toISOString() : null,
      p_end_at: endAt ? new Date(endAt).toISOString() : null,
      p_actor_user_id: actorFilter || null,
      p_target_employee_id: employeeFilter || null,
      p_target_user_id: null,
      p_module: moduleFilter || null,
      p_action: actionFilter || null,
      p_severity: severityFilter || null,
      p_entity_type: null,
      p_entity_id: null,
      p_search: search.trim() || null,
      p_limit: limit,
      p_offset: page * limit,
      p_require_audit_permission: true,
    })

    if (error) {
      console.error('[audit events]', error)
      toast.error('Could not load audit events')
      setEvents([])
    } else {
      setEvents((data ?? []) as AuditEvent[])
    }
    setIsLoading(false)
  }, [actionFilter, actorFilter, canRead, employeeFilter, endAt, moduleFilter, page, search, severityFilter, startAt])

  useEffect(() => {
    if (permissionLoading) return
    loadDirectory()
  }, [loadDirectory, permissionLoading])

  useEffect(() => {
    if (permissionLoading) return
    loadPolicy()
  }, [loadPolicy, permissionLoading])

  useEffect(() => {
    if (permissionLoading) return
    loadEvents()
  }, [loadEvents, permissionLoading])

  function clearFilters() {
    setSearch('')
    setStartAt('')
    setEndAt('')
    setModuleFilter('')
    setActionFilter('')
    setSeverityFilter('')
    setActorFilter('')
    setEmployeeFilter('')
    setPage(0)
  }

  async function updatePolicy(payload: {
    p_capture_ip_mode?: AuditPolicy['capture_ip_mode'] | null
    p_retention_days?: number | null
    p_optional_modules?: Record<string, boolean> | null
    p_clear_retention?: boolean
  }) {
    if (!canManagePolicy) return
    setIsSavingPolicy(true)
    const { data, error } = await supabase.rpc('update_audit_policy_settings', {
      p_capture_ip_mode: payload.p_capture_ip_mode ?? null,
      p_retention_days: payload.p_retention_days ?? null,
      p_optional_modules: payload.p_optional_modules ?? null,
      p_clear_retention: payload.p_clear_retention ?? false,
    })
    if (error) {
      console.error('[audit policy save]', error)
      toast.error('Could not save audit policy')
    } else {
      setPolicy(((data ?? [])[0] ?? null) as AuditPolicy | null)
      toast.success('Audit policy updated')
    }
    setIsSavingPolicy(false)
  }

  function exportCsv() {
    if (!canExport || events.length === 0) return
    const headers = ['created_at', 'actor', 'action', 'target', 'module', 'severity', 'entity_type', 'source', 'redacted']
    const rows = events.map((event) => [
      event.created_at,
      event.actor_name ?? '',
      event.action,
      event.target_name ?? '',
      event.module,
      event.severity,
      event.entity_type,
      event.source,
      event.is_redacted ? 'yes' : 'no',
    ])
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `touchorbit-audit-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  if (permissionLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center bg-[#F7F5FA]">
          <Loader2 className="h-7 w-7 animate-spin text-[#534AB7]" />
        </div>
      </DashboardLayout>
    )
  }

  if (!canRead) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center bg-[#F7F5FA] p-6">
          <div className="max-w-md rounded-xl border border-[#ECE9F2] bg-white p-8 text-center shadow-sm">
            <ShieldCheck className="mx-auto mb-4 h-10 w-10 text-[#534AB7]" />
            <h1 className="text-[20px] font-black text-[#1A1727]">Audit access required</h1>
            <p className="mt-2 text-[13px] font-semibold leading-relaxed text-[#6B6578]">
              You need the audit.read permission to open the organization audit center.
            </p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="min-h-full bg-[#F7F5FA] text-[#1A1727]">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-5 p-4 sm:p-6">
          <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#534AB7] text-white">
                  <ScrollText size={18} />
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest text-[#534AB7]">Security and compliance</span>
              </div>
              <h1 className="text-[28px] font-black tracking-tight text-[#1A1727]">Audit Center</h1>
              <p className="mt-1 text-[13px] font-semibold text-[#6B6578]">
                Review who changed what, where it happened, and which sensitive details were protected.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={loadEvents}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#D8D3E2] bg-white px-3 text-[12px] font-black uppercase tracking-wider text-[#534AB7] transition-colors hover:border-[#534AB7]"
              >
                <RefreshCcw size={15} /> Refresh
              </button>
              <button
                onClick={() => setShowPolicy((value) => !value)}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#D8D3E2] bg-white px-3 text-[12px] font-black uppercase tracking-wider text-[#1A1727] transition-colors hover:border-[#534AB7]"
              >
                <SlidersHorizontal size={15} /> Policy
              </button>
              <button
                onClick={exportCsv}
                disabled={!canExport || events.length === 0}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#1A1727] px-3 text-[12px] font-black uppercase tracking-wider text-white transition-colors hover:bg-[#302A45] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Download size={15} /> Export
              </button>
            </div>
          </header>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-[#ECE9F2] bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#9994A8]">Loaded rows</span>
                <Database size={15} className="text-[#534AB7]" />
              </div>
              <div className="mt-3 text-[26px] font-black text-[#1A1727]">{stats.total}</div>
              <div className="mt-1 text-[11px] font-bold text-[#9994A8]">{totalCount} matching total</div>
            </div>
            <div className="rounded-xl border border-[#ECE9F2] bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#9994A8]">Sensitive</span>
                <EyeOff size={15} className="text-amber-600" />
              </div>
              <div className="mt-3 text-[26px] font-black text-[#1A1727]">{stats.sensitive}</div>
              <div className="mt-1 text-[11px] font-bold text-[#9994A8]">{canReadSensitive ? 'Values visible by permission' : 'Values redacted'}</div>
            </div>
            <div className="rounded-xl border border-[#ECE9F2] bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#9994A8]">Critical</span>
                <AlertTriangle size={15} className="text-red-600" />
              </div>
              <div className="mt-3 text-[26px] font-black text-[#1A1727]">{stats.critical}</div>
              <div className="mt-1 text-[11px] font-bold text-[#9994A8]">High-risk events in this page</div>
            </div>
            <div className="rounded-xl border border-[#ECE9F2] bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#9994A8]">Legacy rows</span>
                <CheckCircle2 size={15} className="text-emerald-600" />
              </div>
              <div className="mt-3 text-[26px] font-black text-[#1A1727]">{stats.legacy}</div>
              <div className="mt-1 text-[11px] font-bold text-[#9994A8]">From old history/security logs</div>
            </div>
          </section>

          {showPolicy && (
            <section className="rounded-xl border border-[#D8D3E2] bg-white p-4 shadow-sm">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-[15px] font-black text-[#1A1727]">
                    <Settings2 size={17} className="text-[#534AB7]" /> Audit Policy
                  </h2>
                  <p className="mt-1 text-[12px] font-semibold text-[#6B6578]">
                    Optional categories can be tuned. Required salary, payroll, security, access, termination, export, and sensitive review events stay locked on.
                  </p>
                </div>
                {policyLoading && <Loader2 className="h-4 w-4 animate-spin text-[#534AB7]" />}
              </div>

              <div className="grid gap-4 xl:grid-cols-[1fr_1.3fr]">
                <div className="rounded-lg border border-[#ECE9F2] p-4">
                  <div className="mb-3 text-[10px] font-black uppercase tracking-widest text-[#9994A8]">IP and device capture</div>
                  <div className="grid gap-2">
                    {CAPTURE_MODES.map((mode) => {
                      const active = policy?.capture_ip_mode === mode.value
                      return (
                        <button
                          key={mode.value}
                          onClick={() => updatePolicy({ p_capture_ip_mode: mode.value })}
                          disabled={!canManagePolicy || isSavingPolicy}
                          className={`rounded-lg border p-3 text-left transition-colors ${active ? 'border-[#534AB7] bg-[#F4F1FF]' : 'border-[#ECE9F2] bg-white hover:border-[#C7C3D0]'} disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[13px] font-black text-[#1A1727]">{mode.label}</span>
                            {active && <CheckCircle2 size={15} className="text-[#534AB7]" />}
                          </div>
                          <p className="mt-1 text-[11px] font-semibold text-[#6B6578]">{mode.description}</p>
                        </button>
                      )
                    })}
                  </div>

                  <div className="mt-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#9994A8]">Retention days</label>
                    <div className="mt-2 flex gap-2">
                      <input
                        type="number"
                        min={30}
                        placeholder={policy?.retention_days ? String(policy.retention_days) : 'Forever'}
                        disabled={!canManagePolicy || isSavingPolicy}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter') return
                          const value = Number((event.target as HTMLInputElement).value)
                          if (value >= 30) updatePolicy({ p_retention_days: value })
                        }}
                        className="h-10 min-w-0 flex-1 rounded-lg border border-[#D8D3E2] bg-white px-3 text-[13px] font-bold outline-none focus:border-[#534AB7]"
                      />
                      <button
                        onClick={() => updatePolicy({ p_clear_retention: true })}
                        disabled={!canManagePolicy || isSavingPolicy}
                        className="rounded-lg border border-[#D8D3E2] px-3 text-[12px] font-black uppercase tracking-wider text-[#6B6578] disabled:opacity-50"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-[#ECE9F2] p-4">
                  <div className="mb-3 text-[10px] font-black uppercase tracking-widest text-[#9994A8]">Optional audit categories</div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {OPTIONAL_MODULES.map((moduleName) => {
                      const enabled = policy?.optional_modules?.[moduleName] ?? true
                      return (
                        <button
                          key={moduleName}
                          onClick={() => updatePolicy({ p_optional_modules: { [moduleName]: !enabled } })}
                          disabled={!canManagePolicy || isSavingPolicy}
                          className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${enabled ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-[#ECE9F2] bg-[#F8F7F9] text-[#6B6578]'} disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          <span className="text-[12px] font-black">{humanize(moduleName)}</span>
                          <span className="text-[10px] font-black uppercase">{enabled ? 'On' : 'Off'}</span>
                        </button>
                      )
                    })}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {REQUIRED_MODULES.map((moduleName) => (
                      <span key={moduleName} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-amber-700">
                        {humanize(moduleName)} locked
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="rounded-xl border border-[#ECE9F2] bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-end">
              <label className="flex min-w-[240px] flex-1 flex-col gap-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#9994A8]">Search</span>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9994A8]" />
                  <input
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value)
                      setPage(0)
                    }}
                    placeholder="Actor, target, action, module..."
                    className="h-10 w-full rounded-lg border border-[#D8D3E2] bg-white pl-9 pr-3 text-[13px] font-semibold outline-none focus:border-[#534AB7]"
                  />
                </div>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#9994A8]">From</span>
                <input type="datetime-local" value={startAt} onChange={(event) => { setStartAt(event.target.value); setPage(0) }} className="h-10 rounded-lg border border-[#D8D3E2] px-3 text-[12px] font-bold outline-none focus:border-[#534AB7]" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#9994A8]">To</span>
                <input type="datetime-local" value={endAt} onChange={(event) => { setEndAt(event.target.value); setPage(0) }} className="h-10 rounded-lg border border-[#D8D3E2] px-3 text-[12px] font-bold outline-none focus:border-[#534AB7]" />
              </label>
              <button
                onClick={clearFilters}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#D8D3E2] px-3 text-[12px] font-black uppercase tracking-wider text-[#6B6578] hover:border-[#534AB7]"
              >
                <Filter size={14} /> Clear {activeFilters > 0 ? `(${activeFilters})` : ''}
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <select value={moduleFilter} onChange={(event) => { setModuleFilter(event.target.value); setPage(0) }} className="h-10 rounded-lg border border-[#D8D3E2] bg-white px-3 text-[12px] font-bold outline-none focus:border-[#534AB7]">
                <option value="">All modules</option>
                {MODULES.map((moduleName) => <option key={moduleName} value={moduleName}>{humanize(moduleName)}</option>)}
              </select>
              <select value={actionFilter} onChange={(event) => { setActionFilter(event.target.value); setPage(0) }} className="h-10 rounded-lg border border-[#D8D3E2] bg-white px-3 text-[12px] font-bold outline-none focus:border-[#534AB7]">
                <option value="">All actions</option>
                {ACTIONS.map((action) => <option key={action} value={action}>{humanize(action)}</option>)}
              </select>
              <select value={severityFilter} onChange={(event) => { setSeverityFilter(event.target.value); setPage(0) }} className="h-10 rounded-lg border border-[#D8D3E2] bg-white px-3 text-[12px] font-bold outline-none focus:border-[#534AB7]">
                <option value="">All severities</option>
                <option value="info">Info</option>
                <option value="notice">Notice</option>
                <option value="sensitive">Sensitive</option>
                <option value="critical">Critical</option>
              </select>
              <select value={actorFilter} onChange={(event) => { setActorFilter(event.target.value); setPage(0) }} className="h-10 rounded-lg border border-[#D8D3E2] bg-white px-3 text-[12px] font-bold outline-none focus:border-[#534AB7]">
                <option value="">All actors</option>
                {users.map((user) => <option key={user.id} value={user.id}>{displayName(user)}</option>)}
              </select>
              <select value={employeeFilter} onChange={(event) => { setEmployeeFilter(event.target.value); setPage(0) }} className="h-10 rounded-lg border border-[#D8D3E2] bg-white px-3 text-[12px] font-bold outline-none focus:border-[#534AB7]">
                <option value="">All employees</option>
                {employees.map((employee) => <option key={employee.id} value={employee.id}>{displayName(employee)}</option>)}
              </select>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-[#ECE9F2] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[#ECE9F2] px-4 py-3">
              <div>
                <h2 className="text-[14px] font-black text-[#1A1727]">Audit Events</h2>
                <p className="mt-0.5 text-[11px] font-bold text-[#9994A8]">Showing page {page + 1} of {pageCount}</p>
              </div>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin text-[#534AB7]" />}
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[1050px] w-full border-collapse">
                <thead className="bg-[#F8F7F9]">
                  <tr className="text-left text-[10px] font-black uppercase tracking-widest text-[#9994A8]">
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Actor</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Target</th>
                    <th className="px-4 py-3">Module</th>
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-16 text-center">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#534AB7]" />
                        <div className="mt-3 text-[12px] font-bold text-[#9994A8]">Loading audit events...</div>
                      </td>
                    </tr>
                  ) : events.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-16 text-center">
                        <ScrollText className="mx-auto h-8 w-8 text-[#C7C3D0]" />
                        <div className="mt-3 text-[13px] font-black text-[#6B6578]">No audit events found</div>
                        <div className="mt-1 text-[12px] font-semibold text-[#9994A8]">Try clearing filters or wait for audited actions to be recorded.</div>
                      </td>
                    </tr>
                  ) : events.map((event) => (
                    <tr key={`${event.source_table}-${event.id}`} className="border-t border-[#F1F0F4] text-[13px] hover:bg-[#FBFAFC]">
                      <td className="whitespace-nowrap px-4 py-3 font-bold text-[#6B6578]">{formatDate(event.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F4F1FF] text-[#534AB7]">
                            <UserRound size={14} />
                          </span>
                          <div className="min-w-0">
                            <div className="truncate font-black text-[#1A1727]">{event.actor_name || 'System'}</div>
                            <div className="truncate text-[11px] font-semibold text-[#9994A8]">{event.actor_email || 'No email'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-black text-[#1A1727]">{auditActionLabel(event)}</div>
                        <div className="text-[11px] font-semibold text-[#9994A8]">{humanize(event.entity_type)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-[#1A1727]">{event.target_name || event.entity_label || 'No target'}</div>
                        {event.is_redacted && <div className="mt-0.5 text-[10px] font-black uppercase tracking-wider text-amber-600">Values redacted</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-lg bg-[#F8F7F9] px-2 py-1 text-[11px] font-black uppercase tracking-wider text-[#6B6578]">{humanize(event.module)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-lg border px-2 py-1 text-[11px] font-black uppercase tracking-wider ${severityClasses(event.severity)}`}>{humanize(event.severity)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#6B6578]">
                          <MonitorSmartphone size={13} /> {sourceLabel(event.source)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => setSelected(event)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#D8D3E2] px-2 text-[11px] font-black uppercase tracking-wider text-[#534AB7] hover:border-[#534AB7]">
                          View <ChevronRight size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-[#ECE9F2] px-4 py-3">
              <button disabled={page === 0 || isLoading} onClick={() => setPage((value) => Math.max(0, value - 1))} className="rounded-lg border border-[#D8D3E2] px-3 py-2 text-[12px] font-black uppercase tracking-wider text-[#6B6578] disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
              <span className="text-[11px] font-black uppercase tracking-widest text-[#9994A8]">{totalCount} results</span>
              <button disabled={page + 1 >= pageCount || isLoading} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-[#D8D3E2] px-3 py-2 text-[12px] font-black uppercase tracking-wider text-[#6B6578] disabled:cursor-not-allowed disabled:opacity-40">Next</button>
            </div>
          </section>
        </div>

        {selected && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
            <button className="flex-1 cursor-default" onClick={() => setSelected(null)} aria-label="Close audit details" />
            <aside className="h-full w-full max-w-[560px] overflow-y-auto bg-white shadow-2xl">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#ECE9F2] bg-white px-5 py-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-[#534AB7]">Audit detail</div>
                  <h3 className="mt-1 text-[18px] font-black text-[#1A1727]">{auditActionLabel(selected)}</h3>
                </div>
                <button onClick={() => setSelected(null)} className="rounded-lg p-2 text-[#9994A8] hover:bg-[#F8F7F9] hover:text-[#1A1727]">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-5 p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <DetailBlock label="Time">{formatDate(selected.created_at)}</DetailBlock>
                  <DetailBlock label="Severity">
                    <span className={`inline-flex rounded-lg border px-2 py-1 text-[11px] font-black uppercase tracking-wider ${severityClasses(selected.severity)}`}>{humanize(selected.severity)}</span>
                  </DetailBlock>
                  <DetailBlock label="Actor">
                    <div>{selected.actor_name || 'System'}</div>
                    <div className="text-[11px] font-semibold text-[#9994A8]">{selected.actor_email || 'No email'}</div>
                  </DetailBlock>
                  <DetailBlock label="Target">{selected.target_name || selected.entity_label || 'No target'}</DetailBlock>
                  <DetailBlock label="Entity">{humanize(selected.entity_type)}{selected.entity_id ? ` / ${compactEntityId(selected.entity_id)}` : ''}</DetailBlock>
                  <DetailBlock label="Source">{sourceDetailLabel(selected)}</DetailBlock>
                </div>

                <div className="rounded-xl border border-[#ECE9F2] p-4">
                  <div className="mb-3 flex items-center gap-2 text-[13px] font-black text-[#1A1727]">
                    {selected.is_redacted ? <EyeOff size={15} className="text-amber-600" /> : <Eye size={15} className="text-emerald-600" />}
                    Change values {selected.is_redacted ? 'redacted' : 'visible'}
                  </div>
                  <div className="grid gap-3">
                    <div>
                      <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-[#9994A8]">Changed fields</div>
                      <JsonBox value={displayChangedFields(selected)} />
                    </div>
                    <div>
                      <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-[#9994A8]">Old value</div>
                      <JsonBox value={displayAuditValue(selected.old_value)} />
                    </div>
                    <div>
                      <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-[#9994A8]">New value</div>
                      <JsonBox value={displayAuditValue(selected.new_value)} />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-[#ECE9F2] p-4">
                  <div className="mb-3 flex items-center gap-2 text-[13px] font-black text-[#1A1727]">
                    <MonitorSmartphone size={15} className="text-[#534AB7]" /> Request context
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <DetailBlock label="IP address">{selected.ip_address || 'Not captured'}</DetailBlock>
                    <DetailBlock label="User agent">{selected.user_agent || 'Not captured'}</DetailBlock>
                  </div>
                </div>

                <div className="rounded-xl border border-[#ECE9F2] p-4">
                  <div className="mb-2 text-[13px] font-black text-[#1A1727]">Metadata</div>
                  <JsonBox value={selected.metadata} />
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
