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

async function getThemeAttribute(page: Page): Promise<string | undefined> {
  return page.evaluate(() => document.documentElement.dataset.theme)
}

async function getSavedThemeMode(page: Page): Promise<string> {
  return page.evaluate(() => window.electronAPI.theme.getMode())
}

async function launchApp(userDataDir: string): Promise<ElectronApplication> {
  return electron.launch({
    args: [path.resolve(__dirname, '../../../out/main/main.js')],
    env: {
      ...process.env,
      TODO_USER_DATA_DIR: userDataDir
    }
  })
}

async function clickUntilMode(page: Page, targetMode: string) {
  for (let i = 0; i < 4; i++) {
    if ((await getSavedThemeMode(page)) === targetMode) return
    await page.click('[data-testid="theme-toggle"]')
    await page.waitForTimeout(300)
  }
  expect(await getSavedThemeMode(page)).toBe(targetMode)
}

test.describe('Theme toggle and persistence', () => {
  let electronApp: ElectronApplication
  let userDataDir: string

  test.beforeAll(async () => {
    userDataDir = createTempUserDataDir('todolist-theme-e2e-')
    electronApp = await launchApp(userDataDir)
  })

  test.afterAll(async () => {
    await electronApp.close()
  })

  test('applies the native system theme on startup when mode is system', async () => {
    const page = await electronApp.firstWindow()
    await waitForDbReady(page)

    const systemTheme = await page.evaluate(() => window.electronAPI.theme.getSystemTheme())
    await expect(page.locator('html')).toHaveAttribute('data-theme', systemTheme, { timeout: 10000 })
    expect(await getSavedThemeMode(page)).toBe('system')
  })

  test('theme toggle button is visible', async () => {
    const page = await electronApp.firstWindow()
    await expect(page.locator('[data-testid="theme-toggle"]')).toBeVisible()
  })

  test('clicking toggle changes the saved mode through IPC', async () => {
    const page = await electronApp.firstWindow()
    const before = await getSavedThemeMode(page)

    await page.click('[data-testid="theme-toggle"]')
    await page.waitForTimeout(300)

    const after = await getSavedThemeMode(page)
    expect(after).not.toBe(before)
    expect(['light', 'dark', 'system']).toContain(after)
    expect(['light', 'dark']).toContain(await getThemeAttribute(page))
  })

  test('theme persists across app restarts via SQLite-backed IPC', async () => {
    const page = await electronApp.firstWindow()

    await clickUntilMode(page, 'dark')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark', { timeout: 5000 })

    await electronApp.close()

    electronApp = await launchApp(userDataDir)
    const newPage = await electronApp.firstWindow()
    await waitForDbReady(newPage)

    await expect(newPage.locator('html')).toHaveAttribute('data-theme', 'dark', { timeout: 10000 })
    expect(await getSavedThemeMode(newPage)).toBe('dark')
  })
})
