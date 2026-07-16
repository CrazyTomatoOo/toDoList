import { _electron as electron, expect, test } from '@playwright/test'
import { resolve } from 'node:path'
import { createTempUserDataDir } from '../main/ipc.harness'

test('main window title should eventually be ToDoList', async () => {
  const userDataDir = createTempUserDataDir('todolist-e2e-')
  const app = await electron.launch({
    args: [resolve('out/main/main.js')],
    env: {
      ...process.env,
      TODO_USER_DATA_DIR: userDataDir,
    },
  })

  try {
    const window = await app.firstWindow()
    await expect(window).toHaveTitle('ToDoList')
    await expect(window.locator('[data-testid="app-shell"]')).toBeVisible()
  } finally {
    await app.close()
  }
})
