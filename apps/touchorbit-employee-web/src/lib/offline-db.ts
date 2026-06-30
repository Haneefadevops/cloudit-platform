import Dexie, { type Table } from 'dexie'

export interface QueuedClockEvent {
  id?: number
  employee_id: string
  organization_id: string
  event_type: 'clock_in' | 'clock_out'
  timestamp: string
  latitude: number | null
  longitude: number | null
  gps_accuracy: number | null
  location_verified: boolean
  selfie_url: string | null
  selfie_blob?: Blob  // Store blob temporarily for offline upload
  device_info: string
  queued_at: string
  synced: boolean
  sync_attempts: number
  last_error?: string
  // Anti-spoofing fields (Sprint 2 - Phase 4F)
  location_samples?: any[] | null
  location_variance?: number | null
  device_fingerprint?: any | null
  timezone_offset?: number | null
  suspicious_flags?: string[] | null
}

export interface CachedOrgChart {
  id: string // composite: `${organizationId}:${userId}`
  data: any[] // OrgChartData
  cachedAt: string
}

class OfflineDB extends Dexie {
  clockEvents!: Table<QueuedClockEvent>
  orgChart!: Table<CachedOrgChart>

  constructor() {
    super('touchorbit-offline')

    this.version(2).stores({
      clockEvents: '++id, synced, queued_at, employee_id',
      orgChart: 'id, cachedAt',
    })
  }
}

export const offlineDB = new OfflineDB()

// Helper functions
export async function queueClockEvent(event: Omit<QueuedClockEvent, 'id' | 'queued_at' | 'synced' | 'sync_attempts'>) {
  await offlineDB.clockEvents.add({
    ...event,
    queued_at: new Date().toISOString(),
    synced: false,
    sync_attempts: 0,
  })
}

export async function getPendingEvents() {
  return offlineDB.clockEvents
    .where('synced')
    .equals(0)
    .sortBy('queued_at')
}

export async function markEventAsSynced(id: number) {
  await offlineDB.clockEvents.update(id, { synced: true })
}

export async function incrementSyncAttempts(id: number, error?: string) {
  const event = await offlineDB.clockEvents.get(id)
  if (event) {
    await offlineDB.clockEvents.update(id, {
      sync_attempts: event.sync_attempts + 1,
      last_error: error,
    })
  }
}

export async function clearSyncedEvents(olderThanDays = 7) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - olderThanDays)

  await offlineDB.clockEvents
    .where('synced')
    .equals(1)
    .and((event) => new Date(event.queued_at) < cutoff)
    .delete()
}
