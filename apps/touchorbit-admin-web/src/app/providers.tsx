'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { useState } from 'react'
import { WhiteLabelInjector } from '@/components/brand/white-label-injector'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10 * 1000, // 10 seconds - live attendance updates
            refetchOnWindowFocus: true,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <WhiteLabelInjector />
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'font-sans',
          duration: 4000,
        }}
        richColors
      />
    </QueryClientProvider>
  )
}
