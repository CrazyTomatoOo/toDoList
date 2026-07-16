import { IPC_CHANNELS, type IpcHandlers } from '../../../shared/ipc.js'
import {
  createTask,
  deleteTask,
  getTaskById,
  getTasksByListId,
  searchTasks,
  updateTask,
  updateTaskSortOrder,
} from '../../db/repositories/taskRepository.js'

export const taskHandlers = [
  { channel: IPC_CHANNELS.TASK_CREATE, handler: createTask },
  { channel: IPC_CHANNELS.TASK_GET_BY_ID, handler: getTaskById },
  { channel: IPC_CHANNELS.TASK_GET_BY_LIST_ID, handler: getTasksByListId },
  { channel: IPC_CHANNELS.TASK_UPDATE, handler: updateTask },
  { channel: IPC_CHANNELS.TASK_DELETE, handler: deleteTask },
  { channel: IPC_CHANNELS.TASK_SEARCH, handler: searchTasks },
  { channel: IPC_CHANNELS.TASK_UPDATE_SORT_ORDER, handler: updateTaskSortOrder },
] satisfies {
  [K in keyof Pick<
    IpcHandlers,
    | typeof IPC_CHANNELS.TASK_CREATE
    | typeof IPC_CHANNELS.TASK_GET_BY_ID
    | typeof IPC_CHANNELS.TASK_GET_BY_LIST_ID
    | typeof IPC_CHANNELS.TASK_UPDATE
    | typeof IPC_CHANNELS.TASK_DELETE
    | typeof IPC_CHANNELS.TASK_SEARCH
    | typeof IPC_CHANNELS.TASK_UPDATE_SORT_ORDER
  >]: { channel: K; handler: IpcHandlers[K] }
}[keyof Pick<
  IpcHandlers,
  | typeof IPC_CHANNELS.TASK_CREATE
  | typeof IPC_CHANNELS.TASK_GET_BY_ID
  | typeof IPC_CHANNELS.TASK_GET_BY_LIST_ID
  | typeof IPC_CHANNELS.TASK_UPDATE
  | typeof IPC_CHANNELS.TASK_DELETE
  | typeof IPC_CHANNELS.TASK_SEARCH
  | typeof IPC_CHANNELS.TASK_UPDATE_SORT_ORDER
>][]
