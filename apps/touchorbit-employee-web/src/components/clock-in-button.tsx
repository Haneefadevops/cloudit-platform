'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Fingerprint, Loader2, WifiOff, XCircle } from 'lucide-react'
import { useClockStatus } from '@/hooks/use-clock-status'
import { useGeolocation } from '@/hooks/use-geolocation'
import { useOfflineSync } from '@/hooks/use-offline-sync'
import { useAuth } from '@/lib/auth'
import { CameraCapture } from './camera-capture'
import { queueClockEvent } from '@/lib/offline-db'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

const HOLD_DURATION = 1200 // ms

export function ClockInButton() {
  const { userId, organizationId } = useAuth()
  const { isClockedIn, employeeId, refreshStatus, isLoading: isClocking } = useClockStatus()
  const { getCurrentLocation, checkGeofence } = useGeolocation()
  const { isOnline, pendingCount } = useOfflineSync()

  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [accessDenied, setAccessDenied] = useState<{ reason: string } | null>(null)
  const [capturedEmployeeId, setCapturedEmployeeId] = useState<string | null>(null)
  const [workType, setWorkType] = useState<'office' | 'wfh' | 'field'>('office')
  const [branches, setBranches] = useState<any[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [mounted, setMounted] = useState(false)
  const [locationData, setLocationData] = useState<{
    latitude: number
    longitude: number
    accuracy: number
    verified: boolean
    samples: any[]
    variance: number
    deviceFingerprint: any
    timezoneOffset: number
    suspiciousFlags: string[]
  } | null>(null)

  // Press-and-hold state
  const [holdProgress, setHoldProgress] = useState(0)
  const [isHolding, setIsHolding] = useState(false)
  const holdTimerRef = useRef<number | null>(null)
  const holdStartRef = useRef<number>(0)
  const rafRef = useRef<number | null>(null)
  const handleClockRef = useRef<() => void>(() => {})

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    console.log('🎬 Camera state changed:', { showCamera, employeeId })
    if (organizationId) {
      loadBranches()
    }
  }, [showCamera, employeeId, organizationId])

  async function loadBranches() {
    try {
      const { data } = await supabase
        .from('branches')
        .select('id, name')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name')
      setBranches(data || [])
    } catch (error) {
      console.error('Error loading branches:', error)
    }
  }

  const handleClock = async () => {
    if (!employeeId || !organizationId) {
      toast.error('Employee record not found')
      return
    }

    if (!isClockedIn && workType === 'office' && !selectedBranchId) {
      toast.error('Please select a branch first')
      return
    }

    setIsGettingLocation(true)

    try {
      console.log('🔵 Getting GPS location...')
      const location = await getCurrentLocation()

      if (!location) throw new Error('Unable to get your location')

      if (location.accuracy > 100) {
        throw new Error(`GPS signal too weak (±${Math.round(location.accuracy)}m). Please move near a window or to an open area.`)
      }

      console.log('🛡️ Verifying security on server...')
      const { data: verification, error: verifyError } = await supabase.rpc('verify_clock_event', {
        p_organization_id: organizationId,
        p_employee_id: employeeId,
        p_lat: location.latitude,
        p_lng: location.longitude,
        p_accuracy: location.accuracy,
        p_work_type: workType,
        p_suspicious_flags: location.suspiciousFlags,
        p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      })

      if (verifyError) throw verifyError

      if (verification.status === 'REJECTED') {
        setAccessDenied({ reason: 'Your location could not be verified. Please contact your manager.' })
        setIsGettingLocation(false)
        return
      }

      console.log('✅ Server verification passed')

      setLocationData({
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        verified: verification.geofence_verified,
        samples: location.samples,
        variance: location.variance,
        deviceFingerprint: location.deviceFingerprint,
        timezoneOffset: location.timezoneOffset,
        suspiciousFlags: verification.flags || [],
      })

      setCapturedEmployeeId(employeeId)
      setShowCamera(true)
      setIsGettingLocation(false)
    } catch (error) {
      console.error('❌ Security block:', error)
      toast.error('Security Check Failed', {
        description: error instanceof Error ? error.message : 'Verification failed',
      })
      setIsGettingLocation(false)
    }
  }

  handleClockRef.current = handleClock

  // Press-and-hold handlers
  const startHold = useCallback(() => {
    if (isGettingLocation || isClocking || showCamera) return
    setIsHolding(true)
    setHoldProgress(0)
    holdStartRef.current = Date.now()

    const animate = () => {
      const elapsed = Date.now() - holdStartRef.current
      const progress = Math.min(100, (elapsed / HOLD_DURATION) * 100)
      setHoldProgress(progress)

      if (elapsed < HOLD_DURATION) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        // Hold complete
        setIsHolding(false)
        setHoldProgress(0)
        handleClockRef.current()
      }
    }
    rafRef.current = requestAnimationFrame(animate)
  }, [isGettingLocation, isClocking, showCamera])

  const endHold = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (isHolding) {
      setIsHolding(false)
      setHoldProgress(0)
    }
  }, [isHolding])

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const handleSelfieCapture = async (selfieUrl: string) => {
    if (!locationData || !employeeId || !organizationId) return

    setShowCamera(false)
    setIsGettingLocation(true)

    try {
      const eventData = {
        employee_id: employeeId,
        organization_id: organizationId,
        branch_id: workType === 'office' ? selectedBranchId : null,
        event_type: isClockedIn ? 'clock_out' as const : 'clock_in' as const,
        timestamp: new Date().toISOString(),
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        gps_accuracy: locationData.accuracy,
        location_verified: locationData.verified,
        selfie_url: selfieUrl,
        device_info: navigator.userAgent,
        work_type: workType,
        location_samples: locationData.samples,
        location_variance: locationData.variance,
        device_fingerprint: locationData.deviceFingerprint,
        timezone_offset: locationData.timezoneOffset,
        suspicious_flags: locationData.suspiciousFlags,
      }

      if (isOnline) {
        const { data: inserted, error } = await supabase
          .from('clock_events')
          .insert({
            ...eventData,
            method: 'mobile_app',
          })
          .select('id')
          .single()

        if (error) {
          console.error('❌ Supabase insert error:', error)
          throw error
        }

        const insertedEventId = inserted?.id
        if (insertedEventId) {
          const channel = supabase
            .channel(`punch-flag-${insertedEventId}`)
            .on('postgres_changes', {
              event: 'UPDATE',
              schema: 'public',
              table: 'clock_events',
              filter: `id=eq.${insertedEventId}`,
            }, (payload) => {
              if (payload.new.admin_review_status === 'flagged') {
                localStorage.setItem('to_flagged_punch', JSON.stringify({
                  id: insertedEventId,
                  ts: Date.now(),
                }))
              }
            })
            .subscribe()

          setTimeout(() => supabase.removeChannel(channel), 15000)

          if ((locationData.suspiciousFlags?.length ?? 0) > 0) {
            localStorage.setItem('to_flagged_punch', JSON.stringify({
              id: insertedEventId,
              ts: Date.now(),
            }))
          }

          supabase.functions.invoke('check-ip-location', {
            body: { event_id: insertedEventId, claimed_lat: locationData.latitude, claimed_lng: locationData.longitude }
          }).catch(err => console.error('IP check failed (non-blocking):', err))
        }

        toast.success(isClockedIn ? 'Clocked out!' : 'Clocked in!')
      } else {
        await queueClockEvent(eventData)
        toast.info('Saved offline', { description: 'Will sync when connection returns' })
      }

      refreshStatus()
    } catch (error) {
      toast.error('Failed to clock ' + (isClockedIn ? 'out' : 'in'), {
        description: error instanceof Error ? error.message : 'Please try again',
      })
    } finally {
      setIsGettingLocation(false)
      setCapturedEmployeeId(null)
      setLocationData(null)
    }
  }

  const handleCameraCancel = () => {
    setShowCamera(false)
    setCapturedEmployeeId(null)
    setIsGettingLocation(false)
    setLocationData(null)
  }

  const isLoading = isClocking || isGettingLocation
  const safeIsClockedIn = mounted ? isClockedIn : false
  const safeIsOnline = mounted ? isOnline : true
  const safePendingCount = mounted ? pendingCount : 0

  // SVG ring calculations
  const r = 76
  const circumference = 2 * Math.PI * r
  const dashOffset = circumference * (1 - holdProgress / 100)

  return (
    <>
      {showCamera && capturedEmployeeId && (
        <CameraCapture
          employeeId={capturedEmployeeId}
          onCapture={handleSelfieCapture}
          onCancel={handleCameraCancel}
        />
      )}

      {accessDenied && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-12 h-12" /> 
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600 mb-8">{accessDenied.reason}</p>
            <button
              onClick={() => setAccessDenied(null)}
              className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 transition-colors shadow-lg active:scale-[0.98]"
            >
              Understand
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col items-center gap-5 w-full">
        {/* Work Location Selector */}
        <div className="flex bg-[#F1F0F4] rounded-2xl p-1 gap-1">
          {([
            { value: 'office', label: '🏢 Office' },
            { value: 'wfh',    label: '🏠 WFH'    },
            { value: 'field',  label: '🚗 Field'   },
          ] as const).map(opt => (
            <button
              key={opt.value}
              onClick={() => { setWorkType(opt.value); if (opt.value !== 'office') setSelectedBranchId('') }}
              disabled={isLoading}
              className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${workType === opt.value ? 'bg-white text-[#534AB7] shadow-sm' : 'text-[#9CA3AF]'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Branch Selector */}
        {workType === 'office' && (
          <select value={selectedBranchId} onChange={e => setSelectedBranchId(e.target.value)} disabled={isLoading}
            className="bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl px-4 py-3 text-[12px] font-bold text-[#1A1727] outline-none focus:border-[#534AB7] w-full max-w-[260px]">
            <option value="">Select Branch</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}

        <div className="relative select-none">
          {/* Outer ring */}
          <div className="w-52 h-52 rounded-full flex items-center justify-center"
            style={{ backgroundColor: safeIsClockedIn ? 'rgba(239,68,68,0.08)' : 'rgba(83,74,183,0.08)' }}>
            {/* Middle ring */}
            <div className="w-44 h-44 rounded-full flex items-center justify-center"
              style={{ backgroundColor: safeIsClockedIn ? 'rgba(239,68,68,0.12)' : 'rgba(83,74,183,0.12)' }}>
              
              {/* Press-and-hold SVG ring */}
              {isHolding && (
                <svg width="176" height="176" className="absolute pointer-events-none" style={{ transform: 'rotate(-90deg)' }}>
                  <circle
                    cx="88" cy="88" r={r}
                    fill="none"
                    stroke={safeIsClockedIn ? 'rgba(239,68,68,0.25)' : 'rgba(83,74,183,0.25)'}
                    strokeWidth="6"
                  />
                  <circle
                    cx="88" cy="88" r={r}
                    fill="none"
                    stroke={safeIsClockedIn ? '#ef4444' : '#534AB7'}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    style={{ transition: 'stroke-dashoffset 50ms linear' }}
                  />
                </svg>
              )}

              {/* Inner button */}
              <button 
                onMouseDown={startHold}
                onMouseUp={endHold}
                onMouseLeave={endHold}
                onTouchStart={(e) => { e.preventDefault(); startHold() }}
                onTouchEnd={endHold}
                disabled={isLoading}
                className="w-36 h-36 rounded-full flex flex-col items-center justify-center gap-1.5 text-white font-black shadow-2xl transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed relative z-10"
                style={{
                  background: safeIsClockedIn ? 'linear-gradient(135deg,#ef4444,#dc2626)' : 'linear-gradient(135deg,#534AB7,#1E1854)',
                  boxShadow: safeIsClockedIn ? '0 8px 32px rgba(239,68,68,0.35)' : '0 8px 32px rgba(83,74,183,0.35)',
                  transform: isHolding ? 'scale(1.04)' : 'scale(1)',
                }}>
                {isLoading
                  ? <Loader2 className="w-9 h-9 animate-spin" />
                  : <Fingerprint className="w-10 h-10" strokeWidth={1.5} />}
                <span className="text-[9px] font-black uppercase tracking-[0.15em]">
                  {isLoading ? (isGettingLocation ? 'Locating…' : 'Processing…') : isHolding ? 'Hold…' : safeIsClockedIn ? 'Clock Out' : 'Clock In'}
                </span>
                {!isLoading && !isHolding && (
                  <span className="text-[8px] text-white/50 font-medium">Hold to confirm</span>
                )}
              </button>
            </div>
          </div>
          {safeIsClockedIn && !isLoading && (
            <div className="absolute inset-0 rounded-full animate-ping opacity-10 pointer-events-none" style={{ backgroundColor: '#ef4444' }} />
          )}
          {!safeIsOnline && (
            <div className="absolute -top-1 -right-1 bg-amber-500 text-white px-2 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-lg pointer-events-none">
              <WifiOff className="w-3 h-3" /> Offline
            </div>
          )}
          {safePendingCount > 0 && (
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-lg whitespace-nowrap pointer-events-none">
              {safePendingCount} pending sync
            </div>
          )}
        </div>
      </div>
    </>
  )
}
