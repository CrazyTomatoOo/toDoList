import { app, shell } from 'electron'
import {
  IPC_CHANNELS,
  type IpcHandlers,
  type DataDirState,
} from '../../../shared/ipc.js'
import { getDataDirState } from '../../services/dataDirState.js'

/**
 * data-dir IPC handlers (issue #13).
 *
 * getState reuses the resolution captured at startup (see
 * services/dataDirState.ts) — the resolution logic itself lives in
 * db/dataDirConfig.ts and is never re-run here. Backups are listed by issue
 * #16; this ticket returns an empty list.
 */
function getDataDirSnapshot(): DataDirState {
  const state = getDataDirState()

  if (!state) {
    throw new Error('数据目录尚未解析（应用未完成启动初始化）')
  }

  const { resolution, defaultDir, noStore } = state

  return {
    dir: resolution.dir,
    defaultDir,
    source: resolution.source,
    isDefault: resolution.dir === defaultDir,
    configPath: resolution.configPath,
    problem: resolution.problem,
    noStore,
    backups: [],
    appVersion: app.getVersion(),
  }
}

function revealDataDir(): void {
  const state = getDataDirState()

  if (!state) {
    throw new Error('数据目录尚未解析（应用未完成启动初始化）')
  }

  shell.openPath(state.resolution.dir)
}

export const dataDirHandlers = [
  {
    channel: IPC_CHANNELS.DATA_DIR_GET_STATE,
    handler: getDataDirSnapshot,
  },
  {
    channel: IPC_CHANNELS.DATA_DIR_REVEAL,
    handler: revealDataDir,
  },
] satisfies {
  [
    K in keyof Pick<
      IpcHandlers,
      | typeof IPC_CHANNELS.DATA_DIR_GET_STATE
      | typeof IPC_CHANNELS.DATA_DIR_REVEAL
    >
  ]: { channel: K; handler: IpcHandlers[K] }
}[keyof Pick<
  IpcHandlers,
  typeof IPC_CHANNELS.DATA_DIR_GET_STATE | typeof IPC_CHANNELS.DATA_DIR_REVEAL
>][]
