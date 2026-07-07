export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || ''

export function getCookieDomain(host: string): string | undefined {
  // Localhost cannot set a Domain attribute with a port.
  if (!host || host.startsWith('localhost')) {
    return undefined
  }
  const hostname = host.split(':')[0]
  const parts = hostname.split('.')
  // For hosts like to-admin.cloudit.lk, share the cookie across *.cloudit.lk.
  // For hosts like example.com, keep it host-only.
  if (parts.length > 2) {
    return `.${parts.slice(-2).join('.')}`
  }
  return hostname
}

export function parseJsonBody(text: string): unknown {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

export const SESSION_COOKIE = {
  name: 'touchorbit_session',
  path: '/',
  maxAge: 7 * 24 * 60 * 60,
} as const
