import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface LocationSample {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number
}

interface GeolocationData {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number
  // Anti-spoofing data
  samples: LocationSample[]
  variance: number
  deviceFingerprint: DeviceFingerprint
  timezoneOffset: number
  suspiciousFlags: string[]
}

interface DeviceFingerprint {
  userAgent: string
  platform: string
  screen: {
    width: number
    height: number
    colorDepth: number
  }
  timezone: string
  language: string
  hardwareConcurrency?: number
  deviceMemory?: number
  connection?: {
    effectiveType?: string
    downlink?: number
  }
}

interface GeofenceResult {
  isWithinGeofence: boolean
  nearestGeofence?: {
    name: string
    distance: number
  }
}

export function useGeolocation() {
  const [location, setLocation] = useState<GeolocationData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function getCurrentLocation(): Promise<GeolocationData | null> {
    setLoading(true)
    setError(null)

    try {
      // Collect 3 GPS samples over 3 seconds to detect spoofing
      const samples: LocationSample[] = []
      const suspiciousFlags: string[] = []

      console.log('🔵 Collecting 3 GPS samples for anti-spoofing...')

      for (let i = 0; i < 3; i++) {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          })
        })

        samples.push({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        })

        // Defense-in-depth: some non-standard browsers / extensions leak a mock flag
        // on the coords object. The W3C spec does NOT expose mock-detection from
        // browser geolocation, so this is a belt-and-braces check, not a guarantee.
        const coords = position.coords as any
        if (coords.mock || coords.isMocked || coords.mocked) {
          suspiciousFlags.push('mock_location_api_legacy')
        }

        // Wait 1 second between samples (except after last sample)
        if (i < 2) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }

      // Flag if all 3 samples have the EXACT same accuracy value (spoofers return fixed values)
      const allSameAccuracy = samples.every(s => s.accuracy === samples[0].accuracy)
      if (allSameAccuracy && samples.length === 3) {
        suspiciousFlags.push('accuracy_too_stable')
        console.warn('⚠️ Suspicious: GPS accuracy is identical across all 3 samples (likely spoofed)')
      }

      // Calculate variance between samples
      const variance = calculateLocationVariance(samples)
      console.log('📊 Location variance:', variance)

      // Flag if variance is suspiciously low (identical coordinates)
      // SKIP on iOS: iOS GPS caches location for battery efficiency, so identical samples are normal
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      if (!isIOS && variance < 0.00001) {
        suspiciousFlags.push('low_variance')
        console.warn('⚠️ Suspicious: GPS samples are identical (possible mock location)')
      } else if (isIOS && variance < 0.00001) {
        console.log('ℹ️ iOS GPS returned identical samples (normal behavior, not flagging)')
      }

      // Calculate average position
      const avgLatitude = samples.reduce((sum, s) => sum + s.latitude, 0) / samples.length
      const avgLongitude = samples.reduce((sum, s) => sum + s.longitude, 0) / samples.length
      const avgAccuracy = samples.reduce((sum, s) => sum + s.accuracy, 0) / samples.length

      // Check accuracy thresholds
      if (avgAccuracy < 5) {
        suspiciousFlags.push('accuracy_too_precise')
        console.warn('⚠️ Suspicious: GPS accuracy unrealistically precise (<5m) — likely spoofed')
      } else if (avgAccuracy > 100) {
        suspiciousFlags.push('accuracy_too_imprecise')
        console.warn('⚠️ Warning: GPS accuracy poor (>100m) - location will be flagged for review')
      }

      // Build device fingerprint
      const deviceFingerprint = collectDeviceFingerprint()

      // Get timezone offset (store but don't flag - org can be anywhere in the world)
      const timezoneOffset = new Date().getTimezoneOffset() * -1 // Convert to positive offset

      // Note: Timezone mismatch check is now done server-side based on org settings
      // The client just collects the timezone for the server to verify

      const data: GeolocationData = {
        latitude: avgLatitude,
        longitude: avgLongitude,
        accuracy: avgAccuracy,
        timestamp: Date.now(),
        samples,
        variance,
        deviceFingerprint,
        timezoneOffset,
        suspiciousFlags,
      }

      if (suspiciousFlags.length > 0) {
        console.warn('⚠️ Suspicious flags detected:', suspiciousFlags)
      } else {
        console.log('✅ Location verified - no suspicious flags')
      }

      setLocation(data)
      setLoading(false)
      return data
    } catch (err) {
      const errorMessage = err instanceof GeolocationPositionError
        ? getGeolocationErrorMessage(err.code)
        : 'Unable to get your location'

      setError(errorMessage)
      setLoading(false)
      return null
    }
  }

  async function checkGeofence(
    organizationId: string,
    latitude: number,
    longitude: number
  ): Promise<GeofenceResult> {
    try {
      // Fetch active geofences for the organization
      const { data: geofences, error } = await supabase
        .from('geofences')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('status', 'active')

      if (error) throw error

      if (!geofences || geofences.length === 0) {
        // No geofences configured - allow clock-in from anywhere
        console.log('✅ No geofences configured - allowing from anywhere')
        return { isWithinGeofence: true }
      }

      // Calculate distances to all geofences
      const results = geofences.map((geofence) => ({
        name: geofence.name,
        distance: calculateDistance(
          latitude,
          longitude,
          geofence.latitude,
          geofence.longitude
        ),
        radius: geofence.radius_meters,
      }))

      // Sort by distance
      results.sort((a, b) => a.distance - b.distance)

      const nearest = results[0]
      const isWithin = nearest.distance <= nearest.radius

      if (isWithin) {
        console.log(`✅ Within geofence "${nearest.name}" (${Math.round(nearest.distance)}m away)`)
      } else {
        console.warn(`⚠️ Outside all geofences. Nearest: "${nearest.name}" (${Math.round(nearest.distance)}m away, needs ${nearest.radius}m)`)
      }

      return {
        isWithinGeofence: isWithin,
        nearestGeofence: {
          name: nearest.name,
          distance: Math.round(nearest.distance),
        },
      }
    } catch (err) {
      console.error('❌ Geofence check error:', err)
      // FAIL-CLOSED: On error, mark as unverified but allow clock-in for admin review
      // The server-side trigger will handle the final verification
      return {
        isWithinGeofence: false,
        nearestGeofence: {
          name: 'Error checking geofence',
          distance: 0,
        },
      }
    }
  }

  return {
    location,
    error,
    loading,
    getCurrentLocation,
    checkGeofence,
  }
}

// Calculate variance between GPS samples to detect mock locations
function calculateLocationVariance(samples: LocationSample[]): number {
  if (samples.length < 2) return 0

  // Calculate mean
  const meanLat = samples.reduce((sum, s) => sum + s.latitude, 0) / samples.length
  const meanLon = samples.reduce((sum, s) => sum + s.longitude, 0) / samples.length

  // Calculate variance (sum of squared differences from mean)
  const varianceLat = samples.reduce((sum, s) => sum + Math.pow(s.latitude - meanLat, 2), 0) / samples.length
  const varianceLon = samples.reduce((sum, s) => sum + Math.pow(s.longitude - meanLon, 2), 0) / samples.length

  // Return combined variance
  return varianceLat + varianceLon
}

// Collect device fingerprint for fraud detection
function collectDeviceFingerprint(): DeviceFingerprint {
  const nav = navigator as any

  const fingerprint: DeviceFingerprint = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    screen: {
      width: screen.width,
      height: screen.height,
      colorDepth: screen.colorDepth,
    },
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
  }

  // Optional properties (not supported in all browsers)
  if (nav.hardwareConcurrency) {
    fingerprint.hardwareConcurrency = nav.hardwareConcurrency
  }

  if (nav.deviceMemory) {
    fingerprint.deviceMemory = nav.deviceMemory
  }

  if (nav.connection) {
    fingerprint.connection = {
      effectiveType: nav.connection.effectiveType,
      downlink: nav.connection.downlink,
    }
  }

  return fingerprint
}

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000 // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

function getGeolocationErrorMessage(code: number): string {
  switch (code) {
    case 1: // PERMISSION_DENIED
      return 'Location permission denied. Please enable location access in your browser settings.'
    case 2: // POSITION_UNAVAILABLE
      return 'Location unavailable. Please check your device GPS settings.'
    case 3: // TIMEOUT
      return 'Location request timed out. Please try again.'
    default:
      return 'Unable to get your location. Please try again.'
  }
}
