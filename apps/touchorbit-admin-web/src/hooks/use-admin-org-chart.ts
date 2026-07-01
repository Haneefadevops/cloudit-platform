'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import type { OrgChartData } from '@/components/ui-touchorbit'

interface EmployeeRow {
  id: string
  manager_id: string | null
  first_name: string
  last_name: string
  photo_url: string | null
  job_title: string | null
  date_of_birth: string | null
  hire_date: string | null
  department_id: string | null
  department_name: string | null
  department_code: string | null
  parent_department_id?: string | null
  branch_id: string | null
  branch_name: string | null
  employee_number?: string | null
  employment_status?: string | null
  termination_date?: string | null
  basic_salary?: number | null
  user_id?: string | null
}

function buildOrgChart(rows: EmployeeRow[], currentUserId?: string | null): OrgChartData {
  const byId = new Map<string, EmployeeRow>()
  const children = new Map<string, string[]>()

  for (const row of rows) {
    byId.set(row.id, row)
    if (row.manager_id && byId.has(row.manager_id)) {
      const list = children.get(row.manager_id) || []
      list.push(row.id)
      children.set(row.manager_id, list)
    } else if (!row.manager_id) {
      const list = children.get('__root__') || []
      list.push(row.id)
      children.set('__root__', list)
    }
  }

  // Build a stable sort path based on names so the layout is deterministic.
  const sortedRows = [...rows].sort((a, b) =>
    `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
  )
  const orderIndex = new Map<string, number>()
  sortedRows.forEach((r, i) => orderIndex.set(r.id, i + 1))

  const out: OrgChartData = []

  function visit(id: string, depth: number, pathIds: string[], pathNames: string[], sortPrefix: string) {
    const row = byId.get(id)
    if (!row) return

    const fullName = `${row.first_name} ${row.last_name}`
    const childIds = (children.get(id) || []).slice().sort((a, b) => (orderIndex.get(a) || 0) - (orderIndex.get(b) || 0))
    const directReportsCount = childIds.length
    const hasChildren = directReportsCount > 0

    const node: OrgChartData[number] = {
      employee_id: row.id,
      manager_id: row.manager_id || null,
      first_name: row.first_name,
      last_name: row.last_name,
      full_name: fullName,
      photo_url: row.photo_url || null,
      job_title: row.job_title || null,
      date_of_birth: row.date_of_birth || null,
      hire_date: row.hire_date || null,
      department_id: row.department_id || null,
      department_name: row.department_name || null,
      department_code: row.department_code || null,
      parent_department_id: row.parent_department_id || null,
      branch_id: row.branch_id || null,
      branch_name: row.branch_name || null,
      depth,
      path_ids: [...pathIds, row.id],
      path_names: [...pathNames, fullName],
      sort_path: sortPrefix,
      direct_reports_count: directReportsCount,
      has_children: hasChildren,
      is_current_user: row.user_id === currentUserId || row.id === currentUserId,
      employee_number: row.employee_number || null,
      employment_status: row.employment_status || null,
      termination_date: row.termination_date || null,
      basic_salary: row.basic_salary ?? null,
      total_reports_count: 0,
      subtree_headcount: 0,
      direct_reports_salary_total: null,
      subtree_salary_total: null,
    }

    out.push(node)

    childIds.forEach((childId, idx) => {
      const childSort = `${sortPrefix}.${String(idx + 1).padStart(5, '0')}`
      visit(childId, depth + 1, node.path_ids, node.path_names, childSort)
    })
  }

  const rootIds = (children.get('__root__') || []).slice().sort((a, b) => (orderIndex.get(a) || 0) - (orderIndex.get(b) || 0))
  rootIds.forEach((id, idx) => {
    visit(id, 0, [], [], String(idx + 1).padStart(5, '0'))
  })

  return out
}

export function useAdminOrgChart() {
  const { organizationId, isLoaded, userId } = useAuth()

  return useQuery({
    queryKey: ['admin-org-chart', organizationId],
    queryFn: async () => {
      if (!organizationId) return []

      const result = await api.get<EmployeeRow[]>(`/employees?limit=500`)
      if (!result.ok) {
        console.error('Error fetching admin org chart:', result.error)
        throw new Error(result.error || 'Failed to fetch org chart')
      }

      return buildOrgChart(result.data || [], userId)
    },
    enabled: isLoaded && !!organizationId,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  })
}
