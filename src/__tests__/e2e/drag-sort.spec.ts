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

async function createTask(page: Page, title: string, priority: string = 'medium') {
  const countBefore = await page.locator('[data-testid="task-item"]').count()
  await page.click('[data-testid="add-task-button"]')
  await page.fill('[data-testid="task-form-title"]', title)
  await page.selectOption('[data-testid="task-form-priority"]', priority)
  await page.click('[data-testid="task-form-save"]')
  await expect(page.locator('[data-testid="task-item"]')).toHaveCount(countBefore + 1, { timeout: 10000 })
}

test.describe('Drag-and-Drop Sort', () => {
  let electronApp: ElectronApplication
  let userDataDir: string

  test.beforeAll(async () => {
    userDataDir = createTempUserDataDir('todolist-drag-sort-e2e-')
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
    await page.fill('[data-testid="list-form-input"]', 'Sort Test List')
    await page.click('[data-testid="list-form-save"]')
    await expect(page.locator('[data-testid="sidebar-item"]')).toHaveCount(1, { timeout: 10000 })
  })

  test.afterAll(async () => {
    await electronApp.close()
  })

  test('creates tasks and shows drag handles', async () => {
    const page = await electronApp.firstWindow()

    await createTask(page, 'Task A', 'high')
    await createTask(page, 'Task B', 'medium')
    await createTask(page, 'Task C', 'low')

    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(3, { timeout: 10000 })

    const titles = page.locator('[data-testid="task-title"]')
    await expect(titles.nth(0)).toHaveText('Task A')
    await expect(titles.nth(1)).toHaveText('Task B')
    await expect(titles.nth(2)).toHaveText('Task C')

    const handles = page.locator('[data-testid="task-drag-handle"]')
    await expect(handles).toHaveCount(3)
  })

  test('reorders tasks via updateSortOrder IPC', async () => {
    const page = await electronApp.firstWindow()

    const reordered = await page.evaluate(async () => {
      const lists = await window.electronAPI.lists.getAll()
      const listId = lists[0].id
      const tasks = await window.electronAPI.tasks.getByListId(listId)
      const taskIds = tasks.map((t) => t.id)

      const newOrder = [taskIds[1], taskIds[2], taskIds[0]]
      await window.electronAPI.tasks.updateSortOrder(listId, newOrder)

      const updated = await window.electronAPI.tasks.getByListId(listId)
      return updated.map((t) => t.title)
    })

    expect(reordered).toEqual(['Task B', 'Task C', 'Task A'])
  })


  test('sort order persists across app restart', async () => {
    await electronApp.close()

    electronApp = await electron.launch({
      args: [path.resolve(__dirname, '../../../out/main/main.js')],
      env: {
        ...process.env,
        TODO_USER_DATA_DIR: userDataDir
      }
    })

    const page = await electronApp.firstWindow()
    await waitForDbReady(page)

    await expect(page.locator('[data-testid="sidebar-item"]')).toHaveCount(1, { timeout: 10000 })

    const titles = page.locator('[data-testid="task-title"]')
    await expect(titles.nth(0)).toHaveText('Task B', { timeout: 10000 })
    await expect(titles.nth(1)).toHaveText('Task C')
    await expect(titles.nth(2)).toHaveText('Task A')
  })
})
