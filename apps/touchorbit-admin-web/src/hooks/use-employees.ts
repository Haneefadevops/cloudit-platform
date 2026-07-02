import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { toast } from 'sonner'

export interface Employee {
  id: string
  organization_id: string
  user_id: string | null
  employee_number: string | null
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  nic: string | null
  date_of_birth: string | null
  hire_date: string | null
  employment_status: string
  job_title: string | null
  department: string | null
  department_id: string | null
  branch_id: string | null
  basic_salary: number | null
  bank_account_number: string | null
  bank_name: string | null
  bank_branch: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  postal_code: string | null
  termination_date: string | null
  termination_reason: string | null
  last_working_day: string | null
  terminated_by: string | null
  photo_url: string | null
  created_at: string
  updated_at: string
}

export interface CreateEmployeeData {
  first_name: string
  last_name: string
  email: string
  phone?: string
  job_title?: string
  department?: string
  department_id?: string
  branch_id?: string
  hire_date?: string
  basic_salary?: number
}

function normalizeEmployee(row: any): Employee {
  return {
    ...row,
    department: row.department_name || row.department || null,
  } as Employee
}

export function useEmployees(options?: { departmentId?: string | null, branchId?: string | null }) {
  const { organizationId, isLoaded } = useAuth()

  return useQuery({
    queryKey: ['employees', organizationId, options?.departmentId, options?.branchId],
    queryFn: async () => {
      if (!organizationId) return []

      const params = new URLSearchParams()
      params.set('limit', '500')
      if (options?.departmentId) params.set('department_id', options.departmentId)
      if (options?.branchId) params.set('branch_id', options.branchId)

      const result = await api.get<any[]>(`/employees?${params.toString()}`)
      if (!result.ok) {
        console.error('Error fetching employees:', result.error)
        throw new Error(result.error || 'Failed to fetch employees')
      }

      return (result.data || []).map(normalizeEmployee)
    },
    enabled: isLoaded && !!organizationId,
  })
}

export function useCreateEmployee() {
  const { organizationId } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateEmployeeData) => {
      if (!organizationId) throw new Error('No organization')

      const result = await api.post<any>('/employees', {
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone: data.phone || null,
        job_title: data.job_title || null,
        department: data.department || null,
        department_id: data.department_id || null,
        branch_id: data.branch_id || null,
        hire_date: data.hire_date || null,
        basic_salary: data.basic_salary ?? null,
        employment_status: 'active',
      })

      if (!result.ok) {
        console.error('Employee creation error:', result.error)
        throw new Error(result.error || 'Failed to create employee')
      }

      return normalizeEmployee(result.data) as Employee
    },
    onSuccess: (employee) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      toast.success(`Employee added! Send them the invite link to sign up.`, {
        description: `${employee.first_name} can now sign up at touchorbit-employee.vercel.app`,
      })
    },
    onError: (error: any) => {
      console.error('Error creating employee:', error)
      toast.error('Failed to add employee', {
        description: error.message || 'Please try again.',
      })
    },
  })
}
