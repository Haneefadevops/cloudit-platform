import type { DashboardConfig } from './types'

// Role strings verified from apps/admin/lib/auth.ts:
// 'owner' | 'hr_admin' | 'manager' | 'finance' | 'dept_manager' | 'branch_manager'
//
// RULE: only include widgets in 'widgets' that also have layout entries.
// v2 widgets are available via the catalog drawer (registry) — do NOT pre-place them here.

const OWNER_DEFAULT: DashboardConfig = {
  widgets: [
    { i: 'w-attendance',    type: 'todays-attendance' },
    { i: 'w-headcount',     type: 'headcount' },
    { i: 'w-leave',         type: 'pending-leave' },
    { i: 'w-clock-ins',     type: 'recent-clock-ins' },
    { i: 'w-weekly',        type: 'weekly-trend' },
    { i: 'w-overtime',      type: 'pending-overtime' },
    { i: 'w-expenses',      type: 'pending-expenses' },
    { i: 'w-announcements', type: 'announcements' },
    { i: 'w-activity',      type: 'recent-activity' },
  ],
  layouts: {
    lg: [
      { i: 'w-attendance',    x: 0, y: 0, w: 4, h: 4 },
      { i: 'w-headcount',     x: 4, y: 0, w: 4, h: 4 },
      { i: 'w-leave',         x: 8, y: 0, w: 4, h: 3 },
      { i: 'w-clock-ins',     x: 0, y: 4, w: 4, h: 5 },
      { i: 'w-weekly',        x: 4, y: 4, w: 4, h: 5 },
      { i: 'w-overtime',      x: 8, y: 4, w: 2, h: 3 },
      { i: 'w-expenses',      x: 10, y: 4, w: 2, h: 3 },
      { i: 'w-announcements', x: 4, y: 9, w: 8, h: 3 },
      { i: 'w-activity',      x: 0, y: 12, w: 12, h: 4 },
    ],
    md: [
      { i: 'w-attendance',    x: 0, y: 0,  w: 4, h: 4 },
      { i: 'w-headcount',     x: 4, y: 0,  w: 4, h: 4 },
      { i: 'w-leave',         x: 0, y: 4,  w: 4, h: 3 },
      { i: 'w-clock-ins',     x: 4, y: 4,  w: 4, h: 4 },
      { i: 'w-weekly',        x: 0, y: 8,  w: 8, h: 4 },
      { i: 'w-overtime',      x: 0, y: 7,  w: 2, h: 1 },
      { i: 'w-expenses',      x: 2, y: 7,  w: 2, h: 1 },
      { i: 'w-announcements', x: 0, y: 12, w: 8, h: 3 },
      { i: 'w-activity',      x: 0, y: 15, w: 8, h: 4 },
    ],
    sm: [
      { i: 'w-attendance',    x: 0, y: 0,  w: 4, h: 3 },
      { i: 'w-headcount',     x: 0, y: 3,  w: 4, h: 4 },
      { i: 'w-leave',         x: 0, y: 7,  w: 4, h: 3 },
      { i: 'w-clock-ins',     x: 0, y: 10, w: 4, h: 4 },
      { i: 'w-weekly',        x: 0, y: 14, w: 4, h: 4 },
      { i: 'w-overtime',      x: 0, y: 18, w: 4, h: 3 },
      { i: 'w-expenses',      x: 0, y: 21, w: 4, h: 3 },
      { i: 'w-announcements', x: 0, y: 24, w: 4, h: 3 },
    ],
  },
}

const HR_DEFAULT: DashboardConfig = {
  widgets: [
    { i: 'w-attendance',    type: 'todays-attendance' },
    { i: 'w-headcount',     type: 'headcount' },
    { i: 'w-leave',         type: 'pending-leave' },
    { i: 'w-clock-ins',     type: 'recent-clock-ins' },
    { i: 'w-weekly',        type: 'weekly-trend' },
    { i: 'w-announcements', type: 'announcements' },
  ],
  layouts: {
    lg: [
      { i: 'w-attendance',    x: 0, y: 0, w: 4, h: 4 },
      { i: 'w-headcount',     x: 4, y: 0, w: 4, h: 4 },
      { i: 'w-leave',         x: 8, y: 0, w: 4, h: 4 },
      { i: 'w-clock-ins',     x: 0, y: 4, w: 6, h: 5 },
      { i: 'w-weekly',        x: 6, y: 4, w: 6, h: 4 },
      { i: 'w-announcements', x: 6, y: 8, w: 6, h: 3 },
    ],
    md: [
      { i: 'w-attendance',    x: 0, y: 0,  w: 4, h: 4 },
      { i: 'w-headcount',     x: 4, y: 0,  w: 4, h: 4 },
      { i: 'w-leave',         x: 0, y: 4,  w: 8, h: 4 },
      { i: 'w-clock-ins',     x: 0, y: 8,  w: 4, h: 4 },
      { i: 'w-weekly',        x: 4, y: 8,  w: 4, h: 4 },
      { i: 'w-announcements', x: 0, y: 12, w: 8, h: 3 },
    ],
    sm: [
      { i: 'w-attendance',    x: 0, y: 0,  w: 4, h: 3 },
      { i: 'w-headcount',     x: 0, y: 3,  w: 4, h: 4 },
      { i: 'w-leave',         x: 0, y: 7,  w: 4, h: 3 },
      { i: 'w-clock-ins',     x: 0, y: 10, w: 4, h: 4 },
      { i: 'w-weekly',        x: 0, y: 14, w: 4, h: 4 },
      { i: 'w-announcements', x: 0, y: 18, w: 4, h: 3 },
      { i: 'w-activity',      x: 0, y: 21, w: 4, h: 4 },
    ],
  },
}

const FINANCE_DEFAULT: DashboardConfig = {
  widgets: [
    { i: 'w-expenses',   type: 'pending-expenses' },
    { i: 'w-overtime',   type: 'pending-overtime' },
    { i: 'w-headcount',  type: 'headcount' },
    { i: 'w-attendance', type: 'todays-attendance' },
  ],
  layouts: {
    lg: [
      { i: 'w-expenses',   x: 0, y: 0, w: 6, h: 3 },
      { i: 'w-overtime',   x: 6, y: 0, w: 6, h: 3 },
      { i: 'w-headcount',  x: 0, y: 3, w: 6, h: 4 },
      { i: 'w-attendance', x: 6, y: 3, w: 6, h: 4 },
    ],
    md: [
      { i: 'w-expenses',   x: 0, y: 0, w: 4, h: 3 },
      { i: 'w-overtime',   x: 4, y: 0, w: 4, h: 3 },
      { i: 'w-headcount',  x: 0, y: 3, w: 4, h: 4 },
      { i: 'w-attendance', x: 4, y: 3, w: 4, h: 4 },
    ],
    sm: [
      { i: 'w-expenses',   x: 0, y: 0,  w: 4, h: 3 },
      { i: 'w-overtime',   x: 0, y: 3,  w: 4, h: 3 },
      { i: 'w-headcount',  x: 0, y: 6,  w: 4, h: 4 },
      { i: 'w-attendance', x: 0, y: 10, w: 4, h: 3 },
    ],
  },
}

const MANAGER_DEFAULT: DashboardConfig = {
  widgets: [
    { i: 'w-attendance',    type: 'todays-attendance' },
    { i: 'w-leave',         type: 'pending-leave' },
    { i: 'w-announcements', type: 'announcements' },
    { i: 'w-clock-ins',     type: 'recent-clock-ins' },
  ],
  layouts: {
    lg: [
      { i: 'w-attendance',    x: 0, y: 0, w: 4, h: 4 },
      { i: 'w-leave',         x: 4, y: 0, w: 4, h: 3 },
      { i: 'w-announcements', x: 8, y: 0, w: 4, h: 4 },
      { i: 'w-clock-ins',     x: 0, y: 4, w: 8, h: 5 },
    ],
    md: [
      { i: 'w-attendance',    x: 0, y: 0, w: 4, h: 4 },
      { i: 'w-leave',         x: 4, y: 0, w: 4, h: 3 },
      { i: 'w-clock-ins',     x: 0, y: 4, w: 8, h: 4 },
      { i: 'w-announcements', x: 0, y: 8, w: 8, h: 3 },
    ],
    sm: [
      { i: 'w-attendance',    x: 0, y: 0,  w: 4, h: 3 },
      { i: 'w-leave',         x: 0, y: 3,  w: 4, h: 3 },
      { i: 'w-clock-ins',     x: 0, y: 6,  w: 4, h: 4 },
      { i: 'w-announcements', x: 0, y: 10, w: 4, h: 3 },
    ],
  },
}

export function getDefaultLayoutForRole(role: string | undefined): DashboardConfig {
  switch (role) {
    case 'owner':           return OWNER_DEFAULT
    case 'hr_admin':        return HR_DEFAULT
    case 'finance':         return FINANCE_DEFAULT
    case 'manager':
    case 'dept_manager':
    case 'branch_manager':  return MANAGER_DEFAULT
    default:                return OWNER_DEFAULT
  }
}
