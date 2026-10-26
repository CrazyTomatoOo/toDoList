import { app } from 'electron'
import fs from 'node:fs'
import { resolveDataDir } from '../db/dataDirConfig.js'
import { getDataDirState, setDataDirState } from './dataDirState.js'
import { startStorageServices } from './storageStartup.js'

/**
 * Safe-mode recovery (issue #15): re-run the data directory resolution in
 * place and, if the directory became usable again, complete the deferred
 * storage startup WITHOUT a relaunch.
 *
 * Returns true when the directory recovered (so the caller can report a fresh,
 * noStore=false snapshot), false when it is still unusable.
 */
export function recoverDataDir(): boolean {
  const state = getDataDirState()

  if (!state || !state.noStore) {
    return false
  }

  const resolveInput = state.resolveInput

  if (!resolveInput) {
    // No resolve input retained: nothing to re-resolve against. This cannot
    // happen in practice (main.ts always stores it), but fail-safe by staying
    // in safe mode rather than opening a database at the wrong path.
    return false
  }

  const fresh = resolveDataDir(resolveInput)

  if (fresh.problem?.kind === 'unusable-dir') {
    // Still unusable: refresh the stored problem (the reason text may have
    // changed, e.g. from "not a directory" to "unwritable") and stay in safe mode.
    setDataDirState({
      resolution: fresh,
      defaultDir: state.defaultDir,
      noStore: true,
      resolveInput,
    })
    return false
  }

  // Recovered. Apply the directory now — getDbPath() reads
  // app.getPath('userData') lazily at first getDb(), so re-pointing it here is
  // enough for the database. sessionData can no longer be moved after the
  // window/Chromium started; ADR-0005 tolerates Chromium scratch staying at
  // the default location, so that re-point is best-effort.
  fs.mkdirSync(fresh.dir, { recursive: true })
  app.setPath('userData', fresh.dir)
  try {
    app.setPath('sessionData', fresh.dir)
  } catch {
    // Chromium already bound its session to the boot-time default — fine.
  }

  setDataDirState({
    resolution: fresh,
    defaultDir: state.defaultDir,
    noStore: false,
    resolveInput,
  })

  try {
    startStorageServices()
  } catch (error) {
    // The directory itself is now valid; a database-level failure surfaces
    // through the IPC handlers as usual instead of pinning the user in safe
    // mode forever.
    console.error('数据目录恢复后存储初始化失败：', error)
  }

  return true
}