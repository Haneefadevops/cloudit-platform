import { test, expect } from '@playwright/test'
import { ensureAuthenticated } from '../helpers/auth'
import { apiDel, loginToApi } from '../helpers/touchorbit-api'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Block Next.js speculative RSC prefetches to avoid API throttle exhaustion.
    await page.route(/\?_rsc=/, route => route.abort())

    await ensureAuthenticated(page)
  })

  test('2.1 dashboard loads with greeting and widgets', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /good afternoon|good morning|good evening|dashboard/i }).first()
    ).toBeVisible()
  })

  test('2.2 Today\'s Attendance widget renders', async ({ page }) => {
    const widget = page.getByText(/Today's Attendance/i).first()
    await expect(widget).toBeVisible()
    await expect(page.getByText(/present today|Present/i).first()).toBeVisible()
  })

  test('2.3 Headcount widget renders', async ({ page }) => {
    const widget = page.getByText(/Headcount/i).first()
    await expect(widget).toBeVisible()
    await expect(page.getByText(/Total Active Staff|Active employees/i).first()).toBeVisible()
  })

  test('2.4 Pending Leave widget renders', async ({ page }) => {
    const widget = page.getByText(/Pending Leave/i).first()
    await expect(widget).toBeVisible()
  })

  test('2.5 Add Widget drawer opens', async ({ page }) => {
    const customizeButton = page.getByRole('button', { name: /customize|add widget/i }).first()
    await expect(customizeButton).toBeVisible()
    await customizeButton.click()

    const drawer = page.locator('body').getByText(/widgets|add widget|available widgets/i).first()
    await expect(drawer).toBeVisible({ timeout: 5000 })
  })

  test('2.6 remove widget from dashboard persists after reload', async ({ page, request }) => {
    const widget = page.getByText(/Recent Clock-Ins/i).first()
    await expect(widget).toBeVisible()

    // Enter customize mode.
    const customizeButton = page.getByRole('button', { name: /customize/i }).first()
    await customizeButton.click()

    // Click the Remove widget button for Recent Clock-Ins.
    const widgetCard = widget.locator('xpath=ancestor::*[contains(@class, "rounded-2xl") or contains(@class, "rounded-xl")][1]')
    const removeButton = widgetCard.getByRole('button', { name: /Remove widget/i })
    await expect(removeButton).toBeVisible({ timeout: 5000 })
    await removeButton.click()

    // Save the layout change.
    await page.getByRole('button', { name: /save/i }).first().click()

    // After removal the widget should no longer be visible.
    await expect(page.getByText(/Recent Clock-Ins/i).first()).not.toBeVisible({ timeout: 5000 })

    await page.reload()
    await expect(page.getByText(/Recent Clock-Ins/i).first()).not.toBeVisible({ timeout: 10000 })

    const token = await loginToApi(request)
    await apiDel(request, token, '/dashboard/layout')
    await page.evaluate(() => {
      Object.keys(localStorage)
        .filter((key) => key.startsWith('touchorbit:dashboard:'))
        .forEach((key) => localStorage.removeItem(key))
    })
  })

  test('2.7 sidebar navigation links navigate to correct routes', async ({ page }) => {
    const routes = [
      { label: /Dashboard/i, path: '/' },
      { label: /Employees/i, path: '/employees' },
      { label: /Org Chart/i, path: '/employees/org-chart' },
      { label: /Leave Management/i, path: '/leave' },
      { label: /Attendance/i, path: '/attendance' },
      { label: /Overtime/i, path: '/overtime' },
      { label: /Calendar/i, path: '/calendar' },
    ]

    for (const route of routes) {
      const link = page.locator('aside, nav').getByRole('link').filter({ hasText: route.label }).first()
      if (await link.isVisible().catch(() => false)) {
        await link.click()
        await expect(page).toHaveURL(new RegExp(`\\${route.path}$`))
        await ensureAuthenticated(page)
      }
    }
  })

  test('2.8 notification bell opens panel', async ({ page }) => {
    const bell = page.locator('header').getByRole('button', { name: /Notifications/i })
    await expect(bell).toBeVisible()
    await bell.click()

    const panel = page.locator('body').getByText(/notifications|no notifications/i).first()
    await expect(panel).toBeVisible({ timeout: 5000 })
  })

  test('2.9 mark all notifications read', async ({ page }) => {
    const bell = page.locator('header').getByRole('button', { name: /Notifications/i })
    await bell.click()

    const markAllRead = page.locator('body').getByText(/mark all read/i).first()
    if (await markAllRead.isVisible().catch(() => false)) {
      await markAllRead.click()
      await expect(page.locator('body').getByText(/no notifications/i).first()).toBeVisible({ timeout: 5000 })
    }
  })

  test('2.10 user menu opens with profile/sign-out options', async ({ page }) => {
    const userMenuTrigger = page.locator('header').getByText(/Fakrith/i).first().locator('..')
    await expect(userMenuTrigger).toBeVisible()
    await userMenuTrigger.click()

    const menuItem = page
      .locator('body')
      .getByText(/profile|account|settings|logout|sign out/i)
      .first()
    await expect(menuItem).toBeVisible({ timeout: 5000 })
  })
})
