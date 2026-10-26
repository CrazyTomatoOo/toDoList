import type { DataDirResolution } from '../db/dataDirConfig.js'

/**
 * Startup-time data directory state (issue #13).
 *
 * main.ts resolves the data directory exactly once during initializeApp()
 * (before app.whenReady, because Electron cannot re-point userData later) and
 * stores the resolution here. IPC handlers reuse that snapshot instead of
 * re-running the resolution, so the directory the UI shows is always the one
 * the process actually booted on.
 *
 * Issue #14's `noticeAcknowledged` flag is deliberately NOT cached here: it
 * lives in the settings table (services/configNotice.ts) and is read while
 * building each DataDirState snapshot, so a getState right after
 * data-dir:ackNotice reflects the write without extra invalidation.
 */

let current: DataDirResolution | null = null
let defaultDir = ''
let noStore = false

export interface DataDirStateStore {
  resolution: DataDirResolution
  defaultDir: string
  noStore: boolean
}

export function setDataDirState(state: DataDirStateStore): void {
  current = state.resolution
  defaultDir = state.defaultDir
  noStore = state.noStore
}

/** Returns the resolution captured at startup, or null before it is set. */
export function getDataDirState(): DataDirStateStore | null {
  return current ? { resolution: current, defaultDir, noStore } : null
}
