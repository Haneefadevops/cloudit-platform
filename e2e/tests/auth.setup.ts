import { test as setup, expect } from '@playwright/test'
import { resolve } from 'node:path'

const adminFile = resolve(__dirname, '../.auth/admin.json')

setup('authenticate as admin', async ({ page }) => {
  // Keep setup stable by authenticating through the same admin auth proxy
  // the UI uses, then save the browser context storage state for tests.
  setup.setTimeout(180000)

  const email = process.env.E2E_ADMIN_EMAIL
  const password = process.env.E2E_ADMIN_PASSWORD

  if (!email || !password) {
    throw new Error(
      'E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD must be set in e2e/.env',
    )
  }

  let authenticated = false
  let lastError = ''

  for (let attempt = 1; attempt <= 3; attempt++) {
    const loginRes = await page.context().request.post('/api/auth/login', {
      data: { email, password },
    })
    const loginBody = (await loginRes.json().catch(() => null)) as {
      ok?: boolean
      error?: string
      message?: string
    } | null

    if (loginRes.ok() && loginBody?.ok) {
      authenticated = true
      break
    }

    lastError =
      loginBody?.error || loginBody?.message || `HTTP ${loginRes.status()}`

    if (loginRes.status() === 429 && attempt < 3) {
      await page.waitForTimeout(65000)
    }
  }

  if (!authenticated) {
    throw new Error(`Failed to authenticate as admin: ${lastError}`)
  }

  const meRes = await page.context().request.get('/api/auth/me')
  const meBody = (await meRes.json().catch(() => null)) as {
    ok?: boolean
    data?: { role?: string }
  } | null

  expect(meRes.ok()).toBe(true)
  expect(meBody?.ok).toBe(true)
  expect(meBody?.data?.role).toMatch(
    /owner|super_admin|admin|manager|hr_admin|finance|dept_manager|branch_manager/,
  )

  await page.context().storageState({ path: adminFile })
})
