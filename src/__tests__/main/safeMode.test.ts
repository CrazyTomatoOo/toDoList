import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * Safe-mode startup + recovery (issue #15).
 *
 * Two boundaries are exercised:
 *  1. main.ts boot — an unusable data directory must open the window
 *     WITHOUT starting the storage services (and without re-pointing
 *     userData), so no database is opened or created at the default location.
 *  2. recoverDataDir() — retry re-resolves the directory in place; a
 *     recovered directory flips noStore to false and starts storage once.
 */

const testRoot = path.join(os.tmpdir(), `todolist-safemode-test-${process.pid}`)

const { startStorageServicesMock } = vi.hoisted(() => ({
  startStorageServicesMock: vi.fn(),
}))
vi.mock('../../main/services/storageStartup.js', () => ({
  startStorageServices: startStorageServicesMock,
}))

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
      ;(eventHandlers[event] ??= []).push(handler)
      return instance
    }),
    once: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      ;(eventHandlers[event] ??= []).push(handler)
      return instance
    }),
    webContents: { openDevTools: vi.fn(), send: vi.fn() },
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

const appHandlers: Record<string, Array<(...args: unknown[]) => void>> = {}
const appMock = {
  requestSingleInstanceLock: vi.fn(() => true),
  quit: vi.fn(),
  relaunch: vi.fn(),
  exit: vi.fn(),
  whenReady: vi.fn(() => Promise.resolve()),
  on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    ;(appHandlers[event] ??= []).push(handler)
    return appMock
  }),
  name: 'ToDoList',
  getPath: vi.fn((name: string) => path.join(testRoot, name)),
  setPath: vi.fn(),
  getVersion: vi.fn(() => '0.2.0'),
}

vi.mock('electron', async () => ({
  app: appMock,
  BrowserWindow: BrowserWindowMock,
  Menu: { buildFromTemplate: vi.fn(() => ({ items: [] })), setApplicationMenu: vi.fn() },
  ipcMain: { handle: vi.fn(), removeHandler: vi.fn(), listeners: vi.fn(() => []) },
  dialog: { showOpenDialog: vi.fn() },
  shell: { openPath: vi.fn() },
  nativeTheme: { themeSource: '' },
  Notification: class {},
}))

// A path that validateDataDir will reject as a system directory. We cannot
// mkdir under the OS system path in CI, so the resolution is driven purely by
// the env config below pointing at it; validateDataDir runs isAbsolute +
// system-dir checks before any mkdir probe.
const SYSTEM_DIR = '/System'

function writeBadConfig(dataDir: string): string {
  const configDir = path.join(testRoot, 'config')
  fs.mkdirSync(configDir, { recursive: true })
  fs.writeFileSync(
    path.join(configDir, 'config.json'),
    JSON.stringify({ version: 1, dataDir }),
  )
  return configDir
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  windowInstances.length = 0
  Object.keys(appHandlers).forEach((key) => delete appHandlers[key])
  delete process.env.ELECTRON_RENDERER_URL
  delete process.env.TODO_CONFIG_DIR
})

afterAll(() => {
  fs.rmSync(testRoot, { recursive: true, force: true })
})

describe('safe-mode boot (main.ts)', () => {
  it('opens the window without starting storage or re-pointing userData', async () => {
    process.env.TODO_CONFIG_DIR = writeBadConfig(SYSTEM_DIR)
    appMock.requestSingleInstanceLock.mockReturnValue(true)

    await import('../../main/main')
    await new Promise((resolve) => setTimeout(resolve, 0))

    // Window came up (safe mode IS the entry screen).
    expect(BrowserWindowMock).toHaveBeenCalled()

    // No database was opened, no scheduler/theme started.
    expect(startStorageServicesMock).not.toHaveBeenCalled()
    // userData stayed at the boot-time default — the DB never falls back there.
    expect(appMock.setPath).not.toHaveBeenCalled()

    // The stored snapshot reflects no-store mode.
    const { getDataDirState } = await import('../../main/services/dataDirState')
    expect(getDataDirState()?.noStore).toBe(true)
  })
})

describe('recoverDataDir (retry)', () => {
  it('flips noStore to false and starts storage once the directory is usable', async () => {
    // Resolve inputs are stored at boot even in safe mode. Here the configured
    // directory became usable: resolveDataDir re-resolves to no problem.
    const { validateDataDir } = await import(
      '../../main/db/dataDirValidation.js'
    )
    const { setDataDirState } = await import('../../main/services/dataDirState')
    const configDir = path.join(testRoot, 'config-recover')
    fs.mkdirSync(path.join(configDir, 'ToDoList'), { recursive: true })
    const dataDir = path.join(testRoot, 'recovered-data')
    const defaultDir = path.join(testRoot, 'userData')
    fs.writeFileSync(
      path.join(configDir, 'ToDoList', 'config.json'),
      JSON.stringify({ version: 1, dataDir }),
    )

    const resolveInput = {
      env: {},
      argv: [],
      appDataDir: configDir,
      exeDir: testRoot,
      defaultUserDataDir: defaultDir,
      validate: (dir) => validateDataDir(dir, { resourcesDir: undefined }),
    }

    setDataDirState({
      resolution: {
        dir: defaultDir,
        source: 'default',
        configPath: path.join(configDir, 'ToDoList', 'config.json'),
        problem: {
          kind: 'unusable-dir',
          detail: `配置的数据目录不可用（不可写）：${defaultDir}`,
          fingerprint: 'x',
        },
      },
      defaultDir,
      noStore: true,
      resolveInput,
    })

    const { recoverDataDir } = await import('../../main/services/safeMode')
    const recovered = recoverDataDir()

    expect(recovered).toBe(true)
    expect(startStorageServicesMock).toHaveBeenCalledTimes(1)
    const { getDataDirState } = await import('../../main/services/dataDirState')
    expect(getDataDirState()?.noStore).toBe(false)
  })

  it('stays in safe mode when the directory is still unusable', async () => {
    const { validateDataDir } = await import(
      '../../main/db/dataDirValidation.js'
    )
    const { setDataDirState, getDataDirState } =
      await import('../../main/services/dataDirState')
    const configDir = path.join(testRoot, 'config-still-bad')
    fs.mkdirSync(path.join(configDir, 'ToDoList'), { recursive: true })
    const defaultDir = path.join(testRoot, 'userData')
    fs.writeFileSync(
      path.join(configDir, 'ToDoList', 'config.json'),
      JSON.stringify({ version: 1, dataDir: SYSTEM_DIR }),
    )

    const resolveInput = {
      env: {},
      argv: [],
      appDataDir: configDir,
      exeDir: testRoot,
      defaultUserDataDir: defaultDir,
      validate: (dir) => validateDataDir(dir, { resourcesDir: undefined }),
    }

    setDataDirState({
      resolution: {
        dir: defaultDir,
        source: 'default',
        configPath: path.join(configDir, 'ToDoList', 'config.json'),
        problem: {
          kind: 'unusable-dir',
          detail: `配置的数据目录不可用（位于系统目录）：${SYSTEM_DIR}`,
          fingerprint: 'y',
        },
      },
      defaultDir,
      noStore: true,
      resolveInput,
    })

    const { recoverDataDir } = await import('../../main/services/safeMode')
    const recovered = recoverDataDir()

    expect(recovered).toBe(false)
    expect(startStorageServicesMock).not.toHaveBeenCalled()
    expect(getDataDirState()?.noStore).toBe(true)
  })
})