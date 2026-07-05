'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { Eye, EyeOff, Lock, AlertCircle, CheckCircle } from 'lucide-react'

export default function SetPasswordPage() {
  return (
    <Suspense fallback={<SetPasswordSkeleton />}>
      <SetPasswordForm />
    </Suspense>
  )
}

function SetPasswordSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#F8F7F9' }}>
      <div className="w-full max-w-[400px] rounded-[20px] bg-white p-10 shadow-lg">
        <div className="h-6 w-3/4 animate-pulse rounded bg-gray-200" />
        <div className="mt-4 h-4 w-1/2 animate-pulse rounded bg-gray-200" />
        <div className="mt-8 h-10 w-full animate-pulse rounded bg-gray-200" />
        <div className="mt-4 h-10 w-full animate-pulse rounded bg-gray-200" />
      </div>
    </div>
  )
}

function SetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams?.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirmPassword?: string }>({})

  if (!token) {
    return <ErrorState title="Invalid invite link" message="This password reset link is missing a token. Please request a new invite." />
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldErrors({})

    const errors: { password?: string; confirmPassword?: string } = {}
    if (!password) {
      errors.password = 'Password is required'
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters'
    } else if (password.length > 128) {
      errors.password = 'Password must be less than 128 characters'
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match'
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setIsLoading(true)
    try {
      const result = await api.post<{ id: string; email: string; fullName: string; role: string; organizationId: string }>(
        '/auth/set-password',
        { token, password }
      )

      if (!result.ok) {
        toast.error(result.error || 'Failed to set password')
        return
      }

      setIsSuccess(true)
      toast.success('Password set successfully! Redirecting…')
      setTimeout(() => {
        router.push('/')
      }, 1500)
    } catch (error: any) {
      toast.error(error?.message || 'Failed to set password')
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6" style={{ backgroundColor: '#F8F7F9' }}>
        <div className="w-full max-w-[400px]">
          <div className="rounded-[20px] bg-white p-10 text-center shadow-lg">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
              <CheckCircle size={24} />
            </div>
            <h1 className="text-[24px] font-extrabold text-gray-900 mb-2">You're all set</h1>
            <p className="text-[13px] text-gray-500">Your password has been set. Redirecting to your dashboard…</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[480px] flex-col justify-between p-10 flex-shrink-0" style={{ backgroundColor: '#1E1854' }}>
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(167,139,250,0.2)' }}>
              <span className="text-purple-400 font-black text-base">T</span>
            </div>
            <div>
              <p className="text-white font-bold text-[15px]">TouchOrbit</p>
              <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.45)' }}>Admin Panel</p>
            </div>
          </div>

          <h2 className="text-white font-extrabold text-[28px] leading-snug mb-6 max-w-[320px]">
            Welcome to your workspace
          </h2>
          <p className="text-[14px] leading-relaxed max-w-[300px] mb-10" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Set a secure password to access your organization's HR dashboard.
          </p>
        </div>
        <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>© 2026 TouchOrbit Technologies (Pvt) Ltd</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6" style={{ backgroundColor: '#F8F7F9' }}>
        <div className="w-full max-w-[400px]">
          <div className="bg-white rounded-[20px] p-10" style={{ boxShadow: '0 8px 32px rgba(26,23,39,0.08)' }}>
            <div className="mb-8">
              <h1 className="text-[24px] font-extrabold text-gray-900 mb-1.5">Set your password</h1>
              <p className="text-[13px] text-gray-400">Create a secure password for your account</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[12px] font-semibold mb-1.5 text-gray-700">Password</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                    className="w-full pl-9 pr-10 py-[11px] text-[13px] rounded-lg outline-none transition-all bg-white text-gray-900 placeholder-gray-400 border-[1.5px] border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {fieldErrors.password && <p className="mt-1 text-[12px] text-red-500">{fieldErrors.password}</p>}
              </div>

              <div>
                <label className="block text-[12px] font-semibold mb-1.5 text-gray-700">Confirm Password</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    autoComplete="new-password"
                    className="w-full pl-9 pr-10 py-[11px] text-[13px] rounded-lg outline-none transition-all bg-white text-gray-900 placeholder-gray-400 border-[1.5px] border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {fieldErrors.confirmPassword && <p className="mt-1 text-[12px] text-red-500">{fieldErrors.confirmPassword}</p>}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-[13px] rounded-lg text-white text-[14px] font-bold transition-all mt-2 disabled:opacity-50 disabled:cursor-not-allowed bg-purple-500 hover:bg-purple-600 active:scale-[0.98]"
              >
                {isLoading ? 'Setting password…' : 'Set Password'}
              </button>
            </form>

            <p className="text-center text-[12px] mt-6 text-gray-400">
              Already have access?{' '}
              <Link href="/login" className="font-semibold text-purple-500 hover:text-purple-600 transition-colors">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function ErrorState({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6" style={{ backgroundColor: '#F8F7F9' }}>
      <div className="w-full max-w-[400px]">
        <div className="rounded-[20px] bg-white p-10 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertCircle size={24} />
          </div>
          <h1 className="text-[20px] font-extrabold text-gray-900 mb-2">{title}</h1>
          <p className="text-[13px] text-gray-500 mb-6">{message}</p>
          <Link
            href="/login"
            className="inline-block w-full rounded-lg bg-purple-500 py-[13px] text-center text-[14px] font-bold text-white transition-colors hover:bg-purple-600"
          >
            Go to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
