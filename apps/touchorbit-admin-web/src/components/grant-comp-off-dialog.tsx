'use client'

import { useState, useEffect } from 'react'
import { X, Gift } from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth'

interface GrantCompOffDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface Employee {
  id: string
  first_name: string
  last_name: string
  employee_number: string
}

interface Holiday {
  id: string
  name: string
  date: string
}

export function GrantCompOffDialog({ isOpen, onClose, onSuccess }: GrantCompOffDialogProps) {
  const { organizationId } = useAuth()
  const [loading, setLoading] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [formData, setFormData] = useState({
    employee_id: '',
    worked_date: '',
    holiday_id: '',
    notes: '',
  })

  useEffect(() => {
    if (isOpen && organizationId) {
      loadEmployees()
      loadHolidays()
    }
  }, [isOpen, organizationId])

  const loadEmployees = async () => {
    try {
      const result = await api.get<Employee[]>(`/employees?status=active&limit=500`)
      if (!result.ok) throw new Error(result.error || 'Failed to load employees')
      setEmployees(result.data || [])
    } catch (error) {
      console.error('Error loading employees:', error)
      toast.error('Failed to load employees')
    }
  }

  const loadHolidays = async () => {
    try {
      const result = await api.get<Holiday[]>(`/organizations/holidays`)
      if (!result.ok) throw new Error(result.error || 'Failed to load holidays')
      setHolidays(result.data || [])
    } catch (error) {
      console.error('Error loading holidays:', error)
      toast.error('Failed to load holidays')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.employee_id || !formData.worked_date) {
      toast.error('Please fill in all required fields')
      return
    }

    setLoading(true)
    try {
      const result = await api.post('/leave/comp-off', {
        employee_id: formData.employee_id,
        worked_date: formData.worked_date,
        holiday_id: formData.holiday_id || undefined,
        notes: formData.notes || undefined,
        status: 'approved',
      })

      if (!result.ok) throw new Error(result.error || 'Failed to grant comp-off')

      toast.success('Comp-off granted successfully!')
      setFormData({
        employee_id: '',
        worked_date: '',
        holiday_id: '',
        notes: '',
      })
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error granting comp-off:', error)
      toast.error('Failed to grant comp-off')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-purple-600" />
            <h2 className="text-xl font-semibold">Grant Comp-Off</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Employee <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.employee_id}
              onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
            >
              <option value="">Select employee</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name} ({emp.employee_number})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date Worked <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.worked_date}
              onChange={(e) => setFormData({ ...formData, worked_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              The date the employee worked (typically a holiday)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Holiday (Optional)
            </label>
            <select
              value={formData.holiday_id}
              onChange={(e) => setFormData({ ...formData, holiday_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">No specific holiday</option>
              {holidays.map((holiday) => (
                <option key={holiday.id} value={holiday.id}>
                  {holiday.name} ({new Date(holiday.date).toLocaleDateString()})
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
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              placeholder="Add any notes about this comp-off..."
            />
          </div>

          <div className="bg-blue-50 border-l-4 border-blue-400 p-3 mt-4">
            <p className="text-sm text-blue-700">
              <strong>Note:</strong> This comp-off will be granted with status &quot;Approved&quot; and will expire based on your organization&apos;s settings.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Granting...' : 'Grant Comp-Off'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
