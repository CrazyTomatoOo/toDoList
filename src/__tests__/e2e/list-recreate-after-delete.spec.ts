import {
  test,
  expect,
  type ElectronApplication,
  _electron as electron,
} from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createTempUserDataDir } from '../main/ipc.harness'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Regression: deleting a list used to go through `window.confirm`, an Electron
 * native dialog that leaves the renderer's focus state desynced, so the next
 * inline list form could not be typed into ("新建项目→删除→无法输入名称").
 * The delete confirmation is now in-app, and the create form stays typeable.
 */
test('create list, delete it, then create another one with keyboard input', async () => {
  const userDataDir = createTempUserDataDir('todolist-list-recreate-')
  const app: ElectronApplication = await electron.launch({
    args: [path.resolve(__dirname, '../../../out/main/main.js')],
    env: { ...process.env, TODO_USER_DATA_DIR: userDataDir },
  })
  const page = await app.firstWindow()

  for (let i = 0; i < 20; i++) {
    const ready = await page.evaluate(async () => {
      try {
        await window.electronAPI.lists.getAll()
        return true
      } catch {
        return false
      }
    })
    if (ready) break
    await page.waitForTimeout(500)
  }

  // 1. Create the first list.
  await page.click('[data-testid="add-list-button"]')
  await page.fill('[data-testid="list-form-input"]', 'First')
  await page.click('[data-testid="list-form-save"]')
  await expect(page.locator('[data-testid="sidebar-item"]')).toHaveCount(1, {
    timeout: 10000,
  })

  // 2. Delete it through the in-app confirmation.
  const item = page.locator('[data-testid="sidebar-item"]').first()
  await item.hover()
  await item.locator('[data-testid="sidebar-item-delete"]').click()
  await expect(page.locator('[data-testid="confirm-dialog"]')).toBeVisible()
  await page.click('[data-testid="confirm-dialog-confirm"]')
  await expect(page.locator('[data-testid="sidebar-item"]')).toHaveCount(0, {
    timeout: 10000,
  })

  // 3. Create again — the name field must accept keyboard input.
  await page.click('[data-testid="add-list-button"]')
  const input = page.locator('[data-testid="list-form-input"]')
  await expect(input).toBeVisible()
  await expect(input).toBeFocused()
  await page.keyboard.type('Second')
  await expect(input).toHaveValue('Second')

  await page.click('[data-testid="list-form-save"]')
  await expect(page.locator('[data-testid="sidebar-item-name"]')).toHaveText(
    'Second',
    { timeout: 10000 },
  )

  await app.close()
})
