'use client'

import { useState, useEffect } from 'react'
import { Search, Clock, X, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'
import { CameraCapture } from '@/components/camera-capture'
import { toast } from 'sonner'

interface Employee {
  id: string
  first_name: string
  last_name: string
  employee_number: string | null
  job_title: string | null
  department: string | null
  organization_id: string
}

interface ClockEvent {
  event_type: 'clock_in' | 'clock_out'
  timestamp: string
}

export default function KioskPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [showCamera, setShowCamera] = useState(false)
  const [loading, setLoading] = useState(true)
  const [clockStatuses, setClockStatuses] = useState<Record<string, 'in' | 'out'>>({})

  const [orgId, setOrgId] = useState<string | null>(null)

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('org')
    setOrgId(id)
  }, [])

  useEffect(() => {
    if (orgId) {
      loadEmployees()
    }
  }, [orgId])

  useEffect(() => {
    // Filter employees based on search
    if (searchQuery.trim() === '') {
      setFilteredEmployees(employees)
    } else {
      const query = searchQuery.toLowerCase()
      setFilteredEmployees(
        employees.filter(emp =>
          emp.first_name.toLowerCase().includes(query) ||
          emp.last_name.toLowerCase().includes(query) ||
          emp.employee_number?.toLowerCase().includes(query) ||
          emp.department?.toLowerCase().includes(query)
        )
      )
    }
  }, [searchQuery, employees])

  async function loadEmployees() {
    setLoading(true)

    // Get all active employees for this organization
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('organization_id', orgId)
      .eq('employment_status', 'active')
      .order('first_name')

    if (error) {
      console.error('Error loading employees:', error)
      toast.error('Failed to load employees')
      setLoading(false)
      return
    }

    setEmployees(data || [])
    setFilteredEmployees(data || [])

    // Load today's clock statuses for all employees
    await loadClockStatuses(data || [])

    setLoading(false)
  }

  async function loadClockStatuses(emps: Employee[]) {
    const today = new Date().toISOString().split('T')[0]
    const employeeIds = emps.map(e => e.id)

    const result = await api.get<any[]>(`/attendance?from=${encodeURIComponent(today + 'T00:00:00')}&to=${encodeURIComponent(today + 'T23:59:59')}&limit=500`)
    const data = result.ok ? result.data || [] : []

    // Build status map
    const statusMap: Record<string, 'in' | 'out'> = {}

    // Group events by employee and get latest
    emps.forEach(emp => {
      const empEvents = data.filter((e: any) => e.employee_id === emp.id)
        .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      if (empEvents.length > 0) {
        const latest = empEvents[empEvents.length - 1]
        statusMap[emp.id] = latest.event_type === 'clock_in' ? 'in' : 'out'
      } else {
        statusMap[emp.id] = 'out'
      }
    })

    setClockStatuses(statusMap)
  }

  function handleEmployeeSelect(employee: Employee) {
    setSelectedEmployee(employee)
    setShowCamera(true)
  }

  async function handleSelfieCapture(selfieUrl: string) {
    if (!selectedEmployee) return

    const eventType = clockStatuses[selectedEmployee.id] === 'in' ? 'clock_out' : 'clock_in'

    console.log('🎬 Kiosk clock attempt:', {
      employee: selectedEmployee.first_name,
      eventType,
      selfieUrl,
      organizationId: selectedEmployee.organization_id
    })

    try {
      const result = await api.post<any>('/attendance/clock-events', {
        employeeId: selectedEmployee.id,
        eventType,
        timestamp: new Date().toISOString(),
        selfieUrl,
        deviceInfo: navigator.userAgent,
        notes: JSON.stringify({ method: 'tablet_kiosk', location_verified: true }),
      })

      if (!result.ok) {
        console.error('❌ API error:', result.error)
        throw new Error(result.error || 'Failed to record clock event')
      }

      console.log('✅ Clock event created:', result.data)

      toast.success(
        `${selectedEmployee.first_name} clocked ${eventType === 'clock_in' ? 'in' : 'out'}!`,
        { duration: 3000 }
      )

      // Update status
      setClockStatuses(prev => ({
        ...prev,
        [selectedEmployee.id]: eventType === 'clock_in' ? 'in' : 'out'
      }))

      // Reset
      setShowCamera(false)
      setSelectedEmployee(null)
    } catch (error: any) {
      console.error('❌ Clock error:', error)
      const errorMessage = error?.message || 'Unknown error'
      toast.error(`Failed to clock ${eventType === 'clock_in' ? 'in' : 'out'}: ${errorMessage}`, {
        duration: 5000
      })
    }
  }

  function handleCancel() {
    setShowCamera(false)
    setSelectedEmployee(null)
  }

  if (!orgId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl shadow-2xl p-12 text-center max-w-md">
          <Clock className="w-20 h-20 text-purple-600 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Kiosk Mode</h1>
          <p className="text-gray-600 mb-6">
            To use kiosk mode, add your organization ID to the URL:
          </p>
          <code className="block bg-gray-100 p-4 rounded-lg text-sm">
            /kiosk?org=YOUR_ORG_ID
          </code>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center">
        <div className="text-white text-2xl">Loading employees...</div>
      </div>
    )
  }

  return (
    <>
      {showCamera && selectedEmployee && (
        <CameraCapture
          employeeId={selectedEmployee.id}
          onCapture={handleSelfieCapture}
          onCancel={handleCancel}
        />
      )}

      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-purple-800 p-8">
        {/* Header */}
        <div className="max-w-6xl mx-auto mb-8">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <Clock className="w-12 h-12 text-purple-600" />
                <div>
                  <h1 className="text-4xl font-bold text-gray-900">TouchOrbit Kiosk</h1>
                  <p className="text-gray-600 text-lg">Select your name to clock in/out</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-5xl font-bold text-gray-900">
                  {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="text-gray-600 text-lg">
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </div>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-8 h-8 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, employee number, or department..."
                className="w-full pl-20 pr-6 py-6 text-2xl border-2 border-gray-300 rounded-2xl focus:outline-none focus:ring-4 focus:ring-purple-500 focus:border-purple-500"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-8 h-8" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Employee Grid */}
        <div className="max-w-6xl mx-auto">
          {filteredEmployees.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-2xl p-12 text-center">
              <p className="text-gray-500 text-2xl">No employees found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredEmployees.map((employee) => {
                const status = clockStatuses[employee.id] || 'out'
                const isClockedIn = status === 'in'

                return (
                  <button
                    key={employee.id}
                    onClick={() => handleEmployeeSelect(employee)}
                    className={`
                      bg-white rounded-2xl shadow-xl p-8 text-left
                      transition-all duration-200 hover:scale-105 hover:shadow-2xl
                      active:scale-95
                      ${isClockedIn ? 'ring-4 ring-green-500' : ''}
                    `}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold text-gray-900 mb-1">
                          {employee.first_name} {employee.last_name}
                        </h3>
                        {employee.employee_number && (
                          <p className="text-gray-500 text-lg">#{employee.employee_number}</p>
                        )}
                      </div>
                      <div className={`
                        px-4 py-2 rounded-full text-lg font-semibold
                        ${isClockedIn
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                        }
                      `}>
                        {isClockedIn ? 'Clocked In' : 'Clocked Out'}
                      </div>
                    </div>

                    <div className="space-y-2 text-gray-600 text-lg">
                      {employee.job_title && <p>{employee.job_title}</p>}
                      {employee.department && <p>{employee.department}</p>}
                    </div>

                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <div className={`
                        text-center py-3 rounded-xl font-semibold text-xl
                        ${isClockedIn
                          ? 'bg-red-50 text-red-700'
                          : 'bg-purple-50 text-purple-700'
                        }
                      `}>
                        {isClockedIn ? 'Tap to Clock Out' : 'Tap to Clock In'}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
