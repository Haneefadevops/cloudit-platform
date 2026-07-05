'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type CustomFieldType = 'text' | 'number' | 'date' | 'dropdown' | 'checkbox'

export interface CustomFieldDefinition {
  id: string
  fieldKey: string
  fieldLabel: string
  fieldType: CustomFieldType
  options?: Record<string, unknown>
  required: boolean
  order: number
}

export type CustomFieldValue = {
  fieldKey: string
  value: unknown
}

export type FeatureFlag = {
  featureKey: string
  enabled: boolean
}

export type WhiteLabelConfig = {
  logoUrl: string | null
  faviconUrl: string | null
  primaryColor: string | null
  dateFormat: string
  currency: string
  supportEmail: string | null
}

const DEFAULT_WHITE_LABEL: WhiteLabelConfig = {
  logoUrl: null,
  faviconUrl: null,
  primaryColor: null,
  dateFormat: 'DD/MM/YYYY',
  currency: 'LKR',
  supportEmail: null,
}

/**
 * Fetch organization custom fields for the current product tenant.
 *
 * NOTE: TouchOrbit API does not yet expose an endpoint that returns the
 * Platform-managed OrganizationCustomField config. This hook calls the
 * intended contract (`GET /api/custom-fields`) and falls back to an empty
 * list until the endpoint is implemented.
 */
export function useCustomFields(entity?: string) {
  return useQuery({
    queryKey: ['custom-fields', entity],
    queryFn: async () => {
      const query = entity ? `?entity=${encodeURIComponent(entity)}` : ''
      const result = await api.get<CustomFieldDefinition[]>(`/custom-fields${query}`)
      if (!result.ok) {
        return []
      }
      return result.data || []
    },
  })
}

/**
 * Fetch feature flags for the current organization.
 *
 * NOTE: TouchOrbit API does not yet expose an endpoint for the
 * Platform-managed OrganizationFeatureFlag config. This hook calls the
 * intended contract (`GET /api/feature-flags`) and falls back to an empty
 * list until the endpoint is implemented.
 */
export function useFeatureFlags() {
  return useQuery({
    queryKey: ['feature-flags'],
    queryFn: async () => {
      const result = await api.get<FeatureFlag[]>('/feature-flags')
      if (!result.ok) {
        return []
      }
      return result.data || []
    },
  })
}

export function useIsFeatureEnabled(featureKey: string) {
  const { data = [] } = useFeatureFlags()
  return data.some((f) => f.featureKey === featureKey && f.enabled)
}

/**
 * Fetch white-label config for the current organization.
 *
 * NOTE: TouchOrbit API does not yet expose a dedicated white-label endpoint.
 * This hook calls the intended contract (`GET /api/white-label`) and falls
 * back to defaults.
 */
export function useWhiteLabel() {
  return useQuery({
    queryKey: ['white-label'],
    queryFn: async () => {
      const result = await api.get<WhiteLabelConfig>('/white-label')
      if (!result.ok) {
        return DEFAULT_WHITE_LABEL
      }
      return { ...DEFAULT_WHITE_LABEL, ...(result.data || {}) }
    },
  })
}
