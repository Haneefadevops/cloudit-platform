'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/lib/auth'
import { usePermissions } from '@/hooks/use-permissions'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'
import {
  CalendarDays,
  Plus,
  ChevronLeft,
  ChevronRight,
  Copy,
  Trash2,
  Clock,
  Check,
  X,
  Settings,
  RefreshCw,
  Lock,
  Unlock,
  Send,
  Printer
} from 'lucide-react'
import { toast } from 'sonner'

function formatLocalDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
import { TableSkeleton } from '@/components/ui/ToSkeleton'
import { ToEmptyState } from '@/components/ui/ToEmptyState'
import { SwapApprovalQueue } from '@/components/roster/SwapApprovalQueue'
import { NoShowsAlert } from '@/components/roster/NoShowsAlert'
import { RosterGrid } from '@/components/roster/RosterGrid'
import { AdherenceView } from '@/components/roster/AdherenceView'

interface ShiftTemplate {
  id: string
  name: string
  start_time: string
  end_time: string
  break_minutes: number
  department_id: string | null
  branch_id: string | null
  status: 'active' | 'inactive'
}

interface RosterEntry {
  id?: string
  employee_id: string
  employee_name: string
  department_id: string | null
  department_name: string | null
  branch_id: string | null
  date: string | null
  shift_template_id: string | null
  shift_name: string | null
  start_time: string | null
  end_time: string | null
  break_minutes: number | null
  notes: string | null
  acknowledgment_status?: string | null
  conflict_reason?: string | null
  conflict_flagged_at?: string | null
}

interface Employee {
  id: string
  first_name: string
  last_name: string
  department_id: string | null
  branch_id: string | null
  department: string | null
}

interface OvertimeRecord {
  employee_id: string
  date: string
}

interface AdherenceEntry {
  employee_id: string
  employee_name: string
  department_id: string | null
  department_name: string | null
  date: string
  shift_name: string | null
  scheduled_start: string | null
  scheduled_end: string | null
  actual_clock_in: string | null
  actual_clock_out: string | null
  status: 'day_off' | 'absent' | 'on_time' | 'late' | 'early_departure' | 'late_early'
}

interface NoShow {
  employee_id: string
  employee_name: string
  department_name: string
  shift_name: string
  scheduled_start: string
  minutes_late: number
}

interface SwapRequest {
  id: string
  requester_employee_id: string
  target_employee_id: string | null
  claimed_by: string | null
  requester_date: string
  target_date: string
  status: 'pending' | 'claimed' | 'approved' | 'rejected'
  requester: { first_name: string, last_name: string }
  target?: { first_name: string, last_name: string }
  claimer?: { first_name: string, last_name: string }
}

interface AvailabilitySlot {
  employee_id: string
  day_of_week: number
  start_time: string | null
  end_time: string | null
  is_available: boolean
}

export default function RosterPage() {
  const { organizationId, isLoaded, isOwner, isManager, isHrAdmin, isDeptManager, isBranchManager, userRole } = useAuth()
  const { can } = usePermissions(['roster.edit', 'roster.publish', 'roster.lock'])
  const canEditRoster = can('roster.edit')
  const canPublishRoster = can('roster.publish')
  const canLockRoster = can('roster.lock')

  const [view, setView] = useState<'roster' | 'adherence'>('roster')
  const [weekStatus, setWeekStatus] = useState<'draft' | 'published' | 'locked'>('draft')
  const [noShows, setNoShows] = useState<NoShow[]>([])
  const [pendingSwaps, setPendingSwaps] = useState<SwapRequest[]>([])

  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const d = new Date()
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust to Monday
    const monday = new Date(d.setDate(diff))
    monday.setHours(0, 0, 0, 0)
    return monday
  })

  const [employees, setEmployees] = useState<Employee[]>([])
  const [templates, setTemplates] = useState<ShiftTemplate[]>([])
  const [rosterData, setRosterData] = useState<RosterEntry[]>([])
  const [adherenceData, setAdherenceData] = useState<AdherenceEntry[]>([])
  const [overtimeRecords, setOvertimeRecords] = useState<OvertimeRecord[]>([])
  const [availabilityData, setAvailabilityData] = useState<AvailabilitySlot[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null) // employeeId-date
  const [showTemplateManager, setShowTemplateManager] = useState(false)
  const [managedScopeId, setManagedScopeId] = useState<string | null>(null)

  // New template form state
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    start_time: '08:00',
    end_time: '17:00',
    break_minutes: 60,
    department_id: '',
    branch_id: ''
  })
  const [addingTemplate, setAddingTemplate] = useState(false)

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentWeekStart)
    d.setDate(d.getDate() + i)
    return d
  })

  useEffect(() => {
    if (isLoaded && organizationId) {
      if (isDeptManager) {
        supabase.rpc('get_my_managed_dept_id').then(({ data }) => {
          setManagedScopeId(data)
          loadInitialData(data, 'dept')
        })
      } else if (isBranchManager) {
        supabase.rpc('get_my_managed_branch_id').then(({ data }) => {
          setManagedScopeId(data)
          loadInitialData(data, 'branch')
        })
      } else {
        loadInitialData()
      }
    }
  }, [isLoaded, organizationId, currentWeekStart, view])

  // Realtime: roster assignments and swap requests
  useEffect(() => {
    if (!organizationId) return
    const weekStartStr = formatLocalDate(currentWeekStart)
    const channel = supabase
      .channel(`roster-updates-${organizationId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'roster_assignments', filter: `organization_id=eq.${organizationId}` },
        () => loadInitialData(managedScopeId, isDeptManager ? 'dept' : isBranchManager ? 'branch' : undefined)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shift_swap_requests', filter: `organization_id=eq.${organizationId}` },
        () => loadInitialData(managedScopeId, isDeptManager ? 'dept' : isBranchManager ? 'branch' : undefined)
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [organizationId, currentWeekStart, managedScopeId])

  function splitName(fullName?: string | null) {
    if (!fullName) return { first_name: '', last_name: '' }
    const parts = fullName.trim().split(/\s+/)
    return { first_name: parts[0] || '', last_name: parts.slice(1).join(' ') || '' }
  }

  async function loadInitialData(scopeId?: string | null, scopeType?: 'dept' | 'branch') {
    setLoading(true)
    try {
      const weekStartStr = formatLocalDate(currentWeekStart)

      // 1. Load Employees through the local API so the roster grid uses local DB seed employees.
      const employeeParams = new URLSearchParams({ status: 'active', limit: '500' })
      if (scopeType === 'dept' && scopeId) {
        employeeParams.set('department_id', scopeId)
      } else if (scopeType === 'branch' && scopeId) {
        employeeParams.set('branch_id', scopeId)
      }
      const employeesRes = await api.get<Employee[]>(`/employees?${employeeParams.toString()}`)
      if (!employeesRes.ok) throw new Error(employeesRes.error)
      setEmployees((employeesRes.data || [])
        .filter(emp => !(emp as Employee & { termination_date?: string | null }).termination_date)
        .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)))

      // 2. Load Week Status
      const statusRes = await api.get<{ status: string }>(`/roster/week-status?week_start=${weekStartStr}`)
      if (!statusRes.ok) throw new Error(statusRes.error)
      setWeekStatus((statusRes.data?.status as 'draft' | 'published' | 'locked') || 'draft')

      if (view === 'roster') {
        // 3. Load Templates from backend shifts endpoint
        const templatesRes = await api.get<ShiftTemplate[]>('/shifts')
        if (!templatesRes.ok) throw new Error(templatesRes.error)
        setTemplates((templatesRes.data || []).filter(t => t.status === 'active'))

        // 4. Load Roster assignments
        const rosterRes = await api.get<(RosterEntry & { shift_id?: string | null })[]>(`/roster/week?week_start=${weekStartStr}`)
        if (!rosterRes.ok) throw new Error(rosterRes.error)
        setRosterData((rosterRes.data || []).map(r => ({ ...r, shift_template_id: r.shift_id ?? null })))

        // 5. Load Overtime records (pending/awaiting)
        const { data: otData } = await supabase
          .from('overtime_records')
          .select('employee_id, date')
          .eq('organization_id', organizationId)
          .in('status', ['pending', 'awaiting_level1', 'awaiting_level2', 'awaiting_level3'])
          .gte('date', weekStartStr)
          .lt('date', formatLocalDate(new Date(currentWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000)))

        setOvertimeRecords(otData || [])

        // 6. Load No-Shows
        const noShowsRes = await api.get<NoShow[]>('/roster/no-shows')
        if (!noShowsRes.ok) throw new Error(noShowsRes.error)
        setNoShows(noShowsRes.data || [])

        // 7. Load Pending & Claimed Swaps
        const swapsRes = await api.get<(SwapRequest & { requester_name?: string; target_name?: string; claimed_name?: string })[]>('/shift-swaps')
        if (!swapsRes.ok) throw new Error(swapsRes.error)
        const mappedSwaps = (swapsRes.data || [])
          .filter(s => s.status === 'pending' || s.status === 'claimed')
          .map(s => ({
            ...s,
            requester: splitName(s.requester_name),
            target: splitName(s.target_name),
            claimer: splitName(s.claimed_name),
          }))
        setPendingSwaps(mappedSwaps)

        // 8. Load employee availability for this week through the local API.
        const availabilityRes = await api.get<AvailabilitySlot[]>(`/roster/availability?week_start=${weekStartStr}`)
        if (!availabilityRes.ok) throw new Error(availabilityRes.error)
        setAvailabilityData(availabilityRes.data || [])

      } else {
        // Load Adherence data
        const adherenceRes = await api.get<AdherenceEntry[]>(`/roster/adherence?week_start=${weekStartStr}`)
        if (!adherenceRes.ok) throw new Error(adherenceRes.error)
        setAdherenceData(adherenceRes.data || [])
      }

    } catch (error) {
      console.error('Error loading roster data:', error)
      toast.error('Failed to load roster data')
    } finally {
      setLoading(false)
    }
  }

  const navigateWeek = (direction: number) => {
    const newDate = new Date(currentWeekStart)
    newDate.setDate(newDate.getDate() + direction * 7)
    setCurrentWeekStart(newDate)
  }

  const handleUpsertAssignment = async (employeeId: string, date: string, shiftTemplateId: string | null) => {
    if (!canEditRoster) {
      toast.error('You do not have permission to edit roster assignments')
      return
    }

    const key = `${employeeId}-${date}`
    setSavingId(key)

    try {
      const existing = rosterData.find(r => r.employee_id === employeeId && r.date === date)

      if (!shiftTemplateId) {
        // Clearing a shift → delete the assignment if one exists
        if (existing?.id) {
          const delRes = await api.del(`/roster/assignments/${existing.id}`)
          if (!delRes.ok) throw new Error(delRes.error)
          setRosterData(prev => prev.filter(r => !(r.employee_id === employeeId && r.date === date)))
        }
        setSavingId(null)
        return
      }

      const res = await api.post<RosterEntry>('/roster/assignments', {
        employee_id: employeeId,
        shift_id: shiftTemplateId,
        assignment_date: date,
      })

      if (!res.ok) throw new Error(res.error)

      // Update local state
      setRosterData(prev => {
        const idx = prev.findIndex(r => r.employee_id === employeeId && r.date === date)
        const template = templates.find(t => t.id === shiftTemplateId)

        const newEntry: RosterEntry = {
          ...(res.data || {}),
          id: res.data?.id || existing?.id,
          employee_id: employeeId,
          employee_name: existing?.employee_name || '',
          department_id: existing?.department_id || null,
          department_name: existing?.department_name || null,
          branch_id: existing?.branch_id || null,
          date,
          shift_template_id: shiftTemplateId,
          shift_name: template?.name || null,
          start_time: template?.start_time || null,
          end_time: template?.end_time || null,
          break_minutes: template?.break_minutes || null,
          notes: null
        }

        if (idx > -1) {
          const updated = [...prev]
          updated[idx] = { ...updated[idx], ...newEntry }
          return updated
        } else {
          return [...prev, newEntry]
        }
      })

    } catch (error) {
      console.error('Error saving assignment:', error)
      toast.error('Failed to save assignment')
    } finally {
      setSavingId(null)
    }
  }

  const handleCopyPreviousWeek = async () => {
    if (!canEditRoster) {
      toast.error('You do not have permission to copy roster weeks')
      return
    }

    const prevWeek = new Date(currentWeekStart)
    prevWeek.setDate(prevWeek.getDate() - 7)

    try {
      const res = await api.post<{ copied: number }>('/roster/copy-week', {
        source_week_start: formatLocalDate(prevWeek),
        target_week_start: formatLocalDate(currentWeekStart)
      })

      if (!res.ok) throw new Error(res.error)

      toast.success(`${res.data?.copied ?? 0} assignments copied from last week`)
      // Refresh data
      loadInitialData(managedScopeId, isDeptManager ? 'dept' : isBranchManager ? 'branch' : undefined)
    } catch (error) {
      console.error('Error copying week:', error)
      toast.error('Failed to copy roster')
    }
  }

  const handleAddTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddingTemplate(true)
    try {
      const res = await api.post<ShiftTemplate>('/shifts', {
        name: newTemplate.name,
        start_time: newTemplate.start_time,
        end_time: newTemplate.end_time,
        break_minutes: newTemplate.break_minutes,
        department_id: newTemplate.department_id || null,
        branch_id: newTemplate.branch_id || null,
        status: 'active'
      })
      if (!res.ok) throw new Error(res.error)

      if (res.data) setTemplates(prev => [...prev, res.data as ShiftTemplate])
      setNewTemplate({
        name: '',
        start_time: '08:00',
        end_time: '17:00',
        break_minutes: 60,
        department_id: '',
        branch_id: ''
      })
      toast.success('Shift added')
    } catch (error) {
      console.error('Error adding shift:', error)
      toast.error('Failed to add shift')
    } finally {
      setAddingTemplate(false)
    }
  }

  const toggleTemplateActive = async (id: string, currentStatus: 'active' | 'inactive') => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    try {
      const res = await api.patch<ShiftTemplate>(`/shifts/${id}`, { status: newStatus })
      if (!res.ok) throw new Error(res.error)

      setTemplates(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t))
      toast.success(`Shift ${newStatus === 'active' ? 'activated' : 'deactivated'}`)
    } catch (error) {
      toast.error('Failed to update shift status')
    }
  }

  const formatTimestamp = (ts: string | null) => {
    if (!ts) return ''
    return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }

  const formatTime = (time: string | null) => {
    if (!time) return ''
    const [h, m] = time.split(':')
    const hour = parseInt(h)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const h12 = hour % 12 || 12
    return `${h12}:${m} ${ampm}`
  }

  // Consistent color coding for shift templates
  const shiftColors: Record<string, { bg: string; border: string; text: string; light: string }> = {}
  const colorPalette = [
    { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', light: 'bg-purple-100' },
    { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', light: 'bg-blue-100' },
    { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', light: 'bg-emerald-100' },
    { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', light: 'bg-amber-100' },
    { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', light: 'bg-rose-100' },
    { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700', light: 'bg-cyan-100' },
    { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', light: 'bg-orange-100' },
    { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', light: 'bg-indigo-100' },
  ]
  templates.forEach((t, i) => {
    shiftColors[t.id] = colorPalette[i % colorPalette.length]
  })

  const handleSetWeekStatus = async (status: 'published' | 'locked' | 'draft') => {
    if ((status === 'published' && !canPublishRoster) || (status === 'locked' && !canLockRoster) || (status === 'draft' && !canEditRoster)) {
      toast.error('You do not have permission to change roster status')
      return
    }

    const weekStartStr = formatLocalDate(currentWeekStart)

    try {
      if (status === 'published') {
        const res = await api.post('/roster/publish', { week_start: weekStartStr })
        if (!res.ok) throw new Error(res.error)
      } else if (status === 'locked') {
        const res = await api.post('/roster/lock', { week_start: weekStartStr })
        if (!res.ok) throw new Error(res.error)
      } else {
        const res = await api.post('/roster/week/unlock', { week_start: weekStartStr })
        if (!res.ok) throw new Error(res.error)
      }
      setWeekStatus(status)
      toast.success(`Roster ${status === 'published' ? 'published — employees can see their schedule' : status === 'locked' ? 'locked — no further edits allowed' : 'unlocked'}`)
    } catch (error) {
      console.error('Error updating roster status:', error)
      toast.error('Failed to update roster status')
    }
  }

  const handleSwapAction = () => {
    loadInitialData(managedScopeId, isDeptManager ? 'dept' : isBranchManager ? 'branch' : undefined)
  }

  const refreshNoShows = async () => {
    const res = await api.get<NoShow[]>('/roster/no-shows')
    if (res.ok) setNoShows(res.data || [])
  }

  const adherenceStats = {
    onTime: adherenceData.filter(d => d.status === 'on_time').length,
    late: adherenceData.filter(d => d.status === 'late' || d.status === 'late_early').length,
    earlyOut: adherenceData.filter(d => d.status === 'early_departure' || d.status === 'late_early').length,
    absent: adherenceData.filter(d => d.status === 'absent').length
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full bg-[#F8F7F9]">
        {/* Page Header */}
        <div className="bg-white border-b border-[#F1F0F4] px-8 py-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-[15px] font-bold text-[#1A1727]">
              {view === 'roster' ? 'Roster Planning' : 'Shift Adherence'}
            </h1>
            <p className="text-[11px] text-[#9CA3AF]">
              {view === 'roster' ? 'Plan shifts and manage employee schedules' : 'Track clock-in/out adherence against rostered shifts'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-[#F1F0F4] p-1 rounded-xl mr-4">
              <button
                onClick={() => setView('roster')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'roster' ? 'bg-[#534AB7] text-white shadow-md' : 'text-[#9CA3AF] hover:text-[#1A1727]'}`}
              >
                Roster
              </button>
              <button
                onClick={() => setView('adherence')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'adherence' ? 'bg-[#534AB7] text-white shadow-md' : 'text-[#9CA3AF] hover:text-[#1A1727]'}`}
              >
                Adherence
              </button>
            </div>

            {view === 'roster' && (
              <>
                {canEditRoster && (
                  <button
                    onClick={handleCopyPreviousWeek}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-[#F1F0F4] text-[#374151] rounded-lg hover:bg-[#F8F7F9] transition-all font-bold text-sm shadow-sm"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Previous Week
                  </button>
                )}
                {canEditRoster && (
                  <button
                    onClick={() => setShowTemplateManager(!showTemplateManager)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-bold text-sm shadow-sm ${
                      showTemplateManager
                        ? 'bg-[#F3E8FF] text-[#534AB7] border border-[#F3E8FF]'
                        : 'bg-white border border-[#F1F0F4] text-[#374151] hover:bg-[#F8F7F9]'
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                    Shift Templates
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Adherence Summary Bar */}
          {view === 'adherence' && !loading && (
            <div className="mb-6 grid grid-cols-4 gap-4">
              <div className="bg-green-50 border border-green-100 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black text-green-600 uppercase tracking-widest">On Time</div>
                  <div className="text-2xl font-black text-green-700">{adherenceStats.onTime}</div>
                </div>
                <Check className="w-8 h-8 text-green-200" />
              </div>
              <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Late Arrival</div>
                  <div className="text-2xl font-black text-amber-700">{adherenceStats.late}</div>
                </div>
                <Clock className="w-8 h-8 text-amber-200" />
              </div>
              <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Early Departure</div>
                  <div className="text-2xl font-black text-orange-700">{adherenceStats.earlyOut}</div>
                </div>
                <ChevronLeft className="w-8 h-8 text-orange-200" />
              </div>
              <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black text-red-600 uppercase tracking-widest">Absent</div>
                  <div className="text-2xl font-black text-red-700">{adherenceStats.absent}</div>
                </div>
                <X className="w-8 h-8 text-red-200" />
              </div>
            </div>
          )}

          {/* Template Manager Panel */}
          {showTemplateManager && (
            <div className="mb-8 bg-white rounded-xl shadow-sm border border-[#F1F0F4] overflow-hidden animate-in slide-in-from-top-2 duration-300">
              <div className="p-6 border-b border-[#F8F7F9] bg-[#F8F7F9]/50 flex items-center justify-between">
                <h2 className="font-bold text-[#1A1727] uppercase tracking-widest text-xs">Shift Template Manager</h2>
                <button onClick={() => setShowTemplateManager(false)} className="text-[#9CA3AF] hover:text-[#6B7280]">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Add Template Form */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-[#1A1727]">Add New Template</h3>
                  <form onSubmit={handleAddTemplate} className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-black text-[#9CA3AF] uppercase mb-1">Shift Name</label>
                      <input
                        required
                        value={newTemplate.name}
                        onChange={e => setNewTemplate({...newTemplate, name: e.target.value})}
                        placeholder="e.g. Morning Shift"
                        className="w-full px-3 py-2 bg-[#F8F7F9] border border-[#F1F0F4] rounded-lg text-sm focus:ring-2 focus:ring-[#534AB7] outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black text-[#9CA3AF] uppercase mb-1">Start Time</label>
                        <input
                          type="time"
                          required
                          value={newTemplate.start_time}
                          onChange={e => setNewTemplate({...newTemplate, start_time: e.target.value})}
                          className="w-full px-3 py-2 bg-[#F8F7F9] border border-[#F1F0F4] rounded-lg text-sm focus:ring-2 focus:ring-[#534AB7] outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-[#9CA3AF] uppercase mb-1">End Time</label>
                        <input
                          type="time"
                          required
                          value={newTemplate.end_time}
                          onChange={e => setNewTemplate({...newTemplate, end_time: e.target.value})}
                          className="w-full px-3 py-2 bg-[#F8F7F9] border border-[#F1F0F4] rounded-lg text-sm focus:ring-2 focus:ring-[#534AB7] outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-[#9CA3AF] uppercase mb-1">Break (minutes)</label>
                      <input
                        type="number"
                        value={newTemplate.break_minutes}
                        onChange={e => setNewTemplate({...newTemplate, break_minutes: parseInt(e.target.value)})}
                        className="w-full px-3 py-2 bg-[#F8F7F9] border border-[#F1F0F4] rounded-lg text-sm focus:ring-2 focus:ring-[#534AB7] outline-none"
                      />
                    </div>
                    <button
                      disabled={addingTemplate}
                      className="w-full py-2 bg-[#534AB7] text-white rounded-lg font-bold text-sm hover:bg-[#1E1854] transition-colors disabled:opacity-50 shadow-md"
                    >
                      {addingTemplate ? 'Saving...' : 'Add Template'}
                    </button>
                  </form>
                </div>

                {/* Template List */}
                <div className="lg:col-span-2">
                  <h3 className="text-sm font-bold text-[#1A1727] mb-4">Existing Templates</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {templates.map(t => (
                      <div key={t.id} className="p-4 bg-white border border-[#F1F0F4] rounded-xl shadow-sm flex items-center justify-between">
                        <div>
                          <div className="font-bold text-[#1A1727]">{t.name}</div>
                          <div className="text-[10px] text-[#9CA3AF] font-medium">
                            {formatTime(t.start_time)} - {formatTime(t.end_time)} ({t.break_minutes}m break)
                          </div>
                        </div>
                        <button
                          onClick={() => toggleTemplateActive(t.id, t.status)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            t.status === 'active' ? 'text-green-600 hover:bg-green-50' : 'text-[#9CA3AF] hover:bg-[#F8F7F9]'
                          }`}
                          title={t.status === 'active' ? 'Deactivate' : 'Activate'}
                        >
                          {t.status === 'active' ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
                        </button>
                      </div>
                    ))}
                    {templates.length === 0 && (
                      <p className="text-[#9CA3AF] text-sm italic">No shift templates created yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Week Navigation */}
          <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl shadow-sm border border-[#F1F0F4]">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigateWeek(-1)}
                className="p-2 hover:bg-[#F1F0F4] rounded-lg transition-colors text-[#6B7280]"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <div className="text-sm font-black text-[#1A1727] uppercase tracking-widest">
                  Week of {currentWeekStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
                {weekStatus === 'locked' && (
                  <div className="flex items-center gap-1 bg-[#F1F0F4] text-[#6B7280] px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-[#F1F0F4]">
                    <Lock className="w-2.5 h-2.5" />
                    Locked
                  </div>
                )}
                {weekStatus === 'published' && (
                  <div className="flex items-center gap-1 bg-green-50 text-green-600 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-green-100">
                    Published
                  </div>
                )}
              </div>
              <button
                onClick={() => navigateWeek(1)}
                className="p-2 hover:bg-[#F1F0F4] rounded-lg transition-colors text-[#6B7280]"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => window.print()}
                className="hidden print:hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#F1F0F4] text-[#374151] rounded-lg hover:bg-[#F8F7F9] transition-all font-black text-[10px] uppercase tracking-widest shadow-sm"
              >
                <Printer className="w-3 h-3" />
                Print
              </button>

              {/* Status Controls */}
              {view === 'roster' && (canPublishRoster || canLockRoster || canEditRoster) && (
                <div className="flex items-center gap-2 pr-4 border-r border-[#F1F0F4]">
                  {weekStatus === 'draft' && canPublishRoster && (
                    <button
                      onClick={() => handleSetWeekStatus('published')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all font-black text-[10px] uppercase tracking-widest shadow-sm shadow-green-100"
                    >
                      <Send className="w-3 h-3" />
                      Publish Roster
                    </button>
                  )}
                  {weekStatus === 'published' && canLockRoster && (
                    <button
                      onClick={() => handleSetWeekStatus('locked')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1A1727] text-white rounded-lg hover:bg-[#1A1727]/90 transition-all font-black text-[10px] uppercase tracking-widest shadow-sm"
                    >
                      <Lock className="w-3 h-3" />
                      Lock Roster
                    </button>
                  )}
                  {weekStatus === 'locked' && canEditRoster && (
                    <button
                      onClick={() => handleSetWeekStatus('draft')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#F1F0F4] text-[#374151] rounded-lg hover:bg-[#F8F7F9] transition-all font-black text-[10px] uppercase tracking-widest shadow-sm"
                    >
                      <Unlock className="w-3 h-3" />
                      Unlock
                    </button>
                  )}
                </div>
              )}

              <div className="text-[10px] font-black text-[#534AB7] uppercase tracking-widest bg-[#F3E8FF] px-3 py-1 rounded-full border border-[#F3E8FF]">
                {isDeptManager ? 'Department' : isBranchManager ? 'Branch' : 'Organization'} Scope
              </div>
            </div>
          </div>

          {/* No-Show Alert Panel */}
          {view === 'roster' && <NoShowsAlert noShows={noShows} onRefresh={refreshNoShows} />}

          {/* Roster Grid — print-friendly wrapper */}
          <div className="print:shadow-none print:border-0 print:bg-white">
          {employees.length === 0 && !loading ? (
            <div className="bg-white rounded-xl shadow-sm border border-[#F1F0F4] p-16">
              <ToEmptyState
                icon={<CalendarDays size={40} className="text-[#D1D5DB]" />}
                title="No employees found in your scope"
                description="Add employees to your organization to start building rosters."
              />
            </div>
          ) : view === 'roster' ? (
            <RosterGrid
              employees={employees}
              weekDays={weekDays}
              rosterData={rosterData}
              templates={templates}
              overtimeRecords={overtimeRecords}
              availabilityData={availabilityData}
              shiftColors={shiftColors}
              canEditRoster={canEditRoster}
              savingId={savingId}
              onUpsert={handleUpsertAssignment}
            />
          ) : (
            <AdherenceView
              employees={employees}
              weekDays={weekDays}
              adherenceData={adherenceData}
            />
          )}

          {loading && (
            <div className="mt-8">
              <TableSkeleton rows={5} columns={8} />
            </div>
          )}
          </div>

          {/* Pending Shift Swaps Queue */}
          {view === 'roster' && (
            <div className="mt-12 space-y-4 animate-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-lg font-black text-[#1A1727] flex items-center gap-2 uppercase tracking-widest">
                <RefreshCw className="w-5 h-5 text-[#534AB7]" />
                Pending Shift Swaps
              </h2>
              <SwapApprovalQueue swaps={pendingSwaps} onAction={handleSwapAction} />
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
