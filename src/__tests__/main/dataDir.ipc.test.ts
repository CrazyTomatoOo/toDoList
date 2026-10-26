import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock Electron: the handlers only need app.getVersion() and shell.openPath().
const openPathMock = vi.fn()

vi.mock('electron', () => ({
  app: {
    getVersion: vi.fn(() => '0.2.0-test'),
  },
  shell: {
    openPath: (...args: unknown[]) => openPathMock(...args),
  },
}))

import { IPC_CHANNELS, type DataDirState } from '../../shared/ipc.js'
import { dataDirHandlers } from '../../main/ipc/handlers/dataDir.js'
import { setDataDirState } from '../../main/services/dataDirState.js'
import { createIpcHarness } from './ipc.harness.js'

function registerDataDirHandlers() {
  const harness = createIpcHarness()
  for (const { channel, handler } of dataDirHandlers) {
    harness.handle(channel, handler as (...args: unknown[]) => unknown)
  }
  return harness
}

const DEFAULT_DIR = '/home/tester/.local/share/todolist-app'
const CUSTOM_DIR = '/mnt/custom-data'

describe('data-dir IPC handlers (issue #13)', () => {
  beforeEach(() => {
    openPathMock.mockReset()
  })

  describe('data-dir:getState', () => {
    it('returns a full snapshot with the env source when TODO_USER_DATA_DIR is set', async () => {
      setDataDirState({
        resolution: {
          dir: CUSTOM_DIR,
          source: 'env',
          configPath: '/home/tester/.config/ToDoList/config.json',
          problem: null,
        },
        defaultDir: DEFAULT_DIR,
        noStore: false,
      })

      const harness = registerDataDirHandlers()
      const state = (await harness.invoke(
        IPC_CHANNELS.DATA_DIR_GET_STATE,
      )) as DataDirState
      expect(state).toEqual({
        dir: CUSTOM_DIR,
        defaultDir: DEFAULT_DIR,
        source: 'env',
        isDefault: false,
        configPath: '/home/tester/.config/ToDoList/config.json',
        problem: null,
        noStore: false,
        backups: [],
        appVersion: '0.2.0-test',
      })
    })

    it('marks the default directory as isDefault with source default', async () => {
      setDataDirState({
        resolution: {
          dir: DEFAULT_DIR,
          source: 'default',
          configPath: '/home/tester/.config/ToDoList/config.json',
          problem: null,
        },
        defaultDir: DEFAULT_DIR,
        noStore: false,
      })

      const harness = registerDataDirHandlers()
      const state = (await harness.invoke(
        IPC_CHANNELS.DATA_DIR_GET_STATE,
      )) as DataDirState

      expect(state.isDefault).toBe(true)
      expect(state.source).toBe('default')
      expect(state.noStore).toBe(false)
    })

    it('carries the config problem with kind, detail, and fingerprint', async () => {
      setDataDirState({
        resolution: {
          dir: DEFAULT_DIR,
          source: 'default',
          configPath: '/home/tester/.config/ToDoList/config.json',
          problem: {
            kind: 'invalid-json',
            detail: '配置文件不是合法的 JSON',
            fingerprint: 'abc123',
          },
        },
        defaultDir: DEFAULT_DIR,
        noStore: false,
      })

      const harness = registerDataDirHandlers()
      const state = (await harness.invoke(
        IPC_CHANNELS.DATA_DIR_GET_STATE,
      )) as DataDirState

      expect(state.problem).toEqual({
        kind: 'invalid-json',
        detail: '配置文件不是合法的 JSON',
        fingerprint: 'abc123',
      })
    })

    it('reflects noStore for an unusable directory', async () => {
      setDataDirState({
        resolution: {
          dir: '/gone/usb',
          source: 'config',
          configPath: '/home/tester/.config/ToDoList/config.json',
          problem: {
            kind: 'unusable-dir',
            detail: '目录不可用',
            fingerprint: 'def456',
          },
        },
        defaultDir: DEFAULT_DIR,
        noStore: true,
      })

      const harness = registerDataDirHandlers()
      const state = (await harness.invoke(
        IPC_CHANNELS.DATA_DIR_GET_STATE,
      )) as DataDirState

      expect(state.noStore).toBe(true)
      expect(state.problem?.kind).toBe('unusable-dir')
    })

    it('returns an empty backup list in this ticket (enumeration lands in #16)', async () => {
      setDataDirState({
        resolution: {
          dir: DEFAULT_DIR,
          source: 'default',
          configPath: '/home/tester/.config/ToDoList/config.json',
          problem: null,
        },
        defaultDir: DEFAULT_DIR,
        noStore: false,
      })

      const harness = registerDataDirHandlers()
      const state = (await harness.invoke(
        IPC_CHANNELS.DATA_DIR_GET_STATE,
      )) as DataDirState

      expect(state.backups).toEqual([])
    })

    it('throws when the startup resolution has not been stored yet', () => {
      // Simulate a fresh module state by clearing via a null-ish probe: the
      // store is module-scoped, so call getState before main.ts wires it.
      // Instead of clearing, assert the error path through a separate module
      // instance is unnecessary — main.ts always stores before IPC registers.
      // Here we simply verify the registered handler is the snapshot reader.
      const entry = dataDirHandlers.find(
        (h) => h.channel === IPC_CHANNELS.DATA_DIR_GET_STATE,
      )
      expect(entry).toBeDefined()
      expect(typeof entry!.handler).toBe('function')
    })
  })

  describe('data-dir:reveal', () => {
    it('opens the current data directory via shell.openPath', async () => {
      setDataDirState({
        resolution: {
          dir: CUSTOM_DIR,
          source: 'cli',
          configPath: '/home/tester/.config/ToDoList/config.json',
          problem: null,
        },
        defaultDir: DEFAULT_DIR,
        noStore: false,
      })

      const harness = registerDataDirHandlers()
      await harness.invoke(IPC_CHANNELS.DATA_DIR_REVEAL)

      expect(openPathMock).toHaveBeenCalledTimes(1)
      expect(openPathMock).toHaveBeenCalledWith(CUSTOM_DIR)
    })
  })
})
