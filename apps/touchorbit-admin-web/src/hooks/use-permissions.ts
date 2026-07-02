'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

type PermissionMap = Record<string, boolean>

export function usePermissions(requestedPermissions: string[] = []) {
  const { isLoaded, userId, role } = useAuth()
  const [permissionMap, setPermissionMap] = useState<PermissionMap>({})
  const [loading, setLoading] = useState(false)

  const stablePermissions = useMemo(
    () => Array.from(new Set(requestedPermissions)).sort(),
    [requestedPermissions.join('|')]
  )

  useEffect(() => {
    let cancelled = false

    async function loadPermissions() {
      if (!isLoaded || !userId || stablePermissions.length === 0) {
        setPermissionMap({})
        return
      }

      if (role === 'owner' || role === 'super_admin') {
        setPermissionMap(Object.fromEntries(stablePermissions.map((permission) => [permission, true])))
        return
      }

      setLoading(true)
      try {
        const checks = await Promise.all(
          stablePermissions.map(async (permission) => {
            const { data, error } = await supabase.rpc('has_permission', {
              p_permission_key: permission,
            })
            return [permission, error ? false : Boolean(data)] as const
          })
        )

        if (!cancelled) {
          setPermissionMap(Object.fromEntries(checks))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadPermissions()
    return () => {
      cancelled = true
    }
  }, [isLoaded, userId, role, stablePermissions.join('|')])

  const can = useCallback(
    (permission: string) => {
      if (role === 'owner' || role === 'super_admin') return true
      return Boolean(permissionMap[permission])
    },
    [permissionMap, role]
  )

  const canForEmployee = useCallback(
    async (permission: string, employeeId: string) => {
      if (role === 'owner' || role === 'super_admin') return true
      const { data, error } = await supabase.rpc('has_permission_for_employee', {
        p_permission_key: permission,
        p_employee_id: employeeId,
      })
      if (error) return false
      return Boolean(data)
    },
    [role]
  )

  return { can, canForEmployee, permissions: permissionMap, loading }
}
