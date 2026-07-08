'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import {
  ChevronLeft, ChevronRight, Plus, Sparkles, X, Trash2, Clock,
  Calendar as CalendarIcon, Building2, Filter, Users, Link2,
} from 'lucide-react'
import { CommandBarBadges } from '@/components/calendar/CommandBarBadges'
import { SmartSummaryBar } from '@/components/calendar/SmartSummaryBar'
import { MiniCalendar } from '@/components/calendar/MiniCalendar'
import { TimeBlockView } from '@/components/calendar/TimeBlockView'
import { MultiEmployeeView } from '@/components/calendar/MultiEmployeeView'
import { AvailabilityOverlay } from '@/components/calendar/AvailabilityOverlay'
import { AutoFillPreview } from '@/components/roster/AutoFillPreview'
import { ShareCalendarModal } from '@/components/calendar/ShareCalendarModal'
import {
  CalendarGrid, useCalendarGrid, CalendarDayCell,
  EventCard, EventDetailPanel, EventCardData,
  AnimatedModal, PillBadge, CommandPalette,
  CalendarSkeleton, EmptyState,
} from '@/components/ui-touchorbit'
import { useCalendar, UnifiedCalendarEvent, CalendarView } from '@/hooks/use-calendar'
import { useTasks } from '@/hooks/use-tasks'
import { EventCreateModal } from '@/components/calendar/EventCreateModal'
import { EventEditModal } from '@/components/calendar/EventEditModal'
import { RescheduleInbox } from '@/components/calendar/RescheduleInbox'
import { TaskSidebar } from '@/components/calendar/TaskSidebar'
import { UpcomingBirthdaysWidget } from '@/components/calendar/UpcomingBirthdaysWidget'
import { CalendarAnalytics } from '@/components/calendar/CalendarAnalytics'
import { CoverageAlertPanel } from '@/components/calendar/CoverageAlertPanel'
import { TaskForm, TaskFormData, EventActions } from '@/components/ui-touchorbit'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function toEventCardData(e: UnifiedCalendarEvent): EventCardData {
  return {
    id: e.id,
    title: e.title,
    type: e.type,
    startAt: e.startAt,
    endAt: e.endAt,
    allDay: e.allDay,
    description: e.description,
    location: e.location,
    meetingUrl: e.meetingUrl,
    status: e.status,
  }
}

export default function CalendarPage() {
  const { organizationId, userId, isLoaded } = useAuth()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<CalendarView>('month')
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all')
  const [departments, setDepartments] = useState<string[]>([])

  // Employee filter + multi-employee view
  const [employees, setEmployees] = useState<{ id: string; first_name: string; last_name: string }[]>([])
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>('all')
  const [showMultiEmployee, setShowMultiEmployee] = useState(false)
  const [selectedMultiEmployeeIds, setSelectedMultiEmployeeIds] = useState<string[]>([])
  const [availabilitySlot, setAvailabilitySlot] = useState<{ start: string; end: string } | null>(null)
  const [showAutoFill, setShowAutoFill] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)

  // Hub data state
  const [hubData, setHubData] = useState<{
    conflicts: any[]
    requests: { leave: any[]; swaps: any[]; reschedules: any[] }
    coverage: { rate: number; active_employees: number; assigned_shift_days: number; potential_shift_days: number }
  } | null>(null)
  const [hubLoading, setHubLoading] = useState(false)

  // Event management state
  const [showEventDialog, setShowEventDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<UnifiedCalendarEvent | null>(null)
  const [showDayDetails, setShowDayDetails] = useState(false)
  const [dayDetailsDate, setDayDetailsDate] = useState<Date | null>(null)

  // Holiday management state
  const [selectedHoliday, setSelectedHoliday] = useState<any | null>(null)
  const [showAddHolidayDialog, setShowAddHolidayDialog] = useState(false)
  const [showEditHolidayDialog, setShowEditHolidayDialog] = useState(false)
  const [holidayFormData, setHolidayFormData] = useState({
    name: '', date: '', type: 'public' as 'public' | 'company' | 'restricted',
    recurring: false, description: '',
  })

  const { events: allEvents, loading, refetch } = useCalendar({ view: viewMode, currentDate })

  // Filter events by employee + department
  const events = useMemo(() => {
    let filtered = allEvents
    if (selectedEmployeeFilter !== 'all') {
      filtered = filtered.filter(e => {
        const empId = e.raw?.employee_id
        if (empId === selectedEmployeeFilter) return true
        if (e.source === 'leave_records' && e.raw?.employee_id === selectedEmployeeFilter) return true
        const attendees = e.raw?.attendees || []
        if (attendees.some((a: any) => a.employee_id === selectedEmployeeFilter)) return true
        return false
      })
    }
    if (selectedDepartment !== 'all') {
      filtered = filtered.filter((e) => {
        if (e.source !== 'leave_records') return true
        const dept = e.raw?.employees?.department
        return dept === selectedDepartment
      })
    }
    return filtered
  }, [allEvents, selectedEmployeeFilter, selectedDepartment])

  // Load employees for filter
  useEffect(() => {
    if (isLoaded && organizationId) {
      loadEmployees()
    }
  }, [isLoaded, organizationId])

  async function loadEmployees() {
    if (!organizationId) return
    const result = await api.get<any[]>('/employees?status=active&limit=500')
    if (result.ok) {
      setEmployees((result.data || []).map((e: any) => ({ id: e.id, first_name: e.first_name, last_name: e.last_name })))
    }
  }

  // Workload: count events per day for heatmap
  const workloadByDate = useMemo(() => {
    const map = new Map<string, number>()
    allEvents.forEach(e => {
      if (!e.startAt) return
      const start = new Date(e.startAt)
      const end = e.endAt ? new Date(e.endAt) : start
      const d = new Date(start)
      while (d <= end) {
        const key = d.toISOString().split('T')[0]
        map.set(key, (map.get(key) || 0) + 1)
        d.setDate(d.getDate() + 1)
      }
    })
    return map
  }, [allEvents])

  // Fetch hub data (conflicts, requests, coverage)
  useEffect(() => {
    if (!isLoaded || !organizationId) return
    fetchHubData()
  }, [isLoaded, organizationId, currentDate, viewMode, selectedDepartment])

  async function fetchHubData() {
    setHubLoading(true)
    try {
      let start: string, end: string
      if (viewMode === 'month') {
        start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0]
        end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString().split('T')[0]
      } else if (viewMode === 'week') {
        const d = new Date(currentDate)
        const day = d.getDay()
        d.setDate(d.getDate() - day)
        start = d.toISOString().split('T')[0]
        const endD = new Date(d)
        endD.setDate(endD.getDate() + 6)
        end = endD.toISOString().split('T')[0]
      } else {
        start = currentDate.toISOString().split('T')[0]
        end = start
      }

      let url = `/calendar-events/hub?start=${start}&end=${end}`
      if (selectedDepartment !== 'all') url += `&departmentId=${encodeURIComponent(selectedDepartment)}`
      const result = await api.get<any>(url)
      if (result.ok) {
        setHubData(result.data)
      }
    } catch (e) { console.error('Hub fetch error:', e) }
    setHubLoading(false)
  }

  function getHubItemsForDate(date: Date) {
    const dateStr = date.toISOString().split('T')[0]
    const conflicts = (hubData?.conflicts || []).filter((c: any) => c.conflict_date === dateStr)
    const requests = [
      ...(hubData?.requests?.leave || []).map((r: any) => ({
        id: r.id,
        type: 'leave' as const,
        employee_id: r.employee_id,
        employee_name: r.employee ? `${r.employee.first_name || ''} ${r.employee.last_name || ''}`.trim() : 'Unknown',
        title: `${r.leave_type || 'Leave'}`,
        status: r.status,
        days_count: r.days_count,
      })),
      ...(hubData?.requests?.swaps || []).map((r: any) => ({
        id: r.id,
        type: 'swap' as const,
        employee_name: r.requester ? `${r.requester.first_name || ''} ${r.requester.last_name || ''}`.trim() : 'Unknown',
        title: `Swap ${r.requester_date ? new Date(r.requester_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}`,
        status: r.status,
      })),
    ].filter((r: any) => {
      // For leave: check if date is within range
      if (r.type === 'leave') {
        const leave = hubData?.requests?.leave?.find((l: any) => l.id === r.id)
        if (leave) {
          return dateStr >= leave.start_date && dateStr <= leave.end_date
        }
      }
      // For swaps: check requester_date or target_date
      if (r.type === 'swap') {
        const swap = hubData?.requests?.swaps?.find((s: any) => s.id === r.id)
        if (swap) {
          return swap.requester_date === dateStr || swap.target_date === dateStr
        }
      }
      return false
    })
    return { conflicts, requests }
  }

  async function handleBulkAction(action: 'approve' | 'reject', id: string, type: string) {
    try {
      const body: any = { action, leaveIds: [], swapIds: [] }
      if (type === 'leave') body.leaveIds = [id]
      if (type === 'swap') body.swapIds = [id]

      const res = await fetch('/api/requests/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast.success(`${action === 'approve' ? 'Approved' : 'Rejected'}`)
        fetchHubData()
        refetch()
      } else {
        toast.error('Action failed')
      }
    } catch (e) { toast.error('Action failed') }
  }

  const totalRequests = (hubData?.requests?.leave?.length || 0) + (hubData?.requests?.swaps?.length || 0)
  const totalConflicts = hubData?.conflicts?.length || 0
  const coverageRate = hubData?.coverage?.rate || 0
  const activeEmployees = hubData?.coverage?.active_employees || 0

  // Task management state
  const [showTaskDialog, setShowTaskDialog] = useState(false)
  const [editingTask, setEditingTask] = useState<any | null>(null)
  const [taskMode, setTaskMode] = useState<'create' | 'edit'>('create')
  const [taskEmployees, setTaskEmployees] = useState<{ id: string; first_name: string; last_name: string }[]>([])

  useEffect(() => {
    if (isLoaded && organizationId) {
      loadDepartments()
    }
  }, [isLoaded, organizationId])

  // Listen for command palette view changes
  useEffect(() => {
    const handler = (e: CustomEvent) => setViewMode(e.detail)
    window.addEventListener('cal:set-view' as any, handler)
    return () => window.removeEventListener('cal:set-view' as any, handler)
  }, [])

  useEffect(() => {
    const handler = () => setCurrentDate(new Date())
    window.addEventListener('cal:jump-today' as any, handler)
    return () => window.removeEventListener('cal:jump-today' as any, handler)
  }, [])

  async function loadDepartments() {
    if (!organizationId) return
    try {
      const result = await api.get<any[]>('/organizations/departments')
      if (result.ok && result.data) {
        setDepartments(result.data.map((d: any) => d.name).filter(Boolean))
      }
    } catch (e) { console.error(e) }
  }

  function getWeekRange() {
    const d = new Date(currentDate)
    const day = d.getDay()
    d.setDate(d.getDate() - day)
    const start = d.toISOString().split('T')[0]
    const endD = new Date(d)
    endD.setDate(endD.getDate() + 6)
    return { start, end: endD.toISOString().split('T')[0] }
  }

  async function handleCreateEvent(formData: any) {
    if (!organizationId || !userId) return
    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        event_date: formData.event_date,
        start_time: formData.start_time || null,
        end_time: formData.end_time || null,
        all_day: formData.all_day,
        event_type: formData.event_type === 'company_event' ? 'announcement' : formData.event_type,
        event_scope: formData.event_scope,
        branch_id: formData.branch_id || null,
        department_id: formData.department_id || null,
        secondary_branch_id: formData.secondary_branch_id || null,
        secondary_department_id: formData.secondary_department_id || null,
        team_member_ids: formData.team_member_ids?.length > 0 ? formData.team_member_ids : [],
        meeting_provider: formData.meeting_provider || null,
        meeting_url: formData.meeting_url || null,
        requires_rsvp: formData.requires_rsvp,
        reminder_minutes: formData.reminder_minutes,
        location: formData.location || null,
      }
      const result = await api.post<{ id: string }>('/calendar-events', payload)
      if (!result.ok) throw new Error(result.error || 'Failed to create event')

      if (formData.meeting_provider && formData.meeting_provider !== 'manual' && !formData.meeting_url) {
        console.warn('Auto-meeting creation skipped: meeting provider integration not yet migrated')
      }

      toast.success('Event created')
      setShowEventDialog(false)
      refetch()
    } catch (error: any) { toast.error(error.message) }
  }

  async function handleEditEvent(eventId: string, formData: any) {
    if (!organizationId || !userId) return
    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        event_date: formData.event_date,
        start_time: formData.start_time || null,
        end_time: formData.end_time || null,
        all_day: formData.all_day,
        event_type: formData.event_type === 'company_event' ? 'announcement' : formData.event_type,
        event_scope: formData.event_scope,
        branch_id: formData.branch_id || null,
        department_id: formData.department_id || null,
        secondary_branch_id: formData.secondary_branch_id || null,
        secondary_department_id: formData.secondary_department_id || null,
        team_member_ids: formData.team_member_ids?.length > 0 ? formData.team_member_ids : null,
        meeting_provider: formData.meeting_provider || null,
        meeting_url: formData.meeting_url || null,
        requires_rsvp: formData.requires_rsvp,
        reminder_minutes: formData.reminder_minutes,
        location: formData.location || null,
        status: formData.status,
      }
      const result = await api.patch<{ id: string }>(`/calendar-events/${eventId}`, payload)
      if (!result.ok) throw new Error(result.error || 'Failed to update event')

      if (formData.meeting_provider && formData.meeting_provider !== 'manual' && !formData.meeting_url) {
        console.warn('Auto-meeting creation skipped: meeting provider integration not yet migrated')
      }

      toast.success('Event updated')
      setShowEditDialog(false)
      setSelectedEvent(null)
      refetch()
    } catch (error: any) { toast.error(error.message) }
  }

  async function loadTaskEmployees() {
    if (!organizationId) return
    const result = await api.get<any[]>('/employees?status=active&limit=500')
    if (result.ok) {
      setTaskEmployees((result.data || []).map((e: any) => ({ id: e.id, first_name: e.first_name, last_name: e.last_name })))
    }
  }

  async function handleCreateTask(formData: TaskFormData) {
    if (!organizationId || !userId) return
    try {
      const payload: any = {
        title: formData.title,
        description: formData.description || null,
        category: formData.category,
        due_date: formData.due_date || null,
        reminder_minutes: formData.reminder_minutes,
        is_recurring: formData.is_recurring,
        recurrence_rule: formData.recurrence_rule || null,
      }
      if (formData.employee_id) payload.employee_id = formData.employee_id

      const result = await api.post('/employee-tasks', payload)
      if (!result.ok) throw new Error(result.error || 'Failed to create task')
      toast.success('Task created')
      setShowTaskDialog(false)
    } catch (error: any) { toast.error(error.message) }
  }

  async function handleEditTask(taskId: string, formData: TaskFormData) {
    if (!organizationId || !userId) return
    try {
      const update: any = {
        title: formData.title,
        description: formData.description || null,
        category: formData.category,
        due_date: formData.due_date || null,
        reminder_minutes: formData.reminder_minutes,
        is_recurring: formData.is_recurring,
        recurrence_rule: formData.recurrence_rule || null,
      }
      if (formData.employee_id) update.employee_id = formData.employee_id

      const result = await api.patch(`/employee-tasks/${taskId}`, update)
      if (!result.ok) throw new Error(result.error || 'Failed to update task')
      toast.success('Task updated')
      setShowTaskDialog(false)
      setEditingTask(null)
    } catch (error: any) { toast.error(error.message) }
  }

  async function handleDuplicateEvent(event: UnifiedCalendarEvent) {
    if (!organizationId || !userId) return
    try {
      const result = await api.post<{ id: string }>(`/calendar-events/${event.id}/duplicate`, {})
      if (!result.ok) throw new Error(result.error || 'Failed to duplicate event')
      toast.success('Event duplicated for tomorrow')
      setSelectedEvent(null)
      refetch()
    } catch (error: any) { toast.error(error.message) }
  }

  async function handleRescheduleEvent(eventId: string, data: any) {
    if (!organizationId || !userId) return
    try {
      const result = await api.patch(`/calendar-events/${eventId}/reschedule`, { reason: data.reason })
      if (!result.ok) throw new Error(result.error || 'Failed to reschedule event')
      toast.success('Event rescheduled')
      setShowEditDialog(false)
      setSelectedEvent(null)
      refetch()
    } catch (error: any) { toast.error(error.message) }
  }

  async function handleDeleteEvent(eventId: string) {
    if (!confirm('Delete event?')) return
    try {
      const result = await api.del(`/calendar-events/${eventId}`)
      if (!result.ok) throw new Error(result.error || 'Failed to delete event')
      toast.success('Event deleted')
      refetch()
      setSelectedEvent(null)
    } catch { toast.error('Failed to delete event') }
  }

  async function handleAddHoliday(e: React.FormEvent) {
    e.preventDefault()
    if (!organizationId) return
    try {
      const result = await api.post('/holidays', { ...holidayFormData })
      if (!result.ok) throw new Error(result.error || 'Failed to add holiday')
      toast.success('Holiday added successfully!')
      setHolidayFormData({ name: '', date: '', type: 'public', recurring: false, description: '' })
      setShowAddHolidayDialog(false)
      refetch()
    } catch (error: any) { toast.error(error.message || 'Failed to add holiday') }
  }

  async function handleEditHoliday(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedHoliday) return
    try {
      const result = await api.patch(`/holidays/${selectedHoliday.id}`, holidayFormData)
      if (!result.ok) throw new Error(result.error || 'Failed to update holiday')
      toast.success('Holiday updated!')
      setShowEditHolidayDialog(false)
      setSelectedHoliday(null)
      refetch()
    } catch (error: any) { toast.error(error.message || 'Failed to update holiday') }
  }

  async function handleDeleteHoliday(holidayId: string) {
    if (!confirm('Are you sure?')) return
    try {
      const result = await api.del(`/holidays/${holidayId}`)
      if (!result.ok) throw new Error(result.error || 'Failed to delete holiday')
      toast.success('Holiday deleted')
      setShowEditHolidayDialog(false); setSelectedHoliday(null)
      refetch()
    } catch { toast.error('Failed to delete holiday') }
  }

  async function handleImportHolidays() {
    if (!organizationId) return
    if (!confirm('Import Sri Lankan public holidays for 2026?')) return
    try {
      const result = await api.post<{ count: number }>('/holidays/import-sri-lankan-2026', {})
      if (!result.ok) throw new Error(result.error || 'Failed to import holidays')
      toast.success(result.data?.count === 0 ? 'Holidays already exist' : `Added ${result.data?.count} holidays!`)
      refetch()
    } catch (error: any) { toast.error(error.message || 'Failed to import holidays') }
  }

  const previousPeriod = () => {
    const d = new Date(currentDate)
    if (viewMode === 'month') d.setMonth(d.getMonth() - 1)
    else if (viewMode === 'week') d.setDate(d.getDate() - 7)
    else d.setDate(d.getDate() - 1)
    setCurrentDate(d)
  }

  const nextPeriod = () => {
    const d = new Date(currentDate)
    if (viewMode === 'month') d.setMonth(d.getMonth() + 1)
    else if (viewMode === 'week') d.setDate(d.getDate() + 7)
    else d.setDate(d.getDate() + 1)
    setCurrentDate(d)
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear()
  }

  const getEventsForDate = useCallback((date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    const sourceEvents = selectedEmployeeFilter === 'all' ? allEvents : events
    return sourceEvents.filter((e) => {
      if (!e.startAt) return false
      const start = new Date(e.startAt)
      const end = e.endAt ? new Date(e.endAt) : start
      const target = new Date(date)
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      target.setHours(0, 0, 0, 0)
      return target >= start && target <= end
    })
  }, [events, allEvents, selectedEmployeeFilter])

  const { cells } = useCalendarGrid(viewMode, currentDate)

  const currentYear = currentDate.getFullYear()
  const currentMonth = currentDate.getMonth()

  const headerTitle = useMemo(() => {
    if (viewMode === 'month') return `${MONTHS[currentMonth]} ${currentYear}`
    if (viewMode === 'week') {
      const start = new Date(currentDate)
      const day = start.getDay()
      start.setDate(start.getDate() - day)
      const end = new Date(start)
      end.setDate(end.getDate() + 6)
      return `${start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} – ${end.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
    }
    return currentDate.toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }, [viewMode, currentDate, currentYear, currentMonth])

  // Day click handler
  const onDayClick = (date: Date) => {
    setDayDetailsDate(date)
    setShowDayDetails(true)
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full bg-[#F8F7F9]">
        {/* Page Header */}
        <div className="bg-white border-b border-[#F1F0F4] px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-[15px] font-bold text-[#1A1727]">Organization Calendar</h1>
              <p className="text-[11px] text-[#9CA3AF]">Unified view of holidays, training, leave and events</p>
            </div>
            <div className="hidden md:flex items-center gap-2 bg-[#F1F0F4] p-1 rounded-xl">
              {(['month', 'week', 'day'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                    viewMode === m ? 'bg-white text-[#534AB7] shadow-sm' : 'text-[#9CA3AF] hover:text-[#374151]'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Employee filter */}
            {employees.length > 0 && (
              <div className="hidden lg:flex items-center gap-2 mr-2">
                <Users size={14} className="text-[#9CA3AF]" />
                <select
                  value={selectedEmployeeFilter}
                  onChange={e => setSelectedEmployeeFilter(e.target.value)}
                  className="px-3 py-1.5 bg-[#F8F7F9] border border-[#F1F0F4] rounded-xl text-xs font-bold text-[#374151] outline-none"
                >
                  <option value="all">All Employees</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                  ))}
                </select>
              </div>
            )}
            {/* Department filter */}
            {departments.length > 0 && (
              <div className="hidden lg:flex items-center gap-2 mr-2">
                <Filter size={14} className="text-[#9CA3AF]" />
                <select
                  value={selectedDepartment}
                  onChange={e => setSelectedDepartment(e.target.value)}
                  className="px-3 py-1.5 bg-[#F8F7F9] border border-[#F1F0F4] rounded-xl text-xs font-bold text-[#374151] outline-none"
                >
                  <option value="all">All Departments</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            )}
            <button
              onClick={() => {
                setShowMultiEmployee(!showMultiEmployee)
                if (!showMultiEmployee && selectedMultiEmployeeIds.length === 0) {
                  setSelectedMultiEmployeeIds(employees.slice(0, 5).map(e => e.id))
                }
              }}
              className={`hidden sm:flex px-3 py-1.5 border rounded-lg transition-all text-xs font-bold shadow-sm items-center gap-2 ${
                showMultiEmployee ? 'bg-[#534AB7] text-white border-[#534AB7]' : 'border-[#F1F0F4] text-[#534AB7] hover:bg-[#F3E8FF]'
              }`}
            >
              <Users size={13} strokeWidth={2.5} /> Multi
            </button>
            <button onClick={handleImportHolidays} className="hidden sm:flex px-3 py-1.5 border border-[#F1F0F4] text-[#534AB7] rounded-lg hover:bg-[#F3E8FF] transition-all text-xs font-bold shadow-sm items-center gap-2">
              <Sparkles size={13} strokeWidth={2.5} /> 2026 SL
            </button>
            <button
              onClick={() => setShowShareModal(true)}
              className="hidden sm:flex px-3 py-1.5 border border-[#F1F0F4] text-[#534AB7] rounded-lg hover:bg-[#F3E8FF] transition-all text-xs font-bold shadow-sm items-center gap-2"
            >
              <Link2 size={13} strokeWidth={2.5} /> Share
            </button>
            <button onClick={() => setShowEventDialog(true)} className="px-4 py-1.5 bg-[#534AB7] text-white rounded-lg hover:bg-[#1E1854] transition-all text-xs font-bold shadow-md shadow-purple-900/20 flex items-center gap-2">
              <Plus size={13} strokeWidth={3} /> Event
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-20">
          <div className="flex flex-col xl:flex-row gap-6 max-w-[1600px] mx-auto">
            {/* Main Calendar */}
            <div className="flex-1 min-w-0">
              <div className="bg-white rounded-[32px] p-6 lg:p-8 border border-[#F1F0F4] shadow-xl shadow-purple-900/5">
                {/* Calendar toolbar */}
                <div className="flex items-center justify-between mb-6">
                  <button onClick={previousPeriod} className="p-2 hover:bg-[#F8F7F9] rounded-xl text-[#9CA3AF] transition-all border border-[#F1F0F4] active:scale-95">
                    <ChevronLeft size={20} strokeWidth={2.5} />
                  </button>
                  <div className="text-center">
                    <div className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-[0.2em] mb-1">{viewMode} View</div>
                    <h2 className="text-xl lg:text-2xl font-black text-[#1A1727] tracking-tight">{headerTitle}</h2>
                  </div>
                  <button onClick={nextPeriod} className="p-2 hover:bg-[#F8F7F9] rounded-xl text-[#9CA3AF] transition-all border border-[#F1F0F4] active:scale-95">
                    <ChevronRight size={20} strokeWidth={2.5} />
                  </button>
                </div>

                {/* Command Bar Badges */}
                <div className="flex items-center justify-center mb-4">
                  <CommandBarBadges
                    conflictCount={totalConflicts}
                    requestCount={totalRequests}
                    coverageRate={coverageRate}
                    onConflictClick={() => {
                      const firstCell = document.querySelector('[data-conflict="true"]')
                      firstCell?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }}
                    onRequestClick={() => {
                      const firstCell = document.querySelector('[data-request="true"]')
                      firstCell?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }}
                  />
                </div>

                {/* Mobile view tabs */}
                <div className="flex md:hidden bg-[#F1F0F4] p-1 rounded-xl mb-6">
                  {(['month', 'week', 'day'] as const).map(m => (
                    <button key={m} onClick={() => setViewMode(m)} className={`flex-1 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === m ? 'bg-white text-[#534AB7] shadow-sm' : 'text-[#9CA3AF]'}`}>
                      {m}
                    </button>
                  ))}
                </div>

                {/* Calendar content */}
                {loading ? (
                  <CalendarSkeleton view={viewMode} />
                ) : viewMode === 'month' ? (
                  <CalendarGrid view={viewMode} currentDate={currentDate}>
                    {Array.isArray(cells) && cells.map((day, index) => {
                      if (day === null) return <div key={`empty-${index}`} className="aspect-square" />
                      const date = new Date(currentYear, currentMonth, day as number)
                      const dayEvents = getEventsForDate(date)
                      const holidayEvents = dayEvents.filter(e => e.type === 'holiday')
                      const isHoliday = holidayEvents.length > 0
                      const isPoya = holidayEvents.some(e => e.title.toLowerCase().includes('poya'))
                      const holidayName = isHoliday ? holidayEvents[0]?.title : undefined
                      const { conflicts: dayConflicts, requests: dayRequests } = getHubItemsForDate(date)
                      return (
                        <div
                          key={day as number}
                          data-conflict={dayConflicts.length > 0 ? 'true' : undefined}
                          data-request={dayRequests.length > 0 ? 'true' : undefined}
                        >
                          <CalendarDayCell
                            date={date}
                            isToday={isToday(date)}
                            isHoliday={isHoliday}
                            isPoya={isPoya}
                            holidayName={holidayName}
                            events={dayEvents.map(e => ({ id: e.id, type: e.type, title: e.title, allDay: e.allDay }))}
                            conflicts={dayConflicts.map((c: any) => ({
                              conflict_id: c.conflict_id,
                              conflict_type: c.conflict_type,
                              severity: c.severity,
                              employee_name: c.employee_name,
                              source_title: c.source_title,
                            }))}
                            requests={dayRequests}
                            workload={workloadByDate.get(date.toISOString().split('T')[0]) || 0}
                            onConflictClick={(c) => toast.info(`${c.conflict_type}: ${c.source_title}`)}
                            onRequestApprove={(id, type) => handleBulkAction('approve', id, type)}
                            onRequestReject={(id, type) => handleBulkAction('reject', id, type)}
                            onClick={onDayClick}
                            className="aspect-square"
                          />
                        </div>
                      )
                    })}
                  </CalendarGrid>
                ) : (
                  /* Week / Day time-block view */
                  <div className="space-y-4">
                    {(() => {
                      const dates = viewMode === 'week'
                        ? Array.from({ length: 7 }, (_, i) => {
                            const d = new Date(currentDate)
                            const day = d.getDay()
                            d.setDate(d.getDate() - day + i)
                            return d
                          })
                        : [new Date(currentDate)]

                      const timeBlockEvents = dates.map(date => {
                        const dayEvents = getEventsForDate(date)
                        return {
                          date,
                          events: dayEvents.filter(e => !e.allDay && e.startAt && e.endAt).map(e => {
                            const start = new Date(e.startAt!)
                            const end = new Date(e.endAt!)
                            return {
                              ...toEventCardData(e),
                              startHour: start.getHours() + start.getMinutes() / 60,
                              endHour: end.getHours() + end.getMinutes() / 60,
                            }
                          }),
                        }
                      })

                      const hasTimedEvents = timeBlockEvents.some(d => d.events.length > 0)

                      if (hasTimedEvents) {
                        return (
                          <TimeBlockView
                            dates={dates}
                            events={timeBlockEvents}
                            onEventClick={(ev) => {
                              const found = allEvents.find(e => e.id === ev.id)
                              if (found) setSelectedEvent(found)
                            }}
                          />
                        )
                      }

                      if (dates.length === 0 || events.length === 0) {
                        return <EmptyState title="No events" description={`No events for this ${viewMode}.`} />
                      }

                      return dates.map(date => {
                        const dayEvents = getEventsForDate(date)
                        return (
                          <div key={date.toISOString()} className="border border-[#F1F0F4] rounded-[24px] p-4 bg-[#F8F7F9]/30">
                            <div className="flex items-center gap-3 mb-3">
                              <span className={`text-xs font-black w-8 h-8 flex items-center justify-center rounded-full ${isToday(date) ? 'bg-[#534AB7] text-white' : 'bg-white text-[#374151] border border-[#F1F0F4]'}`}>
                                {date.getDate()}
                              </span>
                              <span className="text-xs font-black text-[#9CA3AF] uppercase tracking-widest">
                                {date.toLocaleDateString('en-US', { weekday: 'long' })}
                              </span>
                            </div>
                            {dayEvents.length === 0 ? (
                              <div className="py-4 text-center text-xs text-[#D1D5DB] font-medium italic">No events</div>
                            ) : (
                              <div className="space-y-2">
                                {dayEvents.map(e => (
                                  <EventCard
                                    key={e.id}
                                    event={toEventCardData(e)}
                                    compact
                                    onClick={() => setSelectedEvent(e)}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })
                    })()}
                  </div>
                )}

                {/* Legends */}
                <div className="mt-10 pt-6 border-t border-[#F8F7F9] flex flex-wrap gap-6 items-center justify-center">
                  {[
                    { label: 'Public Holiday', color: 'bg-red-500', shadow: 'shadow-red-500/30' },
                    { label: 'Company Event', color: 'bg-purple-500', shadow: 'shadow-purple-500/30' },
                    { label: 'Training', color: 'bg-orange-500', shadow: 'shadow-orange-500/30' },
                    { label: 'Employee Leave', color: 'bg-blue-500', shadow: 'shadow-blue-500/30' },
                    { label: 'Meeting', color: 'bg-emerald-500', shadow: 'shadow-emerald-500/30' },
                    { label: 'Birthday', color: 'bg-pink-500', shadow: 'shadow-pink-500/30' },
                  ].map(l => (
                    <div key={l.label} className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${l.color} shadow-[0_0_8px] ${l.shadow}`} />
                      <span className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Multi-Employee View */}
            {showMultiEmployee && (
              <div className="flex-1 min-w-0">
                <div className="bg-white rounded-[32px] p-6 lg:p-8 border border-[#F1F0F4] shadow-xl shadow-purple-900/5 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black text-[#1A1727]">Multi-Employee View</h3>
                    <div className="flex items-center gap-2">
                      <select
                        multiple
                        size={1}
                        value={selectedMultiEmployeeIds}
                        onChange={(e) => {
                          const options = Array.from(e.target.selectedOptions).map(o => o.value)
                          setSelectedMultiEmployeeIds(options.length ? options : [e.target.value])
                        }}
                        className="px-3 py-1.5 bg-[#F8F7F9] border border-[#F1F0F4] rounded-xl text-xs font-bold text-[#374151] outline-none"
                      >
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {(() => {
                    const { start, end } = getWeekRange()
                    return (
                      <MultiEmployeeView
                        startDate={start}
                        endDate={end}
                        employeeIds={selectedMultiEmployeeIds}
                      />
                    )
                  })()}
                </div>
              </div>
            )}

            {/* Sidebar */}
            <div className="w-full xl:w-80 shrink-0 space-y-6">
              <div className="sticky top-6 space-y-6">
                {/* Analytics Cards */}
                {/* Mini Calendar */}
                <MiniCalendar
                  currentDate={currentDate}
                  onDateSelect={(date) => setCurrentDate(date)}
                  highlightDates={allEvents.map(e => e.startAt ? e.startAt.split('T')[0] : '').filter(Boolean)}
                />

                <CalendarAnalytics
                  startDate={new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0]}
                  endDate={new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString().split('T')[0]}
                />

                {/* Coverage Alerts */}
                <CoverageAlertPanel
                  startDate={new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0]}
                  endDate={new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString().split('T')[0]}
                />

                <UpcomingBirthdaysWidget />

                <TaskSidebar
                  onCreateTask={() => { setTaskMode('create'); setEditingTask(null); loadTaskEmployees(); setShowTaskDialog(true) }}
                  onEditTask={(task) => { setTaskMode('edit'); setEditingTask(task); loadTaskEmployees(); setShowTaskDialog(true) }}
                />

                {/* Reschedule Inbox */}
                <RescheduleInbox />
              </div>
            </div>
          </div>
        </div>

        {/* Event Creation Modal */}
        <EventCreateModal
          open={showEventDialog}
          onClose={() => setShowEventDialog(false)}
          onSubmit={handleCreateEvent}
          initialDate={dayDetailsDate ? dayDetailsDate.toISOString().split('T')[0] : undefined}
        />

        {/* Event Edit Modal */}
        <EventEditModal
          event={selectedEvent}
          open={showEditDialog}
          onClose={() => setShowEditDialog(false)}
          onSubmit={handleEditEvent}
          onReschedule={handleRescheduleEvent}
        />

        {/* Holiday Add Modal */}
        <AnimatedModal open={showAddHolidayDialog} onClose={() => setShowAddHolidayDialog(false)} title="Add Holiday">
          <form onSubmit={handleAddHoliday} className="space-y-5">
            <div>
              <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Name</label>
              <input required value={holidayFormData.name} onChange={e => setHolidayFormData({ ...holidayFormData, name: e.target.value })} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Date</label>
                <input type="date" required value={holidayFormData.date} onChange={e => setHolidayFormData({ ...holidayFormData, date: e.target.value })} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-2 ml-1">Type</label>
                <select value={holidayFormData.type} onChange={e => setHolidayFormData({ ...holidayFormData, type: e.target.value as any })} className="w-full px-4 py-3 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] outline-none">
                  <option value="public">Public</option>
                  <option value="company">Company</option>
                  <option value="restricted">Restricted</option>
                </select>
              </div>
            </div>
            <div className="flex gap-4 pt-2">
              <button type="button" onClick={() => setShowAddHolidayDialog(false)} className="flex-1 py-3 text-[11px] font-black uppercase tracking-widest text-[#9CA3AF] hover:bg-[#F8F7F9] rounded-xl transition-all">Cancel</button>
              <button type="submit" className="flex-1 py-3 bg-[#534AB7] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-purple-900/20 active:scale-95 transition-all">Add Holiday</button>
            </div>
          </form>
        </AnimatedModal>

        {/* Day Details Panel */}
        {showDayDetails && dayDetailsDate && (
          <div className="fixed inset-0 z-50 flex items-center justify-end bg-[#1A1727]/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white h-full w-full max-w-[480px] shadow-2xl animate-in slide-in-from-right-full duration-500 border-l border-[#F1F0F4] flex flex-col">
              <div className="p-6 lg:p-8 border-b border-[#F1F0F4] bg-[#F8F7F9]/50 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black text-[#534AB7] uppercase tracking-[0.2em] mb-1">Daily Agenda</div>
                  <h2 className="text-xl font-black text-[#1A1727] tracking-tight">
                    {dayDetailsDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </h2>
                </div>
                <button onClick={() => setShowDayDetails(false)} className="p-3 bg-white border border-[#F1F0F4] rounded-full text-[#9CA3AF] hover:text-red-500 transition-all hover:rotate-90 shadow-sm">
                  <X size={20} strokeWidth={3} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-4">
                {(() => {
                  const dayEvents = getEventsForDate(dayDetailsDate)
                  if (dayEvents.length === 0) return (
                    <EmptyState title="No events" description="No events scheduled for this date." className="mt-8" />
                  )
                  return dayEvents.map(e => (
                    <EventCard
                      key={e.id}
                      event={toEventCardData(e)}
                      compact
                      onClick={() => { setSelectedEvent(e); setShowDayDetails(false) }}
                    />
                  ))
                })()}
              </div>

              <div className="p-6 lg:p-8 bg-gray-50 border-t border-[#F1F0F4] space-y-3">
                <button
                  onClick={() => {
                    if (dayDetailsDate) {
                      const start = `${dayDetailsDate.toISOString().split('T')[0]}T09:00:00`
                      const end = `${dayDetailsDate.toISOString().split('T')[0]}T17:00:00`
                      setAvailabilitySlot({ start, end })
                    }
                  }}
                  className="w-full py-3 bg-white border border-[#F1F0F4] text-[#534AB7] rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-[#F8F7F9] transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <Users size={14} /> Check Availability
                </button>
                <button
                  onClick={() => {
                    setShowDayDetails(false)
                    setShowEventDialog(true)
                  }}
                  className="w-full py-4 bg-[#534AB7] text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-purple-900/20 hover:bg-[#1E1854] transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <Plus size={14} strokeWidth={3} /> Add Event
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Event Detail Panel (slide-over for selected event) */}
        <EventDetailPanel
          event={selectedEvent ? toEventCardData(selectedEvent) : null}
          onClose={() => setSelectedEvent(null)}
          onEdit={(ev) => { setShowEditDialog(true) }}
          onDelete={(ev) => handleDeleteEvent(ev.id)}
          onDuplicate={(ev) => {
            const found = allEvents.find(e => e.id === ev.id)
            if (found) handleDuplicateEvent(found)
          }}
        />

        {/* Task Form Modal */}
        <TaskForm
          open={showTaskDialog}
          onClose={() => { setShowTaskDialog(false); setEditingTask(null) }}
          onSubmit={taskMode === 'create' ? handleCreateTask : (data) => editingTask ? handleEditTask(editingTask.id, data) : undefined}
          initialData={editingTask ? {
            title: editingTask.title,
            description: editingTask.description,
            category: editingTask.category,
            due_date: editingTask.due_date,
            reminder_minutes: editingTask.reminder_minutes,
            is_recurring: editingTask.is_recurring,
            recurrence_rule: editingTask.recurrence_rule,
            employee_id: editingTask.employee?.id,
          } : undefined}
          mode={taskMode}
          employees={taskEmployees}
          isAdmin={true}
        />

        {/* Smart Summary Bar */}
        <SmartSummaryBar
          conflictCount={totalConflicts}
          requestCount={totalRequests}
          coverageRate={coverageRate}
          activeEmployees={activeEmployees}
          onAutoFill={() => setShowAutoFill(true)}
          onExport={() => {
            const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0]
            const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString().split('T')[0]
            window.open(`/api/reports/calendar/conflicts?startDate=${start}&endDate=${end}&format=csv`, '_blank')
          }}
          onPrint={() => window.print()}
        />

        {/* Auto-Fill Preview */}
        {showAutoFill && (
          <AutoFillPreview
            weekStart={(() => {
              const d = new Date(currentDate)
              const day = d.getDay()
              d.setDate(d.getDate() - day)
              return d.toISOString().split('T')[0]
            })()}
            onClose={() => setShowAutoFill(false)}
            onApplied={() => { refetch(); fetchHubData() }}
          />
        )}

        {/* Share Calendar Modal */}
        <ShareCalendarModal
          open={showShareModal}
          onClose={() => setShowShareModal(false)}
        />

        {/* Availability Overlay */}
        {availabilitySlot && (
          <AvailabilityOverlay
            start={availabilitySlot.start}
            end={availabilitySlot.end}
            onClose={() => setAvailabilitySlot(null)}
          />
        )}

        {/* Command Palette */}
        <CommandPalette />
      </div>
    </DashboardLayout>
  )
}


