'use client'

import { useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { Clock, MapPin, Star, Eye, EyeOff, User, Mail, Building2, Lock } from 'lucide-react'

export default function SignupPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [orgName, setOrgName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim() || !email.trim() || !password || !confirmPassword || !orgName.trim()) {
      toast.error('Please fill in all fields')
      return
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    setIsLoading(true)
    try {
      const nameParts = fullName.trim().split(' ')
      const firstName = nameParts[0]
      const lastName = nameParts.slice(1).join(' ') || ''

      const result = await api.post('/auth/register', {
        email,
        password,
        firstName,
        lastName,
        organizationName: orgName.trim(),
      })

      if (!result.ok) {
        toast.error(result.error || 'Failed to create organization')
        return
      }

      toast.success('Organization created! Welcome to TouchOrbit.')
      window.location.href = '/'
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create organization')
    } finally {
      setIsLoading(false)
    }
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
            HR &amp; Attendance, simplified for your team
          </h2>
          <p className="text-[14px] leading-relaxed max-w-[300px] mb-10" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Join 500+ Sri Lankan businesses using TouchOrbit to manage their workforce.
          </p>

          <div className="space-y-3">
            {[
              { icon: Clock, title: 'Real-time Attendance', desc: 'GPS-verified clock-ins with live tracking' },
              { icon: MapPin, title: 'Multi-branch Support', desc: 'Manage all your locations from one place' },
              { icon: Star, title: '14-day Free Trial', desc: 'No credit card required to get started' },
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
        <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>© 2026 TouchOrbit. All rights reserved.</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6" style={{ backgroundColor: '#F8F7F9' }}>
        <div className="w-full max-w-[400px]">
          <div className="bg-white rounded-[20px] p-10" style={{ boxShadow: '0 8px 32px rgba(26,23,39,0.08)' }}>
            <div className="mb-8">
              <h1 className="text-[24px] font-extrabold text-gray-900 mb-1.5">Create Organization</h1>
              <p className="text-[13px] text-gray-400">Start your 14-day free trial today</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[12px] font-semibold mb-1.5 text-gray-700">Full Name</label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    required
                    placeholder="John Doe"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    className="w-full pl-9 pr-3 py-[11px] text-[13px] rounded-lg outline-none transition-all bg-white text-gray-900 placeholder-gray-400 border-[1.5px] border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold mb-1.5 text-gray-700">Work Email</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    required
                    placeholder="you@company.lk"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-[11px] text-[13px] rounded-lg outline-none transition-all bg-white text-gray-900 placeholder-gray-400 border-[1.5px] border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold mb-1.5 text-gray-700">Organization Name</label>
                <div className="relative">
                  <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    required
                    placeholder="Acme Corporation"
                    value={orgName}
                    onChange={e => setOrgName(e.target.value)}
                    className="w-full pl-9 pr-3 py-[11px] text-[13px] rounded-lg outline-none transition-all bg-white text-gray-900 placeholder-gray-400 border-[1.5px] border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold mb-1.5 text-gray-700">Password</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-[11px] text-[13px] rounded-lg outline-none transition-all bg-white text-gray-900 placeholder-gray-400 border-[1.5px] border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold mb-1.5 text-gray-700">Confirm Password</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    required
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-[11px] text-[13px] rounded-lg outline-none transition-all bg-white text-gray-900 placeholder-gray-400 border-[1.5px] border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                    {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-[13px] rounded-lg text-white text-[14px] font-bold transition-all mt-2 disabled:opacity-50 disabled:cursor-not-allowed bg-purple-500 hover:bg-purple-600 active:scale-[0.98]"
              >
                {isLoading ? 'Creating…' : 'Get Started →'}
              </button>
            </form>

            <p className="text-center text-[12px] mt-6 text-gray-400">
              Already have an account?{' '}
              <Link href="/login" className="font-semibold text-purple-500 hover:text-purple-600 transition-colors">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
