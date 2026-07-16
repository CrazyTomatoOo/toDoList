import { test, expect, type ElectronApplication, type Page, _electron as electron } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createTempUserDataDir } from '../main/ipc.harness'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const EVIDENCE_DIR = path.resolve(__dirname, '../../../.omo/evidence/periodic-long-quadrant')

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

async function createQuadrantTask(page: Page, title: string, urgent: boolean, important: boolean) {
  await page.click('[data-testid="add-task-button"]')
  await page.fill('[data-testid="task-form-title"]', title)
  if (urgent) {
    await page.check('[data-testid="task-form-urgent"]')
  }
  if (important) {
    await page.check('[data-testid="task-form-important"]')
  }
  await page.click('[data-testid="task-form-save"]')
}

test.describe('F3 final verification edge cases', () => {
  let electronApp: ElectronApplication
  let listCounter = 0

  test.beforeAll(async () => {
    const userDataDir = createTempUserDataDir('todolist-f3-e2e-')
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
    await createAndSelectList(page, `F3 List ${listCounter}`)
  })

  test('board view shows empty quadrants for a new list', async () => {
    const page = await electronApp.firstWindow()
    await page.click('[data-testid="view-toggle-board"]')
    await expect(page.locator('[data-testid="quadrant-board"]')).toBeVisible()

    for (const q of ['q1', 'q2', 'q3', 'q4']) {
      await expect(page.locator(`[data-testid="quadrant-${q}"]`)).toBeVisible()
      await expect(page.locator(`[data-testid="quadrant-${q}-empty"]`)).toBeVisible()
    }
  })

  test('quadrant board with tasks screenshot', async () => {
    const page = await electronApp.firstWindow()
    await createQuadrantTask(page, 'Q1 task', true, true)
    await createQuadrantTask(page, 'Q2 task', false, true)
    await createQuadrantTask(page, 'Q3 task', true, false)
    await createQuadrantTask(page, 'Q4 task', false, false)
    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(4, { timeout: 10000 })

    await page.click('[data-testid="view-toggle-board"]')
    await expect(page.locator('[data-testid="quadrant-board"]')).toBeVisible()

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'final-f3-board.png'),
      fullPage: true
    })
  })

  test('recurrence filter applied screenshot', async () => {
    const page = await electronApp.firstWindow()
    await createRecurringTask(page, 'Daily filter', '2026-07-16', 'daily', '2026-07-31')
    await page.click('[data-testid="add-task-button"]')
    await page.fill('[data-testid="task-form-title"]', 'Plain task')
    await page.click('[data-testid="task-form-save"]')
    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(2, { timeout: 10000 })

    await page.selectOption('[data-testid="filter-recurrence"]', 'daily')
    await page.waitForTimeout(500)
    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(1, { timeout: 5000 })
    await expect(page.locator('[data-testid="task-title"]').first()).toHaveText('Daily filter')

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'final-f3-filter.png'),
      fullPage: true
    })
  })

  test('invalid date error state screenshot', async () => {
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

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'final-f3-invalid-date.png'),
      fullPage: true
    })

    await page.click('[data-testid="task-form-cancel"]')
  })

  test('rapid toggles do not create duplicate recurring instances', async () => {
    const page = await electronApp.firstWindow()
    await createRecurringTask(page, 'Rapid toggle', '2026-07-16', 'daily', '2026-07-31')
    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(1, { timeout: 10000 })

    // Click twice in rapid succession without waiting for the first update to settle.
    await page.locator('[data-testid="task-checkbox"]').first().click()
    await page.locator('[data-testid="task-checkbox"]').first().click()

    await page.waitForTimeout(1000)
    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(2, { timeout: 10000 })

    const titles = await page.locator('[data-testid="task-title"]').allTextContents()
    expect(titles).toEqual(['Rapid toggle', 'Rapid toggle'])
  })
})
