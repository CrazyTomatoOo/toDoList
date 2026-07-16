/**
 * IPC channel definitions and type contracts.
 *
 * This file is the single source of truth for all renderer ↔ main process
 * communication. Keep it free of runtime dependencies so it can be imported
 * by both main and renderer.
 */

/** Channel name constants. */
export const IPC_CHANNELS = {
  PING: 'ipc:ping',
  TASK_CREATE: 'tasks:create',
  TASK_GET_BY_ID: 'tasks:getById',
  TASK_GET_BY_LIST_ID: 'tasks:getByListId',
  TASK_UPDATE: 'tasks:update',
  TASK_DELETE: 'tasks:delete',
  TASK_SEARCH: 'tasks:search',
  TASK_UPDATE_SORT_ORDER: 'tasks:updateSortOrder',
  LIST_CREATE: 'lists:create',
  LIST_GET_BY_ID: 'lists:getById',
  LIST_GET_ALL: 'lists:getAll',
  LIST_GET_WITH_TASK_COUNT: 'lists:getWithTaskCount',
  LIST_UPDATE: 'lists:update',
  LIST_DELETE: 'lists:delete',
  IMPORT_EXPORT_EXPORT_JSON: 'import-export:exportJson',
  IMPORT_EXPORT_EXPORT_CSV: 'import-export:exportCsv',
  IMPORT_EXPORT_IMPORT_FILE: 'import-export:importFile',
  THEME_GET_MODE: 'theme:getMode',
  THEME_SET_MODE: 'theme:setMode',
  THEME_GET_SYSTEM_THEME: 'theme:getSystemTheme'
} as const

export const REMINDER_CLICKED_CHANNEL = 'reminder:clicked' as const
export const REMINDER_FIRED_CHANNEL = 'reminder:fired' as const

export type Priority = 'high' | 'medium' | 'low'
export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export interface ListRow {
  id: number
  name: string
  created_at: string
  updated_at: string
}

export type ListWithTaskCount = ListRow & { totalCount: number; completedCount: number }

export interface TaskRow {
  id: number
  list_id: number
  title: string
  description: string | null
  priority: Priority
  due_date: string | null
  reminder_at: string | null
  completed: 0 | 1
  sort_order: number
  created_at: string
  updated_at: string
}

export interface CreateTaskInput {
  list_id: number
  title: string
  description?: string | null
  priority?: Priority
  due_date?: string | null
  reminder_at?: string | null
}

export interface UpdateTaskInput {
  title: string
  description: string | null
  priority: Priority
  due_date: string | null
  reminder_at: string | null
  completed: boolean
  sort_order: number
}

export type TaskListOptions = { completed?: boolean; priority?: Priority; search?: string }
export type TaskSearchFilters = { listId?: number; completed?: boolean; priority?: Priority }

export interface ImportResult {
  importedLists: number
  importedTasks: number
}

export interface ExportResult {
  filePath: string
}

/** Maps each channel to its handler signature. */
export interface IpcHandlers {
  [IPC_CHANNELS.PING]: (message: string) => string
  [IPC_CHANNELS.TASK_CREATE]: (input: CreateTaskInput) => TaskRow
  [IPC_CHANNELS.TASK_GET_BY_ID]: (id: number) => TaskRow | undefined
  [IPC_CHANNELS.TASK_GET_BY_LIST_ID]: (listId: number, options?: TaskListOptions) => TaskRow[]
  [IPC_CHANNELS.TASK_UPDATE]: (id: number, input: Partial<UpdateTaskInput>) => TaskRow
  [IPC_CHANNELS.TASK_DELETE]: (id: number) => void
  [IPC_CHANNELS.TASK_SEARCH]: (query: string, filters?: TaskSearchFilters) => TaskRow[]
  [IPC_CHANNELS.TASK_UPDATE_SORT_ORDER]: (listId: number, taskIds: number[]) => void
  [IPC_CHANNELS.LIST_CREATE]: (name: string) => ListRow
  [IPC_CHANNELS.LIST_GET_BY_ID]: (id: number) => ListRow | undefined
  [IPC_CHANNELS.LIST_GET_ALL]: () => ListRow[]
  [IPC_CHANNELS.LIST_GET_WITH_TASK_COUNT]: () => ListWithTaskCount[]
  [IPC_CHANNELS.LIST_UPDATE]: (id: number, name: string) => ListRow
  [IPC_CHANNELS.LIST_DELETE]: (id: number) => void
  [IPC_CHANNELS.IMPORT_EXPORT_EXPORT_JSON]: () => Promise<ExportResult>
  [IPC_CHANNELS.IMPORT_EXPORT_EXPORT_CSV]: () => Promise<ExportResult>
  [IPC_CHANNELS.IMPORT_EXPORT_IMPORT_FILE]: () => Promise<ImportResult>
  [IPC_CHANNELS.THEME_GET_MODE]: () => ThemeMode
  [IPC_CHANNELS.THEME_SET_MODE]: (mode: ThemeMode) => void
  [IPC_CHANNELS.THEME_GET_SYSTEM_THEME]: () => ResolvedTheme
}

/** Helper type: request payload for a given channel. */
export type IpcRequest<T extends keyof IpcHandlers> = Parameters<IpcHandlers[T]>

/** Helper type: response payload for a given channel. */
export type IpcResponse<T extends keyof IpcHandlers> = ReturnType<IpcHandlers[T]>

export interface ReminderClickedPayload {
  taskId: number
  listId: number
}

/** Shape of the API exposed to the renderer via contextBridge. */
export type ElectronAPI = {
  ping: (message: string) => Promise<string>
  tasks: {
    create: (input: CreateTaskInput) => Promise<TaskRow>
    getById: (id: number) => Promise<TaskRow | undefined>
    getByListId: (listId: number, options?: TaskListOptions) => Promise<TaskRow[]>
    update: (id: number, input: Partial<UpdateTaskInput>) => Promise<TaskRow>
    delete: (id: number) => Promise<void>
    search: (query: string, filters?: TaskSearchFilters) => Promise<TaskRow[]>
    updateSortOrder: (listId: number, taskIds: number[]) => Promise<void>
  }
  lists: {
    create: (name: string) => Promise<ListRow>
    getById: (id: number) => Promise<ListRow | undefined>
    getAll: () => Promise<ListRow[]>
    getWithTaskCount: () => Promise<ListWithTaskCount[]>
    update: (id: number, name: string) => Promise<ListRow>
    delete: (id: number) => Promise<void>
  }
  reminders: {
    onReminderClicked: (callback: (payload: ReminderClickedPayload) => void) => () => void
    onReminderFired: (callback: (payload: ReminderClickedPayload) => void) => () => void
  }
  importExport: {
    exportJson: () => Promise<ExportResult>
    exportCsv: () => Promise<ExportResult>
    importFile: () => Promise<ImportResult>
  }
  theme: {
    getMode: () => Promise<ThemeMode>
    setMode: (mode: ThemeMode) => Promise<void>
    getSystemTheme: () => Promise<ResolvedTheme>
  }
}

/** All channel names as a runtime array for registration/validation. */
export const IPC_CHANNEL_NAMES: (keyof IpcHandlers)[] = Object.values(IPC_CHANNELS)
