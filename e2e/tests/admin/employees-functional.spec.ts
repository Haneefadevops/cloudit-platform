import { test, expect } from '@playwright/test'

function uniqueEmployee() {
  const stamp = Date.now()
  return {
    firstName: 'E2ECreate',
    lastName: String(stamp).slice(-6),
    email: `e2e.create.${stamp}@touchorbit.test`,
    phone: '+94770000002',
    jobTitle: 'E2E Functional Tester',
    department: 'Quality Assurance',
    salary: '135000',
  }
}

async function waitForEmployeesPage(page: any) {
  await page.goto('/employees')
  await page.getByRole('heading', { name: /Employees/i }).first().waitFor({
    state: 'visible',
    timeout: 15000,
  })
  await page.getByText(/No employees found|Search employees/i).first().waitFor({
    state: 'visible',
    timeout: 10000,
  })
}

test.describe('Employees functional workflows', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\?_rsc=/, route => route.abort())
  })

  test('F3.1 creates employee from Add Employee dialog and finds it in the list', async ({ page }) => {
    const employee = uniqueEmployee()

    await waitForEmployeesPage(page)
    await page.getByRole('button', { name: /add employee/i }).first().click()

    const dialog = page.locator('form').filter({
      has: page.getByText(/First Name/i),
    }).first()
    await expect(dialog).toBeVisible()

    await dialog.locator('#first_name').fill(employee.firstName)
    await dialog.locator('#last_name').fill(employee.lastName)
    await dialog.locator('#email').fill(employee.email)
    await dialog.locator('#phone').fill(employee.phone)
    await dialog.locator('#job_title').fill(employee.jobTitle)
    await dialog.locator('#basic_salary').fill(employee.salary)

    const departmentSelect = dialog.locator('#department_id')
    const departmentOptions = await departmentSelect.locator('option').count()
    if (departmentOptions > 1) {
      await departmentSelect.selectOption({ index: 1 })
    }

    await dialog.getByRole('button', { name: /^Add Employee$/i }).click()

    await expect(dialog).not.toBeVisible({ timeout: 15000 })

    const localSearch = page.getByRole('textbox', {
      name: /Search employees.*press/i,
    })
    await localSearch.fill(employee.email)

    await expect(
      page.getByText(new RegExp(`${employee.firstName}\\s+${employee.lastName}`, 'i')).first(),
    ).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(employee.jobTitle).first()).toBeVisible()
  })
})
