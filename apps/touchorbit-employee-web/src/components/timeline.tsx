'use client'

import { useClockStatus } from '@/hooks/use-clock-status'
import { formatTime } from '@/lib/utils'
import { LogIn, LogOut, MapPin, MapPinOff } from 'lucide-react'

export function Timeline() {
  const { todayEvents } = useClockStatus()

  if (todayEvents.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl w-full">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Activity</h3>
        <div className="text-center py-8 text-gray-500">
          <p>No activity yet today</p>
          <p className="text-sm mt-1">Clock in to start tracking</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl w-full">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Today's Activity</h3>

      <div className="space-y-4">
        {todayEvents.map((event, index) => (
          <div key={event.id} className="flex gap-4">
            {/* Timeline indicator */}
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  event.event_type === 'clock_in'
                    ? 'bg-green-100 text-green-600'
                    : 'bg-red-100 text-red-600'
                }`}
              >
                {event.event_type === 'clock_in' ? (
                  <LogIn className="w-5 h-5" />
                ) : (
                  <LogOut className="w-5 h-5" />
                )}
              </div>

              {/* Connecting line */}
              {index < todayEvents.length - 1 && (
                <div className="w-0.5 h-12 bg-gray-200 my-1" />
              )}
            </div>

            {/* Event details */}
            <div className="flex-1 pb-6">
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-semibold text-gray-900">
                  {event.event_type === 'clock_in' ? 'Clocked In' : 'Clocked Out'}
                </h4>
                <span className="text-sm font-medium text-gray-500">
                  {formatTime(event.timestamp)}
                </span>
              </div>

              {/* Location verification badge */}
              <div className="flex items-center gap-2 mt-2">
                {event.location_verified ? (
                  <div className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
                    <MapPin className="w-3 h-3" />
                    <span>Location verified</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                    <MapPinOff className="w-3 h-3" />
                    <span>Outside geofence</span>
                  </div>
                )}
              </div>

              {/* Coordinates (for debugging) */}
              {event.latitude && event.longitude && (
                <div className="text-xs text-gray-400 mt-2 font-mono">
                  {event.latitude.toFixed(6)}, {event.longitude.toFixed(6)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
