/**
 * Org Chart types — aligned with Codex RPC shapes
 * Employee RPC: get_org_chart()
 * Admin RPC:    get_admin_org_chart()
 */

export type ViewerRole = 'employee' | 'admin'

/** Fields every caller receives (structural) */
export interface OrgChartNodeBase {
  employee_id: string
  manager_id: string | null
  first_name: string
  last_name: string
  full_name: string
  photo_url: string | null
  job_title: string | null
  date_of_birth: string | null
  hire_date: string | null
  department_id: string | null
  department_name: string | null
  department_code: string | null
  parent_department_id: string | null
  branch_id: string | null
  branch_name: string | null
  depth: number
  path_ids: string[]
  path_names: string[]
  sort_path: string
  direct_reports_count: number
  has_children: boolean
  is_current_user: boolean
}

/** Admin-only extensions */
export interface OrgChartNodeAdmin extends OrgChartNodeBase {
  employee_number: string | null
  employment_status: string | null
  termination_date: string | null
  basic_salary: number | null
  total_reports_count: number
  subtree_headcount: number
  direct_reports_salary_total: number | null
  subtree_salary_total: number | null
}

export type OrgChartNode = OrgChartNodeBase | OrgChartNodeAdmin

/** Flat list from RPC → frontend builds graph */
export type OrgChartData = OrgChartNode[]

/** Matrix edge from RPC */
export interface MatrixEdge {
  employee_id: string
  matrix_manager_id: string
  relationship_type: string
}

/** Vacancy from RPC */
export interface Vacancy {
  id: string
  department_id: string | null
  department_name: string | null
  manager_id: string | null
  title: string | null
  level: string | null
}

/** React Flow internal node data payload */
export interface OrgChartFlowNodeData extends Record<string, unknown> {
  node: OrgChartNode
  viewerRole: ViewerRole
  onToggleExpand?: (id: string) => void
  isExpanded: boolean
  presence?: PresenceInfo
  isDropTarget?: boolean
  heatmapEnabled?: boolean
  isHistorical?: boolean
}

/** React Flow vacancy node data */
export interface VacancyFlowNodeData extends Record<string, unknown> {
  vacancy: Vacancy
}

/** Presence signal (admin-only, overlay) */
export interface PresenceInfo {
  employee_id: string
  status: 'clocked_in' | 'on_leave' | 'offline'
  since?: string
}
