import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * data-dir:choose handler tests (issue #15).
 *
 * The directory picker is driven through the same `__dialogMock` global that
 * importExport.ts's e2e spec uses, so the test exercises the real handler —
 * only the native dialog is stubbed.
 */

vi.mock('electron', () => ({
  app: { getVersion: vi.fn(() => '0.2.0-test') },
  dialog: { showOpenDialog: vi.fn() },
  shell: { openPath: vi.fn() },
}))

// The choose handler never triggers recovery, but its import graph reaches
// safeMode → storageStartup; stub the latter so the (real) database/scheduler
// chain never loads in this test.
const { startStorageServicesMock } = vi.hoisted(() => ({
  startStorageServicesMock: vi.fn(),
}))
vi.mock('../../main/services/storageStartup.js', () => ({
  startStorageServices: startStorageServicesMock,
}))

import { IPC_CHANNELS, type ChooseDataDirResult } from '../../shared/ipc.js'
import { dataDirHandlers } from '../../main/ipc/handlers/dataDir.js'
import { setDataDirState } from '../../main/services/dataDirState.js'
import { createIpcHarness } from './ipc.harness.js'

interface DialogMock {
  showOpenDialog: (
    options: Electron.OpenDialogOptions,
  ) => Promise<Electron.OpenDialogReturnValue>
}

function setDialogMock(mock: DialogMock): void {
  ;(globalThis as unknown as { __dialogMock?: DialogMock }).__dialogMock = mock
}

function registerDataDirHandlers() {
  const harness = createIpcHarness()
  for (const { channel, handler } of dataDirHandlers) {
    harness.handle(channel, handler as (...args: unknown[]) => unknown)
  }
  return harness
}

const testRoot = path.join(os.tmpdir(), `todolist-choose-test-${process.pid}`)
const CONFIG_PATH = path.join(testRoot, 'config', 'config.json')
const DEFAULT_DIR = path.join(testRoot, 'default-data')
const VALID_DIR = path.join(testRoot, 'chosen-data')

function seedStore(noStore: boolean): void {
  setDataDirState({
    resolution: {
      dir: DEFAULT_DIR,
      source: noStore ? 'config' : 'default',
      configPath: CONFIG_PATH,
      problem: noStore
        ? {
            kind: 'unusable-dir',
            detail: `配置的数据目录不可用（不可写）：${DEFAULT_DIR}`,
            fingerprint: 'seed',
          }
        : null,
    },
    defaultDir: DEFAULT_DIR,
    noStore,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true })
})

afterEach(() => {
  delete (globalThis as unknown as { __dialogMock?: DialogMock }).__dialogMock
  fs.rmSync(testRoot, { recursive: true, force: true })
})

describe('data-dir:choose (issue #15)', () => {
  it('returns failure and does not write the config for an invalid directory', async () => {
    seedStore(true)
    // Pre-seed a known config so we can prove it was left untouched.
    fs.writeFileSync(
      CONFIG_PATH,
      JSON.stringify({ version: 1, dataDir: DEFAULT_DIR }, null, 2),
    )
    const before = fs.readFileSync(CONFIG_PATH, 'utf-8')

    // A system directory is never a valid data directory (validateDataDir).
    setDialogMock({
      showOpenDialog: async () => ({ canceled: false, filePaths: ['/System'] }),
    })

    const harness = registerDataDirHandlers()
    const result = (await harness.invoke(
      IPC_CHANNELS.DATA_DIR_CHOOSE,
    )) as ChooseDataDirResult

    expect(result.canceled).toBe(false)
    expect(result.failure).toBe('位于系统目录')
    expect(result.dir).toBeUndefined()
    // Config untouched: the pick was invalid, so no atomic write happened.
    expect(fs.readFileSync(CONFIG_PATH, 'utf-8')).toBe(before)
    expect(startStorageServicesMock).not.toHaveBeenCalled()
  })

  it('atomically writes the config for a valid directory in safe mode', async () => {
    seedStore(true)

    setDialogMock({
      showOpenDialog: async () => ({
        canceled: false,
        filePaths: [VALID_DIR],
      }),
    })

    const harness = registerDataDirHandlers()
    const result = (await harness.invoke(
      IPC_CHANNELS.DATA_DIR_CHOOSE,
    )) as ChooseDataDirResult

    expect(result.canceled).toBe(false)
    expect(result.dir).toBe(VALID_DIR)
    expect(result.failure).toBeUndefined()

    // The pick was valid: the bootstrap config was atomically rewritten.
    const written = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
    expect(written).toEqual({ version: 1, dataDir: VALID_DIR })
    // No stray temp file left behind by the atomic write.
    expect(fs.existsSync(`${CONFIG_PATH}.tmp`)).toBe(false)
  })

  it('validates only (no config write) when not in safe mode', async () => {
    seedStore(false)

    setDialogMock({
      showOpenDialog: async () => ({
        canceled: false,
        filePaths: [VALID_DIR],
      }),
    })

    const harness = registerDataDirHandlers()
    const result = (await harness.invoke(
      IPC_CHANNELS.DATA_DIR_CHOOSE,
    )) as ChooseDataDirResult

    expect(result.dir).toBe(VALID_DIR)
    // Normal mode leaves the write to data-dir:apply (issue #16).
    expect(fs.existsSync(CONFIG_PATH)).toBe(false)
  })

  it('returns canceled when the user dismisses the dialog', async () => {
    seedStore(true)

    setDialogMock({
      showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
    })

    const harness = registerDataDirHandlers()
    const result = (await harness.invoke(
      IPC_CHANNELS.DATA_DIR_CHOOSE,
    )) as ChooseDataDirResult

    expect(result.canceled).toBe(true)
    expect(result.dir).toBeUndefined()
    expect(result.failure).toBeUndefined()
    expect(fs.existsSync(CONFIG_PATH)).toBe(false)
  })
})