'use client'
import { useEffect } from 'react'

export function UnregisterServiceWorkers() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(r => r.forEach(reg => reg.unregister()))
    }
  }, [])
  return null
}
