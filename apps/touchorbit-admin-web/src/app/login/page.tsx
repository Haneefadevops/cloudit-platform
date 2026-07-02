'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import Link from 'next/link'
import { Users, TrendingUp, Shield, Eye, EyeOff, Mail, Lock } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [showPassword, setShowPassword] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Please enter both email and password')
      return
    }
    setIsLoading(true)
    try {
      const result = await api.post('/auth/login', { email, password })
      if (!result.ok) {
        toast.error(result.error || 'Failed to sign in')
        return
      }
      if (rememberMe) {
        localStorage.setItem('touchorbit_remember_me', 'true')
      } else {
        localStorage.setItem('touchorbit_remember_me', 'false')
        sessionStorage.setItem('touchorbit_session_active', 'true')
      }
      toast.success('Signed in successfully!')
      router.push('/')
      router.refresh()
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error('Enter your email address first')
      return
    }
    toast.info('Please contact your administrator to reset your password.')
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
            HR &amp; Attendance,<br />simplified for Sri Lanka
          </h2>
          <p className="text-[14px] leading-relaxed max-w-[300px] mb-10" style={{ color: 'rgba(255,255,255,0.5)' }}>
            GPS clock-in, live attendance, payroll, leave — all in one platform.
          </p>

          <div className="space-y-3">
            {[
              { icon: Users, title: 'Workforce Visibility', desc: 'See who\'s in, who\'s late, and who\'s absent — live' },
              { icon: TrendingUp, title: 'Actionable Insights', desc: 'Reports and trends to make smarter HR decisions' },
              { icon: Shield, title: 'Secure & Compliant', desc: 'Role-based access control across your organization' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-center gap-3 rounded-xl p-[14px]" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(167,139,250,0.15)' }}>
                  <Icon size={16} className="text-purple-400" />
                </div>
                <div>
                  <p className="text-white text-[13px] font-semibold">{title}</p>
                  <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>© 2026 TouchOrbit Technologies (Pvt) Ltd</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6" style={{ backgroundColor: '#F8F7F9' }}>
        <div className="w-full max-w-[400px]">
          <div className="bg-white rounded-[20px] p-10" style={{ boxShadow: '0 8px 32px rgba(26,23,39,0.08)' }}>
            <div className="mb-8">
              <h1 className="text-[24px] font-extrabold text-gray-900 mb-1.5">Welcome back</h1>
              <p className="text-[13px] text-gray-400">Sign in to your TouchOrbit workspace</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-[12px] font-semibold mb-1.5 text-gray-700">Work Email</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@company.lk"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-[11px] text-[13px] rounded-lg outline-none transition-all bg-white text-gray-900 placeholder-gray-400 border-[1.5px] border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[12px] font-semibold text-gray-700">Password</label>
                  <button type="button" onClick={handleForgotPassword} className="text-[12px] font-semibold text-purple-500 hover:text-purple-600 transition-colors">
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-[11px] text-[13px] rounded-lg outline-none transition-all bg-white text-gray-900 placeholder-gray-400 border-[1.5px] border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <div
                  onClick={() => setRememberMe(!rememberMe)}
                  className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer ${
                    rememberMe ? 'bg-purple-500' : 'bg-white border-[1.5px] border-gray-300'
                  }`}
                >
                  {rememberMe && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span className="text-[13px] text-gray-600">Keep me signed in for 30 days</span>
              </label>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-[13px] rounded-lg text-white text-[14px] font-bold transition-all mt-2 disabled:opacity-50 disabled:cursor-not-allowed bg-purple-500 hover:bg-purple-600 active:scale-[0.98]"
              >
                {isLoading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

            <p className="text-center text-[12px] mt-6 text-gray-400">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="font-semibold text-purple-500 hover:text-purple-600 transition-colors">Create an organization</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
