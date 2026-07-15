'use client'

import { useState } from 'react'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { Lock, Mail } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

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
        console.error('Login error:', result.error)
        toast.error(result.error || 'Failed to sign in')
        return
      }

      toast.success('Signed in successfully!')
      window.location.replace('/')
    } catch (error) {
      console.error('Login error:', error)
      toast.error('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F7F9] font-['Plus_Jakarta_Sans']">
      <div className="h-64 flex flex-col items-center justify-center p-8 text-white relative overflow-hidden" style={{ background: 'linear-gradient(160deg, #1E1854, #534AB7)' }}>
        <div className="absolute top-[-20%] right-[-10%] w-64 h-64 rounded-full bg-white opacity-5" />
        <div className="absolute bottom-[-10%] left-[-5%] w-48 h-48 rounded-full bg-white opacity-5" />
        
        <h1 className="text-4xl font-black tracking-tighter mb-2">TouchOrbit</h1>
        <p className="text-purple-100/70 font-medium text-sm">Empowering Your Workforce</p>
      </div>

      <div className="flex-1 flex flex-col items-center px-6 -mt-12">
        <div className="w-full max-w-md bg-white rounded-[32px] shadow-xl shadow-purple-900/5 p-8 border border-[#F1F0F4]">
          <div className="mb-8">
            <h2 className="text-2xl font-extrabold text-[#1A1727]">Welcome Back</h2>
            <p className="text-[#9CA3AF] text-sm font-medium mt-1">Sign in to manage your work</p>
          </div>

          <form className="space-y-5" onSubmit={handleLogin}>
            <div className="space-y-1">
              <label className="text-[11px] font-black text-[#9CA3AF] uppercase tracking-widest ml-1">Email Address</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#D1D5DB]">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-14 pl-12 pr-4 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] focus:border-[#534AB7] focus:ring-4 focus:ring-[#534AB7]/10 outline-none transition-all"
                  placeholder="name@company.lk"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-black text-[#9CA3AF] uppercase tracking-widest ml-1">Password</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#D1D5DB]">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-14 pl-12 pr-4 bg-[#F8F7F9] border border-[#F1F0F4] rounded-2xl text-sm font-bold text-[#1A1727] focus:border-[#534AB7] focus:ring-4 focus:ring-[#534AB7]/10 outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-14 bg-[#534AB7] text-white rounded-2xl font-bold text-sm shadow-lg shadow-[#534AB7]/30 hover:bg-[#1E1854] disabled:opacity-50 disabled:scale-100 active:scale-[0.98] transition-all"
              >
                {isLoading ? 'SIGNING IN...' : 'SIGN IN'}
              </button>
            </div>
          </form>

          <div className="mt-8 pt-6 border-t border-[#F1F0F4] text-center">
            <p className="text-xs text-[#9CA3AF] font-medium leading-relaxed">
              Don't have an account? <br/>
              <span className="text-[#534AB7] font-bold">Contact your HR administrator</span>
            </p>
          </div>
        </div>
        
        <div className="mt-8 text-center text-[10px] font-bold text-[#D1D5DB] uppercase tracking-[0.2em]">
          TouchOrbit v2.0
        </div>
      </div>
    </div>
  )
}
