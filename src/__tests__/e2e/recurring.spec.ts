import { test, expect, type ElectronApplication, type Page, _electron as electron } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createTempUserDataDir } from '../main/ipc.harness'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function waitForDbReady(page: Page) {
  for (let i = 0; i < 20; i++) {
    const ok = await page.evaluate(async () => {
      try {
        await window.electronAPI.lists.getAll()
        return true
      } catch {
        return false
      }
    })
    if (ok) return
    await page.waitForTimeout(500)
  }
  throw new Error('Database did not become ready within 10s')
}

async function createAndSelectList(page: Page, name: string) {
  const taskFormCancel = page.locator('[data-testid="task-form-cancel"]')
  if (await taskFormCancel.count() > 0) {
    await taskFormCancel.click()
  }

  const listFormCancel = page.locator('[data-testid="list-form-cancel"]')
  if (await listFormCancel.count() > 0) {
    await listFormCancel.click()
  }

  await page.click('[data-testid="add-list-button"]')
  await page.fill('[data-testid="list-form-input"]', name)
  await page.click('[data-testid="list-form-save"]')

  const newListItem = page.locator('[data-testid="sidebar-item"]').filter({
    has: page.locator('[data-testid="sidebar-item-name"]', { hasText: name })
  })
  await expect(newListItem).toBeVisible({ timeout: 10000 })
  await newListItem.click()

  await expect(page.locator('.main-header h1')).toHaveText(name, { timeout: 10000 })

  const listToggle = page.locator('[data-testid="view-toggle-list"]')
  if (await listToggle.count() > 0) {
    await listToggle.click()
  }

  await expect(page.locator('[data-testid="task-list-empty"]')).toBeVisible({ timeout: 10000 })
}

async function createRecurringTask(
  page: Page,
  title: string,
  dueDate: string,
  recurrence: string,
  endDate: string
) {
  await page.click('[data-testid="add-task-button"]')
  await page.fill('[data-testid="task-form-title"]', title)
  await page.fill('[data-testid="task-form-due-date"]', dueDate)
  await page.selectOption('[data-testid="task-form-recurrence"]', recurrence)
  await page.fill('[data-testid="task-form-recurrence-end-date"]', endDate)
  await page.click('[data-testid="task-form-save"]')
}

async function openTaskEdit(page: Page, index: number) {
  const taskItem = page.locator('[data-testid="task-item"]').nth(index)
  await taskItem.hover()
  await taskItem.locator('[data-testid="task-edit-button"]').click()
}

test.describe('Recurring and Long-Duration Tasks', () => {
  let electronApp: ElectronApplication
  let listCounter = 0

  test.beforeAll(async () => {
    const userDataDir = createTempUserDataDir('todolist-recurring-e2e-')
    electronApp = await electron.launch({
      args: [path.resolve(__dirname, '../../../out/main/main.js')],
      env: {
        ...process.env,
        TODO_USER_DATA_DIR: userDataDir
      }
    })
    const page = await electronApp.firstWindow()
    await waitForDbReady(page)
  })

  test.afterAll(async () => {
    await electronApp.close()
  })

  test.beforeEach(async () => {
    const page = await electronApp.firstWindow()
    listCounter++
    await createAndSelectList(page, `Recurring List ${listCounter}`)
  })

  test('creates a recurring task with fixed due and end dates', async () => {
    const page = await electronApp.firstWindow()
    await createRecurringTask(page, 'Daily recurring', '2026-07-16', 'daily', '2026-07-31')
    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(1, { timeout: 10000 })
    await expect(page.locator('[data-testid="task-title"]').first()).toHaveText('Daily recurring')
    await expect(page.locator('[data-testid="task-recurrence"]').first()).toHaveText('Daily')
  })

  test('completing a daily recurring task advances the due date by one day', async () => {
    const page = await electronApp.firstWindow()
    await createRecurringTask(page, 'Daily recurring', '2026-07-16', 'daily', '2026-07-31')
    await page.locator('[data-testid="task-checkbox"]').first().click()
    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(2, { timeout: 10000 })

    await openTaskEdit(page, 1)
    await expect(page.locator('[data-testid="task-form"]')).toBeVisible()
    await expect(page.locator('[data-testid="task-form-due-date"]')).toHaveValue('2026-07-17')
    await expect(page.locator('[data-testid="task-form-title"]')).toHaveValue('Daily recurring')
    await page.click('[data-testid="task-form-cancel"]')
  })

  test('completing a weekly recurring task advances the due date by seven days', async () => {
    const page = await electronApp.firstWindow()
    await createRecurringTask(page, 'Weekly recurring', '2026-07-16', 'weekly', '2026-08-31')
    await page.locator('[data-testid="task-checkbox"]').first().click()
    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(2, { timeout: 10000 })

    await openTaskEdit(page, 1)
    await expect(page.locator('[data-testid="task-form-due-date"]')).toHaveValue('2026-07-23')
    await page.click('[data-testid="task-form-cancel"]')
  })

  test('completing a monthly recurring task from Jan 31 clamps to Feb 28', async () => {
    const page = await electronApp.firstWindow()
    await createRecurringTask(page, 'Monthly recurring', '2026-01-31', 'monthly', '2026-12-31')
    await page.locator('[data-testid="task-checkbox"]').first().click()
    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(2, { timeout: 10000 })

    await openTaskEdit(page, 1)
    await expect(page.locator('[data-testid="task-form-due-date"]')).toHaveValue('2026-02-28')
    await page.click('[data-testid="task-form-cancel"]')
  })

  test('creates a long-duration task with start and end dates', async () => {
    const page = await electronApp.firstWindow()
    await page.click('[data-testid="add-task-button"]')
    await page.fill('[data-testid="task-form-title"]', 'Long duration')
    await page.fill('[data-testid="task-form-start-date"]', '2026-07-10')
    await page.fill('[data-testid="task-form-end-date"]', '2026-07-20')
    await page.click('[data-testid="task-form-save"]')
    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(1, { timeout: 10000 })

    await openTaskEdit(page, 0)
    await expect(page.locator('[data-testid="task-form-start-date"]')).toHaveValue('2026-07-10')
    await expect(page.locator('[data-testid="task-form-end-date"]')).toHaveValue('2026-07-20')
    await page.click('[data-testid="task-form-cancel"]')
  })

  test('blocks saving a task when end date is before start date', async () => {
    const page = await electronApp.firstWindow()
    await page.click('[data-testid="add-task-button"]')
    await page.fill('[data-testid="task-form-title"]', 'Invalid duration')
    await page.fill('[data-testid="task-form-start-date"]', '2026-07-20')
    await page.fill('[data-testid="task-form-end-date"]', '2026-07-10')
    await page.click('[data-testid="task-form-save"]')
    await expect(page.locator('[data-testid="task-form-duration-error"]')).toBeVisible()
    await expect(page.locator('[data-testid="task-form-duration-error"]')).toHaveText(
      'Start date must be before or equal to end date'
    )
    await page.click('[data-testid="task-form-cancel"]')
  })
})
