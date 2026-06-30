'use client'

import { useOfflineSync } from '@/hooks/use-offline-sync'
import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react'

export function OfflineSyncStatus() {
  const { isOnline, isSyncing, pendingCount, lastSyncError, syncNow } = useOfflineSync()

  // Don't show anything if online and no pending items
  if (isOnline && pendingCount === 0 && !isSyncing) {
    return null
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-80 z-40">
      <div
        className={`
          rounded-lg shadow-lg p-4
          ${isOnline ? 'bg-blue-50 border border-blue-200' : 'bg-amber-50 border border-amber-200'}
        `}
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="flex-shrink-0">
            {isSyncing ? (
              <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
            ) : isOnline ? (
              <Wifi className="w-5 h-5 text-blue-600" />
            ) : (
              <WifiOff className="w-5 h-5 text-amber-600" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">
              {isSyncing
                ? 'Syncing...'
                : isOnline
                  ? 'Connected'
                  : 'Offline Mode'}
            </p>

            {pendingCount > 0 && (
              <p className="text-xs text-gray-600 mt-1">
                {pendingCount} clock event{pendingCount > 1 ? 's' : ''} pending sync
              </p>
            )}

            {lastSyncError && (
              <div className="flex items-start gap-1.5 mt-2 text-xs text-red-600">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <p>{lastSyncError}</p>
              </div>
            )}
          </div>

          {/* Sync button */}
          {isOnline && pendingCount > 0 && !isSyncing && (
            <button
              onClick={syncNow}
              className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-100 rounded transition"
            >
              Sync Now
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
