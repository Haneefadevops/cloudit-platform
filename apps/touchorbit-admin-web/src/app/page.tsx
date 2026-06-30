'use client'

import { useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { DashboardLayout } from '@/components/dashboard-layout'
import Link from 'next/link'
import { useAutoLinkAdmin } from '@/hooks/use-auto-link-admin'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { LayoutDashboard, Loader2 } from 'lucide-react'

const ConfigurableDashboard = dynamic(
  () => import('@/components/configurable-dashboard').then(m => m.ConfigurableDashboard),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={24} className="text-purple-500 animate-spin" />
          <span className="text-[13px] text-gray-400 font-medium">Loading your dashboard…</span>
        </div>
      </div>
    ),
  }
)

export default function DashboardPage() {
  const { isLoaded, isSignedIn } = useAuth()
  const { isLinking, needsSetup } = useAutoLinkAdmin()
  const router = useRouter()

  useEffect(() => {
    if (isLoaded && isSignedIn && needsSetup) {
      router.push('/setup')
    }
  }, [isLoaded, isSignedIn, needsSetup, router])

  if (!isLoaded || isLinking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="text-purple-500 animate-spin" />
          <span className="text-[13px] text-gray-400 font-medium">Loading…</span>
        </div>
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white rounded-[20px] p-10 text-center max-w-[360px] w-full" style={{ boxShadow: '0 8px 32px rgba(26,23,39,0.08)' }}>
          <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center mx-auto mb-5">
            <LayoutDashboard size={22} className="text-purple-500" />
          </div>
          <h1 className="text-[22px] font-extrabold mb-1.5 text-gray-900">TouchOrbit Admin</h1>
          <p className="text-[13px] text-gray-400 mb-7">Sign in to access your dashboard</p>
          <Link
            href="/login"
            className="inline-block w-full px-6 py-3 rounded-lg text-white text-[13px] font-bold bg-purple-500 hover:bg-purple-600 transition-colors text-center active:scale-[0.98]"
          >
            Sign In to Continue
          </Link>
        </div>
      </div>
    )
  }

  if (needsSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="text-purple-500 animate-spin" />
          <span className="text-[13px] text-gray-400 font-medium">Setting up your workspace…</span>
        </div>
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full bg-gray-50">
        <ConfigurableDashboard />
      </div>
    </DashboardLayout>
  )
}
