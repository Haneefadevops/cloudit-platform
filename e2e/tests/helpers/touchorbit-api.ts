import type { APIRequestContext } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

export type SeedEmployee = {
  id: string
  email: string
  first_name: string
  last_name: string
  employee_number?: string
  job_title?: string
}

export type SeedState = {
  employee: SeedEmployee
  employeePassword: string
}

type ApiEnvelope<T> = {
  ok?: boolean
  data?: T
  error?: string
  message?: string
}

const sessionCookieName = 'touchorbit_session'

export const seedStatePath = resolve(__dirname, '../../.auth/seed.json')

export function getApiUrl(): string {
  const raw = process.env.E2E_API_URL?.trim()
  if (!raw) {
    throw new Error('E2E_API_URL must be set in e2e/.env to seed frontend E2E data')
  }

  return raw.replace(/\/api\/?$/, '').replace(/\/$/, '')
}

export async function loginToApi(request: APIRequestContext): Promise<string> {
  const email = process.env.E2E_ADMIN_EMAIL
  const password = process.env.E2E_ADMIN_PASSWORD

  if (!email || !password) {
    throw new Error('E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD must be set in e2e/.env')
  }

  const apiUrl = getApiUrl()
  let lastError = ''

  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await request.post(`${apiUrl}/api/auth/login`, {
      data: { email, password },
    })
    const payload = (await response.json().catch(() => null)) as
      | ApiEnvelope<{ token?: string }>
      | null

    if (response.ok() && payload?.ok && payload.data?.token) {
      return payload.data.token
    }

    lastError = payload?.error || payload?.message || response.statusText()
    if (response.status() === 429 && attempt < 3) {
      await new Promise((resolveRetry) => setTimeout(resolveRetry, 65000))
    }
  }

  throw new Error(`Could not authenticate to TouchOrbit API for seeding: ${lastError}`)
}

export async function apiGet<T>(
  request: APIRequestContext,
  token: string,
  path: string,
): Promise<T> {
  const response = await request.get(`${getApiUrl()}/api${path}`, {
    headers: { Cookie: `${sessionCookieName}=${token}` },
  })
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null

  if (!response.ok() || !payload?.ok) {
    const errorDetail =
      typeof payload?.error === 'string'
        ? payload.error
        : payload?.error
          ? JSON.stringify(payload.error)
          : undefined
    const messageDetail =
      typeof payload?.message === 'string'
        ? payload.message
        : payload?.message
          ? JSON.stringify(payload.message)
          : undefined
    throw new Error(errorDetail || messageDetail || response.statusText())
  }

  return payload.data as T
}

export async function apiPost<T>(
  request: APIRequestContext,
  token: string,
  path: string,
  data: unknown,
): Promise<T> {
  const response = await request.post(`${getApiUrl()}/api${path}`, {
    headers: { Cookie: `${sessionCookieName}=${token}` },
    data,
  })
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null

  if (!response.ok() || !payload?.ok) {
    const errorDetail =
      typeof payload?.error === 'string'
        ? payload.error
        : payload?.error
          ? JSON.stringify(payload.error)
          : undefined
    const messageDetail =
      typeof payload?.message === 'string'
        ? payload.message
        : payload?.message
          ? JSON.stringify(payload.message)
          : undefined
    throw new Error(errorDetail || messageDetail || response.statusText())
  }

  return payload.data as T
}

export async function apiDel<T>(
  request: APIRequestContext,
  token: string,
  path: string,
): Promise<T> {
  const response = await request.delete(`${getApiUrl()}/api${path}`, {
    headers: { Cookie: `${sessionCookieName}=${token}` },
  })
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null

  if (!response.ok() || !payload?.ok) {
    const errorDetail =
      typeof payload?.error === 'string'
        ? payload.error
        : payload?.error
          ? JSON.stringify(payload.error)
          : undefined
    const messageDetail =
      typeof payload?.message === 'string'
        ? payload.message
        : payload?.message
          ? JSON.stringify(payload.message)
          : undefined
    throw new Error(errorDetail || messageDetail || response.statusText())
  }

  return payload.data as T
}

export async function apiPatch<T>(
  request: APIRequestContext,
  token: string,
  path: string,
  data: unknown,
): Promise<T> {
  const response = await request.patch(`${getApiUrl()}/api${path}`, {
    headers: { Cookie: `${sessionCookieName}=${token}` },
    data,
  })
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null

  if (!response.ok() || !payload?.ok) {
    const errorDetail =
      typeof payload?.error === 'string'
        ? payload.error
        : payload?.error
          ? JSON.stringify(payload.error)
          : undefined
    const messageDetail =
      typeof payload?.message === 'string'
        ? payload.message
        : payload?.message
          ? JSON.stringify(payload.message)
          : undefined
    throw new Error(errorDetail || messageDetail || response.statusText())
  }

  return payload.data as T
}

export async function apiPut<T>(
  request: APIRequestContext,
  token: string,
  path: string,
  data: unknown,
): Promise<T> {
  const response = await request.put(`${getApiUrl()}/api${path}`, {
    headers: { Cookie: `${sessionCookieName}=${token}` },
    data,
  })
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null

  if (!response.ok() || !payload?.ok) {
    const errorDetail =
      typeof payload?.error === 'string'
        ? payload.error
        : payload?.error
          ? JSON.stringify(payload.error)
          : undefined
    const messageDetail =
      typeof payload?.message === 'string'
        ? payload.message
        : payload?.message
          ? JSON.stringify(payload.message)
          : undefined
    throw new Error(errorDetail || messageDetail || response.statusText())
  }

  return payload.data as T
}

export async function ensureSeedEmployee(
  request: APIRequestContext,
): Promise<SeedState> {
  const token = await loginToApi(request)
  const email =
    process.env.E2E_SEED_EMPLOYEE_EMAIL?.trim().toLowerCase() ||
    'e2e.employee@touchorbit.test'
  const employeePassword =
    process.env.E2E_SEED_EMPLOYEE_PASSWORD || 'TouchOrbitE2E!2026'

  const existing = await apiGet<SeedEmployee[]>(
    request,
    token,
    `/employees?search=${encodeURIComponent(email)}&limit=10`,
  )

  let employee = existing.find((row) => row.email?.toLowerCase() === email)

  if (!employee) {
    employee = await apiPost<SeedEmployee>(request, token, '/employees', {
      first_name: 'E2E',
      last_name: 'Employee',
      email,
      employee_number: 'E2E-EMPLOYEE',
      phone: '+94770000001',
      department: 'Quality Assurance',
      job_title: 'Frontend E2E Test Employee',
      hire_date: '2026-01-01',
      employment_status: 'active',
      basic_salary: 125000,
    })
  }

  await apiPost<{ reset?: boolean }>(
    request,
    token,
    `/employees/${employee.id}/reset-password`,
    { password: employeePassword },
  )

  const seedState: SeedState = { employee, employeePassword }
  mkdirSync(dirname(seedStatePath), { recursive: true })
  writeFileSync(seedStatePath, JSON.stringify(seedState, null, 2))

  return seedState
}
