import { app, dialog, shell } from 'electron'
import {
  IPC_CHANNELS,
  type IpcHandlers,
  type DataDirState,
  type ChooseDataDirResult,
} from '../../../shared/ipc.js'
import { getDataDirState } from '../../services/dataDirState.js'
import {
  saveNoticeAcknowledgement,
  isNoticeAcknowledged,
} from '../../services/configNotice.js'
import { recoverDataDir } from '../../services/safeMode.js'
import { getMainWindow } from '../../window.js'
import { validateDataDir } from '../../db/dataDirValidation.js'
import {
  CONFIG_VERSION,
  writeConfigAtomic,
  validationFailureText,
} from '../../db/dataDirConfig.js'

interface DialogMock {
  showOpenDialog: (
    options: Electron.OpenDialogOptions,
  ) => Promise<Electron.OpenDialogReturnValue>
}

function getDialogMock(): DialogMock | undefined {
  return (globalThis as unknown as { __dialogMock?: DialogMock }).__dialogMock
}

/**
 * data-dir IPC handlers (issues #13, #14, #15).
 *
 * getState reuses the resolution captured at startup (see
 * services/dataDirState.ts) — except in safe mode, where a retry re-runs the
 * resolution in-process (services/safeMode.ts) so the app can enter the
 * recovered directory without a relaunch. Backups are listed by issue #16;
 * this ticket returns an empty list.
 */
function getDataDirSnapshot(): DataDirState {
  const state = getDataDirState()

  if (!state) {
    throw new Error('数据目录尚未解析（应用未完成启动初始化）')
  }

  if (state.noStore) {
    // Safe-mode retry (issue #15): re-check the directory. If it recovered,
    // storage services have been started and the stored state flipped.
    recoverDataDir()
  }

  const fresh = getDataDirState() ?? state
  const { resolution, defaultDir, noStore } = fresh
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
    // Safe mode must not touch the database (issue #15): reading the settings
    // table would open/create a DB at the boot-time default userData. In a
    // normal run an unreadable settings table degrades to "not acknowledged"
    // instead of breaking the snapshot.
    noticeAcknowledged: noStore ? false : checkAcknowledged(fingerprint),
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

/**
 * Choose a data directory (issue #15): open the native directory picker and
 * validate the selection immediately. The renderer never touches the native
 * dialog (ADR-0003).
 *
 * In safe mode there is no data to migrate (no database was opened), so a
 * valid pick also commits the bootstrap config atomically and the renderer
 * relaunches afterward. In a normal run the pick is validated only — the
 * config write and migration belong to `data-dir:apply` (issue #16).
 */
async function chooseDataDir(): Promise<ChooseDataDirResult> {
  const state = getDataDirState()

  if (!state) {
    throw new Error('数据目录尚未解析（应用未完成启动初始化）')
  }

  const options: Electron.OpenDialogOptions = {
    title: '选择数据目录',
    buttonLabel: '选择',
    properties: ['openDirectory', 'createDirectory'],
  }

  const mock = getDialogMock()
  const win = getMainWindow()
  const result = mock
    ? await mock.showOpenDialog(options)
    : win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true }
  }

  const dir = result.filePaths[0]
  const failure = validateDataDir(dir, { resourcesDir: process.resourcesPath })

  if (failure) {
    return { canceled: false, failure: validationFailureText(failure) }
  }

  if (state.noStore) {
    writeConfigAtomic(state.resolution.configPath, {
      version: CONFIG_VERSION,
      dataDir: dir,
    })
  }

  return { canceled: false, dir }
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
  {
    channel: IPC_CHANNELS.DATA_DIR_CHOOSE,
    handler: chooseDataDir,
  },
] satisfies {
  [
    K in keyof Pick<
      IpcHandlers,
      | typeof IPC_CHANNELS.DATA_DIR_GET_STATE
      | typeof IPC_CHANNELS.DATA_DIR_REVEAL
      | typeof IPC_CHANNELS.DATA_DIR_ACK_NOTICE
      | typeof IPC_CHANNELS.DATA_DIR_CHOOSE
    >
  ]: { channel: K; handler: IpcHandlers[K] }
}[keyof Pick<
  IpcHandlers,
  | typeof IPC_CHANNELS.DATA_DIR_GET_STATE
  | typeof IPC_CHANNELS.DATA_DIR_REVEAL
  | typeof IPC_CHANNELS.DATA_DIR_ACK_NOTICE
  | typeof IPC_CHANNELS.DATA_DIR_CHOOSE
>][]
