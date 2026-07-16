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

test.describe('List management', () => {
  let electronApp: ElectronApplication

  test.beforeAll(async () => {
    const userDataDir = createTempUserDataDir('todolist-lists-e2e-')
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

  test('shows empty sidebar state initially', async () => {
    const page = await electronApp.firstWindow()
    await waitForDbReady(page)
    await expect(page.locator('[data-testid="list-sidebar"]')).toBeVisible()
    await expect(page.locator('[data-testid="sidebar-empty"]')).toBeVisible()
  })

  test('can create a new list', async () => {
    const page = await electronApp.firstWindow()

    // Click add list button
    await page.click('[data-testid="add-list-button"]')
    await expect(page.locator('[data-testid="list-form"]')).toBeVisible()

    // Fill in list name and save
    await page.fill('[data-testid="list-form-input"]', 'Work')
    await page.click('[data-testid="list-form-save"]')

    // Wait for form to close and list to appear
    await expect(page.locator('[data-testid="list-form"]')).not.toBeVisible({ timeout: 10000 })
    await expect(page.locator('[data-testid="sidebar-item"]')).toHaveCount(1, { timeout: 10000 })
    await expect(page.locator('[data-testid="sidebar-item-name"]').first()).toHaveText('Work')
  })

  test('can create a second list', async () => {
    const page = await electronApp.firstWindow()

    await page.click('[data-testid="add-list-button"]')
    await page.fill('[data-testid="list-form-input"]', 'Personal')
    await page.click('[data-testid="list-form-save"]')

    await expect(page.locator('[data-testid="sidebar-item"]')).toHaveCount(2, { timeout: 10000 })
  })



  test('can edit a list name and rejects duplicate names while editing', async () => {
    const page = await electronApp.firstWindow()
    const firstItem = page.locator('[data-testid="sidebar-item"]').first()

    await firstItem.hover()
    await firstItem.locator('[data-testid="sidebar-item-edit"]').click()
    await expect(page.locator('[data-testid="list-form"]')).toBeVisible()
    await expect(page.locator('[data-testid="list-form-input"]')).toHaveValue('Work')

    await page.fill('[data-testid="list-form-input"]', 'Personal')
    await page.click('[data-testid="list-form-save"]')
    await expect(page.locator('[data-testid="list-form-error"]')).toHaveText('A list with this name already exists')

    await page.fill('[data-testid="list-form-input"]', 'Projects')
    await page.click('[data-testid="list-form-save"]')
    await expect(page.locator('[data-testid="list-form"]')).not.toBeVisible({ timeout: 10000 })
    await expect(page.locator('[data-testid="sidebar-item-name"]').first()).toHaveText('Projects')
    await expect(page.locator('.main-header h1')).toHaveText('Projects')
  })

  test('selecting a list updates the header', async () => {
    const page = await electronApp.firstWindow()
    const items = page.locator('[data-testid="sidebar-item"]')

    await items.nth(1).click()
    await expect(page.locator('.main-header h1')).toHaveText('Personal')

    await items.nth(0).click()
    await expect(page.locator('.main-header h1')).toHaveText('Projects')
  })

  test('can delete a list with confirmation', async () => {
    const page = await electronApp.firstWindow()

    // Set up dialog handler to accept confirmation
    page.on('dialog', (dialog) => dialog.accept())

    // Hover to reveal delete button, then click it
    const secondItem = page.locator('[data-testid="sidebar-item"]').nth(1)
    await secondItem.hover()
    await page.click('[data-testid="sidebar-item-delete"]')

    // Verify list was deleted
    await expect(page.locator('[data-testid="sidebar-item"]')).toHaveCount(1, { timeout: 10000 })
  })
})
