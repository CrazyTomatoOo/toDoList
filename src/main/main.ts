import { app, BrowserWindow, Menu } from 'electron'
import { createMainWindow, focusMainWindow, getMainWindow } from './window.js'
import { registerIpcHandlers } from './ipc/handlers/index.js'
import { ReminderScheduler } from './services/reminderScheduler.js'
import { getTasksWithPendingReminders, updateTask } from './db/repositories/taskRepository.js'
import { REMINDER_FIRED_CHANNEL, type ReminderClickedPayload } from '../shared/ipc.js'

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
            { role: 'about' },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' }
          ]
        }
      ]
    : []

  const template: Electron.MenuItemConstructorOptions[] = [
    ...macAppMenu,
    {
      label: 'File',
      submenu: [{ role: isMac ? 'close' : 'quit' }]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac
          ? [
              { role: 'pasteAndMatchStyle' },
              { role: 'delete' },
              { role: 'selectAll' }
            ]
          : [
              { role: 'delete' },
              { type: 'separator' },
              { role: 'selectAll' }
            ])
      ] as Electron.MenuItemConstructorOptions[]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ] as Electron.MenuItemConstructorOptions[]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
        ...(isMac
          ? [
              { type: 'separator' },
              { role: 'front' },
              { type: 'separator' },
              { role: 'window' }
            ]
          : [])
      ] as Electron.MenuItemConstructorOptions[]
    }
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

  app.whenReady().then(() => {
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
            clearReminder: (id) => updateTask(id, { reminder_at: null }),
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
        })
      })
      .catch(() => {
        // Keep startup non-blocking; database access errors surface through IPC handlers.
      })

    Menu.setApplicationMenu(createApplicationMenu())
    registerIpcHandlers()
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
