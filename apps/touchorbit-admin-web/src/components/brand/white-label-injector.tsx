'use client'

import { useEffect } from 'react'
import { useWhiteLabel } from '@/hooks/useOrganizationConfig'

export function WhiteLabelInjector() {
  const { data: config } = useWhiteLabel()

  useEffect(() => {
    if (!config) return
    const root = document.documentElement

    if (config.primaryColor) {
      root.style.setProperty('--primary', config.primaryColor)
    }

    if (config.logoUrl) {
      root.style.setProperty('--organization-logo-url', `url(${config.logoUrl})`)
    }
  }, [config])

  return null
}
