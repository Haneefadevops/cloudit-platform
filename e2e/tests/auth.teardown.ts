import { test as teardown } from '@playwright/test'
import { rmSync } from 'node:fs'
import { resolve } from 'node:path'

const adminFile = resolve(__dirname, '../.auth/admin.json')

teardown('clean up authenticated state', async () => {
  try {
    rmSync(adminFile, { force: true })
  } catch {
    // ignore
  }
})
