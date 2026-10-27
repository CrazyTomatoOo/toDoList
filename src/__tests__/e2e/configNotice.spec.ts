import {
  test,
  expect,
  type ElectronApplication,
  type Page,
  _electron as electron,
} from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * 真实验证 (issue #14): boot the built app against a broken bootstrap config
 * (TODO_CONFIG_DIR pointing at a config.json that is not valid JSON) and
 * assert the persistent notice banner shows between the header and the
 * content, then disappears for good after 知道了 (fingerprint acknowledged).
 */
async function launchApp(
  userDataDir: string,
  configDir: string,
): Promise<ElectronApplication> {
  return electron.launch({
    args: [
      path.resolve(__dirname, '../../../out/main/main.js'),
      // Redirect userData without TODO_USER_DATA_DIR, which would
      // short-circuit config resolution (source: 'env', problem: null) and
      // hide the broken config entirely.
      `--user-data-dir=${userDataDir}`,
    ],
    env: {
      ...process.env,
      TODO_CONFIG_DIR: configDir,
    },
  })
}

async function waitForShell(page: Page) {
  await page.waitForSelector('[data-testid="app-shell"]', { timeout: 15000 })
}

test.describe('配置未生效提示条', () => {
  let userDataDir: string
  let configDir: string

  test.beforeEach(() => {
    // Isolated userData per test (and per launch within a test) so the
    // acknowledged fingerprint never leaks across tests or into the real
    // user's Application Support.
    userDataDir = mkdtempSync(path.join(tmpdir(), 'todo-user-'))
    configDir = mkdtempSync(path.join(tmpdir(), 'todo-config-'))
    // Broken config: truncated JSON. Fingerprint = sha256 of these bytes.
    writeFileSync(
      path.join(configDir, 'config.json'),
      '{"dataDir": "/absolutely/not/valid/j',
    )
  })

  test.afterEach(() => {
    rmSync(userDataDir, { recursive: true, force: true })
    rmSync(configDir, { recursive: true, force: true })
  })

  test('shows the banner for a broken config and acknowledges via 知道了', async () => {
    const app = await launchApp(userDataDir, configDir)
    const page = await app.firstWindow()
    await waitForShell(page)

    const banner = page.locator('[data-testid="config-notice"]')
    await expect(banner).toBeVisible()
    await expect(banner).toHaveAttribute('role', 'status')

    // Reason line + monospace config path are both present.
    await expect(
      page.locator('[data-testid="config-notice-path"]'),
    ).toContainText(path.join(configDir, 'config.json'))

    // Banner sits between the header and the content, inside the main area.
    const position = await page.evaluate(() => {
      const banner = document.querySelector('[data-testid="config-notice"]')
      const header = document.querySelector('.main-header')
      const content = document.querySelector(
        '.search-filter-bar, .task-list, [data-testid="task-list-empty"]',
      )
      if (!banner || !header || !content) return 'missing'
      return banner.compareDocumentPosition(header) &
        Node.DOCUMENT_POSITION_PRECEDING &&
        banner.compareDocumentPosition(content) &
          Node.DOCUMENT_POSITION_FOLLOWING
        ? 'between'
        : 'elsewhere'
    })
    expect(position).toBe('between')

    // 知道了 writes the fingerprint and hides the banner.
    await page.getByRole('button', { name: '知道了' }).click()
    await expect(banner).toBeHidden()

    await app.close()

    // Same fingerprint relaunches without the banner (acknowledged).
    const app2 = await launchApp(userDataDir, configDir)
    const page2 = await app2.firstWindow()
    await waitForShell(page2)
    await expect(
      page2.locator('[data-testid="config-notice"]'),
    ).toBeHidden()
    await app2.close()
  })

  test('打开设置 jumps to the data tab without acknowledging', async () => {
    const app = await launchApp(userDataDir, configDir)
    const page = await app.firstWindow()
    await waitForShell(page)

    await page.getByRole('button', { name: '打开设置' }).click()
    await expect(page.locator('[data-testid="settings-page"]')).toBeVisible()
    await expect(
      page.locator('[data-testid="settings-section-data"]'),
    ).toBeVisible()

    // Exiting settings still shows the banner (no fingerprint written).
    await page.click('[data-testid="settings-back-button"]')
    await expect(page.locator('[data-testid="config-notice"]')).toBeVisible()
    await app.close()
  })
})
