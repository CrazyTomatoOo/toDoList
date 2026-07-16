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

test.describe('Quadrant Board View', () => {
  let electronApp: ElectronApplication
  let listCounter = 0

  test.beforeAll(async () => {
    const userDataDir = createTempUserDataDir('todolist-quadrant-e2e-')
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
    await createAndSelectList(page, `Quadrant List ${listCounter}`)
  })

  test('creates tasks in each quadrant and places them correctly on the board', async () => {
    const page = await electronApp.firstWindow()
    await createQuadrantTask(page, 'Q1 task', true, true)
    await createQuadrantTask(page, 'Q2 task', false, true)
    await createQuadrantTask(page, 'Q3 task', true, false)
    await createQuadrantTask(page, 'Q4 task', false, false)
    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(4, { timeout: 10000 })

    await page.click('[data-testid="view-toggle-board"]')
    await expect(page.locator('[data-testid="quadrant-board"]')).toBeVisible()

    await expect(page.locator('[data-testid="quadrant-q1-tasks"] [data-testid="task-item"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="quadrant-q1-tasks"] [data-testid="task-title"]')).toHaveText('Q1 task')

    await expect(page.locator('[data-testid="quadrant-q2-tasks"] [data-testid="task-item"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="quadrant-q2-tasks"] [data-testid="task-title"]')).toHaveText('Q2 task')

    await expect(page.locator('[data-testid="quadrant-q3-tasks"] [data-testid="task-item"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="quadrant-q3-tasks"] [data-testid="task-title"]')).toHaveText('Q3 task')

    await expect(page.locator('[data-testid="quadrant-q4-tasks"] [data-testid="task-item"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="quadrant-q4-tasks"] [data-testid="task-title"]')).toHaveText('Q4 task')
  })

  test('switching lists while in board view hides tasks from the previously selected list', async () => {
    const page = await electronApp.firstWindow()
    await createQuadrantTask(page, 'List A task', true, true)
    await page.click('[data-testid="view-toggle-board"]')
    await expect(page.locator('[data-testid="quadrant-q1-tasks"] [data-testid="task-item"]')).toHaveCount(1)

    listCounter++
    const listBName = `Quadrant List ${listCounter}`
    await page.click('[data-testid="add-list-button"]')
    await page.fill('[data-testid="list-form-input"]', listBName)
    await page.click('[data-testid="list-form-save"]')

    const listBItem = page.locator('[data-testid="sidebar-item"]').filter({
      has: page.locator('[data-testid="sidebar-item-name"]', { hasText: listBName })
    })
    await expect(listBItem).toBeVisible({ timeout: 10000 })
    await listBItem.click()

    await expect(page.locator('.main-header h1')).toHaveText(listBName, { timeout: 10000 })
    await page.waitForTimeout(300)
    await page.click('[data-testid="add-list-button"]')
    await page.fill('[data-testid="list-form-input"]', `Quadrant List ${listCounter}`)
    await page.click('[data-testid="list-form-save"]')
    await page.locator('[data-testid="sidebar-item"]').last().click()

    await expect(page.locator('[data-testid="quadrant-q1-tasks"] [data-testid="task-item"]')).toHaveCount(0)
    await expect(page.locator('[data-testid="quadrant-q1-empty"]')).toBeVisible()
  })

  test('toggling a task complete from the board reflects in list view', async () => {
    const page = await electronApp.firstWindow()
    await createQuadrantTask(page, 'Toggle task', true, true)
    await page.click('[data-testid="view-toggle-board"]')
    await expect(page.locator('[data-testid="quadrant-q1-tasks"] [data-testid="task-item"]')).toHaveCount(1)

    await page.locator('[data-testid="quadrant-q1-tasks"] [data-testid="task-checkbox"]').first().click()
    await page.waitForTimeout(300)

    await page.click('[data-testid="view-toggle-list"]')
    await expect(page.locator('[data-testid="task-list-empty"]')).not.toBeVisible()
    await expect(page.locator('[data-testid="task-title"]').first()).toHaveClass(/completed/)
  })
})
