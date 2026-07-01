import { useEffect, useState } from 'react'
import { offlineDB, getPendingEvents, markEventAsSynced, incrementSyncAttempts } from '@/lib/offline-db'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [lastSyncError, setLastSyncError] = useState<string | null>(null)

  // Sync real online status after mount and listen for changes
  useEffect(() => {
    setIsOnline(navigator.onLine)

    function handleOnline() {
      setIsOnline(true)
      syncPendingEvents()
    }

    function handleOffline() {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Check pending count on mount and when syncing
  useEffect(() => {
    updatePendingCount()
  }, [isSyncing])

  // Auto-sync on mount if online
  useEffect(() => {
    if (isOnline) {
      syncPendingEvents()
    }
  }, [])

  async function updatePendingCount() {
    const events = await getPendingEvents()
    setPendingCount(events.length)
  }

  async function syncPendingEvents() {
    if (isSyncing || !isOnline) return

    setIsSyncing(true)
    setLastSyncError(null)

    try {
      const pendingEvents = await getPendingEvents()

      if (pendingEvents.length === 0) {
        setIsSyncing(false)
        return
      }

      console.log(`📤 Syncing ${pendingEvents.length} pending clock events...`)

      for (const event of pendingEvents) {
        try {
          let selfieUrl = event.selfie_url

          // Upload selfie blob if exists
          if (event.selfie_blob && !selfieUrl) {
            const timestamp = new Date().getTime()
            const filename = `${event.employee_id}/${timestamp}.jpg`

            const { data, error: uploadError } = await supabase.storage
              .from('attendance-selfies')
              .upload(filename, event.selfie_blob, {
                contentType: 'image/jpeg',
                cacheControl: '3600',
              })

            if (uploadError) throw uploadError

            const { data: urlData } = supabase.storage
              .from('attendance-selfies')
              .getPublicUrl(filename)

            selfieUrl = urlData.publicUrl
          }

          // Sync clock event to the NestJS backend
          // Note: Server-side verification runs during creation
          const result = await api.post<any>('/attendance/clock-events', {
            employeeId: event.employee_id,
            eventType: event.event_type,
            latitude: event.latitude,
            longitude: event.longitude,
            selfieUrl,
            deviceInfo: event.device_info,
            notes: JSON.stringify({
              location_verified: event.location_verified,
              gps_accuracy: event.gps_accuracy,
              location_samples: event.location_samples || null,
              location_variance: event.location_variance || null,
              device_fingerprint: event.device_fingerprint || null,
              timezone_offset: event.timezone_offset || null,
              suspicious_flags: event.suspicious_flags || [],
              method: 'mobile_app',
              synced_at: new Date().toISOString(),
            }),
          })

          if (!result.ok) throw new Error(result.error || 'Failed to sync clock event')

          // Mark as synced
          if (event.id) {
            await markEventAsSynced(event.id)
          }

          console.log(`✅ Synced event ${event.id}`)
        } catch (err) {
          console.error(`❌ Failed to sync event ${event.id}:`, err)

          if (event.id) {
            await incrementSyncAttempts(
              event.id,
              err instanceof Error ? err.message : 'Unknown error'
            )
          }

          // Continue with other events even if one fails
          continue
        }
      }

      await updatePendingCount()

      // Show success notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('TouchOrbit', {
          body: `Synced ${pendingEvents.length} clock event(s)`,
          icon: '/icon-192.png',
        })
      }
    } catch (err) {
      console.error('Sync error:', err)
      setLastSyncError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setIsSyncing(false)
    }
  }

  return {
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncError,
    syncNow: syncPendingEvents,
  }
}
