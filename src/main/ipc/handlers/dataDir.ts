import { app, shell } from 'electron'
import {
  IPC_CHANNELS,
  type IpcHandlers,
  type DataDirState,
} from '../../../shared/ipc.js'
import { getDataDirState } from '../../services/dataDirState.js'
import {
  saveNoticeAcknowledgement,
  isNoticeAcknowledged,
} from '../../services/configNotice.js'

/**
 * data-dir IPC handlers (issues #13 and #14).
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
  const fingerprint = resolution.problem?.fingerprint ?? ''

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
    // An unreadable settings table (locked database, unusable directory)
    // degrades to "not acknowledged" — same contract as ackNotice: the
    // banner reappears every launch instead of breaking the snapshot.
    noticeAcknowledged: checkAcknowledged(fingerprint),
  }
}

function checkAcknowledged(fingerprint: string): boolean {
  if (fingerprint === '') {
    return false
  }

  try {
    return isNoticeAcknowledged(fingerprint)
  } catch {
    return false
  }
}

function revealDataDir(): void {
  const state = getDataDirState()

  if (!state) {
    throw new Error('数据目录尚未解析（应用未完成启动初始化）')
  }

  shell.openPath(state.resolution.dir)
}

/**
 * Acknowledge the current broken config (issue #14): persist its fingerprint
 * in the settings table of the data directory in use. A config that parses
 * again removes the key, so a future breakage is announced fresh.
 *
 * Degrades instead of throwing: when the database cannot be written (unusable
 * directory, locked file), the acknowledgement is simply not persisted and
 * the banner reappears on the next launch — the app keeps running.
 */
function acknowledgeNotice(): void {
  const state = getDataDirState()

  if (!state) {
    throw new Error('数据目录尚未解析（应用未完成启动初始化）')
  }

  const fingerprint = state.resolution.problem?.fingerprint ?? null

  try {
    saveNoticeAcknowledgement(fingerprint)
  } catch (error) {
    console.warn(
      `无法写入配置提示的确认记录，下次启动将再次提示：${String(error)}`,
    )
  }
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
  {
    channel: IPC_CHANNELS.DATA_DIR_ACK_NOTICE,
    handler: acknowledgeNotice,
  },
] satisfies {
  [
    K in keyof Pick<
      IpcHandlers,
      | typeof IPC_CHANNELS.DATA_DIR_GET_STATE
      | typeof IPC_CHANNELS.DATA_DIR_REVEAL
      | typeof IPC_CHANNELS.DATA_DIR_ACK_NOTICE
    >
  ]: { channel: K; handler: IpcHandlers[K] }
}[keyof Pick<
  IpcHandlers,
  | typeof IPC_CHANNELS.DATA_DIR_GET_STATE
  | typeof IPC_CHANNELS.DATA_DIR_REVEAL
  | typeof IPC_CHANNELS.DATA_DIR_ACK_NOTICE
>][]
