import type { DataDirResolution } from '../db/dataDirConfig.js'

/**
 * Startup-time data directory state (issue #13).
 *
 * main.ts resolves the data directory exactly once during initializeApp()
 * (before app.whenReady, because Electron cannot re-point userData later) and
 * stores the resolution here. IPC handlers reuse that snapshot instead of
 * re-running the resolution, so the directory the UI shows is always the one
 * the process actually booted on.
 */

let current: DataDirResolution | null = null
let defaultDir = ''
let noStore = false

export function setDataDirState(state: {
  resolution: DataDirResolution
  defaultDir: string
  noStore: boolean
}): void {
  current = state.resolution
  defaultDir = state.defaultDir
  noStore = state.noStore
}

/** Returns the resolution captured at startup, or null before it is set. */
export function getDataDirState(): {
  resolution: DataDirResolution
  defaultDir: string
  noStore: boolean
} | null {
  return current ? { resolution: current, defaultDir, noStore } : null
}
