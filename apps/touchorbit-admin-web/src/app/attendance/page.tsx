'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { Clock, UserCheck, UserX, AlertTriangle, RefreshCw, Download, Shield, CheckCircle, XCircle, Eye, ChevronRight, MapPin, Map, Search, ShieldAlert, ExternalLink, MessageSquare, X, ListFilter, SlidersHorizontal, Sparkles, List, Maximize2, Activity } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

const AttendanceMap = dynamic(() => import('@/components/attendance-map'), { ssr: false })

interface Employee {
  id: string
  first_name: string
  last_name: string
  job_title: string | null
  department: string | null
  photo_url: string | null
}

interface AttendanceEntry {
  employee: Employee
  clockIn: string | null
  clockOut: string | null
  status: 'present' | 'late' | 'absent' | 'completed' | 'break'
  isOnBreak: boolean
  locationVerified: boolean
  selfieUrl: string | null
  gpsAccuracy: number | null
  latitude: number | null
  longitude: number | null
  workType: 'office' | 'wfh' | 'field' | null
  shiftName?: string | null
  breakMinutes: number
  suspiciousFlags: string[]
  adminReviewStatus: 'flagged' | 'approved' | 'rejected' | null
  branchName?: string | null
  rawEvents: any[]
  breaks: any[]
}

interface AdvancedFilters {
  department: string | null
  branch: string | null
  shift: string | null
  workType: 'office' | 'wfh' | 'field' | null
  locationVerified: boolean | null
  hasSelfie: boolean | null
  suspiciousOnly: boolean
  noGps: boolean
  outsideGeofence: boolean
}

const initialAdvancedFilters: AdvancedFilters = {
  department: null,
  branch: null,
  shift: null,
  workType: null,
  locationVerified: null,
  hasSelfie: null,
  suspiciousOnly: false,
  noGps: false,
  outsideGeofence: false,
}

interface SuspiciousEvent {
  id: string
  employee_id: string
  employee_name: string
  event_type: 'clock_in' | 'clock_out'
  timestamp: string
  suspicious_flags: string[]
  latitude: number | null
  longitude: number | null
  gps_accuracy: number | null
  location_variance: number | null
  admin_review_status: string
  selfie_url: string | null
  branch_name?: string | null
}

interface ActivityFeedItem {
  id: string
  msg: string
  time: string
  employeeName: string
  tone: 'normal' | 'success' | 'warning' | 'danger'
}

function getHoursWorked(clockIn: string, clockOut: string | null): string {
  const start = new Date(clockIn).getTime()
  const end = clockOut ? new Date(clockOut).getTime() : Date.now()
  const hours = (end - start) / (1000 * 60 * 60)
  const h = Math.floor(hours)
  const m = Math.floor((hours - h) * 60)
  return `${h}h ${m}m`
}

function formatRelativeUpdate(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m ago` : `${hours}h ago`
}

function formatTime(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }) : '-'
}

function getClockEvent(entry: AttendanceEntry, type: 'clock_in' | 'clock_out') {
  const events = entry.rawEvents.filter((event: any) => event.event_type === type)
  return events[events.length - 1] || null
}

function getFirstBreakStart(entry: AttendanceEntry): string | null {
  const firstBreak = entry.breaks.find((event: any) => event.break_start)
  return firstBreak?.break_start || null
}

function getFirstBreakEnd(entry: AttendanceEntry): string | null {
  const endedBreak = entry.breaks.find((event: any) => event.break_end)
  return endedBreak?.break_end || null
}

function getEventLocationLabel(entry: AttendanceEntry, event: any): string {
  const workType = event?.work_type || entry.workType
  if (workType === 'wfh') return 'WFH'
  if (workType === 'field') return 'Field'
  return event?.branch?.name || entry.branchName || 'Office'
}

function getEventMapsUrl(event: any): string | null {
  return event?.latitude != null && event?.longitude != null
    ? `https://maps.google.com/?q=${event.latitude},${event.longitude}`
    : null
}

function exportEmployeeDayLog(entry: AttendanceEntry, date: string) {
  const rows = [
    ['Time', 'Event Type', 'Location', 'GPS Accuracy', 'Verified', 'Suspicious Flags'],
    ...entry.rawEvents.map(ev => [
      new Date(ev.timestamp).toLocaleTimeString(),
      ev.event_type === 'clock_in' ? 'Clock In' : 'Clock Out',
      ev.branch?.name || '',
      ev.gps_accuracy ? `${ev.gps_accuracy.toFixed(1)}m` : '',
      ev.location_verified ? 'Yes' : 'No',
      (ev.suspicious_flags || []).join('; ')
    ]),
    ...entry.breaks.map(b => [
      new Date(b.break_start).toLocaleTimeString(),
      'Break Started',
      '', '', '', ''
    ]),
    ...entry.breaks.filter(b => b.break_end).map(b => [
      new Date(b.break_end).toLocaleTimeString(),
      'Break Returned',
      '', '', '', ''
    ])
  ].sort((a, b) => {
    // Basic string sort for time is risky but these are 12h formatted. 
    // Better to use the raw timestamps if we had them here, but we can sort rawEvents first.
    return 0 // Keep raw order or sort by actual date objects if we passed them.
  })

  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.setAttribute('download', `attendance-${entry.employee.first_name}-${date}.csv`)
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function AttendanceRowSkeleton() {
  return (
    <div className="p-4 flex flex-col gap-3 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-[#F1F0F4] shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex justify-between">
            <div className="h-3 bg-[#F1F0F4] rounded w-1/3" />
            <div className="h-2 bg-[#F1F0F4] rounded w-1/4" />
          </div>
          <div className="flex justify-between">
            <div className="h-2 bg-[#F1F0F4] rounded w-1/4" />
            <div className="h-2 bg-[#F1F0F4] rounded w-1/6" />
          </div>
        </div>
      </div>
      <div className="flex justify-between pl-14">
        <div className="space-y-1">
          <div className="h-2 bg-[#F1F0F4] rounded w-24" />
          <div className="h-2 bg-[#F1F0F4] rounded w-16" />
        </div>
        <div className="flex gap-1">
          <div className="w-6 h-6 bg-[#F1F0F4] rounded-lg" />
          <div className="w-6 h-6 bg-[#F1F0F4] rounded-lg" />
        </div>
      </div>
    </div>
  )
}

function exportToCSV(board: AttendanceEntry[], date: string) {
  const rows = [
    ['Employee Name', 'Job Title', 'Department', 'Status', 'Clock In', 'Clock Out', 'Hours Worked', 'Break Time', 'Location Verified', 'Selfie', 'GPS Accuracy (m)'],
    ...board.map(e => [
      `${e.employee.first_name} ${e.employee.last_name}`,
      e.employee.job_title || '',
      e.employee.department || '',
      e.status,
      e.clockIn ? new Date(e.clockIn).toLocaleTimeString() : '',
      e.clockOut ? new Date(e.clockOut).toLocaleTimeString() : '',
      e.clockIn ? getHoursWorked(e.clockIn, e.clockOut) : '',
      e.breakMinutes > 0 ? `${e.breakMinutes}m` : '',
      e.locationVerified ? 'Yes' : 'No',
      e.selfieUrl ? 'Yes' : 'No',
      e.gpsAccuracy != null ? e.gpsAccuracy.toFixed(1) : '',
    ])
  ]
  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.setAttribute('download', `attendance-${date}.csv`)
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function getVerificationScore(entry: AttendanceEntry) {
  const checks = [
    { label: 'Location Verified', pass: entry.locationVerified, type: 'critical' },
    { label: 'Selfie Present', pass: !!entry.selfieUrl, type: 'medium' },
    { label: 'GPS Accuracy (<50m)', pass: entry.gpsAccuracy !== null && entry.gpsAccuracy < 50, type: 'low' },
    { label: 'Inside Geofence', pass: !entry.suspiciousFlags.includes('outside_geofence'), type: 'critical' },
    { label: 'No Security Flags', pass: entry.suspiciousFlags.length === 0, type: 'critical' }
  ]
  const score = checks.filter(c => c.pass).length
  return { score, checks }
}

export default function AttendancePage() {
  const { organizationId, userId, isLoaded, isDeptManager, isBranchManager } = useAuth()
  const [isClient, setIsClient] = useState(false)
  const [board, setBoard] = useState<AttendanceEntry[]>([])
  const boardRef = useRef<AttendanceEntry[]>([])
  const [suspiciousEvents, setSuspiciousEvents] = useState<SuspiciousEvent[]>([])
  const [showSuspiciousSection, setShowSuspiciousSection] = useState(true)
  const [loading, setLoading] = useState(true)
  const [managedScopeId, setManagedScopeId] = useState<string | null>(null)
  const [selected, setSelected] = useState<AttendanceEntry | null>(null)
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [geofences, setGeofences] = useState<any[]>([])

  // Phase 4 States
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false)
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(initialAdvancedFilters)
  const [departments, setDepartments] = useState<{id: string, name: string}[]>([])
  const [branches, setBranches] = useState<{id: string, name: string}[]>([])

  // Phase 2 States
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map')
  const [isLiveMode, setIsLiveMode] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0)
  const [mapResetSignal, setMapResetSignal] = useState(0)
  const [isMapExpanded, setIsMapExpanded] = useState(false)
  const [showActivityPanel, setShowActivityPanel] = useState(false)
  const [showExpandedActivityPanel, setShowExpandedActivityPanel] = useState(true)
  const [showExpandedFilters, setShowExpandedFilters] = useState(true)

  // Phase 6 States
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'location' | 'verification' | 'notes'>('overview')
  const [drawerNotes, setDrawerNotes] = useState<Record<string, string>>({})

  // Phase 7 States
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([])
  const [isOnline, setIsOnline] = useState(true)
  const [shifts, setShifts] = useState<{id: string, name: string}[]>([])

  useEffect(() => {
    setIsClient(true)
    setIsOnline(navigator.onLine)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    boardRef.current = board
  }, [board])

  // Live Activity Realtime
  useEffect(() => {
    if (!isLiveMode || !organizationId) return

    const reloadScopedAttendance = () => {
      if ((isDeptManager || isBranchManager) && !managedScopeId) return
      const scopeId = isDeptManager || isBranchManager ? managedScopeId : undefined
      loadAttendance(scopeId)
      loadSuspiciousEvents(scopeId)
    }

    const findEmployeeName = (employeeId: string) => {
      const entry = boardRef.current.find(e => e.employee.id === employeeId)
      return entry ? `${entry.employee.first_name} ${entry.employee.last_name}` : 'Employee'
    }

    const channel = supabase
      .channel('attendance-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'clock_events', filter: `organization_id=eq.${organizationId}` }, (payload) => {
        const event = payload.new
        const tone: ActivityFeedItem['tone'] = event.suspicious_flags?.length > 0 ? 'danger' : event.event_type === 'clock_in' ? 'success' : 'normal'
        reloadScopedAttendance()
        setActivityFeed(prev => [{
          id: event.id,
          msg: event.event_type === 'clock_in' ? 'Clocked in' : 'Clocked out',
          time: event.timestamp,
          employeeName: findEmployeeName(event.employee_id),
          tone,
        }, ...prev.filter(item => item.id !== event.id && new Date(item.time).getTime() >= Date.now() - (60 * 60 * 1000))])

        if (event.suspicious_flags?.length > 0) {
          toast.error('Suspicious activity detected')
        } else if (event.event_type === 'clock_in') {
          toast.success('New clock-in received')
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'break_events', filter: `organization_id=eq.${organizationId}` }, (payload) => {
        const breakEvent = payload.new
        reloadScopedAttendance()
        setActivityFeed(prev => [{
          id: breakEvent.id,
          msg: breakEvent.break_end ? 'Returned from break' : 'Started break',
          time: breakEvent.break_end || breakEvent.break_start,
          employeeName: findEmployeeName(breakEvent.employee_id),
          tone: 'normal' as const,
        }, ...prev.filter(item => item.id !== breakEvent.id && new Date(item.time).getTime() >= Date.now() - (60 * 60 * 1000))])
        toast.info(breakEvent.break_end ? 'Employee returned from break' : 'Employee started a break')
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [isLiveMode, organizationId, managedScopeId, isDeptManager, isBranchManager, selectedDate])

  // Reset tab when selection changes
  useEffect(() => {
    if (selected) setActiveTab('overview')
  }, [selected?.employee.id])

  // Timer for "Updated X sec ago"
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsSinceUpdate(Math.floor((new Date().getTime() - lastUpdated.getTime()) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [lastUpdated])

  // Auto-refresh interval (30 seconds)
  useEffect(() => {
    let interval: any
    if (isLiveMode && selectedDate === new Date().toISOString().split('T')[0]) {
      interval = setInterval(() => {
        loadAttendance(managedScopeId)
        loadSuspiciousEvents(managedScopeId)
      }, 30000)
    }
    return () => clearInterval(interval)
  }, [isLiveMode, selectedDate, managedScopeId])

  useEffect(() => {
    if (organizationId) {
      Promise.all([
        supabase.from('departments').select('id, name').eq('organization_id', organizationId),
        supabase.from('branches').select('id, name').eq('organization_id', organizationId),
        supabase.from('shifts').select('id, name').eq('organization_id', organizationId).eq('status', 'active').order('name')
      ]).then(([{ data: depts }, { data: brs }, { data: shiftRows }]) => {
        setDepartments(depts || [])
        setBranches(brs || [])
        setShifts(shiftRows || [])
      })
    }
  }, [organizationId])

  useEffect(() => {
    if (isLoaded && organizationId) {
      if (isDeptManager) {
        supabase.rpc('get_my_managed_dept_id').then(({ data }) => {
          setManagedScopeId(data)
          loadAttendance(data)
          loadSuspiciousEvents(data)
        })
      } else if (isBranchManager) {
        supabase.rpc('get_my_managed_branch_id').then(({ data }) => {
          setManagedScopeId(data)
          loadAttendance(data)
          loadSuspiciousEvents(data)
        })
      } else {
        loadAttendance()
        loadSuspiciousEvents()
      }
    }
  }, [isLoaded, organizationId, managedScopeId, selectedDate])

  const loadAttendance = async (scopeId?: string | null) => {
    if (!organizationId) return
    setLoading(true)

    // Get active employees - scoped by manager
    let empQuery = supabase
      .from('employees')
      .select('id, first_name, last_name, job_title, department, photo_url')
      .eq('organization_id', organizationId)
      .eq('employment_status', 'active')
    
    if (isDeptManager && scopeId) empQuery = empQuery.eq('department_id', scopeId)
    else if (isBranchManager && scopeId) empQuery = empQuery.eq('branch_id', scopeId)

    const { data: employees } = await empQuery
    if (!employees || employees.length === 0) {
      setBoard([])
      setLoading(false)
      setLastUpdated(new Date())
      return
    }

    const targetDate = selectedDate
    const [{ data: events }, { data: geoData }] = await Promise.all([
      supabase.from('clock_events').select('*, branch:branches(name)').eq('organization_id', organizationId).gte('timestamp', targetDate + 'T00:00:00').lte('timestamp', targetDate + 'T23:59:59').order('timestamp', { ascending: true }),
      supabase.from('geofences').select('id, name, latitude, longitude, radius_meters').eq('organization_id', organizationId)
    ])
    setGeofences(geoData || [])

    const { data: breakEvents } = await supabase
      .from('break_events')
      .select('*')
      .eq('organization_id', organizationId)
      .gte('break_start', targetDate + 'T00:00:00')
      .lte('break_start', targetDate + 'T23:59:59')

    const { data: rosterRows } = await supabase
      .from('roster_assignments')
      .select('employee_id, shift:shifts(name)')
      .eq('organization_id', organizationId)
      .eq('date', targetDate)

    const shiftByEmployeeId = new globalThis.Map((rosterRows || []).map((row: any) => [
      row.employee_id,
      Array.isArray(row.shift) ? row.shift[0]?.name : row.shift?.name
    ]))

    const entries: AttendanceEntry[] = employees.map((emp) => {
      const empEvents = (events || []).filter((e: any) => e.employee_id === emp.id)
      const clockInEvents = empEvents.filter((e: any) => e.event_type === 'clock_in')
      const clockOutEvents = empEvents.filter((e: any) => e.event_type === 'clock_out')
      const clockIn = clockInEvents[clockInEvents.length - 1]
      const clockOut = clockOutEvents[clockOutEvents.length - 1]

      const empBreaks = (breakEvents || []).filter((b: any) => b.employee_id === emp.id)
      const totalBreakMinutes = empBreaks.reduce((sum: number, b: any) => sum + (b.duration_minutes || 0), 0)
      const isOnBreak = empBreaks.some((b: any) => b.break_end === null)

      let status: AttendanceEntry['status'] = 'absent'
      if (clockIn) {
        if (clockOut && new Date(clockOut.timestamp) > new Date(clockIn.timestamp)) status = 'completed'
        else if (isOnBreak) status = 'break'
        else {
          const lateT = new Date(clockIn.timestamp); lateT.setHours(9, 15, 0, 0)
          status = new Date(clockIn.timestamp) > lateT ? 'late' : 'present'
        }
      }

      return {
        employee: emp,
        clockIn: clockIn?.timestamp || null,
        clockOut: (clockOut && (status === 'completed')) ? clockOut.timestamp : null,
        status,
        isOnBreak,
        locationVerified: clockIn?.location_verified || false,
        selfieUrl: clockIn?.selfie_url || null,
        gpsAccuracy: clockIn?.gps_accuracy ?? null,
        latitude: clockIn?.latitude ?? null,
        longitude: clockIn?.longitude ?? null,
        workType: clockIn?.work_type || null,
        shiftName: shiftByEmployeeId.get(emp.id) || null,
        breakMinutes: totalBreakMinutes,
        suspiciousFlags: clockIn?.suspicious_flags || [],
        adminReviewStatus: clockIn?.admin_review_status || null,
        branchName: clockIn?.branch?.name || null,
        rawEvents: empEvents,
        breaks: empBreaks,
      }
    })

    setBoard(entries)
    const employeeNameById = new globalThis.Map(entries.map(e => [e.employee.id, `${e.employee.first_name} ${e.employee.last_name}`]))
    const oneHourAgo = Date.now() - (60 * 60 * 1000)
    const feedItems: ActivityFeedItem[] = [
      ...(events || []).map((event: any) => ({
        id: event.id,
        msg: event.event_type === 'clock_in' ? 'Clocked in' : 'Clocked out',
        time: event.timestamp,
        employeeName: employeeNameById.get(event.employee_id) || 'Employee',
        tone: ((event.suspicious_flags || []).length > 0 ? 'danger' : event.event_type === 'clock_in' ? 'success' : 'normal') as ActivityFeedItem['tone'],
      })),
      ...(breakEvents || []).flatMap((event: any) => [
        {
          id: `${event.id}-start`,
          msg: 'Started break',
          time: event.break_start,
          employeeName: employeeNameById.get(event.employee_id) || 'Employee',
          tone: 'normal' as const,
        },
        ...(event.break_end ? [{
          id: `${event.id}-end`,
          msg: 'Returned from break',
          time: event.break_end,
          employeeName: employeeNameById.get(event.employee_id) || 'Employee',
          tone: 'normal' as const,
        }] : []),
      ]),
    ]
      .filter(item => new Date(item.time).getTime() >= oneHourAgo)
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    setActivityFeed(feedItems)
    setLoading(false)
    setLastUpdated(new Date())
  }

  const loadSuspiciousEvents = async (scopeId?: string | null) => {
    if (!organizationId) return
    const targetDate = selectedDate
    let query = supabase
      .from('clock_events')
      .select('id, employee_id, event_type, timestamp, suspicious_flags, latitude, longitude, gps_accuracy, location_variance, admin_review_status, selfie_url, employees!inner(first_name, last_name, department_id, branch_id), branches(name)')
      .eq('organization_id', organizationId)
      .eq('admin_review_status', 'flagged')
      .gte('timestamp', targetDate + 'T00:00:00')
      .lte('timestamp', targetDate + 'T23:59:59')

    if (isDeptManager && scopeId) query = (query as any).eq('employees.department_id', scopeId)
    else if (isBranchManager && scopeId) query = (query as any).eq('employees.branch_id', scopeId)
    const { data, error } = await query.order('timestamp', { ascending: false }).limit(20)
    if (error) { console.error('Error loading suspicious events:', error); return }
    setSuspiciousEvents((data || []).map((e: any) => ({
      id: e.id,
      employee_id: e.employee_id,
      employee_name: `${e.employees.first_name} ${e.employees.last_name}`,
      event_type: e.event_type,
      timestamp: e.timestamp,
      suspicious_flags: e.suspicious_flags || [],
      latitude: e.latitude,
      longitude: e.longitude,
      gps_accuracy: e.gps_accuracy,
      location_variance: e.location_variance,
      admin_review_status: e.admin_review_status,
      selfie_url: e.selfie_url,
      branch_name: e.branches?.name || null,
    })))
  }

  const reviewEvent = async (eventId: string, status: 'approved' | 'rejected') => {
    setSuspiciousEvents(prev => prev.filter(e => e.id !== eventId))
    const { error } = await supabase.rpc('review_clock_event', {
      p_event_id: eventId,
      p_status: status,
      p_reviewed_by: userId,
      p_notes: status === 'approved' ? 'Reviewed and approved by admin' : 'Rejected due to suspicious activity',
    })
    if (error) {
      toast.error('Failed to review event: ' + error.message)
      loadSuspiciousEvents(managedScopeId)
    } else {
      toast.success(`Event ${status} successfully`)
    }
  }

  const getFlagLabel = (flag: string): string => {
    const labels: Record<string, string> = {
      low_variance: 'Identical GPS samples (possible mock location)',
      accuracy_too_precise: 'GPS accuracy suspiciously precise (<1m)',
      accuracy_too_imprecise: 'GPS accuracy too imprecise (>100m)',
      timezone_mismatch: 'Device timezone does not match expected timezone',
      teleportation: 'Impossible movement speed detected',
      outside_geofence: 'Outside all designated geofences',
      mock_location_api: 'Mock location detected by API',
    }
    return labels[flag] || flag
  }

  const stats = [
    { id: 'present',    label: 'Present',    value: board.filter(e => e.status === 'present' || e.status === 'late').length, color: '#10B981' },
    { id: 'late',       label: 'Late',       value: board.filter(e => e.status === 'late').length, color: '#F59E0B' },
    { id: 'absent',     label: 'Absent',     value: board.filter(e => e.status === 'absent').length, color: '#EF4444' },
    { id: 'break',      label: 'On Break',   value: board.filter(e => e.status === 'break').length, color: '#534AB7' },
    { id: 'completed',  label: 'Completed',  value: board.filter(e => e.status === 'completed').length, color: '#3B82F6' },
    { id: 'suspicious', label: 'Suspicious', value: board.filter(e => e.adminReviewStatus === 'flagged').length, color: '#EF4444' },
  ]

  const filtered = board.filter(e => {
    const matchesFilter =
      filter === 'all'        ? true :
      filter === 'present'    ? (e.status === 'present' || e.status === 'late') :
      filter === 'suspicious' ? e.adminReviewStatus === 'flagged' :
                                e.status === filter
    const matchesSearch = `${e.employee.first_name} ${e.employee.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
    
    // Advanced Filters
    const matchesDept = !advancedFilters.department || e.employee.department === advancedFilters.department
    const matchesBranch = !advancedFilters.branch || e.branchName === advancedFilters.branch
    const matchesShift = !advancedFilters.shift || e.shiftName === advancedFilters.shift
    const matchesWorkType = !advancedFilters.workType || e.workType === advancedFilters.workType
    const matchesVerified = advancedFilters.locationVerified === null || e.locationVerified === advancedFilters.locationVerified
    const matchesSelfie = advancedFilters.hasSelfie === null || (!!e.selfieUrl === advancedFilters.hasSelfie)
    const matchesSuspiciousOnly = !advancedFilters.suspiciousOnly || e.adminReviewStatus === 'flagged'
    const matchesNoGps = !advancedFilters.noGps || (e.clockIn && e.latitude === null)
    const matchesOutsideGeofence = !advancedFilters.outsideGeofence || e.suspiciousFlags.includes('outside_geofence')

    return matchesFilter && matchesSearch && matchesDept && matchesBranch && matchesShift && matchesWorkType && matchesVerified && matchesSelfie && matchesSuspiciousOnly && matchesNoGps && matchesOutsideGeofence
  })

  // Status proportions for bar
  const total = board.length || 1
  const proportions = {
    present: (board.filter(e => e.status === 'present').length / total) * 100,
    late: (board.filter(e => e.status === 'late').length / total) * 100,
    absent: (board.filter(e => e.status === 'absent').length / total) * 100,
    break: (board.filter(e => e.status === 'break').length / total) * 100,
    completed: (board.filter(e => e.status === 'completed').length / total) * 100,
  }

  const statusSegments = [
    { id: 'present', label: 'Present', value: board.filter(e => e.status === 'present').length, percent: proportions.present, color: 'bg-emerald-500', text: 'text-emerald-700' },
    { id: 'late', label: 'Late', value: board.filter(e => e.status === 'late').length, percent: proportions.late, color: 'bg-amber-500', text: 'text-amber-700' },
    { id: 'absent', label: 'Absent', value: board.filter(e => e.status === 'absent').length, percent: proportions.absent, color: 'bg-red-500', text: 'text-red-700' },
    { id: 'break', label: 'Break', value: board.filter(e => e.status === 'break').length, percent: proportions.break, color: 'bg-[#534AB7]', text: 'text-[#534AB7]' },
    { id: 'completed', label: 'Completed', value: board.filter(e => e.status === 'completed').length, percent: proportions.completed, color: 'bg-blue-500', text: 'text-blue-700' },
  ]

  const applySavedView = (view: string) => {
    setFilter('all')
    setSearchQuery('')
    const newFilters = { ...initialAdvancedFilters }
    
    switch(view) {
      case 'Needs attention':
        newFilters.suspiciousOnly = true
        break
      case 'Late arrivals':
        setFilter('late')
        break
      case 'No clock-in':
        setFilter('absent')
        break
      case 'Outside geofence':
        newFilters.outsideGeofence = true
        break
      case 'Remote / field staff':
        newFilters.workType = 'field' // Simple default for this preset
        break
    }
    setAdvancedFilters(newFilters)
    setIsFilterDrawerOpen(false)
  }

  const timelineItems = filtered.flatMap(e => {
    const employeeName = `${e.employee.first_name} ${e.employee.last_name}`
    const base = {
      employeeId: e.employee.id,
      employeeName,
      status: e.status,
      department: e.employee.department,
      branchName: e.branchName,
      suspicious: e.adminReviewStatus === 'flagged' || e.suspiciousFlags.length > 0,
    }

    return [
      ...e.rawEvents.map((ev: any) => ({
        ...base,
        id: ev.id,
        time: ev.timestamp,
        label: ev.event_type === 'clock_in' ? 'Clocked in' : 'Clocked out',
        detail: ev.branch?.name || e.branchName || 'Mobile location',
        tone: (ev.suspicious_flags || []).length > 0 ? 'danger' : ev.event_type === 'clock_in' ? 'success' : 'normal',
      })),
      ...e.breaks.flatMap((b: any) => [
        {
          ...base,
          id: `${b.id}-start`,
          time: b.break_start,
          label: 'Started break',
          detail: e.branchName || 'Break event',
          tone: 'break',
        },
        ...(b.break_end ? [{
          ...base,
          id: `${b.id}-end`,
          time: b.break_end,
          label: 'Returned from break',
          detail: e.branchName || 'Break event',
          tone: 'success',
        }] : []),
      ]),
    ]
  }).sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full bg-[#ECECF1] font-['Plus_Jakarta_Sans']">
        
        {/* Compact Command Header */}
        <div className="bg-[#ECECF1] border-b border-[#D8D6DF] px-6 py-4 shrink-0">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-xl font-black text-[#1A1727] tracking-tight flex items-center gap-2">
                  Live Attendance
                  {isLiveMode && selectedDate === new Date().toISOString().split('T')[0] && (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black rounded-lg uppercase tracking-widest border border-emerald-200">
                      <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" /> Live
                    </span>
                  )}
                </h1>
                <div className="flex items-center gap-2 text-[11px] font-black text-[#6B6578]">
                  {!isOnline ? (
                    <span className="flex items-center gap-1.5 text-red-500"><AlertTriangle size={10} /> Offline / reconnecting</span>
                  ) : loading ? (
                    <span className="flex items-center gap-1.5"><RefreshCw size={10} className="animate-spin" /> Syncing...</span>
                  ) : (
                    <span>Updated {formatRelativeUpdate(secondsSinceUpdate)}</span>
                  )}
                  <span>·</span>
                  <span>{board.length} staff</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
              {/* Date Selector */}
              <div className="flex bg-[#E3E2EA] rounded-xl p-1 gap-1 border border-[#C7C3D0] shadow-sm">
                {[
                  { id: 'today', label: 'Today', date: new Date().toISOString().split('T')[0] },
                  { id: 'yesterday', label: 'Yesterday', date: new Date(Date.now() - 86400000).toISOString().split('T')[0] }
                ].map(d => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDate(d.date)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${selectedDate === d.date ? 'bg-white text-[#534AB7] shadow-sm' : 'text-[#6B6578] hover:text-[#1A1727]'}`}
                  >
                    {d.label}
                  </button>
                ))}
                <input 
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent border-none text-[10px] font-black text-[#534AB7] outline-none px-2 uppercase tracking-widest"
                />
              </div>

              {/* View Mode Toggle */}
              <div className="flex bg-[#E3E2EA] rounded-xl p-1 gap-1 border border-[#C7C3D0] shadow-sm">
                {[
                  { id: 'map', icon: Map, label: 'Map' },
                  { id: 'list', icon: List, label: 'List' }
                ].map(m => (
                  <button
                    key={m.id}
                    onClick={() => setViewMode(m.id as 'map' | 'list')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === m.id ? 'bg-white text-[#534AB7] shadow-sm' : 'text-[#6B6578] hover:text-[#1A1727]'}`}
                  >
                    <m.icon size={12} /> {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#E3E2EA] border border-[#C7C3D0] shadow-sm">
                <span className="text-[10px] font-black text-[#6B6578] uppercase tracking-widest">Auto-Refresh</span>
                <button 
                  onClick={() => setIsLiveMode(!isLiveMode)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${isLiveMode ? 'bg-[#534AB7]' : 'bg-[#9CA3AF]'}`}
                  aria-label="Toggle auto refresh"
                >
                  <div className={`absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${isLiveMode ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
              <button
                onClick={() => exportToCSV(filtered, selectedDate)}
                className="p-2.5 text-[#374151] bg-[#E3E2EA] border border-[#C7C3D0] hover:bg-white rounded-xl transition-all shadow-sm"
                title="Export Filtered CSV"
              >
                <Download size={18} />
              </button>
              <button 
                onClick={() => loadAttendance(managedScopeId)} 
                className="flex items-center gap-2 px-4 py-2 bg-[#534AB7] text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-purple-900/20 hover:bg-[#1E1854] transition-all"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>
            </div>
          </div>
        </div>

        {/* KPI & Status Overview Bar */}
        <div className="bg-[#ECECF1] border-b border-[#D8D6DF] px-6 py-3 shrink-0">
          <div className="grid grid-cols-[minmax(0,1fr)_280px] items-stretch gap-4">
            <div className="grid min-w-0 grid-cols-6 gap-2">
              {stats.map(s => (
                <button 
                  key={s.label}
                  onClick={() => setFilter(filter === s.id ? 'all' : s.id)}
                  className={`group relative flex h-[74px] min-w-0 flex-col items-start justify-center rounded-xl border px-3 transition-all shadow-sm ${filter === s.id ? 'bg-white border-[#534AB7]/40 ring-2 ring-[#534AB7]/10' : 'bg-[#F4F3F7] border-[#C7C3D0] hover:bg-white'}`}
                >
                  <div className="w-full truncate text-[9px] font-black text-[#6B6578] uppercase tracking-widest mb-0.5 group-hover:text-[#534AB7]">{s.label}</div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-black text-[#1A1727]">{s.value}</span>
                    <div className="w-1 h-1 rounded-full mb-1" style={{ backgroundColor: s.color }} />
                  </div>
                  {filter === s.id && (
                    <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#534AB7] rounded-full" />
                  )}
                </button>
              ))}
            </div>

            <div className="flex h-[74px] items-center justify-between gap-3 rounded-xl border border-[#C7C3D0] bg-[#F4F3F7] px-3 shadow-sm">
              <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-3 gap-y-1">
                {statusSegments.map(segment => (
                  <div key={segment.id} className="flex min-w-0 items-center gap-1.5">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${segment.color}`} />
                    <span className={`shrink-0 text-[9px] font-black ${segment.text}`}>{Math.round(segment.percent)}%</span>
                    <span className="truncate text-[8px] font-bold uppercase tracking-wider text-[#6B6578]">{segment.label}</span>
                  </div>
                ))}
              </div>
              <div
                className="h-12 w-12 shrink-0 rounded-full border border-white shadow-sm"
                style={{
                  background: `conic-gradient(#10B981 0 ${proportions.present}%, #F59E0B ${proportions.present}% ${proportions.present + proportions.late}%, #EF4444 ${proportions.present + proportions.late}% ${proportions.present + proportions.late + proportions.absent}%, #534AB7 ${proportions.present + proportions.late + proportions.absent}% ${proportions.present + proportions.late + proportions.absent + proportions.break}%, #3B82F6 ${proportions.present + proportions.late + proportions.absent + proportions.break}% 100%)`
                }}
                title="Attendance status percentages"
              >
                <div className="m-3 h-6 w-6 rounded-full bg-[#F4F3F7]" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden p-4 gap-4">
          
          {viewMode === 'map' && (
          <div className="w-[450px] rounded-2xl border border-[#C7C3D0] bg-white flex flex-col overflow-hidden shadow-sm">
            <div className="p-4 border-b border-[#F1F0F4] space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#D1D5DB]" size={16} />
                  <input 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search employee..." 
                    className="w-full pl-10 pr-4 py-2.5 bg-[#F8F7F9] border-none rounded-xl text-sm font-bold placeholder:text-[#D1D5DB] outline-none focus:ring-2 focus:ring-[#534AB7]/10" 
                  />
                </div>
                <button 
                  onClick={() => setIsFilterDrawerOpen(true)}
                  className={`px-3 py-2.5 rounded-xl border transition-all flex items-center gap-2 ${
                    Object.values(advancedFilters).some(v => v !== null && v !== false) 
                    ? 'bg-[#F3E8FF] border-[#534AB7]/20 text-[#534AB7]' 
                    : 'bg-[#F8F7F9] border-transparent text-[#9CA3AF] hover:text-[#374151]'
                  }`}
                >
                  <ListFilter size={18} />
                  {Object.values(advancedFilters).some(v => v !== null && v !== false) && (
                    <span className="w-1.5 h-1.5 bg-[#534AB7] rounded-full" />
                  )}
                </button>
              </div>

              {/* Active Filter Chips */}
              {(Object.values(advancedFilters).some(v => v !== null && v !== false) || filter !== 'all') && (
                <div className="flex flex-wrap gap-1.5 pb-1">
                  {filter !== 'all' && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-[#F8F7F9] border border-[#F1F0F4] rounded-lg text-[9px] font-black text-[#534AB7] uppercase tracking-wider">
                      <span>Status: {filter}</span>
                      <button onClick={() => setFilter('all')}><X size={10} /></button>
                    </div>
                  )}
                  {advancedFilters.department && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-[#F8F7F9] border border-[#F1F0F4] rounded-lg text-[9px] font-black text-[#534AB7] uppercase tracking-wider">
                      <span>Dept: {advancedFilters.department}</span>
                      <button onClick={() => setAdvancedFilters(f => ({ ...f, department: null }))}><X size={10} /></button>
                    </div>
                  )}
                  {advancedFilters.branch && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-[#F8F7F9] border border-[#F1F0F4] rounded-lg text-[9px] font-black text-[#534AB7] uppercase tracking-wider">
                      <span>Branch: {advancedFilters.branch}</span>
                      <button onClick={() => setAdvancedFilters(f => ({ ...f, branch: null }))}><X size={10} /></button>
                    </div>
                  )}
                  {advancedFilters.workType && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-[#F8F7F9] border border-[#F1F0F4] rounded-lg text-[9px] font-black text-[#534AB7] uppercase tracking-wider">
                      <span>{advancedFilters.workType}</span>
                      <button onClick={() => setAdvancedFilters(f => ({ ...f, workType: null }))}><X size={10} /></button>
                    </div>
                  )}
                  {advancedFilters.suspiciousOnly && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-red-50 border border-red-100 rounded-lg text-[9px] font-black text-red-600 uppercase tracking-wider">
                      <span>Suspicious</span>
                      <button onClick={() => setAdvancedFilters(f => ({ ...f, suspiciousOnly: false }))}><X size={10} /></button>
                    </div>
                  )}
                  {advancedFilters.noGps && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 border border-amber-100 rounded-lg text-[9px] font-black text-amber-600 uppercase tracking-wider">
                      <span>No GPS</span>
                      <button onClick={() => setAdvancedFilters(f => ({ ...f, noGps: false }))}><X size={10} /></button>
                    </div>
                  )}
                  {advancedFilters.outsideGeofence && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-red-50 border border-red-100 rounded-lg text-[9px] font-black text-red-600 uppercase tracking-wider">
                      <span>Outside Fence</span>
                      <button onClick={() => setAdvancedFilters(f => ({ ...f, outsideGeofence: false }))}><X size={10} /></button>
                    </div>
                  )}
                  <button 
                    onClick={() => { setAdvancedFilters(initialAdvancedFilters); setFilter('all'); }}
                    className="text-[9px] font-black text-[#9CA3AF] uppercase tracking-widest hover:text-red-500 transition-colors ml-auto"
                  >
                    Clear All
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[#F8F7F9] no-scrollbar">
              {loading ? (
                <div className="flex flex-col">
                  {[...Array(8)].map((_, i) => <AttendanceRowSkeleton key={i} />)}
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-20 text-center px-6">
                  <div className="w-16 h-16 bg-[#F8F7F9] rounded-full flex items-center justify-center mx-auto mb-4">
                    <UserX size={32} className="text-[#D1D5DB]" />
                  </div>
                  <h3 className="text-sm font-black text-[#1A1727] uppercase tracking-wider mb-1">No employees found</h3>
                  <p className="text-[11px] font-bold text-[#9CA3AF]">
                    {filter === 'late' ? 'Great! No employees are late today.' :
                     filter === 'suspicious' ? 'Excellent! No suspicious activity detected.' :
                     'No employees match your current filter or search criteria.'}
                  </p>
                </div>
              ) : filtered.map(e => {
                const isSelected = selected?.employee.id === e.employee.id
                const gpsState = !e.clockIn ? '—' : 
                                 e.locationVerified ? 'Verified' : 
                                 e.gpsAccuracy == null ? 'No GPS' :
                                 e.gpsAccuracy > 100 ? 'Weak GPS' : 'Unverified'
                
                const lastEventText = e.status === 'completed' ? `Clocked out ${new Date(e.clockOut!).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}` :
                                     e.status === 'break' ? 'Currently on break' :
                                     e.clockIn ? `Clocked in ${new Date(e.clockIn).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}` :
                                     'No clock-in today'

                return (
                  <div 
                    key={e.employee.id} 
                    onClick={() => setSelected(e)}
                    className={`group p-4 flex flex-col gap-3 cursor-pointer transition-all ${isSelected ? 'bg-[#F3E8FF] border-l-4 border-[#534AB7]' : 'hover:bg-[#F8F7F9]'}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-xl bg-[#F1F0F4] flex items-center justify-center font-black text-[#9CA3AF] text-sm shrink-0 border-2 border-white overflow-hidden shadow-sm">
                          {e.employee.photo_url ? (
                            <img src={e.employee.photo_url} className="w-full h-full object-cover" alt="avatar" />
                          ) : (
                            `${e.employee.first_name[0]}${e.employee.last_name[0]}`
                          )}
                        </div>
                        {e.suspiciousFlags.length > 0 && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 border-2 border-white flex items-center justify-center shadow-sm">
                            <AlertTriangle size={8} className="text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-0.5">
                          <div className="text-[13px] font-black text-[#1A1727] truncate leading-tight">{e.employee.first_name} {e.employee.last_name}</div>
                          <div className="text-[10px] font-black text-[#534AB7] uppercase tracking-tighter whitespace-nowrap ml-2">
                            {e.clockIn ? new Date(e.clockIn).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }) : '—'}
                          </div>
                        </div>
                        <div className="flex justify-between items-center gap-2">
                          <div className="text-[10px] font-bold text-[#9CA3AF] truncate uppercase tracking-tighter">{e.employee.department}</div>
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest whitespace-nowrap ${
                            e.status === 'present' ? 'bg-emerald-100 text-emerald-700' :
                            e.status === 'late' ? 'bg-amber-100 text-amber-700' :
                            e.status === 'absent' ? 'bg-red-100 text-red-700' :
                            e.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                            'bg-[#EDE9FE] text-[#534AB7]'
                          }`}>
                            {e.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pl-14">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-[#6B7280] leading-none mb-0.5">{lastEventText}</span>
                        <div className="flex items-center gap-1.5">
                          <MapPin size={10} className={gpsState === 'Verified' ? 'text-emerald-500' : 'text-[#D1D5DB]'} />
                          <span className={`text-[9px] font-black uppercase tracking-widest ${gpsState === 'Verified' ? 'text-emerald-600' : 'text-[#9CA3AF]'}`}>{gpsState}</span>
                          {e.gpsAccuracy != null && <span className="text-[9px] font-bold text-[#D1D5DB]">· ±{e.gpsAccuracy.toFixed(0)}m</span>}
                        </div>
                      </div>

                      {/* Row Quick Actions */}
                      <div className={`flex items-center gap-1 transition-all ${(isSelected || 'group-hover:opacity-100 opacity-0')}`}>
                        <Link 
                          href={`/employees/${e.employee.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 hover:bg-white rounded-lg text-[#9CA3AF] hover:text-[#534AB7] transition-colors shadow-sm border border-transparent hover:border-[#F1F0F4]"
                          title="View Profile"
                        >
                          <Eye size={12} />
                        </Link>
                        {e.latitude != null && e.longitude != null && (
                          <a 
                            href={`https://maps.google.com/?q=${e.latitude},${e.longitude}`}
                            target="_blank"
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 hover:bg-white rounded-lg text-[#9CA3AF] hover:text-[#534AB7] transition-colors shadow-sm border border-transparent hover:border-[#F1F0F4]"
                            title="Open Map Location"
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}
                        {e.adminReviewStatus === 'flagged' && (
                          <Link 
                            href="/spoofing-review"
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 bg-red-50 hover:bg-red-100 rounded-lg text-red-500 transition-colors shadow-sm border border-red-100"
                            title="Review Flag"
                          >
                            <ShieldAlert size={12} />
                          </Link>
                        )}
                        <button 
                          onClick={(e) => { e.stopPropagation(); toast.info('Messaging feature coming soon'); }}
                          className="p-1.5 hover:bg-white rounded-lg text-[#9CA3AF] hover:text-[#534AB7] transition-colors shadow-sm border border-transparent hover:border-[#F1F0F4]"
                          title="Message Employee (Coming Soon)"
                        >
                          <MessageSquare size={12} />
                        </button>
                        <button 
                          onClick={(event) => { event.stopPropagation(); exportEmployeeDayLog(e, selectedDate); }}
                          className="p-1.5 hover:bg-white rounded-lg text-[#9CA3AF] hover:text-[#534AB7] transition-colors shadow-sm border border-transparent hover:border-[#F1F0F4]"
                          title="Export Employee Day Log"
                        >
                          <Download size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          )}

          {/* Right Detail / Map */}
          <div className="flex-1 flex flex-col relative overflow-hidden">
            
            {/* Suspicious Events Panel (Collapsible/Above Map) */}
            {!selected && suspiciousEvents.length > 0 && (
              <div className="border-b border-red-100 bg-red-50 z-10">
                <button
                  onClick={() => setShowSuspiciousSection(prev => !prev)}
                  className="w-full px-6 py-3 flex items-center gap-3 hover:bg-red-100/50 transition-colors"
                >
                  <AlertTriangle size={15} className="text-red-500 shrink-0" />
                  <span className="text-[11px] font-black text-red-700 uppercase tracking-wider flex-1 text-left">
                    {suspiciousEvents.length} Suspicious Event{suspiciousEvents.length > 1 ? 's' : ''} — Review Required
                  </span>
                  <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-black rounded-full">{suspiciousEvents.length}</span>
                  <ChevronRight size={14} className={`text-red-400 transition-transform ${showSuspiciousSection ? 'rotate-90' : ''}`} />
                </button>
                {showSuspiciousSection && (
                  <div className="px-4 pb-4 space-y-3 max-h-[320px] overflow-y-auto">
                    {suspiciousEvents.map(evt => (
                      <div key={evt.id} className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
                        <div className="flex items-start gap-3 p-4">
                          {evt.selfie_url ? (
                            <img src={evt.selfie_url} alt="selfie" className="w-12 h-12 rounded-xl object-cover border border-[#F1F0F4] shrink-0" />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-[#F8F7F9] border border-[#F1F0F4] flex items-center justify-center shrink-0">
                              <Shield size={18} className="text-[#D1D5DB]" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[13px] font-black text-[#1A1727]">{evt.employee_name}</span>
                              <span className="px-2 py-0.5 bg-red-50 text-red-600 text-[9px] font-black rounded-full uppercase tracking-wider border border-red-100">
                                {evt.event_type === 'clock_in' ? 'Clock In' : 'Clock Out'}
                              </span>
                            </div>
                            <div className="text-[11px] font-bold text-[#9CA3AF] mb-2">
                              {new Date(evt.timestamp).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                              {evt.branch_name && <span> · {evt.branch_name}</span>}
                            </div>
                            <div className="space-y-1 mb-3">
                              {evt.suspicious_flags.map(flag => (
                                <div key={flag} className="flex items-start gap-1.5">
                                  <AlertTriangle size={10} className="text-amber-500 mt-0.5 shrink-0" />
                                  <span className="text-[10px] font-bold text-[#374151]">{getFlagLabel(flag)}</span>
                                </div>
                              ))}
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-bold text-[#9CA3AF]">
                              {evt.gps_accuracy != null && <span>GPS: {evt.gps_accuracy.toFixed(1)}m</span>}
                              {evt.location_variance != null && <span>Variance: {evt.location_variance.toFixed(2)}</span>}
                              {evt.latitude != null && evt.longitude != null && (
                                <a
                                  href={`https://maps.google.com/?q=${evt.latitude},${evt.longitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#534AB7] flex items-center gap-0.5"
                                >
                                  <MapPin size={9} /> View on Map
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex border-t border-[#F8F7F9]">
                          <button
                            onClick={() => reviewEvent(evt.id, 'approved')}
                            className="flex-1 py-2.5 flex items-center justify-center gap-1.5 text-[11px] font-black text-emerald-600 hover:bg-emerald-50 transition-colors"
                          >
                            <CheckCircle size={13} /> Approve
                          </button>
                          <div className="w-px bg-[#F8F7F9]" />
                          <button
                            onClick={() => reviewEvent(evt.id, 'rejected')}
                            className="flex-1 py-2.5 flex items-center justify-center gap-1.5 text-[11px] font-black text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <XCircle size={13} /> Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Live Map (Persistent) / List / Timeline */}
            <div className="flex-1 relative overflow-hidden">
              {viewMode === 'map' ? (
                <div className="h-full relative overflow-hidden rounded-2xl border border-[#C7C3D0] bg-white shadow-sm">
                  {isClient && (
                    <AttendanceMap
                      geofences={geofences}
                      selectedEmployeeId={selected?.employee.id}
                      resetSignal={mapResetSignal}
                      onEmployeeSelect={(id) => {
                        const entry = board.find(e => e.employee.id === id)
                        if (entry) setSelected(entry)
                      }}
                      selectedRoute={selected ? [
                        ...selected.rawEvents.map(ev => ({
                          latitude: ev.latitude,
                          longitude: ev.longitude,
                          type: ev.event_type === 'clock_in' ? 'Clock In' : 'Clock Out',
                          timestamp: ev.timestamp
                        })),
                        ...selected.breaks.map(b => ([
                          { latitude: b.latitude ?? selected.latitude, longitude: b.longitude ?? selected.longitude, type: 'Break Start', timestamp: b.break_start },
                          ...(b.break_end ? [{ latitude: b.latitude ?? selected.latitude, longitude: b.longitude ?? selected.longitude, type: 'Break End', timestamp: b.break_end }] : [])
                        ])).flat()
                      ].filter(p => p.latitude != null && p.longitude != null).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()) : undefined}
                      employees={filtered
                        .filter(e => e.latitude != null && e.longitude != null)
                        .map(e => ({
                          id: e.employee.id,
                          name: `${e.employee.first_name} ${e.employee.last_name}`,
                          initials: `${e.employee.first_name[0]}${e.employee.last_name[0]}`,
                          status: (e.isOnBreak ? 'break' : e.status) as any,
                          workType: e.workType,
                          latitude: e.latitude!,
                          longitude: e.longitude!,
                          selfieUrl: e.selfieUrl,
                          gpsAccuracy: e.gpsAccuracy,
                          suspicious: e.adminReviewStatus === 'flagged' || e.suspiciousFlags.length > 0,
                          clockInTime: e.clockIn,
                          department: e.employee.department,
                        }))}
                    />
                  )}
                  <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
                    <button
                      onClick={() => setIsMapExpanded(true)}
                      className="h-10 w-10 rounded-xl bg-white/95 border border-[#D8D6DF] text-[#534AB7] shadow-lg flex items-center justify-center hover:bg-[#F8F6FF]"
                      title="Expand map"
                    >
                      <Maximize2 size={17} />
                    </button>
                    <button
                      onClick={() => setShowActivityPanel(prev => !prev)}
                      className="relative h-10 w-10 rounded-xl bg-white/95 border border-[#D8D6DF] text-[#534AB7] shadow-lg flex items-center justify-center hover:bg-[#F8F6FF]"
                      title="Live activity"
                    >
                      <Activity size={17} />
                      {activityFeed.length > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[8px] font-black text-white">{activityFeed.length}</span>}
                    </button>
                  </div>
                  {/* Instruction overlay */}
                  {!selected && (
                    <div className="absolute bottom-3 left-3 z-[1000] bg-white/80 backdrop-blur-sm rounded-xl px-4 py-2 shadow-sm pointer-events-none">
                      <p className="text-[11px] font-bold text-[#9CA3AF]">Select an employee to view details</p>
                    </div>
                  )}
                  {showActivityPanel && activityFeed.length > 0 && (
                    <div className="absolute top-16 left-16 z-[1000] w-72 max-w-[calc(100%-5rem)] bg-white/95 backdrop-blur-md rounded-2xl shadow-lg border border-[#D8D6DF] overflow-hidden">
                      <div className="px-4 py-3 border-b border-[#F1F0F4] flex items-center justify-between">
                        <span className="text-[10px] font-black text-[#1A1727] uppercase tracking-widest">Live Activity</span>
                        <button onClick={() => setShowActivityPanel(false)} className="text-[#9CA3AF] hover:text-[#1A1727]"><X size={14} /></button>
                      </div>
                      <div className="max-h-52 overflow-y-auto no-scrollbar divide-y divide-[#F8F7F9]">
                        {activityFeed.map(item => (
                          <div key={item.id} className="px-4 py-3 flex items-start gap-3">
                            <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                              item.tone === 'danger' ? 'bg-red-500' :
                              item.tone === 'warning' ? 'bg-amber-500' :
                              item.tone === 'success' ? 'bg-emerald-500' :
                              'bg-[#534AB7]'
                            }`} />
                            <div className="min-w-0 flex-1">
                              <div className="text-[11px] font-black text-[#1A1727] truncate">{item.employeeName}</div>
                              <div className="text-[10px] font-bold text-[#6B7280]">{item.msg}</div>
                            </div>
                            <div className="text-[9px] font-black text-[#9CA3AF] whitespace-nowrap">
                              {new Date(item.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : viewMode === 'list' ? (
                <div className="h-full flex flex-col overflow-hidden">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-sm font-black uppercase tracking-widest text-[#1A1727]">Attendance List</h2>
                      <p className="text-[10px] font-bold text-[#6B6578]">{filtered.length} matching staff · {selectedDate}</p>
                    </div>
                    <button
                      onClick={() => setIsFilterDrawerOpen(true)}
                      className="flex items-center gap-2 rounded-xl border border-[#C7C3D0] bg-[#F4F3F7] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#534AB7] shadow-sm hover:bg-white"
                    >
                      <ListFilter size={15} /> Filters
                    </button>
                  </div>
                  <div className="bg-white rounded-2xl border border-[#C7C3D0] overflow-hidden shadow-sm">
                    <table className="w-full table-fixed text-left">
                      <thead className="bg-[#F4F3F7] border-b border-[#D8D6DF]">
                        <tr>
                          <th className="w-[24%] px-4 py-4 text-[10px] font-black text-[#6B6578] uppercase tracking-widest">Employee</th>
                          <th className="w-[9%] px-3 py-4 text-[10px] font-black text-[#6B6578] uppercase tracking-widest">Status</th>
                          <th className="w-[9%] px-3 py-4 text-[10px] font-black text-[#6B6578] uppercase tracking-widest">Clock In</th>
                          <th className="w-[9%] px-3 py-4 text-[10px] font-black text-[#6B6578] uppercase tracking-widest">Clock Out</th>
                          <th className="w-[9%] px-3 py-4 text-[10px] font-black text-[#6B6578] uppercase tracking-widest">Break Start</th>
                          <th className="w-[9%] px-3 py-4 text-[10px] font-black text-[#6B6578] uppercase tracking-widest">Break End</th>
                          <th className="w-[15%] px-3 py-4 text-[10px] font-black text-[#6B6578] uppercase tracking-widest">Clk In Location</th>
                          <th className="w-[16%] px-3 py-4 text-[10px] font-black text-[#6B6578] uppercase tracking-widest">Clk Out Location</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F0F4]">
                        {filtered.map(e => {
                          const clockInEvent = getClockEvent(e, 'clock_in')
                          const clockOutEvent = getClockEvent(e, 'clock_out')
                          const clockInMap = getEventMapsUrl(clockInEvent)
                          const clockOutMap = getEventMapsUrl(clockOutEvent)

                          return (
                            <tr
                              key={e.employee.id}
                              onClick={() => setSelected(e)}
                              className={`hover:bg-[#F8F7F9] cursor-pointer transition-colors ${selected?.employee.id === e.employee.id ? 'bg-[#F3E8FF]' : ''}`}
                            >
                              <td className="px-4 py-4">
                                <div className="flex min-w-0 items-center gap-3">
                                  <div className="h-9 w-9 shrink-0 rounded-lg bg-[#F1F0F4] flex items-center justify-center font-bold text-[#9CA3AF] text-xs overflow-hidden">
                                    {e.employee.photo_url ? <img src={e.employee.photo_url} className="w-full h-full object-cover" alt="avatar" /> : `${e.employee.first_name[0]}${e.employee.last_name[0]}`}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-black text-[#1A1727]">{e.employee.first_name} {e.employee.last_name}</div>
                                    <div className="truncate text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">{e.employee.department || '-'}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-4">
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                                  e.status === 'present' ? 'bg-emerald-100 text-emerald-700' :
                                  e.status === 'late' ? 'bg-amber-100 text-amber-700' :
                                  e.status === 'absent' ? 'bg-red-100 text-red-700' :
                                  e.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                                  'bg-[#EDE9FE] text-[#534AB7]'
                                }`}>
                                  {e.status}
                                </span>
                              </td>
                              <td className="px-3 py-4 text-xs font-bold text-[#1A1727]">{formatTime(e.clockIn)}</td>
                              <td className="px-3 py-4 text-xs font-bold text-[#1A1727]">{formatTime(e.clockOut)}</td>
                              <td className="px-3 py-4 text-xs font-bold text-[#1A1727]">{formatTime(getFirstBreakStart(e))}</td>
                              <td className="px-3 py-4 text-xs font-bold text-[#1A1727]">{formatTime(getFirstBreakEnd(e))}</td>
                              <td className="truncate px-3 py-4 text-xs font-bold text-[#6B7280]">
                                {clockInMap ? (
                                  <a href={clockInMap} target="_blank" onClick={(event) => event.stopPropagation()} className="inline-flex items-center gap-1 text-[#534AB7] hover:underline">
                                    {getEventLocationLabel(e, clockInEvent)} <ExternalLink size={11} />
                                  </a>
                                ) : getEventLocationLabel(e, clockInEvent)}
                              </td>
                              <td className="truncate px-3 py-4 text-xs font-bold text-[#6B7280]">
                                {clockOutEvent ? (
                                  clockOutMap ? (
                                    <a href={clockOutMap} target="_blank" onClick={(event) => event.stopPropagation()} className="inline-flex items-center gap-1 text-[#534AB7] hover:underline">
                                      {getEventLocationLabel(e, clockOutEvent)} <ExternalLink size={11} />
                                    </a>
                                  ) : getEventLocationLabel(e, clockOutEvent)
                                ) : '-'}
                              </td>
                            </tr>
                          )
                        })}
                        {filtered.length === 0 && (
                          <tr>
                            <td colSpan={8} className="py-20 text-center">
                              <UserX size={40} className="mx-auto mb-3 text-[#D1D5DB]" />
                              <p className="text-sm font-bold text-[#9CA3AF]">No employees found matching this criteria</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Advanced Filter Drawer */}
            {isFilterDrawerOpen && (
              <div className="fixed inset-y-0 right-0 w-full md:w-[400px] h-screen bg-white shadow-2xl z-[1300] flex flex-col animate-in slide-in-from-right duration-300 border-l border-[#F1F0F4]">
                <div className="px-7 py-6 border-b border-[#F1F0F4] flex justify-between items-center bg-white sticky top-0 z-10 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#F8F7F9] flex items-center justify-center text-[#534AB7] border border-[#F1F0F4]">
                      <SlidersHorizontal size={20} />
                    </div>
                    <h2 className="text-base font-black text-[#1A1727]">Advanced Filters</h2>
                  </div>
                  <button onClick={() => setIsFilterDrawerOpen(false)} className="p-2 text-[#D1D5DB] hover:text-[#1A1727] transition-colors">
                    <XCircle size={22} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-7 py-7 space-y-9 no-scrollbar">
                  {/* Saved Views */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest px-1">
                      <Sparkles size={12} className="text-amber-500" /> Saved Views
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {['Needs attention', 'Late arrivals', 'No clock-in', 'Outside geofence', 'Remote / field staff'].map(view => (
                        <button 
                          key={view}
                          onClick={() => applySavedView(view)}
                          className="px-4 py-3.5 bg-[#F8F7F9] hover:bg-[#F3E8FF] border border-[#F1F0F4] rounded-xl text-left transition-all"
                        >
                          <div className="text-[10px] font-black text-[#374151] leading-tight">{view}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Filter Sections */}
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest px-1">Organization</div>
                      
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-[#6B7280] ml-1">Department</label>
                        <select 
                          value={advancedFilters.department || ''}
                          onChange={e => setAdvancedFilters(f => ({ ...f, department: e.target.value || null }))}
                          className="w-full bg-[#F8F7F9] border-none rounded-xl px-4 py-3.5 text-sm font-bold text-[#1A1727] outline-none focus:ring-2 focus:ring-[#534AB7]/10 appearance-none cursor-pointer"
                        >
                          <option value="">All Departments</option>
                          {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-[#6B7280] ml-1">Branch</label>
                        <select 
                          value={advancedFilters.branch || ''}
                          onChange={e => setAdvancedFilters(f => ({ ...f, branch: e.target.value || null }))}
                          className="w-full bg-[#F8F7F9] border-none rounded-xl px-4 py-3.5 text-sm font-bold text-[#1A1727] outline-none focus:ring-2 focus:ring-[#534AB7]/10 appearance-none cursor-pointer"
                        >
                          <option value="">All Branches</option>
                          {branches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-[#6B7280] ml-1">Shift</label>
                        <select
                          value={advancedFilters.shift || ''}
                          onChange={e => setAdvancedFilters(f => ({ ...f, shift: e.target.value || null }))}
                          className="w-full bg-[#F8F7F9] border-none rounded-xl px-4 py-3.5 text-sm font-bold text-[#1A1727] outline-none focus:ring-2 focus:ring-[#534AB7]/10 appearance-none cursor-pointer"
                        >
                          <option value="">All Shifts</option>
                          {shifts.map(shift => <option key={shift.id} value={shift.name}>{shift.name}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest px-1">Work Preferences</div>
                      
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-[#6B7280] ml-1">Work Type</label>
                        <div className="grid grid-cols-3 gap-2">
                          {['office', 'wfh', 'field'].map(type => (
                            <button
                              key={type}
                              onClick={() => setAdvancedFilters(f => ({ ...f, workType: f.workType === type ? null : type as any }))}
                              className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                                advancedFilters.workType === type 
                                ? 'bg-[#534AB7] border-[#534AB7] text-white' 
                                : 'bg-[#F8F7F9] border-transparent text-[#9CA3AF] hover:text-[#374151]'
                              }`}
                            >
                              {type}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest px-1">Status Flags</div>
                      
                      {[
                        { key: 'suspiciousOnly', label: 'Suspicious Punches', icon: AlertTriangle, color: 'text-red-500' },
                        { key: 'outsideGeofence', label: 'Outside Geofence', icon: MapPin, color: 'text-red-500' },
                        { key: 'noGps', label: 'No GPS Signal', icon: ShieldAlert, color: 'text-amber-500' },
                        { key: 'locationVerified', label: 'Location Verified', icon: Shield, color: 'text-emerald-500', type: 'boolean' },
                        { key: 'hasSelfie', label: 'Has Selfie Photo', icon: Eye, color: 'text-[#534AB7]', type: 'boolean' }
                      ].map(flag => (
                        <button
                          key={flag.key}
                          onClick={() => {
                            if (flag.type === 'boolean') {
                              setAdvancedFilters(f => ({ ...f, [flag.key]: (f as any)[flag.key] === true ? false : (f as any)[flag.key] === false ? null : true }))
                            } else {
                              setAdvancedFilters(f => ({ ...f, [flag.key]: !(f as any)[flag.key] }))
                            }
                          }}
                          className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                            (advancedFilters as any)[flag.key] === true ? 'bg-[#F3E8FF] border-[#534AB7]/20' : 
                            (advancedFilters as any)[flag.key] === false ? 'bg-red-50 border-red-100' :
                            'bg-[#F8F7F9] border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <flag.icon size={16} className={flag.color} />
                            <span className={`text-xs font-bold ${(advancedFilters as any)[flag.key] !== null && (advancedFilters as any)[flag.key] !== false ? 'text-[#1A1727]' : 'text-[#6B7280]'}`}>{flag.label}</span>
                          </div>
                          <div className={`w-8 h-4 rounded-full relative transition-colors ${
                            (advancedFilters as any)[flag.key] === true ? 'bg-[#534AB7]' : 
                            (advancedFilters as any)[flag.key] === false ? 'bg-red-500' : 'bg-[#D1D5DB]'
                          }`}>
                            <div className={`absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${
                              (advancedFilters as any)[flag.key] !== null && (advancedFilters as any)[flag.key] !== false ? 'translate-x-4' : 'translate-x-0'
                            }`} />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="px-7 py-5 border-t border-[#F1F0F4] bg-[#F8F7F9] shrink-0">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setIsFilterDrawerOpen(false)}
                        className="px-5 py-2.5 bg-[#534AB7] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-purple-900/20 hover:bg-[#1E1854] transition-all"
                      >
                        Apply Filters
                      </button>
                      <button onClick={() => setAdvancedFilters(initialAdvancedFilters)} className="text-[10px] font-black text-red-500 hover:underline uppercase tracking-widest">Reset All</button>
                    </div>
                    <span className="text-right text-[10px] font-bold text-[#9CA3AF]">{filtered.length} matching staff</span>
                  </div>
                </div>
              </div>
            )}

            {/* Selected Employee Detail Modal */}
            {selected && (
              <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-[#1A1727]/45 p-4 backdrop-blur-sm">
              <div className="max-h-[92vh] w-full max-w-4xl bg-white shadow-2xl flex flex-col rounded-3xl border border-[#D8D6DF] overflow-hidden">
                {/* Modal Header */}
                <div className="p-6 border-b border-[#F1F0F4] flex justify-between items-center bg-white sticky top-0 z-10 shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#F3E8FF] border-2 border-white shadow-sm flex items-center justify-center text-[#534AB7] text-xl font-black overflow-hidden">
                      {selected.employee.photo_url ? (
                        <img src={selected.employee.photo_url} className="w-full h-full object-cover" alt="avatar" />
                      ) : (
                        selected.employee.first_name[0]
                      )}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base font-black text-[#1A1727] truncate">{selected.employee.first_name} {selected.employee.last_name}</h2>
                      <p className="text-[#9CA3AF] font-bold text-[10px] uppercase tracking-widest truncate">{selected.employee.job_title} · {selected.employee.department}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)} className="p-2 text-[#D1D5DB] hover:text-[#1A1727] transition-colors">
                    <XCircle size={22} />
                  </button>
                </div>

                {/* Exception Panel */}
                {(selected.adminReviewStatus === 'flagged' || selected.status === 'late' || selected.status === 'absent' || selected.suspiciousFlags.includes('outside_geofence')) && (
                  <div className="mx-6 mt-6 bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                      <AlertTriangle size={16} />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black text-red-700 uppercase tracking-widest mb-1">
                        {selected.adminReviewStatus === 'flagged' ? 'Suspicious Punch' : 
                         selected.status === 'late' ? 'Late Arrival' : 
                         selected.status === 'absent' ? 'No Clock-in' : 'Outside Geofence'}
                      </h4>
                      <p className="text-[10px] font-bold text-red-600 leading-normal">
                        {selected.adminReviewStatus === 'flagged' ? 'This entry has been automatically flagged. Please review selfie and GPS variance.' :
                         selected.status === 'late' ? 'Employee clocked in after the grace period.' :
                         selected.status === 'absent' ? 'No activity recorded for this employee today.' :
                         'Clock-in event occurred outside all designated geofences.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Tab Navigation */}
                <div className="px-6 mt-6 shrink-0">
                  <div className="flex bg-[#F8F7F9] rounded-xl p-1 border border-[#F1F0F4]">
                    {[
                      { id: 'overview', label: 'Overview' },
                      { id: 'timeline', label: 'Timeline' },
                      { id: 'location', label: 'Location' },
                      { id: 'verification', label: 'Verify' },
                      { id: 'notes', label: 'Notes' }
                    ].map(t => (
                      <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id as any)}
                        className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === t.id ? 'bg-white text-[#534AB7] shadow-sm' : 'text-[#9CA3AF] hover:text-[#374151]'}`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Modal Content */}
                <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
                  {activeTab === 'overview' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#F8F7F9] rounded-2xl p-4 border border-[#F1F0F4]">
                          <div className="text-[9px] font-black text-[#9CA3AF] uppercase tracking-widest mb-3 text-center">Identity</div>
                          <div className="flex flex-col items-center">
                            <div className="w-16 h-16 rounded-2xl bg-white border-2 border-white shadow-sm flex items-center justify-center text-[#534AB7] text-2xl font-black overflow-hidden mb-2">
                              {selected.employee.photo_url ? (
                                <img src={selected.employee.photo_url} className="w-full h-full object-cover" alt="avatar" />
                              ) : (
                                selected.employee.first_name[0]
                              )}
                            </div>
                            <span className="text-[13px] font-black text-[#1A1727]">{selected.employee.first_name} {selected.employee.last_name}</span>
                            <span className="text-[9px] font-bold text-[#9CA3AF] uppercase tracking-widest">{selected.employee.job_title}</span>
                          </div>
                        </div>
                        <div className="bg-[#F8F7F9] rounded-2xl p-4 border border-[#F1F0F4] flex flex-col justify-center items-center">
                          <div className="text-[9px] font-black text-[#9CA3AF] uppercase tracking-widest mb-3">Status</div>
                          <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-2 ${
                            selected.status === 'present' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                            selected.status === 'late' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                            selected.status === 'absent' ? 'bg-red-100 text-red-700 border border-red-200' :
                            selected.status === 'completed' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                            'bg-[#EDE9FE] text-[#534AB7] border border-[#DDD6FE]'
                          }`}>
                            {selected.status}
                          </span>
                          <span className="text-[9px] font-bold text-[#9CA3AF] uppercase tracking-widest">
                            {selected.workType || 'Office'} Based
                          </span>
                        </div>
                      </div>

                      <div className="bg-[#F8F7F9] rounded-2xl p-5 border border-[#F1F0F4]">
                        <div className="text-[10px] font-black text-[#1A1727] uppercase tracking-[0.15em] mb-4">Shift Performance</div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white rounded-xl p-3 shadow-sm border border-[#F1F0F4]">
                            <div className="text-[8px] font-black text-[#9CA3AF] uppercase tracking-widest mb-1">Total Worked</div>
                            <div className="text-base font-black text-[#1A1727]">{selected.clockIn ? getHoursWorked(selected.clockIn, selected.clockOut) : '0h 0m'}</div>
                          </div>
                          <div className="bg-white rounded-xl p-3 shadow-sm border border-[#F1F0F4]">
                            <div className="text-[8px] font-black text-[#9CA3AF] uppercase tracking-widest mb-1">Total Break</div>
                            <div className="text-base font-black text-[#534AB7]">{selected.breakMinutes > 0 ? `${Math.floor(selected.breakMinutes/60)}h ${selected.breakMinutes%60}m` : '0h 0m'}</div>
                          </div>
                          <div className="bg-white rounded-xl p-3 shadow-sm border border-[#F1F0F4]">
                            <div className="text-[8px] font-black text-[#9CA3AF] uppercase tracking-widest mb-1">First In</div>
                            <div className="text-xs font-black text-[#1A1727]">{selected.clockIn ? new Date(selected.clockIn).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }) : '—'}</div>
                          </div>
                          <div className="bg-white rounded-xl p-3 shadow-sm border border-[#F1F0F4]">
                            <div className="text-[8px] font-black text-[#9CA3AF] uppercase tracking-widest mb-1">Last Out</div>
                            <div className="text-xs font-black text-[#1A1727]">{selected.clockOut ? new Date(selected.clockOut).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }) : '—'}</div>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Link 
                          href={`/employees/${selected.employee.id}`}
                          className="flex-1 py-3 bg-white border border-[#F1F0F4] rounded-xl flex items-center justify-center gap-2 text-[10px] font-black text-[#534AB7] uppercase tracking-widest hover:bg-[#F8F7F9] transition-all"
                        >
                          <Eye size={14} /> Full Profile
                        </Link>
                        <button 
                          onClick={() => exportEmployeeDayLog(selected, selectedDate)}
                          className="flex-1 py-3 bg-white border border-[#F1F0F4] rounded-xl flex items-center justify-center gap-2 text-[10px] font-black text-[#534AB7] uppercase tracking-widest hover:bg-[#F8F7F9] transition-all"
                        >
                          <Download size={14} /> Day Log
                        </button>
                      </div>
                    </div>
                  )}

                  {activeTab === 'timeline' && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] font-black text-[#1A1727] uppercase tracking-[0.15em]">Daily Timeline</div>
                        <span className="text-[9px] font-bold text-[#9CA3AF] uppercase tracking-widest">{selectedDate}</span>
                      </div>
                      <div className="relative pl-6 space-y-6">
                        <div className="absolute left-1.5 top-2 bottom-2 w-0.5 bg-[#F1F0F4]" />
                        
                        {[
                          ...selected.rawEvents.map(ev => ({ 
                            type: ev.event_type === 'clock_in' ? 'Clock In' : 'Clock Out', 
                            time: ev.timestamp, 
                            color: ev.event_type === 'clock_in' ? 'bg-emerald-500' : 'bg-red-500',
                            icon: ev.event_type === 'clock_in' ? CheckCircle : XCircle,
                            location: ev.branch?.name || 'Mobile/Unknown',
                            suspicious: (ev.suspicious_flags || []).length > 0
                          })),
                          ...selected.breaks.map(b => ([
                            { type: 'Started Break', time: b.break_start, color: 'bg-[#534AB7]', icon: Clock, location: '', suspicious: false },
                            ...(b.break_end ? [{ type: 'Returned from Break', time: b.break_end, color: 'bg-emerald-500', icon: CheckCircle, location: '', suspicious: false }] : [])
                          ])).flat()
                        ].sort((a,b) => new Date(a.time).getTime() - new Date(b.time).getTime()).map((item, idx) => (
                          <div key={idx} className="relative">
                            <div className={`absolute -left-[22px] top-1 w-3 h-3 rounded-full border-2 border-white ${item.color} shadow-sm z-10`} />
                            <div className="bg-[#F8F7F9] rounded-2xl p-4 border border-[#F1F0F4] relative overflow-hidden">
                              {item.suspicious && (
                                <div className="absolute top-0 right-0 px-2 py-0.5 bg-red-500 text-white text-[8px] font-black uppercase tracking-widest">Suspicious</div>
                              )}
                              <div className="flex justify-between items-start mb-1">
                                <span className="text-[11px] font-black text-[#1A1727] uppercase tracking-tight">{item.type}</span>
                                <span className="text-[11px] font-black text-[#534AB7]">{new Date(item.time).toLocaleTimeString([], {hour:'numeric', minute:'2-digit', hour12:true})}</span>
                              </div>
                              {item.location && (
                                <div className="flex items-center gap-1 text-[9px] font-bold text-[#9CA3AF]">
                                  <MapPin size={10} /> {item.location}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}

                        {selected.rawEvents.length === 0 && (
                          <div className="text-center py-20">
                            <Clock size={32} className="mx-auto mb-3 text-[#D1D5DB] opacity-20" />
                            <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">No activity recorded today</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'location' && (
                    <div className="space-y-6">
                      <div className="bg-[#F8F7F9] rounded-2xl p-5 border border-[#F1F0F4]">
                        <div className="text-[10px] font-black text-[#1A1727] uppercase tracking-[0.15em] mb-4">
                          {selected.workType === 'wfh' ? 'Work Location' : selected.workType === 'field' ? 'Work Location' : 'Geofence Status'}
                        </div>
                        <div className="space-y-4">
                          {selected.workType === 'wfh' ? (
                            <div className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm border border-[#F1F0F4]">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500">🏠</div>
                                <div>
                                  <div className="text-[11px] font-black text-[#1A1727]">Work From Home</div>
                                  <div className="text-[9px] font-bold text-[#9CA3AF]">Remote — geofence not applicable</div>
                                </div>
                              </div>
                              <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 border border-blue-100">WFH</span>
                            </div>
                          ) : selected.workType === 'field' ? (
                            <div className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm border border-[#F1F0F4]">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center text-amber-500">🚗</div>
                                <div>
                                  <div className="text-[11px] font-black text-[#1A1727]">Field Work</div>
                                  <div className="text-[9px] font-bold text-[#9CA3AF]">Off-site — geofence not applicable</div>
                                </div>
                              </div>
                              <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-amber-50 text-amber-600 border border-amber-100">Field</span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm border border-[#F1F0F4]">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-[#F8F7F9] flex items-center justify-center text-[#534AB7]"><Map size={18} /></div>
                                <div>
                                  <div className="text-[11px] font-black text-[#1A1727]">{selected.branchName || 'Main Branch'}</div>
                                  <div className="text-[9px] font-bold text-[#9CA3AF]">Assigned Worksite</div>
                                </div>
                              </div>
                              <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${selected.suspiciousFlags.includes('outside_geofence') ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                                {selected.suspiciousFlags.includes('outside_geofence') ? 'Outside' : 'Inside'}
                              </span>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-white rounded-xl shadow-sm border border-[#F1F0F4]">
                              <div className="text-[8px] font-black text-[#9CA3AF] uppercase tracking-widest mb-1">Coordinates</div>
                              <div className="text-[10px] font-black text-[#1A1727]">{selected.latitude != null ? selected.latitude.toFixed(4) : '—'}, {selected.longitude != null ? selected.longitude.toFixed(4) : '—'}</div>
                            </div>
                            <div className="p-3 bg-white rounded-xl shadow-sm border border-[#F1F0F4]">
                              <div className="text-[8px] font-black text-[#9CA3AF] uppercase tracking-widest mb-1">GPS Accuracy</div>
                              <div className="text-[10px] font-black text-[#1A1727]">{selected.gpsAccuracy != null ? `±${selected.gpsAccuracy.toFixed(1)} meters` : '—'}</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {selected.latitude != null && selected.longitude != null && (
                        <div className="space-y-3">
                          <div className="text-[10px] font-black text-[#1A1727] uppercase tracking-[0.15em]">External Maps</div>
                          <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${selected.latitude},${selected.longitude}`}
                            target="_blank"
                            className="w-full py-4 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl flex items-center justify-center gap-3 text-[11px] font-black text-[#534AB7] uppercase tracking-widest hover:bg-white hover:shadow-sm transition-all"
                          >
                            <ExternalLink size={16} /> Open in Google Maps
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'verification' && (
                    <div className="space-y-6">
                      {(() => {
                        const { score, checks } = getVerificationScore(selected)
                        return (
                          <>
                            <div className="bg-[#F8F7F9] rounded-3xl p-8 border border-[#F1F0F4] flex flex-col items-center">
                              <div className="relative w-24 h-24 mb-4">
                                <svg className="w-full h-full" viewBox="0 0 36 36">
                                  <path className="text-[#F1F0F4] stroke-current" strokeWidth="3" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                  <path className={`${score >= 4 ? 'text-emerald-500' : score >= 3 ? 'text-amber-500' : 'text-red-500'} stroke-current`} strokeWidth="3" strokeDasharray={`${(score/5)*100}, 100`} strokeLinecap="round" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                  <span className="text-2xl font-black text-[#1A1727]">{score}</span>
                                  <span className="text-[9px] font-black text-[#9CA3AF] uppercase tracking-tighter">/ 5 Score</span>
                                </div>
                              </div>
                              <div className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                score === 5 ? 'bg-emerald-100 text-emerald-700' :
                                score >= 3 ? 'bg-amber-100 text-amber-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {score === 5 ? 'Fully Trusted' : score >= 3 ? 'Trustworthy' : 'Review Required'}
                              </div>
                            </div>

                            <div className="space-y-2">
                              {checks.map(c => (
                                <div key={c.label} className="flex items-center justify-between p-4 bg-[#F8F7F9] rounded-2xl border border-[#F1F0F4]">
                                  <div className="flex items-center gap-3">
                                    {c.pass ? (
                                      <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"><CheckCircle size={14} /></div>
                                    ) : (
                                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${c.type === 'critical' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                                        <AlertTriangle size={14} />
                                      </div>
                                    )}
                                    <span className="text-[11px] font-black text-[#1A1727]">{c.label}</span>
                                  </div>
                                  <span className={`text-[10px] font-black uppercase tracking-widest ${c.pass ? 'text-emerald-600' : c.type === 'critical' ? 'text-red-600' : 'text-amber-600'}`}>
                                    {c.pass ? 'Pass' : c.type === 'critical' ? 'Fail' : 'Warn'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  )}

                  {activeTab === 'notes' && (
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest ml-1">Admin Notes</label>
                        <textarea 
                          value={drawerNotes[selected.employee.id] || ''}
                          onChange={(e) => setDrawerNotes(prev => ({ ...prev, [selected.employee.id]: e.target.value }))}
                          placeholder="Add private internal notes for this employee's shift..."
                          className="w-full h-40 bg-[#F8F7F9] border-none rounded-2xl p-4 text-xs font-bold text-[#1A1727] placeholder:text-[#D1D5DB] outline-none focus:ring-2 focus:ring-[#534AB7]/10 resize-none"
                        />
                      </div>

                      <div className="space-y-3">
                        <div className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest ml-1">Quick Notes</div>
                        <div className="flex flex-wrap gap-2">
                          {['Called employee', 'Approved field work', 'Payroll adjustment needed', 'GPS signal issues', 'Selfie verified manually'].map(note => (
                            <button
                              key={note}
                              onClick={() => {
                                const current = drawerNotes[selected.employee.id] || ''
                                setDrawerNotes(prev => ({ 
                                  ...prev, 
                                  [selected.employee.id]: current ? `${current}\n- ${note}` : `- ${note}` 
                                }))
                              }}
                              className="px-3 py-1.5 bg-[#F8F7F9] border border-[#F1F0F4] rounded-lg text-[10px] font-black text-[#374151] hover:bg-[#F3E8FF] hover:text-[#534AB7] transition-all"
                            >
                              + {note}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button 
                        onClick={() => toast.success('Note saved locally')}
                        className="w-full py-4 bg-[#534AB7] text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-purple-900/20 hover:bg-[#1E1854] transition-all"
                      >
                        Save Notes
                      </button>
                    </div>
                  )}
                </div>
              </div>
              </div>
            )}

            {isMapExpanded && (
              <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-[#1A1727]/45 p-4 backdrop-blur-sm">
                <div className="h-[86vh] w-full max-w-6xl overflow-hidden rounded-3xl border border-[#D8D6DF] bg-white shadow-2xl">
                  <div className="flex items-center justify-between border-b border-[#F1F0F4] px-5 py-3">
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-widest text-[#1A1727]">Live Attendance Map</h3>
                      <p className="text-[10px] font-bold text-[#9CA3AF]">Expanded operational view</p>
                    </div>
                    <button onClick={() => setIsMapExpanded(false)} className="rounded-xl p-2 text-[#9CA3AF] hover:bg-[#F8F7F9] hover:text-[#1A1727]">
                      <XCircle size={22} />
                    </button>
                  </div>
                  <div className="relative h-[calc(86vh-61px)]">
                    {isClient && (
                      <AttendanceMap
                        geofences={geofences}
                        selectedEmployeeId={selected?.employee.id}
                        resetSignal={mapResetSignal}
                        onEmployeeSelect={(id) => {
                          const entry = board.find(e => e.employee.id === id)
                          if (entry) setSelected(entry)
                        }}
                        selectedRoute={selected ? [
                          ...selected.rawEvents.map(ev => ({
                            latitude: ev.latitude,
                            longitude: ev.longitude,
                            type: ev.event_type === 'clock_in' ? 'Clock In' : 'Clock Out',
                            timestamp: ev.timestamp
                          })),
                          ...selected.breaks.map(b => ([
                            { latitude: b.latitude ?? selected.latitude, longitude: b.longitude ?? selected.longitude, type: 'Break Start', timestamp: b.break_start },
                            ...(b.break_end ? [{ latitude: b.latitude ?? selected.latitude, longitude: b.longitude ?? selected.longitude, type: 'Break End', timestamp: b.break_end }] : [])
                          ])).flat()
                        ].filter(p => p.latitude != null && p.longitude != null).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()) : undefined}
                        employees={filtered
                          .filter(e => e.latitude != null && e.longitude != null)
                          .map(e => ({
                            id: e.employee.id,
                            name: `${e.employee.first_name} ${e.employee.last_name}`,
                            initials: `${e.employee.first_name[0]}${e.employee.last_name[0]}`,
                            status: (e.isOnBreak ? 'break' : e.status) as any,
                            workType: e.workType,
                            latitude: e.latitude!,
                            longitude: e.longitude!,
                            selfieUrl: e.selfieUrl,
                            gpsAccuracy: e.gpsAccuracy,
                            suspicious: e.adminReviewStatus === 'flagged' || e.suspiciousFlags.length > 0,
                            clockInTime: e.clockIn,
                            department: e.employee.department,
                          }))}
                      />
                    )}
                    <div className="absolute left-4 top-4 z-[1000] flex gap-2">
                      <button
                        onClick={() => setShowExpandedFilters(prev => !prev)}
                        className="flex h-10 items-center gap-2 rounded-xl border border-[#D8D6DF] bg-white/95 px-3 text-[#534AB7] shadow-lg hover:bg-[#F8F6FF]"
                      >
                        <ListFilter size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Filters</span>
                      </button>
                      <button
                        onClick={() => setShowExpandedActivityPanel(prev => !prev)}
                        className="relative flex h-10 items-center gap-2 rounded-xl border border-[#D8D6DF] bg-white/95 px-3 text-[#534AB7] shadow-lg hover:bg-[#F8F6FF]"
                      >
                        <Activity size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Activity</span>
                        {activityFeed.length > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[8px] font-black text-white">{activityFeed.length}</span>}
                      </button>
                    </div>

                    {showExpandedFilters && (
                      <div className="absolute left-4 top-16 z-[1000] w-[640px] max-w-[calc(100%-2rem)] rounded-2xl border border-[#D8D6DF] bg-white/95 p-4 shadow-xl backdrop-blur-md">
                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-widest text-[#1A1727]">Map Filters</span>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => { setFilter('all'); setAdvancedFilters(initialAdvancedFilters) }}
                              className="text-[9px] font-black uppercase tracking-widest text-red-500 hover:underline"
                            >
                              Clear
                            </button>
                            <button
                              onClick={() => setShowExpandedFilters(false)}
                              className="rounded-lg border border-[#D8D6DF] bg-white px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-[#534AB7] hover:bg-[#F8F6FF]"
                            >
                              Close
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          <select
                            value={advancedFilters.branch || ''}
                            onChange={(event) => setAdvancedFilters(prev => ({ ...prev, branch: event.target.value || null }))}
                            className="rounded-xl border border-[#D8D6DF] bg-[#F8F7F9] px-3 py-2 text-[11px] font-bold text-[#1A1727] outline-none"
                          >
                            <option value="">All Branches</option>
                            {branches.map(branch => <option key={branch.id} value={branch.name}>{branch.name}</option>)}
                          </select>
                          <select
                            value={advancedFilters.department || ''}
                            onChange={(event) => setAdvancedFilters(prev => ({ ...prev, department: event.target.value || null }))}
                            className="rounded-xl border border-[#D8D6DF] bg-[#F8F7F9] px-3 py-2 text-[11px] font-bold text-[#1A1727] outline-none"
                          >
                            <option value="">All Departments</option>
                            {departments.map(department => <option key={department.id} value={department.name}>{department.name}</option>)}
                          </select>
                          <select
                            value={advancedFilters.workType || ''}
                            onChange={(event) => setAdvancedFilters(prev => ({ ...prev, workType: (event.target.value || null) as AdvancedFilters['workType'] }))}
                            className="rounded-xl border border-[#D8D6DF] bg-[#F8F7F9] px-3 py-2 text-[11px] font-bold text-[#1A1727] outline-none"
                          >
                            <option value="">All Work Types</option>
                            <option value="office">Office</option>
                            <option value="wfh">WFH</option>
                            <option value="field">Field</option>
                          </select>
                          <select
                            value={advancedFilters.shift || ''}
                            onChange={(event) => setAdvancedFilters(prev => ({ ...prev, shift: event.target.value || null }))}
                            className="rounded-xl border border-[#D8D6DF] bg-[#F8F7F9] px-3 py-2 text-[11px] font-bold text-[#1A1727] outline-none"
                          >
                            <option value="">All Shifts</option>
                            {shifts.map(shift => <option key={shift.id} value={shift.name}>{shift.name}</option>)}
                          </select>
                        </div>
                        <div className="mt-3 grid grid-cols-5 gap-2">
                          {[
                            { id: 'all', label: 'All' },
                            { id: 'present', label: 'Present' },
                            { id: 'late', label: 'Late' },
                            { id: 'break', label: 'Break' },
                            { id: 'completed', label: 'Completed' },
                          ].map(option => (
                            <button
                              key={option.id}
                              onClick={() => setFilter(option.id)}
                              className={`rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                                filter === option.id
                                  ? 'border-[#534AB7] bg-[#534AB7] text-white'
                                  : 'border-[#D8D6DF] bg-[#F8F7F9] text-[#6B6578] hover:bg-white'
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {showExpandedActivityPanel && (
                      <div className="absolute right-4 top-16 z-[1000] w-80 max-w-[calc(100%-2rem)] overflow-hidden rounded-2xl border border-[#D8D6DF] bg-white/95 shadow-xl backdrop-blur-md">
                        <div className="flex items-center justify-between border-b border-[#F1F0F4] px-4 py-3">
                          <div>
                            <span className="block text-[10px] font-black uppercase tracking-widest text-[#1A1727]">Live Activity</span>
                            <span className="text-[9px] font-bold text-[#9CA3AF]">Last 1 hour</span>
                          </div>
                          <button
                            onClick={() => setShowExpandedActivityPanel(false)}
                            className="rounded-lg border border-[#D8D6DF] bg-white px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-[#534AB7] hover:bg-[#F8F6FF]"
                          >
                            Close
                          </button>
                        </div>
                        <div className="max-h-[420px] overflow-y-auto divide-y divide-[#F8F7F9]">
                          {activityFeed.length === 0 ? (
                            <div className="px-4 py-6 text-center text-[11px] font-bold text-[#9CA3AF]">No activity in the last hour</div>
                          ) : activityFeed.map(item => (
                            <div key={item.id} className="flex items-start gap-3 px-4 py-3">
                              <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                                item.tone === 'danger' ? 'bg-red-500' :
                                item.tone === 'warning' ? 'bg-amber-500' :
                                item.tone === 'success' ? 'bg-emerald-500' :
                                'bg-[#534AB7]'
                              }`} />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[11px] font-black text-[#1A1727]">{item.employeeName}</div>
                                <div className="text-[10px] font-bold text-[#6B7280]">{item.msg}</div>
                              </div>
                              <div className="whitespace-nowrap text-[9px] font-black text-[#9CA3AF]">
                                {new Date(item.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>
      </div>
    </DashboardLayout>
  )
}
