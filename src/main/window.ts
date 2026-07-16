import { BrowserWindow } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null

/**
 * Create the primary application window.
 *
 * Returns the existing window if one has already been created, which is the
 * foundation of the single-instance behavior. The window is configured with a
 * secure preload script, context isolation, and a sandbox.
 */
export function createMainWindow(): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show()
    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }
    mainWindow.focus()
    return mainWindow
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'ToDoList',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  // Load the Vite dev server in development, or the built renderer in production.
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  return mainWindow
}

/** Return the current main window, or null if it has been destroyed. */
export function getMainWindow(): BrowserWindow | null {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null
}

/**
 * Focus the existing main window.
 *
 * Restores the window if minimized, shows it if hidden, and brings it to the
 * foreground. This is used by the single-instance lock and the macOS activate
 * event.
 */
export function focusMainWindow(): BrowserWindow | null {
  const win = getMainWindow()
  if (!win) {
    return null
  }

  if (win.isMinimized()) {
    win.restore()
  }
  win.show()
  win.focus()
  return win
}
