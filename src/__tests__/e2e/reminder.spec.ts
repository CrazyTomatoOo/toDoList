import { test, expect, type ElectronApplication, type Page, _electron as electron } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createTempUserDataDir } from '../main/ipc.harness'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

type ReminderTestWindow = Window & { __reminderFired?: boolean }

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

/** Convert a Date to the `datetime-local` value format in the current timezone. */
function toDatetimeLocal(date: Date): string {
  const offset = date.getTimezoneOffset() * 60000
  const local = new Date(date.getTime() - offset)
  return local.toISOString().slice(0, 16)
}


test.describe('Reminder notifications', () => {
  let electronApp: ElectronApplication

  test.beforeAll(async () => {
    const userDataDir = createTempUserDataDir('todolist-reminder-e2e-')
    electronApp = await electron.launch({
      args: [path.resolve(__dirname, '../../../out/main/main.js')],
      env: {
        ...process.env,
        TODO_USER_DATA_DIR: userDataDir,
        REMINDER_POLL_INTERVAL_MS: '1000',
      },
    })

    const page = await electronApp.firstWindow()
    await waitForDbReady(page)
    await page.click('[data-testid="add-list-button"]')
    await page.fill('[data-testid="list-form-input"]', 'Reminder List')
    await page.click('[data-testid="list-form-save"]')
    await expect(page.locator('[data-testid="sidebar-item"]')).toHaveCount(1, { timeout: 10000 })
  })

  test.afterAll(async () => {
    await electronApp.close()
  })

  test('fires a notification when a task reminder elapses', async () => {
    const page = await electronApp.firstWindow()
    // The datetime-local input has minute precision. A "2s in the future"
    // value often truncates to the current minute, which can land behind the
    // scheduler's last poll and be skipped forever. Use the current minute
    // so the reminder is already due and the scheduler fires it on the next poll.
    const reminderAt = toDatetimeLocal(new Date())

    await page.click('[data-testid="add-task-button"]')
    await page.fill('[data-testid="task-form-title"]', 'Reminder test')
    await page.fill('[data-testid="task-form-reminder"]', reminderAt)

    // Listen for the fired event so the test can verify the main process
    // broadcast, but the durable assertion is the cleared DB reminder.
    await page.evaluate(() => {
      const unsubscribe = window.electronAPI.reminders.onReminderFired(() => {
        ;(window as ReminderTestWindow).__reminderFired = true
        unsubscribe()
      })
    })

    await page.click('[data-testid="task-form-save"]')
    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(1, { timeout: 10000 })

    const listId = await page.evaluate(async () => {
      const lists = await window.electronAPI.lists.getAll()
      return lists[0]?.id
    })
    if (!listId) throw new Error('No list found')

    let eventReceived = false
    for (let i = 0; i < 60; i++) {
      eventReceived = await page.evaluate(() => (window as ReminderTestWindow).__reminderFired === true)
      const tasks = await page.evaluate(async (id) => {
        return await window.electronAPI.tasks.getByListId(id)
      }, listId)
      if (tasks.length > 0 && tasks[0].reminder_at === null) {
        expect(eventReceived).toBe(true)
        return
      }
      await page.waitForTimeout(500)
    }
    throw new Error('Reminder was not cleared')
  })
})
