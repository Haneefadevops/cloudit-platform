'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, X, RotateCcw, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface CameraCaptureProps {
  onCapture: (photoUrl: string) => void
  onCancel: () => void
  employeeId: string
}

export function CameraCapture({ onCapture, onCancel, employeeId }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Debug: Log state changes
  useEffect(() => {
    console.log('🎬 Camera state:', {
      hasStream: !!stream,
      hasPhoto: !!photo,
      hasError: !!error,
      buttonShouldShow: !photo,
      buttonShouldBeEnabled: !!stream && !error
    })
  }, [stream, photo, error])

  useEffect(() => {
    console.log('🎥 CameraCapture mounted, stream exists:', !!stream)
    // Only start camera if we don't already have a stream
    if (!stream) {
      startCamera()
    }
    return () => {
      console.log('🎥 CameraCapture unmounting, stopping camera')
      stopCamera()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function startCamera() {
    try {
      console.log('📷 Requesting camera access...')

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user', // Front camera
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })

      console.log('✅ Camera access granted')

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        // Ensure video plays
        await videoRef.current.play()
      }

      setStream(mediaStream)
      setError(null)
    } catch (err: any) {
      console.error('❌ Camera access error:', err)

      let errorMessage = 'Unable to access camera. '

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage += 'Please allow camera permission in your browser.'
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMessage += 'No camera found on your device.'
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMessage += 'Camera is being used by another app.'
      } else {
        errorMessage += 'Please check your camera settings.'
      }

      setError(errorMessage)
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }
  }

  function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0)

    // Convert to blob
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob)
        setPhoto(url)
        stopCamera()
      }
    }, 'image/jpeg', 0.85)
  }

  function retake() {
    setPhoto(null)
    startCamera()
  }

  async function confirmPhoto() {
    if (!photo || !canvasRef.current) return

    setUploading(true)

    try {
      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve) => {
        canvasRef.current!.toBlob((b) => resolve(b!), 'image/jpeg', 0.85)
      })

      // Generate unique filename
      const timestamp = new Date().getTime()
      const filename = `${employeeId}/${timestamp}.jpg`

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('attendance-selfies')
        .upload(filename, blob, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
        })

      if (error) throw error

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('attendance-selfies')
        .getPublicUrl(filename)

      onCapture(urlData.publicUrl)
    } catch (err) {
      console.error('Upload error:', err)
      setError('Failed to upload photo. Please try again.')
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 text-white p-4 flex justify-between items-center">
        <h2 className="text-lg font-semibold">Take Attendance Selfie</h2>
        <button
          onClick={onCancel}
          className="p-2 hover:bg-gray-800 rounded-full transition"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Camera View */}
      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
        {error ? (
          <div className="text-white text-center p-6">
            <Camera className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">{error}</p>
            <button
              onClick={startCamera}
              className="mt-4 px-6 py-2 bg-purple-600 rounded-lg hover:bg-purple-700 transition"
            >
              Try Again
            </button>
          </div>
        ) : photo ? (
          <img
            src={photo}
            alt="Captured"
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="max-w-full max-h-full object-contain transform scale-x-[-1]"
            />

            {/* Face guide overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-80 border-4 border-white border-dashed rounded-full opacity-30"></div>
            </div>
          </>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Controls */}
      <div className="bg-gray-900 p-6 flex flex-col justify-center items-center gap-4 h-[160px] flex-shrink-0">
        {photo ? (
          <div className="flex gap-6">
            <button
              onClick={retake}
              disabled={uploading}
              className="flex flex-col items-center gap-2 text-white hover:text-purple-400 transition disabled:opacity-50"
            >
              <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center">
                <RotateCcw className="w-8 h-8" />
              </div>
              <span className="text-sm">Retake</span>
            </button>

            <button
              onClick={confirmPhoto}
              disabled={uploading}
              className="flex flex-col items-center gap-2 text-white hover:text-green-400 transition disabled:opacity-50"
            >
              <div className="w-16 h-16 rounded-full bg-green-600 flex items-center justify-center">
                {uploading ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Check className="w-8 h-8" />
                )}
              </div>
              <span className="text-sm">{uploading ? 'Uploading...' : 'Confirm'}</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 w-full">
            <button
              onClick={capturePhoto}
              disabled={!stream || error !== null}
              className={`
                w-20 h-20 rounded-full border-4 transition-all
                flex items-center justify-center shadow-xl
                ${!stream || error !== null
                  ? 'bg-gray-600 border-gray-500 cursor-not-allowed opacity-50'
                  : 'bg-white border-white hover:bg-gray-100 hover:scale-110 active:scale-95'
                }
              `}
              aria-label="Take photo"
            >
              <Camera className={`w-10 h-10 ${!stream || error !== null ? 'text-gray-400' : 'text-gray-900'}`} />
            </button>
            {!stream && !error && (
              <p className="text-white text-sm font-medium">Starting camera...</p>
            )}
            {stream && !error && (
              <p className="text-white text-base font-semibold animate-pulse">Tap to capture</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
