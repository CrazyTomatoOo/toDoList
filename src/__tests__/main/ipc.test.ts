import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ipcMain } from 'electron'
import {
  IPC_CHANNELS,
  type ElectronAPI,
  IPC_CHANNEL_NAMES
} from '../../shared/ipc.js'
import {
  ipcHandlers,
  registerIpcHandlers,
  unregisterIpcHandlers
} from '../../main/ipc/index.js'

// Mock the Electron ipcMain module so tests run in Node (Vitest) without a real
// Electron main process. The handle/removeHandler registrations are recorded in
// memory so we can assert on the contract.
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    removeHandler: vi.fn()
  }
}))

describe('IPC type contract and registration', () => {
  beforeEach(() => {
    ;(ipcMain.handle as ReturnType<typeof vi.fn>).mockClear()
    ;(ipcMain.removeHandler as ReturnType<typeof vi.fn>).mockClear()
  })

  afterEach(() => {
    unregisterIpcHandlers()
  })

  it('registers all declared channels via ipcMain.handle', () => {
    registerIpcHandlers()

    for (const channel of IPC_CHANNEL_NAMES) {
      expect(
        (ipcMain.handle as ReturnType<typeof vi.fn>).mock.calls.some(
          (call: unknown[]) => call[0] === channel
        ),
        `expected ipcMain.handle to be called for ${channel}`
      ).toBe(true)
    }
  })

  it('registers exactly the declared channels and no others', () => {
    registerIpcHandlers()

    const registeredChannels = (ipcMain.handle as ReturnType<typeof vi.fn>).mock.calls.map(
      (call: unknown[]) => call[0]
    )
    expect(registeredChannels.sort()).toEqual(IPC_CHANNEL_NAMES.slice().sort())
  })

  it('declares a ping handler that returns pong: <message>', () => {
    const pingEntry = ipcHandlers.find((h) => h.channel === IPC_CHANNELS.PING)
    expect(pingEntry).toBeDefined()
    expect(pingEntry!.handler('hello')).toBe('pong: hello')
  })

  it('removes all declared handlers via ipcMain.removeHandler', () => {
    registerIpcHandlers()
    unregisterIpcHandlers()

    for (const channel of IPC_CHANNEL_NAMES) {
      expect(
        (ipcMain.removeHandler as ReturnType<typeof vi.fn>).mock.calls.some(
          (call: unknown[]) => call[0] === channel
        ),
        `expected ipcMain.removeHandler to be called for ${channel}`
      ).toBe(true)
    }
  })
})

// Type-only test: if this compiles, the renderer-side type contract is correct.
type _ExpectedPing = ElectronAPI['ping']
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _pingTypeCheck: _ExpectedPing = async (message: string) => `pong: ${message}`
