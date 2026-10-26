import { app, BrowserWindow, Menu } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { createMainWindow, focusMainWindow, getMainWindow } from './window.js'
import { registerIpcHandlers } from './ipc/handlers/index.js'
import { ReminderScheduler } from './services/reminderScheduler.js'
import { initThemeSource } from './services/theme.js'
import {
  getTasksWithPendingReminders,
  updateReminderNextFire,
} from './db/repositories/taskRepository.js'
import { computeNextReminderFire } from './db/repositories/reminderSchedule.js'
import { resolveDataDir } from './db/dataDirConfig.js'
import { setDataDirState } from './services/dataDirState.js'
import { validateDataDir } from './db/dataDirValidation.js'
import {
  REMINDER_FIRED_CHANNEL,
  type ReminderClickedPayload,
} from '../shared/ipc.js'

const isMac = process.platform === 'darwin'

/**
 * Build the application menu.
 *
 * On macOS the first menu is the app menu (ToDoList) so the platform quit,
 * hide, and services shortcuts behave correctly. On Windows the menu is simpler
 * because the window chrome provides the close behavior.
 */
function createApplicationMenu(): Menu {
  const macAppMenu: Electron.MenuItemConstructorOptions[] = isMac
    ? [
        {
          label: app.name,
          submenu: [
            { label: '关于', role: 'about' },
            { type: 'separator' },
            { label: '服务', role: 'services' },
            { type: 'separator' },
            { label: '隐藏', role: 'hide' },
            { label: '隐藏其他', role: 'hideOthers' },
            { label: '全部显示', role: 'unhide' },
            { type: 'separator' },
            { label: '退出', role: 'quit' },
          ],
        },
      ]
    : []

  const template: Electron.MenuItemConstructorOptions[] = [
    ...macAppMenu,
    {
      label: '文件',
      submenu: [
        { label: isMac ? '关闭窗口' : '退出', role: isMac ? 'close' : 'quit' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', role: 'undo' },
        { label: '重做', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', role: 'cut' },
        { label: '复制', role: 'copy' },
        { label: '粘贴', role: 'paste' },
        ...(isMac
          ? [
              { label: '粘贴并匹配样式', role: 'pasteAndMatchStyle' },
              { label: '删除', role: 'delete' },
              { label: '全选', role: 'selectAll' },
            ]
          : [
              { label: '删除', role: 'delete' },
              { type: 'separator' },
              { label: '全选', role: 'selectAll' },
            ]),
      ] as Electron.MenuItemConstructorOptions[],
    },
    {
      label: '视图',
      submenu: [
        { label: '重新加载', role: 'reload' },
        { label: '强制重新加载', role: 'forceReload' },
        { label: '开发者工具', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: '实际大小', role: 'resetZoom' },
        { label: '放大', role: 'zoomIn' },
        { label: '缩小', role: 'zoomOut' },
        { type: 'separator' },
        { label: '切换全屏', role: 'togglefullscreen' },
      ] as Electron.MenuItemConstructorOptions[],
    },
    {
      label: '窗口',
      submenu: [
        { label: '最小化', role: 'minimize' },
        { label: '关闭窗口', role: 'close' },
        ...(isMac
          ? [
              { type: 'separator' },
              { label: '前置全部窗口', role: 'front' },
              { type: 'separator' },
              { label: '窗口', role: 'window' },
            ]
          : []),
      ] as Electron.MenuItemConstructorOptions[],
    },
  ]

  return Menu.buildFromTemplate(template)
}

/**
 * Initialize the Electron application.
 *
 * Enforces a single application instance unless running under E2E tests. When a
 * second instance is launched, the existing window is focused instead of opening a
 * new one. On macOS the window is recreated when the user clicks the Dock icon
 * after closing all windows.
 */
export function initializeApp(): void {
  const isE2E = process.env.E2E_TEST === '1'

  if (!isE2E) {
    const gotTheLock = app.requestSingleInstanceLock()

    if (!gotTheLock) {
      app.quit()
      return
    }

    app.on('second-instance', () => {
      focusMainWindow()
    })
  }

  // Resolve the data directory before app.whenReady(): Electron cannot re-point
  // userData/sessionData later. The single-instance lock is requested above
  // first because its identity derives from DIR_USER_DATA (electron#24447);
  // resolving after the lock would create one instance per data directory.
  // Read the default once, before setPath() below re-points it: the UI shows
  // this value as "默认目录" and "恢复默认" migrates back to it.
  const defaultUserDataDir = app.getPath('userData')

  const resolution = resolveDataDir({
    env: process.env,
    argv: process.argv,
    appDataDir: app.getPath('appData'),
    exeDir: path.dirname(process.execPath),
    defaultUserDataDir,
    validate: (dir) =>
      validateDataDir(dir, { resourcesDir: process.resourcesPath }),
  })

  const noStore = resolution.problem?.kind === 'unusable-dir'

  if (!noStore) {
    fs.mkdirSync(resolution.dir, { recursive: true })
    app.setPath('userData', resolution.dir)
    app.setPath('sessionData', resolution.dir)
  }

  // Capture the resolution for the data-dir IPC handlers (issue #13): the UI
  // shows exactly the directory this process booted on.
  setDataDirState({
    resolution,
    defaultDir: defaultUserDataDir,
    noStore,
  })

  app.whenReady().then(() => {
    Menu.setApplicationMenu(createApplicationMenu())
    registerIpcHandlers()

    if (noStore) {
      // Safe mode (ADR-0005): the configured directory is unusable, so no
      // database is opened or created — the renderer shows the no-store screen.
      createMainWindow()
      return
    }

    // Initialize the database lazily. If the native module is not yet rebuilt
    // for the current Electron version (e.g. during T5 development), the app
    // continues to start so that IPC and UI can be verified independently.
    import('./db/connection.js')
      .then(({ getDb }) => {
        return import('./db/migrations.js').then(({ runMigrations }) => {
          getDb()
          runMigrations()

          const pollIntervalMs = process.env.REMINDER_POLL_INTERVAL_MS
            ? parseInt(process.env.REMINDER_POLL_INTERVAL_MS, 10)
            : 10_000
          const scheduler = new ReminderScheduler({
            getPendingReminders: getTasksWithPendingReminders,
            completeReminder: (task) => {
              const nextFire = computeNextReminderFire(task)
              updateReminderNextFire(task.id, nextFire)
            },
            pollIntervalMs,
            onReminderFired: (task) => {
              const win = getMainWindow()
              if (win) {
                win.webContents.send(REMINDER_FIRED_CHANNEL, {
                  taskId: task.id,
                  listId: task.list_id,
                } as ReminderClickedPayload)
              }
            },
          })
          scheduler.start()
          app.on('before-quit', () => scheduler.stop())

          // Native chrome (date picker, menus, dialogs) follows the saved mode,
          // not the OS — see initThemeSource().
          initThemeSource()
        })
      })
      .catch(() => {
        // Keep startup non-blocking; database access errors surface through IPC handlers.
      })

    createMainWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow()
      } else {
        focusMainWindow()
      }
    })
  })

  app.on('window-all-closed', () => {
    if (!isMac) {
      app.quit()
    }
  })
}

initializeApp()
