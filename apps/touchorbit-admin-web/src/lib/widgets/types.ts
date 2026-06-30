import type { LayoutItem } from 'react-grid-layout'

export type WidgetType =
  | 'todays-attendance'
  | 'pending-leave'
  | 'pending-overtime'
  | 'pending-expenses'
  | 'headcount'
  | 'recent-clock-ins'
  | 'weekly-trend'
  | 'announcements'
  | 'spoofing-review'
  // v2 Phase 1 — approval widgets
  | 'pending-comp-off'
  | 'pending-encashment'
  | 'pending-corrections'
  | 'pending-doc-signatures'
  // v2 Phase 2 — operations widgets
  | 'payroll-summary'
  | 'pending-shift-swaps'
  | 'roster-adherence'
  | 'training-overview'
  // v2 Phase 3 — insights widgets
  | 'performance-reviews'
  | 'assets-overview'
  | 'upcoming-events'

export interface WidgetInstance {
  i: string      // unique instance id, e.g. 'widget-abc123'
  type: WidgetType
}

export interface DashboardConfig {
  widgets: WidgetInstance[]
  layouts: {
    lg: LayoutItem[]
    md: LayoutItem[]
    sm: LayoutItem[]
  }
}

export interface WidgetProps {
  organizationId: string
  editMode: boolean
  onRemove: () => void
}

export interface WidgetDefinition {
  type: WidgetType
  title: string
  description: string
  category: 'attendance' | 'people' | 'finance' | 'comms'
  component: React.ComponentType<WidgetProps>
  defaultSize: { w: number; h: number }
  minSize: { w: number; h: number }
}
