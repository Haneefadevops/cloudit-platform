import { test as setup, expect } from '@playwright/test'
import { ensureSeedEmployee } from './helpers/touchorbit-api'

setup('seed TouchOrbit frontend test data', async ({ request }) => {
  setup.setTimeout(180000)

  const seed = await ensureSeedEmployee(request)

  expect(seed.employee.email).toMatch(/@/)
  expect(seed.employee.id).toBeTruthy()
})
