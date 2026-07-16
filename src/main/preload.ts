import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC_CHANNELS, REMINDER_CLICKED_CHANNEL, REMINDER_FIRED_CHANNEL, type ElectronAPI, type ReminderClickedPayload } from '../shared/ipc.js'

/**
 * Exposes a minimal, typed API to the renderer process.
 *
 * SECURITY: Only whitelisted IPC channels are exposed. Node APIs, require,
 * process, and raw ipcRenderer are never exposed.
 */
const electronAPI: ElectronAPI = {
  ping: (message: string) => ipcRenderer.invoke(IPC_CHANNELS.PING, message),
  tasks: {
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.TASK_CREATE, input),
    getById: (id) => ipcRenderer.invoke(IPC_CHANNELS.TASK_GET_BY_ID, id),
    getByListId: (listId, options) => ipcRenderer.invoke(IPC_CHANNELS.TASK_GET_BY_LIST_ID, listId, options),
    update: (id, input) => ipcRenderer.invoke(IPC_CHANNELS.TASK_UPDATE, id, input),
    delete: (id) => ipcRenderer.invoke(IPC_CHANNELS.TASK_DELETE, id),
    search: (query, filters) => ipcRenderer.invoke(IPC_CHANNELS.TASK_SEARCH, query, filters),
    updateSortOrder: (listId, taskIds) => ipcRenderer.invoke(IPC_CHANNELS.TASK_UPDATE_SORT_ORDER, listId, taskIds)
  },
  lists: {
    create: (name) => ipcRenderer.invoke(IPC_CHANNELS.LIST_CREATE, name),
    getById: (id) => ipcRenderer.invoke(IPC_CHANNELS.LIST_GET_BY_ID, id),
    getAll: () => ipcRenderer.invoke(IPC_CHANNELS.LIST_GET_ALL),
    getWithTaskCount: () => ipcRenderer.invoke(IPC_CHANNELS.LIST_GET_WITH_TASK_COUNT),
    update: (id, name) => ipcRenderer.invoke(IPC_CHANNELS.LIST_UPDATE, id, name),
    delete: (id) => ipcRenderer.invoke(IPC_CHANNELS.LIST_DELETE, id)
  },
  reminders: {
    onReminderClicked: (callback) => {
      const handler = (_event: IpcRendererEvent, payload: ReminderClickedPayload) => callback(payload)
      ipcRenderer.on(REMINDER_CLICKED_CHANNEL, handler)
      return () => {
        ipcRenderer.removeListener(REMINDER_CLICKED_CHANNEL, handler)
      }
    },
    onReminderFired: (callback) => {
      const handler = (_event: IpcRendererEvent, payload: ReminderClickedPayload) => callback(payload)
      ipcRenderer.on(REMINDER_FIRED_CHANNEL, handler)
      return () => {
        ipcRenderer.removeListener(REMINDER_FIRED_CHANNEL, handler)
      }
    }
  },
  importExport: {
    exportJson: () => ipcRenderer.invoke(IPC_CHANNELS.IMPORT_EXPORT_EXPORT_JSON),
    exportCsv: () => ipcRenderer.invoke(IPC_CHANNELS.IMPORT_EXPORT_EXPORT_CSV),
    importFile: () => ipcRenderer.invoke(IPC_CHANNELS.IMPORT_EXPORT_IMPORT_FILE)
  },
  theme: {
    getMode: () => ipcRenderer.invoke(IPC_CHANNELS.THEME_GET_MODE),
    setMode: (mode) => ipcRenderer.invoke(IPC_CHANNELS.THEME_SET_MODE, mode),
    getSystemTheme: () => ipcRenderer.invoke(IPC_CHANNELS.THEME_GET_SYSTEM_THEME)
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
