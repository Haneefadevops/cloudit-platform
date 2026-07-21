import type { DashboardConfig } from './types'
import { api } from '@/lib/api'

const storageKey = (userId: string) => `touchorbit:dashboard:${userId}`

export async function loadLayout(userId: string): Promise<DashboardConfig | null> {
  if (typeof window === 'undefined') return null
  try {
    const remote = await api.get<DashboardConfig | null>('/dashboard/layout')
    if (remote.ok && remote.data) {
      window.localStorage.setItem(storageKey(userId), JSON.stringify(remote.data))
      return remote.data
    }
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
  const result = await api.patch('/dashboard/layout', config)
  if (!result.ok) throw new Error(result.error || 'Failed to save dashboard layout')
  window.localStorage.setItem(storageKey(userId), JSON.stringify(config))
}

export async function resetLayout(userId: string): Promise<void> {
  if (typeof window === 'undefined') return
  const result = await api.del('/dashboard/layout')
  if (!result.ok) throw new Error(result.error || 'Failed to reset dashboard layout')
  window.localStorage.removeItem(storageKey(userId))
}
