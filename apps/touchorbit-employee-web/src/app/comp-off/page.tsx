'use client'

import { useEffect, useState } from 'react'
import { EmployeeLayout } from '@/components/employee-layout'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { Gift, Calendar, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface Employee {
  id: string
  organization_id: string
}

interface CompOffRecord {
  id: string
  worked_date: string
  holiday_id: string | null
  status: 'pending' | 'approved' | 'used' | 'expired'
  approved_at: string | null
  used_date: string | null
  expiry_date: string | null
  notes: string | null
  holidays?: {
    name: string
    date: string
  }
}

export default function EmployeeCompOffPage() {
  const { isLoaded } = useAuth()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [records, setRecords] = useState<CompOffRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [formData, setFormData] = useState({
    worked_date: '',
    holiday_id: '',
    notes: '',
  })
  const [holidays, setHolidays] = useState<Array<{ id: string; name: string; date: string }>>([])

  useEffect(() => {
    if (isLoaded) {
      loadEmployeeAndRecords()
    }
  }, [isLoaded])

  const loadEmployeeAndRecords = async () => {
    setLoading(true)
    try {
      const empResult = await api.get<Employee>('/employees/me')
      if (!empResult.ok || !empResult.data) throw new Error(empResult.error || 'Employee not found')
      const emp = empResult.data
      setEmployee(emp)

      const [recordsResult, holidaysResult] = await Promise.all([
        api.get<CompOffRecord[]>(`/leave/comp-off?employee_id=${emp.id}`),
        api.get<Array<{ id: string; name: string; date: string }>>('/organizations/holidays'),
      ])

      if (!recordsResult.ok) throw new Error(recordsResult.error || 'Failed to load comp-off records')
      setRecords(recordsResult.data || [])

      const pastHolidays = (holidaysResult.data || [])
        .filter((h) => h.date <= new Date().toISOString().split('T')[0])
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 20)
      setHolidays(pastHolidays)
    } catch (error: any) {
      console.error('Error loading comp-off data:', error)
      toast.error(error.message || 'Failed to load comp-off data')
    } finally {
      setLoading(false)
    }
  }

  const handleRequestCompOff = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!employee) return

    try {
      const result = await api.post<CompOffRecord>('/leave/comp-off', {
        employee_id: employee.id,
        worked_date: formData.worked_date,
        holiday_id: formData.holiday_id || undefined,
        notes: formData.notes || undefined,
      })

      if (!result.ok) throw new Error(result.error || 'Failed to submit comp-off request')

      toast.success('Comp-off request submitted!')
      setShowRequestForm(false)
      setFormData({ worked_date: '', holiday_id: '', notes: '' })
      await loadEmployeeAndRecords()
    } catch (error: any) {
      console.error('Error requesting comp-off:', error)
      toast.error(error.message || 'Failed to submit comp-off request')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-amber-600" />
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'used':
        return <CheckCircle className="w-4 h-4 text-blue-600" />
      case 'expired':
        return <AlertCircle className="w-4 h-4 text-gray-600" />
      default:
        return null
    }
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: 'bg-amber-100 text-amber-700',
      approved: 'bg-green-100 text-green-700',
      used: 'bg-blue-100 text-blue-700',
      expired: 'bg-gray-100 text-gray-700',
    }
    return badges[status as keyof typeof badges] || 'bg-gray-100 text-gray-700'
  }

  const availableBalance = records.filter((r) => r.status === 'approved').length

  return (
    <EmployeeLayout>
      <div className="p-6 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Comp-Off Balance</h1>
          <p className="text-gray-600 mt-1">Track your compensatory off days</p>
        </div>

        {/* Balance Card */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-lg p-6 text-white mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Gift className="w-8 h-8" />
            <h2 className="text-2xl font-bold">Available Comp-Off Days</h2>
          </div>
          <div className="text-5xl font-bold">{availableBalance}</div>
          <p className="text-purple-200 mt-2">Days available to use</p>
        </div>

        {/* Request Button */}
        <button
          onClick={() => setShowRequestForm(true)}
          disabled={loading || !employee}
          className="w-full mb-6 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Request Comp-Off for Holiday Work
        </button>

        {/* Request Form Dialog */}
        {showRequestForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
              <h2 className="text-xl font-bold mb-4">Request Comp-Off</h2>
              <form onSubmit={handleRequestCompOff} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date You Worked
                  </label>
                  <input
                    type="date"
                    value={formData.worked_date}
                    onChange={(e) => setFormData({ ...formData, worked_date: e.target.value })}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Holiday (Optional)
                  </label>
                  <select
                    value={formData.holiday_id}
                    onChange={(e) => setFormData({ ...formData, holiday_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select a holiday</option>
                    {holidays.map((holiday) => (
                      <option key={holiday.id} value={holiday.id}>
                        {holiday.name} ({formatDate(holiday.date)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    rows={3}
                    placeholder="Reason for working on holiday..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRequestForm(false)
                      setFormData({ worked_date: '', holiday_id: '', notes: '' })
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!employee}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Submit Request
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Records List */}
        {loading ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            Loading comp-off records...
          </div>
        ) : records.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <Gift className="w-16 h-16 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No comp-off records</h3>
            <p className="text-gray-500">
              Request comp-off when you work on a holiday
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((record) => (
              <div key={record.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusIcon(record.status)}
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadge(
                          record.status
                        )}`}
                      >
                        {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-700">
                          Worked on: <strong>{formatDate(record.worked_date)}</strong>
                        </span>
                      </div>

                      {record.holidays && (
                        <div className="text-sm text-gray-600">
                          Holiday: {record.holidays.name}
                        </div>
                      )}

                      {record.expiry_date && record.status === 'approved' && (
                        <div className="text-sm text-gray-600">
                          Expires: {formatDate(record.expiry_date)}
                          {new Date(record.expiry_date) < new Date() && (
                            <span className="text-red-500 ml-2">(Expired)</span>
                          )}
                        </div>
                      )}

                      {record.used_date && (
                        <div className="text-sm text-gray-600">
                          Used on: {formatDate(record.used_date)}
                        </div>
                      )}

                      {record.notes && (
                        <div className="text-sm text-gray-600 italic mt-2">
                          {record.notes}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </EmployeeLayout>
  )
}
