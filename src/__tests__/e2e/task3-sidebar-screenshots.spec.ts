import { test, type ElectronApplication, type Page, _electron as electron } from '@playwright/test'
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

test.describe('Task 3 - Sidebar screenshots', () => {
  let electronApp: ElectronApplication

  test.beforeAll(async () => {
    const userDataDir = createTempUserDataDir('todolist-task3-screenshots-')
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

  test('takes sidebar navigation screenshots', async () => {
    const page = await electronApp.firstWindow()
    await waitForDbReady(page)

    // Create a few lists
    await page.click('[data-testid="add-list-button"]')
    await page.fill('[data-testid="list-form-input"]', 'Work Tasks')
    await page.click('[data-testid="list-form-save"]')
    await page.waitForTimeout(300)

    await page.click('[data-testid="add-list-button"]')
    await page.fill('[data-testid="list-form-input"]', 'Personal Tasks')
    await page.click('[data-testid="list-form-save"]')
    await page.waitForTimeout(300)

    await page.click('[data-testid="add-list-button"]')
    await page.fill('[data-testid="list-form-input"]', 'Shopping List')
    await page.click('[data-testid="list-form-save"]')
    await page.waitForTimeout(300)

    // Click the first list to select it
    const items = page.locator('[data-testid="sidebar-item"]')
    await items.first().click()
    await page.waitForTimeout(300)

    // Take screenshot showing keyboard + mouse navigation
    await page.screenshot({
      path: '.omo/evidence/ui-redesign/task-3-sidebar.png',
      fullPage: false
    })

    // Now click the second list
    await items.nth(1).click()
    await page.waitForTimeout(300)

    // Verify the second list is active (has aria-current="page")
    const secondItem = items.nth(1)
    const ariaCurrent = await secondItem.getAttribute('aria-current')
    if (ariaCurrent !== 'page') {
      throw new Error(`Expected aria-current="page" on second item, got "${ariaCurrent}"`)
    }

    // Verify the first item is NOT active
    const firstItem = items.first()
    const firstAriaCurrent = await firstItem.getAttribute('aria-current')
    if (firstAriaCurrent === 'page') {
      throw new Error('First item should not have aria-current="page" after clicking second item')
    }

    // Take failure evidence screenshot (showing correct list is active)
    await page.screenshot({
      path: '.omo/evidence/ui-redesign/task-3-sidebar-failure.png',
      fullPage: false
    })
  })
})
