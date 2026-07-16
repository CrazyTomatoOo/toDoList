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

test.describe('Task 4 - Header & view toggle screenshots', () => {
  let electronApp: ElectronApplication

  test.beforeAll(async () => {
    const userDataDir = createTempUserDataDir('todolist-task4-screenshots-')
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

  test('captures header with view toggle in both List and Board modes', async () => {
    const page = await electronApp.firstWindow()
    await waitForDbReady(page)

    // Initially no lists exist — view toggle should NOT be rendered
    const viewToggleInitially = page.locator('.view-toggle')
    await expect(viewToggleInitially).not.toBeVisible()

    // Capture the "no list selected" / no-view-toggle state as failure evidence
    await page.screenshot({
      path: '.omo/evidence/ui-redesign/task-4-header-failure.png',
      fullPage: false
    })

    // Create a list so the view toggle appears
    await page.click('[data-testid="add-list-button"]')
    await page.fill('[data-testid="list-form-input"]', 'Test List')
    await page.click('[data-testid="list-form-save"]')
    await page.waitForTimeout(500)

    // Wait for the view toggle to appear
    const viewToggle = page.locator('.view-toggle')
    await expect(viewToggle).toBeVisible()

    // Verify List mode is active by default
    const listBtn = page.locator('[data-testid="view-toggle-list"]')
    const boardBtn = page.locator('[data-testid="view-toggle-board"]')

    await expect(listBtn).toHaveAttribute('aria-pressed', 'true')
    await expect(boardBtn).toHaveAttribute('aria-pressed', 'false')

    // Screenshot with List view active
    await page.screenshot({
      path: '.omo/evidence/ui-redesign/task-4-header.png',
      fullPage: false
    })

    // Switch to Board view
    await boardBtn.click()
    await page.waitForTimeout(300)

    // Verify Board mode is now active
    await expect(listBtn).toHaveAttribute('aria-pressed', 'false')
    await expect(boardBtn).toHaveAttribute('aria-pressed', 'true')

    // Switch back to List view
    await listBtn.click()
    await page.waitForTimeout(300)

    // Verify List mode is active again
    await expect(listBtn).toHaveAttribute('aria-pressed', 'true')
    await expect(boardBtn).toHaveAttribute('aria-pressed', 'false')

    // Verify Add Task button contains Plus icon (SVG rendered)
    const addTaskBtn = page.locator('[data-testid="add-task-button"]')
    await expect(addTaskBtn).toBeVisible()
    const svgIcon = addTaskBtn.locator('svg')
    await expect(svgIcon).toBeVisible()
  })
})
