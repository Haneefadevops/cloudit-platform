'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Key, Eye, EyeOff, Lock, CheckCircle2, AlertCircle } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const passwordRequirements = [
    { label: 'Minimum 8 characters', met: newPassword.length >= 8 },
    { label: 'At least one uppercase letter', met: /[A-Z]/.test(newPassword) },
    { label: 'At least one lowercase letter', met: /[a-z]/.test(newPassword) },
    { label: 'At least one number', met: /\d/.test(newPassword) },
    { label: 'At least one special character', met: /[!@#$%^&*]/.test(newPassword) },
  ]

  const isPasswordValid = passwordRequirements.every(req => req.met)
  const passwordsMatch = newPassword === confirmPassword && newPassword !== ''

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isPasswordValid) {
      toast.error('Password does not meet requirements')
      return
    }

    if (!passwordsMatch) {
      toast.error('Passwords do not match')
      return
    }

    setIsLoading(true)

    try {
      // 1. Update password
      const { error: passwordError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (passwordError) throw passwordError

      // 2. Update metadata to clear force_password_change flag
      const { error: metadataError } = await supabase.auth.updateUser({
        data: { 
          force_password_change: false,
          password_changed_at: new Date().toISOString()
        }
      })

      if (metadataError) throw metadataError

      // 3. Refresh the session to get updated metadata
      const { error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError) throw refreshError

      toast.success('Password updated successfully!')

      // 4. Wait a moment for session to propagate, then redirect with full page reload
      setTimeout(() => {
        window.location.href = '/'  // Force full reload to fetch fresh session
      }, 1000)  // Increased timeout to 1000ms for better session propagation
    } catch (error: any) {
      console.error('Password reset error:', error)
      toast.error(error.message || 'Failed to update password')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
            <Lock className="h-6 w-6 text-purple-600" />
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900">
            Change Your Password
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            For security, please set a new password for your account.
          </p>
        </div>

        <form className="mt-8 space-y-6 bg-white p-8 rounded-2xl shadow-xl border border-purple-100" onSubmit={handlePasswordChange}>
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none pr-12"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-purple-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                placeholder="••••••••"
              />
            </div>

            {/* Requirements Checklist */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Requirements</p>
              {passwordRequirements.map((req, i) => (
                <div key={i} className="flex items-center gap-2">
                  {req.met ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 text-gray-300" />
                  )}
                  <span className={`text-xs ${req.met ? 'text-gray-900' : 'text-gray-500'}`}>
                    {req.label}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-2 pt-1 border-t border-gray-200 mt-1">
                {passwordsMatch ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 text-gray-300" />
                )}
                <span className={`text-xs ${passwordsMatch ? 'text-gray-900' : 'text-gray-500'}`}>
                  Passwords match
                </span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !isPasswordValid || !passwordsMatch}
            className="w-full flex justify-center py-4 px-4 border border-transparent rounded-2xl shadow-lg text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
          >
            {isLoading ? 'Updating...' : 'Change Password & Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
