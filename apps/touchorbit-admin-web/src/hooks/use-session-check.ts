'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export function useSessionCheck() {
  const pathname = usePathname()

  useEffect(() => {
    // Skip session check on auth pages (prevents infinite redirect loop)
    const isAuthPage = pathname === '/login' || pathname === '/signup'
    if (isAuthPage) {
      return
    }

    // Check if user wants to stay logged in
    const rememberMe = localStorage.getItem('touchorbit_remember_me')
    const sessionActive = sessionStorage.getItem('touchorbit_session_active')

    // If user doesn't want to stay logged in AND this is a new browser session
    if (rememberMe === 'false' && !sessionActive) {
      // Auto logout - user closed browser without "stay logged in"
      supabase.auth.signOut().then(() => {
        window.location.href = '/login'
      })
    } else if (rememberMe === 'false') {
      // Mark session as active for current browser session
      sessionStorage.setItem('touchorbit_session_active', 'true')
    }
  }, [pathname])
}
