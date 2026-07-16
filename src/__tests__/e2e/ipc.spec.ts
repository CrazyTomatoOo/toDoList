import { test, expect, type ElectronApplication, _electron as electron } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createTempUserDataDir } from '../main/ipc.harness'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

test.describe('IPC bridge security', () => {
  let electronApp: ElectronApplication

  test.beforeAll(async () => {
    const userDataDir = createTempUserDataDir('todolist-ipc-e2e-')

    electronApp = await electron.launch({
      args: [path.resolve(__dirname, '../../../out/main/main.js')],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TODO_USER_DATA_DIR: userDataDir
      }
    })
  })

  test.afterAll(async () => {
    await electronApp.close()
  })

  test('renderer cannot access window.require', async () => {
    const page = await electronApp.firstWindow()
    const requireType = await page.evaluate(() => typeof (window as Window & { require?: unknown }).require)
    expect(requireType).toBe('undefined')
  })

  test('renderer can call window.electronAPI.ping', async () => {
    const page = await electronApp.firstWindow()
    const result = await page.evaluate(async () => {
      return window.electronAPI.ping('hello')
    })
    expect(result).toBe('pong: hello')
  })
})
