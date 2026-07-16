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

test.describe('Task 7 - Form redesign screenshots', () => {
  let electronApp: ElectronApplication

  test.beforeAll(async () => {
    const userDataDir = createTempUserDataDir('todolist-task7-form-')
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

  test('captures task form open and field-level validation error', async () => {
    const page = await electronApp.firstWindow()
    await waitForDbReady(page)

    // Create a list first
    await page.click('[data-testid="add-list-button"]')
    await page.fill('[data-testid="list-form-input"]', 'Test List')
    await page.click('[data-testid="list-form-save"]')
    await page.waitForTimeout(500)

    // Open task form via keyboard — focus the Add Task button and press Enter
    const addTaskButton = page.locator('[data-testid="add-task-button"]')
    await addTaskButton.focus()
    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)

    // Verify modal is visible with correct a11y attributes
    const overlay = page.locator('[data-testid="task-form-overlay"]')
    await expect(overlay).toBeVisible()
    await expect(overlay).toHaveAttribute('role', 'dialog')
    await expect(overlay).toHaveAttribute('aria-modal', 'true')

    // Fill in a title
    await page.fill('[data-testid="task-form-title"]', 'Test Task for Form')

    // Screenshot the open form (keyboard-opened)
    await page.screenshot({
      path: '.omo/evidence/ui-redesign/task-7-form.png',
      fullPage: false
    })

    // Close with Escape
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    await expect(overlay).not.toBeVisible()

    // Reopen with mouse click
    await addTaskButton.click()
    await page.waitForTimeout(300)
    await expect(overlay).toBeVisible()

    // Fill in title
    await page.fill('[data-testid="task-form-title"]', 'Invalid Date Task')

    // Enter invalid dates: start_date > end_date
    await page.fill('[data-testid="task-form-start-date"]', '2026-12-31')
    await page.fill('[data-testid="task-form-end-date"]', '2026-01-01')

    // Submit the form
    await page.click('[data-testid="task-form-save"]')
    await page.waitForTimeout(300)

    // Verify field-level error is visible
    const durationError = page.locator('[data-testid="task-form-duration-error"]')
    await expect(durationError).toBeVisible()
    await expect(durationError).toHaveText('Start date must be before or equal to end date')
    await expect(durationError).toHaveAttribute('role', 'alert')
    await expect(durationError).toHaveAttribute('aria-live', 'polite')

    // Screenshot the failure state (field-level error visible)
    await page.screenshot({
      path: '.omo/evidence/ui-redesign/task-7-form-failure.png',
      fullPage: false
    })

    // Close the form
    await page.click('[data-testid="task-form-close"]')
    await page.waitForTimeout(300)
    await expect(overlay).not.toBeVisible()
  })
})
