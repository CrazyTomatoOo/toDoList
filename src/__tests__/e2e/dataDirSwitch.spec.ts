import {
  test,
  expect,
  type ElectronApplication,
  type Page,
  _electron as electron,
} from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * 真实重启 e2e (issue #17 e2e ①): boot the built app on a temp userData,
 * create a task, switch the data directory from 设置 → 数据, migrate and
 * relaunch, then assert the app came back up on the NEW directory with the
 * task intact and the OLD directory listed in the backup table.
 *
 * `--user-data-dir` (not TODO_USER_DATA_DIR) so config resolution actually
 * runs (see configNotice.spec.ts for the same rationale).
 */
async function launchApp(
  userDataDir: string,
  configDir: string,
): Promise<ElectronApplication> {
  return electron.launch({
    args: [
      path.resolve(__dirname, '../../../out/main/main.js'),
      `--user-data-dir=${userDataDir}`,
    ],
    env: {
      ...process.env,
      TODO_CONFIG_DIR: configDir,
      E2E_NEW_DIR: process.env.E2E_NEW_DIR ?? '',
    },
  })
}

async function waitForShell(page: Page) {
  await page.waitForSelector('[data-testid="app-shell"]', { timeout: 15000 })
}

test.describe('设置页换目录闭环', () => {
  let userDataDir: string
  let configDir: string
  let newDir: string

  test.beforeEach(() => {
    userDataDir = mkdtempSync(path.join(tmpdir(), 'todo-user-'))
    configDir = mkdtempSync(path.join(tmpdir(), 'todo-config-'))
    newDir = mkdtempSync(path.join(tmpdir(), 'todo-newdata-'))
    // The second mkdtemp created the dir; remove it so the switch sees a
    // fresh path (either way works — validateDataDir mkdirs).
    rmSync(newDir, { recursive: true, force: true })
    // Carried into the app process for the main-process __dialogMock stub.
    process.env.E2E_NEW_DIR = newDir
  })

  test.afterEach(() => {
    for (const dir of [userDataDir, configDir, newDir]) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('migrates to a new directory and relaunches with data intact', async () => {
    // ── Phase 1: boot on the original userData, create a task. ──
    let app = await launchApp(userDataDir, configDir)
    let page = await app.firstWindow()
    await waitForShell(page)

    // Wait for db/list readiness like reminder.spec.ts (try-catch polling).
    for (let i = 0; i < 20; i++) {
      const ok = await page.evaluate(async () => {
        try {
          await window.electronAPI.lists.getAll()
          return true
        } catch {
          return false
        }
      })
      if (ok) break
      await page.waitForTimeout(500)
    }
    // add-task-button requires a selected list — create one first.
    await page.click('[data-testid="add-list-button"]')
    await page.fill('[data-testid="list-form-input"]', '迁移清单')
    await page.click('[data-testid="list-form-save"]')
    await expect(page.locator('[data-testid="sidebar-item"]')).toHaveCount(1, {
      timeout: 10000,
    })
    await page.click('[data-testid="add-task-button"]')
    await page.fill('[data-testid="task-form-title"]', '迁移后仍在的任务')
    await page.click('[data-testid="task-form-save"]')
    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(1, {
      timeout: 10000,
    })

    // ── Phase 2: settings → 数据 → 更改… ──
    await page.click('[data-testid="settings-button"]')
    await page.click('[data-testid="settings-nav-data"]')
    await page.waitForSelector('[data-testid="settings-section-data"]')
    await expect(page.locator('[data-testid="data-dir-path"]')).toContainText(
      userDataDir,
    )

    // The native directory picker cannot be driven by Playwright. The app's
    // intentional test hook is the main-process __dialogMock (same seam the
    // unit tests use). Inject it via app.evaluate with the dir carried in env
    // (evaluate args arrive as proxies that path APIs reject). Validation
    // still runs for real in the main process.
    await app.evaluate(() => {
      const dir = process.env.E2E_NEW_DIR
      if (!dir) throw new Error('E2E_NEW_DIR not set')
      ;(globalThis as { __dialogMock?: unknown }).__dialogMock = {
        showOpenDialog: async () => ({ canceled: false, filePaths: [dir] }),
      }
    })

    await page.click('[data-testid="data-dir-change-button"]')

    // In-place binary choice: 迁移现有数据 default-checked.
    await page.waitForSelector('[data-testid="data-dir-switch-panel"]')
    const migrate = page.locator('[data-testid="data-dir-migrate-option"]')
    await expect(migrate).toBeChecked()
    await expect(
      page.locator('[data-testid="data-dir-empty-option"]'),
    ).not.toBeChecked()
    await expect(
      page.locator('[data-testid="data-dir-switch-target"]'),
    ).toHaveText(newDir)

    // ── Phase 3: 迁移并重启 ──
    // app:relaunch() + app.exit(0) tears this process down; Playwright sees
    // the close as a normal exit. A stray `electron.launch({args: []})` would
    // boot the real default userData — nothing to wait for here.
    await page.click('[data-testid="data-dir-apply-button"]')
    // The migration commits the config; the restart is offered, not forced.
    await page.waitForSelector('[data-testid="data-dir-migrated-panel"]')
    await page.click('[data-testid="data-dir-restart-now"]')
    // Old process exits via app.exit(0); tolerate either close or an already
    // closed connection.
    await app.waitForEvent('close', { timeout: 15000 }).catch(() => undefined)

    // ── Phase 4: relaunch and verify the new directory is live. ──
    app = await launchApp(userDataDir, configDir)
    page = await app.firstWindow()
    await waitForShell(page)

    await page.click('[data-testid="settings-button"]')
    await page.click('[data-testid="settings-nav-data"]')
    await page.waitForSelector('[data-testid="settings-section-data"]')
    await expect(page.locator('[data-testid="data-dir-path"]')).toHaveText(
      newDir,
    )
    await expect(page.locator('[data-testid="data-dir-badge"]')).toHaveText(
      '自定义',
    )

    // The migrated task survived.
    await page.click('[data-testid="settings-back-button"]')
    await expect(page.locator('[data-testid="task-item"]')).toHaveCount(1, {
      timeout: 10000,
    })
    await expect(
      page.locator('[data-testid="task-title"]', {
        hasText: '迁移后仍在的任务',
      }),
    ).toHaveCount(1)

    // Old directory shows up in the backup table.
    await page.click('[data-testid="settings-button"]')
    await page.click('[data-testid="settings-nav-data"]')
    await page.waitForSelector('[data-testid="settings-section-data"]')
    await page.waitForSelector('[data-testid="backup-table"]')
    const backupNames = await page
      .locator('[data-testid="backup-row"] td:first-child')
      .allTextContents()
    const oldDirName = path.basename(userDataDir)
    expect(
      backupNames.some((name) => name.startsWith('todo-data-backup-')),
    ).toBe(true)
    // And the old dir itself was renamed into a backup beside the new dir.
    const siblings = readdirSync(newDir + '/..')
    const backupSibling = siblings.find(
      (s) =>
        s.startsWith('todo-data-backup-') &&
        existsSync(path.join(path.dirname(newDir), s, 'todo.db')),
    )
    expect(backupSibling).toBeDefined()
    void oldDirName

    await app.close()
  })
})
