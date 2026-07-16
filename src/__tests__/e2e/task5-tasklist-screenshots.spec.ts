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

test.describe('Task 5 - Task list & item screenshots', () => {
  let electronApp: ElectronApplication

  test.beforeAll(async () => {
    const userDataDir = createTempUserDataDir('todolist-task5-screenshots-')
    electronApp = await electron.launch({
      args: [path.resolve(__dirname, '../../../out/main/main.js')],
      env: {
        ...process.env,
        TODO_USER_DATA_DIR: userDataDir
      }
    })
  })

  test.afterAll(async () => {
    await electronApp.close()
  })

  test('captures task list with tasks, actions, and completed state', async () => {
    const page = await electronApp.firstWindow()
    await waitForDbReady(page)

    // Create a list
    await page.click('[data-testid="add-list-button"]')
    await page.fill('[data-testid="list-form-input"]', 'Test List')
    await page.click('[data-testid="list-form-save"]')
    await page.waitForTimeout(500)

    // Verify the list was created and is selected
    const taskListContainer = page.locator('[data-testid="task-list-container"]')
    await expect(taskListContainer).toBeVisible()

    // Initially empty — capture empty state with card treatment
    const emptyState = page.locator('[data-testid="task-list-empty"]')
    await expect(emptyState).toBeVisible()

    // Create first task
    await page.click('[data-testid="add-task-button"]')
    await page.waitForTimeout(300)
    await page.fill('[data-testid="task-form-title"]', 'Buy groceries')
    await page.click('[data-testid="task-form-save"]')
    await page.waitForTimeout(500)

    // Create second task
    await page.click('[data-testid="add-task-button"]')
    await page.waitForTimeout(300)
    await page.fill('[data-testid="task-form-title"]', 'Write report')
    await page.click('[data-testid="task-form-save"]')
    await page.waitForTimeout(500)

    // Create third task
    await page.click('[data-testid="add-task-button"]')
    await page.waitForTimeout(300)
    await page.fill('[data-testid="task-form-title"]', 'Call dentist')
    await page.click('[data-testid="task-form-save"]')
    await page.waitForTimeout(500)

    // Verify tasks are rendered
    const taskList = page.locator('[data-testid="task-list"]')
    await expect(taskList).toBeVisible()
    const taskItems = page.locator('[data-testid="task-item"]')
    await expect(taskItems).toHaveCount(3)

    // Verify task structure: title, meta, actions, drag handle
    const firstTask = taskItems.first()
    await expect(firstTask.locator('[data-testid="task-title"]')).toBeVisible()
    await expect(firstTask.locator('[data-testid="task-edit-button"]')).toBeVisible()
    await expect(firstTask.locator('[data-testid="task-delete-button"]')).toBeVisible()
    await expect(firstTask.locator('[data-testid="task-drag-handle"]')).toBeVisible()
    await expect(firstTask.locator('[data-testid="task-checkbox"]')).toBeVisible()

    // Screenshot with tasks visible (hover over first task to show actions)
    await firstTask.hover()
    await page.waitForTimeout(200)
    await page.screenshot({
      path: '.omo/evidence/ui-redesign/task-5-tasklist.png',
      fullPage: false
    })

    // Complete the first task by clicking its checkbox
    await firstTask.locator('[data-testid="task-checkbox"]').click()
    await page.waitForTimeout(300)

    // Verify the completed state: title should have strikethrough (completed class)
    const completedTitle = firstTask.locator('[data-testid="task-title"]')
    await expect(completedTitle).toHaveClass(/completed/)

    // Verify the checkbox is checked
    const checkbox = firstTask.locator('[data-testid="task-checkbox"]')
    await expect(checkbox).toHaveAttribute('aria-checked', 'true')

    // Screenshot with completed task (failure evidence — verifies strikethrough persists)
    await page.screenshot({
      path: '.omo/evidence/ui-redesign/task-5-tasklist-failure.png',
      fullPage: false
    })

    // Verify filter bar is visible
    const filterBar = page.locator('[data-testid="filter-bar"]')
    await expect(filterBar).toBeVisible()

    // Verify search bar is visible
    const searchBar = page.locator('[data-testid="search-bar"]')
    await expect(searchBar).toBeVisible()

    // Test search functionality
    await page.fill('[data-testid="search-input"]', 'report')
    await page.waitForTimeout(300)

    // Only one task should match the search
    const filteredTasks = page.locator('[data-testid="task-item"]')
    await expect(filteredTasks).toHaveCount(1)

    // Clear search
    await page.click('[data-testid="search-clear"]')
    await page.waitForTimeout(300)
    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(3)
  })
})
