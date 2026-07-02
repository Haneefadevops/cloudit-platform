// TouchOrbit Shared UI Package
// Export all components, utilities, and styles

// Calendar primitives
export { GlassCard } from "./components/calendar/primitives/GlassCard"
export { AnimatedModal } from "./components/calendar/primitives/AnimatedModal"
export { PillBadge, EventDot } from "./components/calendar/primitives/PillBadge"
export type { EventType, StatusType } from "./components/calendar/primitives/PillBadge"
export { CommandPalette } from "./components/calendar/primitives/CommandPalette"
export { TimeColumn } from "./components/calendar/primitives/TimeColumn"
export { CalendarSkeleton, EventListSkeleton } from "./components/calendar/primitives/CalendarSkeleton"
export { EmptyState } from "./components/calendar/primitives/EmptyState"
export { BottomSheet } from "./components/calendar/primitives/BottomSheet"
export { PullToRefresh } from "./components/calendar/primitives/PullToRefresh"

// Calendar components
export { CalendarGrid, useCalendarGrid } from "./components/calendar/CalendarGrid"
export type { CalendarView } from "./components/calendar/CalendarGrid"
export { CalendarDayCell } from "./components/calendar/CalendarDayCell"
export type { DayEvent } from "./components/calendar/CalendarDayCell"
export { EventCard } from "./components/calendar/EventCard"
export type { EventCardData } from "./components/calendar/EventCard"
export { EventDetailPanel } from "./components/calendar/EventDetailPanel"
export { EventActions } from "./components/calendar/EventActions"
export type { RsvpStatus } from "./components/calendar/EventActions"
export { TaskForm } from "./components/calendar/TaskForm"
export type { TaskFormData, TaskCategory } from "./components/calendar/TaskForm"

// Org Chart
export { OrgChart } from "./components/org-chart/OrgChart"
export type { OrgChartProps } from "./components/org-chart/OrgChart"
export { OrgChartSkeleton } from "./components/org-chart/OrgChartSkeleton"
export type {
  ViewerRole,
  OrgChartNodeBase,
  OrgChartNodeAdmin,
  OrgChartNode,
  OrgChartData,
  OrgChartFlowNodeData,
  MatrixEdge,
  Vacancy,
  VacancyFlowNodeData,
  PresenceInfo,
} from "./components/org-chart/types"
export { mockOrgChartData } from "./components/org-chart/mock-data"
export type { LayoutDirection } from "./components/org-chart/use-layout"

// Utilities
export { cn, formatCurrency, formatTime, formatDate, formatDateTime, calculateHours, getInitials, truncate } from "./lib/utils"

// Styles (import these in your Next.js app/layout.tsx)
// import "@touchorbit/ui/styles/globals.css"
