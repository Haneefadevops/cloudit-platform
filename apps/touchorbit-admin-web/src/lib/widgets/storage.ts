import type { DashboardConfig } from './types'

const storageKey = (userId: string) => `touchorbit:dashboard:${userId}`

export async function loadLayout(userId: string): Promise<DashboardConfig | null> {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(storageKey(userId))
    if (!raw) return null
    return JSON.parse(raw) as DashboardConfig
  } catch {
    return null
  }
}

export async function saveLayout(
  userId: string,
  _organizationId: string,
  config: DashboardConfig
): Promise<void> {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(storageKey(userId), JSON.stringify(config))
}

export async function resetLayout(userId: string): Promise<void> {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(storageKey(userId))
}
