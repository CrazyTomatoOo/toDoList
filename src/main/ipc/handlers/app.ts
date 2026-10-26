import { app } from 'electron'
import { IPC_CHANNELS, type IpcHandlers } from '../../../shared/ipc.js'

/**
 * App lifecycle IPC handlers (issue #15).
 *
 * `app:relaunch` restarts the process — used after `data-dir:choose` commits a
 * new directory in safe mode. `app:quit` is the graceful counterpart for the
 * safe-mode "退出" button (fires before-quit, closes windows, then exits).
 */
function relaunchApp(): void {
  app.relaunch()
  app.exit(0)
}

function quitApp(): void {
  app.quit()
}

export const appHandlers = [
  {
    channel: IPC_CHANNELS.APP_RELAUNCH,
    handler: relaunchApp,
  },
  {
    channel: IPC_CHANNELS.APP_QUIT,
    handler: quitApp,
  },
] satisfies {
  [
    K in keyof Pick<
      IpcHandlers,
      typeof IPC_CHANNELS.APP_RELAUNCH | typeof IPC_CHANNELS.APP_QUIT
    >
  ]: { channel: K; handler: IpcHandlers[K] }
}[keyof Pick<
  IpcHandlers,
  typeof IPC_CHANNELS.APP_RELAUNCH | typeof IPC_CHANNELS.APP_QUIT
>][]
