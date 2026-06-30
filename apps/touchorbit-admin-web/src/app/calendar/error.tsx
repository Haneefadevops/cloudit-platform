'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function CalendarErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Calendar page error:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
        <AlertTriangle size={28} className="text-red-500" />
      </div>
      <h2 className="text-lg font-black text-[#1A1727] mb-2">Something went wrong</h2>
      <p className="text-sm text-[#9CA3AF] max-w-md mb-6">
        The calendar failed to load. This might be a temporary issue. Try refreshing the page.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="flex items-center gap-2 px-5 py-3 bg-[#534AB7] text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-[#1E1854] transition-all active:scale-95"
        >
          <RefreshCw size={14} /> Try Again
        </button>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-3 border border-[#F1F0F4] text-[#374151] rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-[#F8F7F9] transition-all"
        >
          Reload Page
        </button>
      </div>
      {process.env.NODE_ENV === 'development' && (
        <pre className="mt-8 text-left text-xs bg-[#1A1727] text-white p-4 rounded-xl max-w-2xl overflow-auto">
          {error.message}
          {error.stack}
        </pre>
      )}
    </div>
  )
}
