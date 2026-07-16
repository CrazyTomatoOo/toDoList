import { ipcMain } from 'electron'
import { IPC_CHANNELS, type IpcHandlers } from '../../../shared/ipc.js'
import { listHandlers } from './lists.js'
import { taskHandlers } from './tasks.js'
import { importExportHandlers } from './importExport.js'
import { themeHandlers } from './theme.js'

type HandlerRegistration = {
  [K in keyof IpcHandlers]: {
    channel: K
    handler: IpcHandlers[K]
  }
}[keyof IpcHandlers]

type CallableHandler = (...args: unknown[]) => unknown

const pingHandler: IpcHandlers[typeof IPC_CHANNELS.PING] = (message: string) => {
  return `pong: ${message}`
}

export const ipcHandlers: HandlerRegistration[] = [
  { channel: IPC_CHANNELS.PING, handler: pingHandler },
  ...taskHandlers,
  ...listHandlers,
  ...importExportHandlers,
  ...themeHandlers,
]

export function registerIpcHandlers(): void {
  for (const { channel, handler } of ipcHandlers) {
    ipcMain.handle(channel, async (_event, ...args: unknown[]) => {
      return (handler as CallableHandler)(...args)
    })
  }
}

export function unregisterIpcHandlers(): void {
  for (const { channel } of ipcHandlers) {
    ipcMain.removeHandler(channel)
  }
}
