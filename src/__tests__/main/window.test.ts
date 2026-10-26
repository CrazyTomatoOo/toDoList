import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * Electron's userData/appData live under this throwaway root: initializeApp()
 * now resolves the data directory (issue #12) and mkdir's it before whenReady.
 */
const testRoot = path.join(os.tmpdir(), `todolist-window-test-${process.pid}`)

/**
 * Mock browser window instances. We keep a live list so that
 * BrowserWindow.getAllWindows() can return the windows created by tests.
 */
const windowInstances: Array<ReturnType<typeof createMockBrowserWindow>> = []

function createMockBrowserWindow(
  options: Electron.BrowserWindowConstructorOptions,
) {
  const eventHandlers: Record<string, Array<(...args: unknown[]) => void>> = {}
  const instance = {
    options,
    loadURL: vi.fn(),
    loadFile: vi.fn(),
    show: vi.fn(),
    focus: vi.fn(),
    restore: vi.fn(),
    isMinimized: vi.fn(() => false),
    isDestroyed: vi.fn(() => false),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!eventHandlers[event]) eventHandlers[event] = []
      eventHandlers[event].push(handler)
      return instance
    }),
    once: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!eventHandlers[event]) eventHandlers[event] = []
      eventHandlers[event].push(handler)
      return instance
    }),
    webContents: {
      openDevTools: vi.fn(),
    },
    _eventHandlers: eventHandlers,
    _emit(event: string, ...args: unknown[]) {
      eventHandlers[event]?.forEach((h) => h(...args))
    },
  }
  windowInstances.push(instance)
  return instance
}

const BrowserWindowMock = vi.fn(function (options) {
  return createMockBrowserWindow(options)
}) as unknown as typeof BrowserWindow
BrowserWindowMock.getAllWindows = vi.fn(() =>
  windowInstances.filter((w) => !w.isDestroyed()),
)
BrowserWindowMock.getAllWindows = vi.fn(() =>
  windowInstances.filter((w) => !w.isDestroyed()),
)

const appHandlers: Record<string, Array<(...args: unknown[]) => void>> = {}
const appMock = {
  requestSingleInstanceLock: vi.fn(() => true),
  quit: vi.fn(),
  whenReady: vi.fn(() => Promise.resolve()),
  on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    if (!appHandlers[event]) appHandlers[event] = []
    appHandlers[event].push(handler)
    return appMock
  }),
  name: 'ToDoList',
  getPath: vi.fn((name: string) => path.join(testRoot, name)),
  setPath: vi.fn(),
  getVersion: vi.fn(() => '0.2.0'),
}

const menuMock = {
  buildFromTemplate: vi.fn(() => ({ items: [] })),
  setApplicationMenu: vi.fn(),
}

vi.mock('electron', async () => {
  return {
    app: appMock,
    BrowserWindow: BrowserWindowMock,
    Menu: menuMock,
    ipcMain: {
      handle: vi.fn(),
      removeHandler: vi.fn(),
      listeners: vi.fn(() => []),
    },
  }
})

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  windowInstances.length = 0
  BrowserWindowMock.getAllWindows.mockReturnValue([])
  Object.keys(appHandlers).forEach((key) => delete appHandlers[key])
  delete process.env.ELECTRON_RENDERER_URL
})

afterAll(() => {
  fs.rmSync(testRoot, { recursive: true, force: true })
})

describe('window creation', () => {
  it('creates a BrowserWindow with the correct title and size', async () => {
    const { createMainWindow } = await import('../../main/window')
    createMainWindow()

    expect(BrowserWindowMock).toHaveBeenCalledTimes(1)
    const options = BrowserWindowMock.mock
      .calls[0][0] as Electron.BrowserWindowConstructorOptions
    expect(options.title).toBe('待办清单')
    expect(options.width).toBe(1200)
    expect(options.height).toBe(800)
    expect(options.minWidth).toBe(800)
    expect(options.minHeight).toBe(600)
    expect(options.webPreferences?.contextIsolation).toBe(true)
    expect(options.webPreferences?.nodeIntegration).toBe(false)
    expect(options.webPreferences?.preload).toContain('preload.js')
  })

  it('returns the same window instance when called twice', async () => {
    const { createMainWindow } = await import('../../main/window')
    const win1 = createMainWindow()
    const win2 = createMainWindow()

    expect(win1).toBe(win2)
    expect(BrowserWindowMock).toHaveBeenCalledTimes(1)
  })

  it('loads the Vite dev server URL in development', async () => {
    process.env.ELECTRON_RENDERER_URL = 'http://localhost:5173'
    const { createMainWindow } = await import('../../main/window')
    const win = createMainWindow() as ReturnType<typeof createMockBrowserWindow>

    expect(win.loadURL).toHaveBeenCalledWith('http://localhost:5173')
    expect(win.loadFile).not.toHaveBeenCalled()
  })

  it('loads the built renderer index.html in production', async () => {
    const { createMainWindow } = await import('../../main/window')
    const win = createMainWindow() as ReturnType<typeof createMockBrowserWindow>

    expect(win.loadFile).toHaveBeenCalled()
    expect(win.loadFile.mock.calls[0][0]).toContain('index.html')
    expect(win.loadURL).not.toHaveBeenCalled()
  })

  it('focuses, restores and shows the existing window when requested', async () => {
    const { createMainWindow, focusMainWindow } =
      await import('../../main/window')
    const win = createMainWindow() as ReturnType<typeof createMockBrowserWindow>
    win.isMinimized.mockReturnValue(true)

    focusMainWindow()

    expect(win.restore).toHaveBeenCalled()
    expect(win.show).toHaveBeenCalled()
    expect(win.focus).toHaveBeenCalled()
  })
})

describe('single-instance lock', () => {
  it('requests a single-instance lock on startup', async () => {
    appMock.requestSingleInstanceLock.mockReturnValue(true)
    await import('../../main/main')

    expect(appMock.requestSingleInstanceLock).toHaveBeenCalled()
  })

  it('quits the app when the lock is not obtained', async () => {
    appMock.requestSingleInstanceLock.mockReturnValue(false)
    await import('../../main/main')

    expect(appMock.quit).toHaveBeenCalled()
    expect(BrowserWindowMock).not.toHaveBeenCalled()
  })

  it('creates the window and menu when the lock is obtained', async () => {
    appMock.requestSingleInstanceLock.mockReturnValue(true)
    appMock.whenReady.mockResolvedValue(undefined)

    await import('../../main/main')
    // Allow the whenReady() promise chain to resolve.
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(menuMock.setApplicationMenu).toHaveBeenCalled()
    expect(BrowserWindowMock).toHaveBeenCalled()
  })

  it('focuses the existing window when a second instance is launched', async () => {
    appMock.requestSingleInstanceLock.mockReturnValue(true)
    appMock.whenReady.mockResolvedValue(undefined)

    await import('../../main/main')
    await new Promise((resolve) => setTimeout(resolve, 0))

    const win = windowInstances[0]
    appHandlers['second-instance']?.forEach((h) => h())

    expect(win.focus).toHaveBeenCalled()
  })
})

describe('data directory wiring', () => {
  it('re-points userData but keeps the original default in the state snapshot', async () => {
    const configDir = path.join(testRoot, 'config')
    const customDir = path.join(testRoot, 'custom-data')
    fs.mkdirSync(configDir, { recursive: true })
    fs.writeFileSync(
      path.join(configDir, 'config.json'),
      JSON.stringify({ version: 1, dataDir: customDir }),
    )
    process.env.TODO_CONFIG_DIR = configDir
    appMock.requestSingleInstanceLock.mockReturnValue(true)

    try {
      // Imported, not statically referenced: the module runs initializeApp on
      // load, which is the boundary this test exercises.
      await import('../../main/main')
      const { getDataDirState } = await import('../../main/services/dataDirState')

      const state = getDataDirState()
      expect(state?.resolution.dir).toBe(customDir)
      expect(state?.defaultDir).toBe(path.join(testRoot, 'userData'))
      expect(appMock.setPath).toHaveBeenCalledWith('userData', customDir)
      expect(appMock.setPath).toHaveBeenCalledWith('sessionData', customDir)
    } finally {
      delete process.env.TODO_CONFIG_DIR
    }
  })
})
