import {
  test,
  expect,
  type ElectronApplication,
  type Page,
  _electron as electron,
} from '@playwright/test'
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

async function setTheme(page: Page, target: 'light' | 'dark') {
  for (let i = 0; i < 6; i++) {
    const theme = await page.evaluate(
      () => document.documentElement.dataset.theme,
    )
    if (theme === target) return
    await page.click('[data-testid="theme-toggle"]')
    await page.waitForTimeout(250)
  }
  throw new Error(`could not reach ${target}`)
}

test.describe('Custom date picker theming', () => {
  let electronApp: ElectronApplication

  test.beforeAll(async () => {
    const userDataDir = createTempUserDataDir('todolist-datepicker-e2e-')
    electronApp = await electron.launch({
      args: [path.resolve(__dirname, '../../../out/main/main.js')],
      env: { ...process.env, TODO_USER_DATA_DIR: userDataDir },
    })
  })

  test.afterAll(async () => {
    await electronApp.close()
  })

  test('renders the popup with theme-matched colors in dark and light', async () => {
    const page = await electronApp.firstWindow()
    await waitForDbReady(page)

    await page.click('[data-testid="add-list-button"]')
    await page.fill('[data-testid="list-form-input"]', 'Pick')
    await page.click('[data-testid="list-form-save"]')

    await setTheme(page, 'dark')
    await page.click('[data-testid="add-task-button"]')
    await page.waitForSelector('[data-testid="task-form"]')
    await page.click('[data-testid="task-form-due-date-trigger"]')
    const popup = page.locator('[data-testid="task-form-due-date-popup"]')
    await expect(popup).toBeVisible()
    // dark token surface (--color-n100) — not the native light-only panel
    await expect(popup).toHaveCSS('background-color', 'rgb(35, 35, 41)')
    // Chinese grid visible
    await expect(popup.locator('.date-picker-title')).toHaveText(
      /\d{4}年\d{1,2}月/,
    )
    await expect(popup.locator('.date-picker-weekday').first()).toHaveText('日')

    // select a day through the visible calendar; hidden native input stays in sync
    await page.click('[data-testid="task-form-due-date-day-2026-08-21"]')
    await expect(popup).not.toBeVisible()
    await expect(
      page.locator('[data-testid="task-form-due-date"]'),
    ).toHaveValue('2026-08-21')
    await expect(
      page.locator('[data-testid="task-form-due-date-trigger"]'),
    ).toContainText('8月21日')
    await page.click('[data-testid="task-form-close"]')
    await page.waitForSelector('[data-testid="task-form"]', {
      state: 'detached',
    })

    // light theme: white surface + native input fill path still works
    await setTheme(page, 'light')
    await page.click('[data-testid="add-task-button"]')
    await page.waitForSelector('[data-testid="task-form"]')
    await page.click('[data-testid="task-form-due-date-trigger"]')
    await expect(popup).toHaveCSS('background-color', 'rgb(255, 255, 255)')
    await page.keyboard.press('Escape')
    await expect(popup).not.toBeVisible()
    await page.fill('[data-testid="task-form-due-date"]', '2026-09-01')
    await expect(
      page.locator('[data-testid="task-form-due-date-trigger"]'),
    ).toContainText('9月1日')
  })
})
