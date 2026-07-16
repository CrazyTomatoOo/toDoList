import { IPC_CHANNELS, type IpcHandlers } from '../../../shared/ipc.js'
import {
  createList,
  deleteList,
  getAllLists,
  getListById,
  getListsWithTaskCount,
  updateList,
} from '../../db/repositories/listRepository.js'

export const listHandlers = [
  { channel: IPC_CHANNELS.LIST_CREATE, handler: createList },
  { channel: IPC_CHANNELS.LIST_GET_BY_ID, handler: getListById },
  { channel: IPC_CHANNELS.LIST_GET_ALL, handler: getAllLists },
  { channel: IPC_CHANNELS.LIST_GET_WITH_TASK_COUNT, handler: getListsWithTaskCount },
  { channel: IPC_CHANNELS.LIST_UPDATE, handler: updateList },
  { channel: IPC_CHANNELS.LIST_DELETE, handler: deleteList },
] satisfies {
  [K in keyof Pick<
    IpcHandlers,
    | typeof IPC_CHANNELS.LIST_CREATE
    | typeof IPC_CHANNELS.LIST_GET_BY_ID
    | typeof IPC_CHANNELS.LIST_GET_ALL
    | typeof IPC_CHANNELS.LIST_GET_WITH_TASK_COUNT
    | typeof IPC_CHANNELS.LIST_UPDATE
    | typeof IPC_CHANNELS.LIST_DELETE
  >]: { channel: K; handler: IpcHandlers[K] }
}[keyof Pick<
  IpcHandlers,
  | typeof IPC_CHANNELS.LIST_CREATE
  | typeof IPC_CHANNELS.LIST_GET_BY_ID
  | typeof IPC_CHANNELS.LIST_GET_ALL
  | typeof IPC_CHANNELS.LIST_GET_WITH_TASK_COUNT
  | typeof IPC_CHANNELS.LIST_UPDATE
  | typeof IPC_CHANNELS.LIST_DELETE
>][]
