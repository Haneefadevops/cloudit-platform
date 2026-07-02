'use client'

import Link from 'next/link'
import { ArrowLeft, LogOut, Search } from 'lucide-react'
import { BottomNav } from './bottom-nav'
import { NotificationBell } from './notification-bell'
import { useAuth } from '@/lib/auth'

interface EmployeeLayoutProps {
  children: React.ReactNode
  title?: string
  backHref?: string
  showGreeting?: boolean
  hideHeader?: boolean
}

export function EmployeeLayout({ children, title, backHref, showGreeting = true, hideHeader = false }: EmployeeLayoutProps) {
  const { userProfile, signOut } = useAuth()
  
  const firstName = userProfile?.first_name || 'Kasun'
  const initials = firstName.charAt(0)

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: '#F8F7F9', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      {/* Mobile Header */}
      {!hideHeader && (
        <header className="bg-white border-b sticky top-0 z-40" style={{ borderColor: '#F1F0F4' }}>
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {backHref && backHref !== '/' ? (
                <Link
                  href={backHref}
                  className="p-2 hover:bg-gray-50 rounded-xl transition-colors"
                  style={{ color: '#534AB7' }}
                >
                  <ArrowLeft className="w-6 h-6" />
                </Link>
              ) : showGreeting ? (
                <div>
                  <div style={{ fontSize: '13px', color: '#9CA3AF', fontWeight: 500 }}>Good morning,</div>
                  <div style={{ fontSize: '17px', fontWeight: 800, color: '#111827' }}>{firstName}</div>
                </div>
              ) : (
                <h1 style={{ fontSize: '17px', fontWeight: 800, color: '#111827' }}>{title}</h1>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Link href="/search" className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                <Search className="w-5 h-5" />
              </Link>
              <NotificationBell />
              <div className="relative">
                <div 
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
                  style={{ backgroundColor: '#F3E8FF', color: '#7C3AED', fontSize: '15px', fontWeight: 700 }}
                >
                  {initials}
                </div>
                <div 
                  className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white"
                  style={{ backgroundColor: '#EF4444' }}
                />
              </div>
              <button
                onClick={() => signOut()}
                className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Content */}
      <main className="animate-in fade-in duration-500">
        {children}
      </main>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  )
}
