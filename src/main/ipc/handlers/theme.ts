import { IPC_CHANNELS, type IpcHandlers } from '../../../shared/ipc.js'
import { getSavedMode, getSystemTheme, saveMode } from '../../services/theme.js'

export const themeHandlers = [
  { channel: IPC_CHANNELS.THEME_GET_MODE, handler: getSavedMode },
  { channel: IPC_CHANNELS.THEME_SET_MODE, handler: saveMode },
  { channel: IPC_CHANNELS.THEME_GET_SYSTEM_THEME, handler: getSystemTheme },
] satisfies {
  [K in keyof Pick<
    IpcHandlers,
    | typeof IPC_CHANNELS.THEME_GET_MODE
    | typeof IPC_CHANNELS.THEME_SET_MODE
    | typeof IPC_CHANNELS.THEME_GET_SYSTEM_THEME
  >]: { channel: K; handler: IpcHandlers[K] }
}[keyof Pick<
  IpcHandlers,
  | typeof IPC_CHANNELS.THEME_GET_MODE
  | typeof IPC_CHANNELS.THEME_SET_MODE
  | typeof IPC_CHANNELS.THEME_GET_SYSTEM_THEME
>][]
