'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { toast } from 'sonner'
import type { OrgChartData } from '@/components/ui-touchorbit'

export function useReassignManager() {
  const { organizationId } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      employeeId,
      managerId,
    }: {
      employeeId: string
      managerId: string | null
    }) => {
      const { data, error } = await supabase.rpc('set_employee_manager', {
        p_employee_id: employeeId,
        p_manager_id: managerId,
      })

      if (error) {
        // Map SQLSTATE to friendly messages
        const code = (error as any).code
        if (code === '42501') {
          throw new Error('Unauthorized — you do not have permission to reassign managers.')
        }
        if (code === '22023') {
          const msg = error.message?.toLowerCase() || ''
          if (msg.includes('self')) throw new Error('An employee cannot report to themselves.')
          if (msg.includes('terminated')) throw new Error('Cannot assign a terminated employee.')
          if (msg.includes('cycle')) throw new Error('This would create a reporting cycle.')
          throw new Error('Invalid reassignment — check employee and manager.')
        }
        throw error
      }

      return data as {
        employee_id: string
        previous_manager_id: string | null
        manager_id: string | null
        updated_at: string
      }
    },

    onMutate: async ({ employeeId, managerId }) => {
      const queryKey = ['admin-org-chart', organizationId]
      await queryClient.cancelQueries({ queryKey })
      const previousData = queryClient.getQueryData<OrgChartData>(queryKey)

      if (previousData) {
        const next = previousData.map((n) => {
          if (n.employee_id === employeeId) {
            return { ...n, manager_id: managerId }
          }
          return n
        })
        queryClient.setQueryData<OrgChartData>(queryKey, next)
      }

      return { previousData }
    },

    onError: (err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['admin-org-chart', organizationId], context.previousData)
      }
      toast.error(err instanceof Error ? err.message : 'Reassignment failed')
    },

    onSuccess: (result) => {
      toast.success('Manager reassigned successfully')
      queryClient.invalidateQueries({ queryKey: ['admin-org-chart', organizationId] })
    },
  })
}
