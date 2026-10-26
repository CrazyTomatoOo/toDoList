import { test, expect, type ElectronApplication, type Page, _electron as electron } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createTempUserDataDir } from '../main/ipc.harness'
import { chooseThemeMode } from './settings.helpers'

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

test.describe('Task 8 - Settings entry and import/export polish', () => {
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

  test('captures settings button and import/export buttons', async () => {
    const page = await electronApp.firstWindow()
    await waitForDbReady(page)

    // Create a list first so header actions are visible
    await page.click('[data-testid="add-list-button"]')
    await page.fill('[data-testid="list-form-input"]', 'Test List for Polish')
    await page.click('[data-testid="list-form-save"]')
    await page.waitForTimeout(500)

    // Verify settings button is visible
    const settingsButton = page.locator('[data-testid="settings-button"]')
    await expect(settingsButton).toBeVisible()

    // Change theme through the settings page
    const initialTheme = await page.evaluate(
      () => document.documentElement.dataset.theme,
    )
    await chooseThemeMode(page, initialTheme === 'light' ? 'dark' : 'light')

    // Verify theme changed
    const newTheme = await page.evaluate(
      () => document.documentElement.dataset.theme,
    )
    expect(newTheme).not.toBe(initialTheme)

    // Screenshot showing the new header in action
    await page.screenshot({
      path: '.omo/evidence/ui-redesign/task-8-polish.png',
      fullPage: false,
    })

    // Now test that import/export buttons don't affect theme
    const importButton = page.locator('[data-testid="import-button"]')
    const exportJsonButton = page.locator('[data-testid="export-json-button"]')
    const exportCsvButton = page.locator('[data-testid="export-csv-button"]')

    await expect(importButton).toBeVisible()
    await expect(exportJsonButton).toBeVisible()
    await expect(exportCsvButton).toBeVisible()

    // Click import button (will show file dialog, but we just verify it doesn't change theme)
    // Note: We can't actually complete the import in e2e without mocking, but we verify the click doesn't affect theme
    await importButton.click()
    await page.waitForTimeout(300)

    // Verify theme didn't change
    const themeAfterImport = await page.evaluate(
      () => document.documentElement.dataset.theme,
    )
    expect(themeAfterImport).toBe(newTheme)

    // Click export JSON button
    await exportJsonButton.click()
    await page.waitForTimeout(300)

    // Verify theme still didn't change
    const themeAfterExportJson = await page.evaluate(
      () => document.documentElement.dataset.theme,
    )
    expect(themeAfterExportJson).toBe(newTheme)

    // Click export CSV button
    await exportCsvButton.click()
    await page.waitForTimeout(300)

    // Verify theme still didn't change
    const themeAfterExportCsv = await page.evaluate(
      () => document.documentElement.dataset.theme,
    )
    expect(themeAfterExportCsv).toBe(newTheme)

    // Screenshot showing import/export buttons after clicks with theme unchanged
    await page.screenshot({
      path: '.omo/evidence/ui-redesign/task-8-polish-failure.png',
      fullPage: false,
    })
  })
})
