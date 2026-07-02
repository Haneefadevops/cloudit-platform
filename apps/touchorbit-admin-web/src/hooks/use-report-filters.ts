'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface FilterDept { id: string; name: string }
export interface FilterEmployee { id: string; name: string }

export function useReportFilters(organizationId: string | null | undefined) {
  const [departments, setDepartments] = useState<FilterDept[]>([])
  const [employees,   setEmployees]   = useState<FilterEmployee[]>([])
  const [filtersLoading, setFiltersLoading] = useState(false)

  useEffect(() => {
    if (!organizationId) return
    setFiltersLoading(true)

    Promise.all([
      supabase
        .from('departments')
        .select('id, name')
        .eq('organization_id', organizationId)
        .order('name'),
      supabase
        .from('employees')
        .select('id, first_name, last_name')
        .eq('organization_id', organizationId)
        .eq('employment_status', 'active')
        .order('first_name'),
    ]).then(([{ data: depts }, { data: emps }]) => {
      setDepartments((depts ?? []).map((d: any) => ({ id: d.id, name: d.name })))
      setEmployees(
        (emps ?? []).map((e: any) => ({ id: e.id, name: `${e.first_name} ${e.last_name}` }))
      )
      setFiltersLoading(false)
    })
  }, [organizationId])

  return { departments, employees, filtersLoading }
}
