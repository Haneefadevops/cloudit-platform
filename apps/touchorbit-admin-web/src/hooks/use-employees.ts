import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
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

export function useEmployees(options?: { departmentId?: string | null, branchId?: string | null }) {
  const { organizationId, isLoaded } = useAuth()

  return useQuery({
    queryKey: ['employees', organizationId, options?.departmentId, options?.branchId],
    queryFn: async () => {
      if (!organizationId) return []

      let query = supabase
        .from('employees')
        .select('*')
        .eq('organization_id', organizationId)

      if (options?.departmentId) {
        query = query.eq('department_id', options.departmentId)
      }
      if (options?.branchId) {
        query = query.eq('branch_id', options.branchId)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching employees:', error)
        throw error
      }

      return data as Employee[]
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

      // Create employee record without user_id (they'll sign up later)
      const { data: employee, error: employeeError } = await supabase
        .from('employees')
        .insert({
          organization_id: organizationId,
          user_id: null, // Will be linked when they sign up via Clerk
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          phone: data.phone || null,
          job_title: data.job_title || null,
          department: data.department || null,
          department_id: data.department_id || null,
          branch_id: data.branch_id || null,
          hire_date: data.hire_date || null,
          basic_salary: data.basic_salary || null,
          employment_status: 'active',
        })
        .select()
        .single()

      if (employeeError) {
        console.error('Employee creation error:', employeeError)
        throw employeeError
      }

      return employee as Employee
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
