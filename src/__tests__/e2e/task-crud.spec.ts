import { test, expect, type ElectronApplication, type Page, _electron as electron } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createTempUserDataDir } from '../main/ipc.harness'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Wait for the database to be ready by polling lists.getAll() */
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

test.describe('Task CRUD', () => {
  let electronApp: ElectronApplication

  test.beforeAll(async () => {
    const userDataDir = createTempUserDataDir('todolist-tasks-e2e-')
    electronApp = await electron.launch({
      args: [path.resolve(__dirname, '../../../out/main/main.js')],
      env: {
        ...process.env,
        TODO_USER_DATA_DIR: userDataDir
      }
    })

    // Wait for DB and create a list
    const page = await electronApp.firstWindow()
    await waitForDbReady(page)
    await page.click('[data-testid="add-list-button"]')
    await page.fill('[data-testid="list-form-input"]', 'Test List')
    await page.click('[data-testid="list-form-save"]')
    await expect(page.locator('[data-testid="sidebar-item"]')).toHaveCount(1, { timeout: 10000 })
  })

  test.afterAll(async () => {
    await electronApp.close()
  })

  test('shows empty task state', async () => {
    const page = await electronApp.firstWindow()
    await expect(page.locator('[data-testid="task-list-empty"]')).toBeVisible()
  })

  test('can create a task via header button', async () => {
    const page = await electronApp.firstWindow()

    // Click Add Task button in header
    await page.click('[data-testid="add-task-button"]')
    await expect(page.locator('[data-testid="task-form"]')).toBeVisible()

    // Fill in task details
    await page.fill('[data-testid="task-form-title"]', 'Buy groceries')
    await page.selectOption('[data-testid="task-form-priority"]', 'high')
    await page.click('[data-testid="task-form-save"]')

    // Verify task appears in list
    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(1, { timeout: 10000 })
    await expect(page.locator('[data-testid="task-title"]').first()).toHaveText('Buy groceries')
    await expect(page.locator('[data-testid="task-priority"]').first()).toHaveText('high')
  })

  test('can create a second task', async () => {
    const page = await electronApp.firstWindow()

    await page.click('[data-testid="add-task-button"]')
    await page.fill('[data-testid="task-form-title"]', 'Read a book')
    await page.fill('[data-testid="task-form-description"]', 'Something relaxing')
    await page.selectOption('[data-testid="task-form-priority"]', 'low')
    await page.click('[data-testid="task-form-save"]')

    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(2, { timeout: 10000 })
  })

  test('can toggle task completion', async () => {
    const page = await electronApp.firstWindow()

    // Click the first task's checkbox
    const checkboxes = page.locator('[data-testid="task-checkbox"]')
    await checkboxes.first().click()

    // Verify the task title has strikethrough class
    const titles = page.locator('[data-testid="task-title"]')
    await expect(titles.first()).toHaveClass(/completed/)
  })

  test('can edit a task', async () => {
    const page = await electronApp.firstWindow()

    // Hover to reveal edit button, then click it
    const firstItem = page.locator('[data-testid="task-item"]').first()
    await firstItem.hover()
    await page.locator('[data-testid="task-edit-button"]').first().click()

    // Verify form opens with existing data
    await expect(page.locator('[data-testid="task-form"]')).toBeVisible()
    const titleInput = page.locator('[data-testid="task-form-title"]')
    await expect(titleInput).toHaveValue('Buy groceries')

    // Update the title
    await titleInput.fill('Buy organic groceries')
    await page.click('[data-testid="task-form-save"]')

    // Verify update
    await expect(page.locator('[data-testid="task-title"]').first()).toHaveText(
      'Buy organic groceries',
      { timeout: 10000 }
    )
  })

  test('can delete a task', async () => {
    const page = await electronApp.firstWindow()

    // Accept confirmation dialog
    page.on('dialog', (dialog) => dialog.accept())

    // Hover to reveal delete button, then click it
    const firstItem = page.locator('[data-testid="task-item"]').first()
    await firstItem.hover()
    await page.locator('[data-testid="task-delete-button"]').first().click()

    // Verify task was removed
    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(1, { timeout: 10000 })
  })

  test('task form validates required title', async () => {
    const page = await electronApp.firstWindow()

    await page.click('[data-testid="add-task-button"]')
    // Leave title empty and try to save
    await page.click('[data-testid="task-form-save"]')

    // Verify error message appears
    await expect(page.locator('[data-testid="task-form-error"]')).toBeVisible()
    await expect(page.locator('[data-testid="task-form-error"]')).toHaveText('Title is required')

    // Close the form so it doesn't interfere with subsequent tests
    await page.click('[data-testid="task-form-cancel"]')
    await expect(page.locator('[data-testid="task-form"]')).not.toBeVisible()
  })

  test('can cancel task form', async () => {
    const page = await electronApp.firstWindow()

    await page.click('[data-testid="add-task-button"]')
    await page.fill('[data-testid="task-form-title"]', 'Should not appear')
    await page.click('[data-testid="task-form-cancel"]')

    // Verify form is closed and task was not created
    await expect(page.locator('[data-testid="task-form"]')).not.toBeVisible()
    // Should still have only 1 task (from previous tests)
    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(1)
  })

  test('sidebar shows updated task count', async () => {
    const page = await electronApp.firstWindow()
    const count = page.locator('[data-testid="sidebar-item-count"]').first()
    await expect(count).toHaveText('1')
  })
})
