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

async function createTask(page: Page, title: string, priority: string, description?: string) {
  await page.click('[data-testid="add-task-button"]')
  await page.fill('[data-testid="task-form-title"]', title)
  if (description) {
    await page.fill('[data-testid="task-form-description"]', description)
  }
  await page.selectOption('[data-testid="task-form-priority"]', priority)
  await page.click('[data-testid="task-form-save"]')
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

test.describe('Search and Filter', () => {
  let electronApp: ElectronApplication

  test.beforeAll(async () => {
    const userDataDir = createTempUserDataDir('todolist-search-filter-e2e-')
    electronApp = await electron.launch({
      args: [path.resolve(__dirname, '../../../out/main/main.js')],
      env: {
        ...process.env,
        TODO_USER_DATA_DIR: userDataDir
      }
    })

    const page = await electronApp.firstWindow()
    await waitForDbReady(page)

    await page.click('[data-testid="add-list-button"]')
    await page.fill('[data-testid="list-form-input"]', 'Search Test List')
    await page.click('[data-testid="list-form-save"]')
    await expect(page.locator('[data-testid="sidebar-item"]')).toHaveCount(1, { timeout: 10000 })

    await createTask(page, 'Buy groceries', 'high', 'Milk, eggs, bread')
    await createTask(page, 'Read a book', 'low', 'Something relaxing')
    await createTask(page, 'Write report', 'medium', 'Quarterly review')
    await createTask(page, 'Buy new shoes', 'low')

    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(4, { timeout: 10000 })

    const checkboxes = page.locator('[data-testid="task-checkbox"]')
    await checkboxes.nth(1).click()
    await page.waitForTimeout(300)
  })

  test.afterAll(async () => {
    await electronApp.close()
  })

  test('shows search and filter controls', async () => {
    const page = await electronApp.firstWindow()
    await expect(page.locator('[data-testid="search-filter-bar"]')).toBeVisible()
    await expect(page.locator('[data-testid="search-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="filter-priority"]')).toBeVisible()
    await expect(page.locator('[data-testid="filter-status"]')).toBeVisible()
  })

  test('search filters tasks by title', async () => {
    const page = await electronApp.firstWindow()

    await page.fill('[data-testid="search-input"]', 'Buy')
    await page.waitForTimeout(500)

    const items = page.locator('[data-testid="task-item"]')
    await expect(items).toHaveCount(2, { timeout: 5000 })

    const titles = page.locator('[data-testid="task-title"]')
    await expect(titles.nth(0)).toHaveText('Buy groceries')
    await expect(titles.nth(1)).toHaveText('Buy new shoes')

    await page.fill('[data-testid="search-input"]', '')
    await page.waitForTimeout(500)
    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(4, { timeout: 5000 })
  })

  test('search filters tasks by description', async () => {
    const page = await electronApp.firstWindow()

    await page.fill('[data-testid="search-input"]', 'relaxing')
    await page.waitForTimeout(500)

    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(1, { timeout: 5000 })
    await expect(page.locator('[data-testid="task-title"]').first()).toHaveText('Read a book')

    await page.fill('[data-testid="search-input"]', '')
    await page.waitForTimeout(500)
  })

  test('filter by priority', async () => {
    const page = await electronApp.firstWindow()

    await page.selectOption('[data-testid="filter-priority"]', 'high')
    await page.waitForTimeout(500)

    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(1, { timeout: 5000 })
    await expect(page.locator('[data-testid="task-title"]').first()).toHaveText('Buy groceries')

    await page.selectOption('[data-testid="filter-priority"]', '')
    await page.waitForTimeout(500)
  })

  test('filter by completed status', async () => {
    const page = await electronApp.firstWindow()

    await page.selectOption('[data-testid="filter-status"]', 'completed')
    await page.waitForTimeout(500)

    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(1, { timeout: 5000 })
    await expect(page.locator('[data-testid="task-title"]').first()).toHaveText('Read a book')

    await page.selectOption('[data-testid="filter-status"]', 'incomplete')
    await page.waitForTimeout(500)

    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(3, { timeout: 5000 })

    await page.selectOption('[data-testid="filter-status"]', 'all')
    await page.waitForTimeout(500)
  })

  test('combine search and filter', async () => {
    const page = await electronApp.firstWindow()

    await page.fill('[data-testid="search-input"]', 'Buy')
    await page.selectOption('[data-testid="filter-priority"]', 'low')
    await page.waitForTimeout(500)

    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(1, { timeout: 5000 })
    await expect(page.locator('[data-testid="task-title"]').first()).toHaveText('Buy new shoes')

    await page.fill('[data-testid="search-input"]', '')
    await page.selectOption('[data-testid="filter-priority"]', '')
    await page.waitForTimeout(500)
  })

  test('shows empty state when no results match', async () => {
    const page = await electronApp.firstWindow()

    await page.fill('[data-testid="search-input"]', 'nonexistent task xyz')
    await page.waitForTimeout(500)

    await expect(page.locator('[data-testid="task-list-empty"]')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.task-list-empty-text')).toHaveText('No tasks match your search')

    await page.fill('[data-testid="search-input"]', '')
    await page.waitForTimeout(500)
  })

  test('clear search button works', async () => {
    const page = await electronApp.firstWindow()

    await page.fill('[data-testid="search-input"]', 'Buy')
    await page.waitForTimeout(500)
    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(2, { timeout: 5000 })

    await expect(page.locator('[data-testid="search-clear"]')).toBeVisible()
    await page.click('[data-testid="search-clear"]')
    await page.waitForTimeout(500)

    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(4, { timeout: 5000 })
    await expect(page.locator('[data-testid="search-input"]')).toHaveValue('')
  })
})

test.describe('Recurrence and Quadrant Filters', () => {
  let electronApp: ElectronApplication
  let listCounter = 0

  test.beforeAll(async () => {
    const userDataDir = createTempUserDataDir('todolist-filter-extra-e2e-')
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
    await createAndSelectList(page, `Filter List ${listCounter}`)
  })

  test('filters by recurrence in list view', async () => {
    const page = await electronApp.firstWindow()

    await page.click('[data-testid="add-task-button"]')
    await page.fill('[data-testid="task-form-title"]', 'Daily filter task')
    await page.fill('[data-testid="task-form-due-date"]', '2026-07-16')
    await page.selectOption('[data-testid="task-form-recurrence"]', 'daily')
    await page.fill('[data-testid="task-form-recurrence-end-date"]', '2026-07-31')
    await page.click('[data-testid="task-form-save"]')

    await page.click('[data-testid="add-task-button"]')
    await page.fill('[data-testid="task-form-title"]', 'Plain task')
    await page.click('[data-testid="task-form-save"]')

    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(2, { timeout: 10000 })

    await page.selectOption('[data-testid="filter-recurrence"]', 'daily')
    await page.waitForTimeout(500)
    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(1, { timeout: 5000 })
    await expect(page.locator('[data-testid="task-title"]').first()).toHaveText('Daily filter task')

    await page.selectOption('[data-testid="filter-recurrence"]', '')
    await page.waitForTimeout(500)
  })

  test('filters by quadrant in list view', async () => {
    const page = await electronApp.firstWindow()

    await page.click('[data-testid="add-task-button"]')
    await page.fill('[data-testid="task-form-title"]', 'Q1 filter task')
    await page.check('[data-testid="task-form-urgent"]')
    await page.check('[data-testid="task-form-important"]')
    await page.click('[data-testid="task-form-save"]')

    await page.click('[data-testid="add-task-button"]')
    await page.fill('[data-testid="task-form-title"]', 'Q4 filter task')
    await page.click('[data-testid="task-form-save"]')

    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(2, { timeout: 10000 })

    await page.selectOption('[data-testid="filter-quadrant"]', 'q1-urgent-important')
    await page.waitForTimeout(500)
    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(1, { timeout: 5000 })
    await expect(page.locator('[data-testid="task-title"]').first()).toHaveText('Q1 filter task')

    await page.selectOption('[data-testid="filter-quadrant"]', '')
    await page.waitForTimeout(500)
  })
})

