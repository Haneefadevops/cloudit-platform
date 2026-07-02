const API_URL = process.env.NEXT_PUBLIC_API_URL

export interface ApiResult<T> {
  ok: boolean
  data?: T
  error?: string
}

async function apiCall<T>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
  if (!API_URL) {
    return { ok: false, error: 'NEXT_PUBLIC_API_URL is not configured' }
  }

  try {
    const response = await fetch(`${API_URL}/api${path}`, {
      method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    let payload: unknown
    const text = await response.text()
    if (text) {
      try {
        payload = JSON.parse(text)
      } catch {
        payload = { message: text }
      }
    }

    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        const pathname = window.location.pathname
        const alreadyAuthPage =
          pathname.startsWith('/login') ||
          pathname.startsWith('/signup') ||
          pathname.startsWith('/reset-password')
        if (!alreadyAuthPage) {
          window.location.href = '/login'
        }
      }
      const message =
        (payload && typeof payload === 'object' && (payload as any).message) ||
        (payload && typeof payload === 'object' && (payload as any).error) ||
        'Unauthorized'
      return { ok: false, error: message }
    }

    if (!response.ok) {
      const message =
        (payload && typeof payload === 'object' && (payload as any).message) ||
        (payload && typeof payload === 'object' && (payload as any).error) ||
        response.statusText
      return { ok: false, error: message }
    }

    // Normalize backend envelope `{ ok: true, data: ... }`
    if (payload && typeof payload === 'object' && 'ok' in payload) {
      const envelope = payload as { ok: boolean; data?: T; message?: string; error?: string }
      if (envelope.ok) {
        return { ok: true, data: envelope.data }
      }
      return { ok: false, error: envelope.message || envelope.error || 'Request failed' }
    }

    return { ok: true, data: payload as T }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' }
  }
}

export const api = {
  get: <T>(path: string) => apiCall<T>('GET', path),
  post: <T>(path: string, body: unknown) => apiCall<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => apiCall<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => apiCall<T>('PATCH', path, body),
  del: <T>(path: string) => apiCall<T>('DELETE', path),
}
