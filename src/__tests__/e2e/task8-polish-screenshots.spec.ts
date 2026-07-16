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

test.describe('Task 8 - Theme toggle and import/export polish', () => {
  let electronApp: ElectronApplication

  test.beforeAll(async () => {
    const userDataDir = createTempUserDataDir('todolist-task8-polish-')
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

  test('captures theme toggle and import/export buttons', async () => {
    const page = await electronApp.firstWindow()
    await waitForDbReady(page)

    // Create a list first so header actions are visible
    await page.click('[data-testid="add-list-button"]')
    await page.fill('[data-testid="list-form-input"]', 'Test List for Polish')
    await page.click('[data-testid="list-form-save"]')
    await page.waitForTimeout(500)

    // Verify theme toggle is visible
    const themeToggle = page.locator('[data-testid="theme-toggle"]')
    await expect(themeToggle).toBeVisible()

    // Get initial theme mode from aria-label
    const initialLabel = await themeToggle.getAttribute('aria-label')
    expect(initialLabel).toBeTruthy()

    // Click theme toggle to cycle theme
    await themeToggle.click()
    await page.waitForTimeout(300)

    // Verify theme changed (aria-label should be different)
    const newLabel = await themeToggle.getAttribute('aria-label')
    expect(newLabel).not.toBe(initialLabel)

    // Screenshot showing theme toggle in action
    await page.screenshot({
      path: '.omo/evidence/ui-redesign/task-8-polish.png',
      fullPage: false
    })

    // Now test that import/export buttons don't affect theme
    const importButton = page.locator('[data-testid="import-button"]')
    const exportJsonButton = page.locator('[data-testid="export-json-button"]')
    const exportCsvButton = page.locator('[data-testid="export-csv-button"]')

    await expect(importButton).toBeVisible()
    await expect(exportJsonButton).toBeVisible()
    await expect(exportCsvButton).toBeVisible()

    // Get theme state before clicking import/export
    const themeBeforeImport = await themeToggle.getAttribute('aria-label')

    // Click import button (will show file dialog, but we just verify it doesn't change theme)
    // Note: We can't actually complete the import in e2e without mocking, but we verify the click doesn't affect theme
    await importButton.click()
    await page.waitForTimeout(300)

    // Verify theme didn't change
    const themeAfterImport = await themeToggle.getAttribute('aria-label')
    expect(themeAfterImport).toBe(themeBeforeImport)

    // Click export JSON button
    await exportJsonButton.click()
    await page.waitForTimeout(300)

    // Verify theme still didn't change
    const themeAfterExportJson = await themeToggle.getAttribute('aria-label')
    expect(themeAfterExportJson).toBe(themeBeforeImport)

    // Click export CSV button
    await exportCsvButton.click()
    await page.waitForTimeout(300)

    // Verify theme still didn't change
    const themeAfterExportCsv = await themeToggle.getAttribute('aria-label')
    expect(themeAfterExportCsv).toBe(themeBeforeImport)

    // Screenshot showing import/export buttons after clicks with theme unchanged
    await page.screenshot({
      path: '.omo/evidence/ui-redesign/task-8-polish-failure.png',
      fullPage: false
    })
  })
})
