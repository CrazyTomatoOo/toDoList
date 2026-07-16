import { test, expect, type ElectronApplication, type Page, _electron as electron } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
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

async function setupDialogMock(electronApp: ElectronApplication, filePath: string) {
  await electronApp.evaluate(async (_app, targetPath) => {
    globalThis.__dialogMock = {
      showSaveDialog: async () => ({ canceled: false, filePath: targetPath }),
      showOpenDialog: async () => ({ canceled: false, filePaths: [targetPath] }),
    }
  }, filePath)
}

test.describe('Import and Export', () => {
  let electronApp: ElectronApplication
  let exportDir: string

  test.beforeEach(async () => {
    exportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'todolist-import-export-e2e-'))
  })

  test.afterEach(async () => {
    await electronApp.close()
    fs.rmSync(exportDir, { recursive: true, force: true })
  })

  test('exports and imports JSON roundtrip', async () => {
    const userDataDir = createTempUserDataDir('todolist-export-e2e-')
    electronApp = await electron.launch({
      args: [path.resolve(__dirname, '../../../out/main/main.js')],
      env: {
        ...process.env,
        TODO_USER_DATA_DIR: userDataDir,
      },
    })

    const page = await electronApp.firstWindow()
    await waitForDbReady(page)

    // Create a list and a task.
    await page.click('[data-testid="add-list-button"]')
    await page.fill('[data-testid="list-form-input"]', 'Work')
    await page.click('[data-testid="list-form-save"]')
    await expect(page.locator('[data-testid="sidebar-item"]')).toHaveCount(1, { timeout: 10000 })

    await page.click('[data-testid="add-task-button"]')
    await page.fill('[data-testid="task-form-title"]', 'Export me')
    await page.click('[data-testid="task-form-save"]')
    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(1, { timeout: 10000 })

    // Export JSON.
    const exportPath = path.join(exportDir, 'export.json')
    await setupDialogMock(electronApp, exportPath)
    await page.click('[data-testid="export-json-button"]')
    await page.waitForTimeout(500)
    expect(fs.existsSync(exportPath)).toBe(true)

    // Close the export app and start a fresh instance to import into.
    await electronApp.close()
    await new Promise((resolve) => setTimeout(resolve, 500))

    electronApp = await electron.launch({
      args: [path.resolve(__dirname, '../../../out/main/main.js')],
      env: {
        ...process.env,
        TODO_USER_DATA_DIR: createTempUserDataDir('todolist-import-e2e-'),
      },
    })

    const importPage = await electronApp.firstWindow()
    await waitForDbReady(importPage)
    await setupDialogMock(electronApp, exportPath)
    await importPage.click('[data-testid="import-button"]')

    await expect(importPage.locator('[data-testid="sidebar-item"]')).toHaveCount(1, { timeout: 10000 })
    await expect(importPage.locator('[data-testid="task-item"]')).toHaveCount(1, { timeout: 10000 })
    await expect(importPage.locator('[data-testid="task-title"]').first()).toHaveText('Export me')
  })

  test('exports and imports CSV roundtrip', async () => {
    const userDataDir = createTempUserDataDir('todolist-export-csv-e2e-')
    electronApp = await electron.launch({
      args: [path.resolve(__dirname, '../../../out/main/main.js')],
      env: {
        ...process.env,
        TODO_USER_DATA_DIR: userDataDir,
      },
    })

    const page = await electronApp.firstWindow()
    await waitForDbReady(page)

    await page.click('[data-testid="add-list-button"]')
    await page.fill('[data-testid="list-form-input"]', 'Personal')
    await page.click('[data-testid="list-form-save"]')
    await expect(page.locator('[data-testid="sidebar-item"]')).toHaveCount(1, { timeout: 10000 })

    await page.click('[data-testid="add-task-button"]')
    await page.fill('[data-testid="task-form-title"]', 'Buy bread')
    await page.selectOption('[data-testid="task-form-priority"]', 'low')
    await page.click('[data-testid="task-form-save"]')
    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(1, { timeout: 10000 })

    const exportPath = path.join(exportDir, 'export.csv')
    await setupDialogMock(electronApp, exportPath)
    await page.click('[data-testid="export-csv-button"]')
    await page.waitForTimeout(500)
    expect(fs.existsSync(exportPath)).toBe(true)

    await electronApp.close()
    await new Promise((resolve) => setTimeout(resolve, 500))

    electronApp = await electron.launch({
      args: [path.resolve(__dirname, '../../../out/main/main.js')],
      env: {
        ...process.env,
        TODO_USER_DATA_DIR: createTempUserDataDir('todolist-import-csv-e2e-'),
      },
    })

    const importPage = await electronApp.firstWindow()
    await waitForDbReady(importPage)
    await setupDialogMock(electronApp, exportPath)
    await importPage.click('[data-testid="import-button"]')

    await expect(importPage.locator('[data-testid="sidebar-item"]')).toHaveCount(1, { timeout: 10000 })
    await expect(importPage.locator('[data-testid="task-item"]')).toHaveCount(1, { timeout: 10000 })
    await expect(importPage.locator('[data-testid="task-title"]').first()).toHaveText('Buy bread')
  })

  test('import is additive for existing data', async () => {
    const userDataDir = createTempUserDataDir('todolist-additive-e2e-')
    electronApp = await electron.launch({
      args: [path.resolve(__dirname, '../../../out/main/main.js')],
      env: {
        ...process.env,
        TODO_USER_DATA_DIR: userDataDir,
      },
    })

    const page = await electronApp.firstWindow()
    await waitForDbReady(page)

    await page.click('[data-testid="add-list-button"]')
    await page.fill('[data-testid="list-form-input"]', 'Work')
    await page.click('[data-testid="list-form-save"]')
    await expect(page.locator('[data-testid="sidebar-item"]')).toHaveCount(1, { timeout: 10000 })

    await page.click('[data-testid="add-task-button"]')
    await page.fill('[data-testid="task-form-title"]', 'Existing task')
    await page.click('[data-testid="task-form-save"]')
    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(1, { timeout: 10000 })

    const importPath = path.join(exportDir, 'additive-import.json')
    fs.writeFileSync(
      importPath,
      JSON.stringify({
        lists: [],
        tasks: [
          {
            listName: 'Work',
            title: 'Imported task',
            description: null,
            priority: 'medium',
            dueDate: null,
            reminderAt: null,
            completed: false,
            sortOrder: 0,
          },
        ],
      }),
      'utf-8',
    )

    await setupDialogMock(electronApp, importPath)
    await page.click('[data-testid="import-button"]')
    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(2, { timeout: 10000 })
  })
})
