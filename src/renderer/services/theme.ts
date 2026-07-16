import { useState, useCallback, useEffect } from 'react'
import type { ResolvedTheme, ThemeMode } from '../../shared/ipc'

export type { ResolvedTheme, ThemeMode }

const MODES: ThemeMode[] = ['system', 'light', 'dark']

function isThemeMode(value: string | undefined): value is ThemeMode {
  return value !== undefined && MODES.includes(value as ThemeMode)
}

function currentDocumentTheme(): ResolvedTheme {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

/** Detect system color scheme preference through the main process nativeTheme API. */
export async function getSystemTheme(): Promise<ResolvedTheme> {
  return window.electronAPI.theme.getSystemTheme()
}

/** Read saved mode from SQLite via IPC. Returns 'system' if missing or invalid. */
export async function getSavedMode(): Promise<ThemeMode> {
  const mode = await window.electronAPI.theme.getMode()
  return isThemeMode(mode) ? mode : 'system'
}

/** Persist mode to SQLite via IPC. */
export async function saveMode(mode: ThemeMode): Promise<void> {
  if (!isThemeMode(mode)) {
    throw new Error(`Invalid theme mode: ${mode}`)
  }
  await window.electronAPI.theme.setMode(mode)
}

/** Resolve 'system' to an actual 'light' | 'dark'. */
export async function resolveTheme(mode: ThemeMode): Promise<ResolvedTheme> {
  return mode === 'system' ? getSystemTheme() : mode
}

/** Apply the resolved theme to the document root via data-theme attribute. */
export async function applyTheme(mode: ThemeMode): Promise<ResolvedTheme> {
  const resolved = await resolveTheme(mode)
  document.documentElement.dataset.theme = resolved
  return resolved
}

/** Cycle through modes: system → light → dark → system. */
export function cycleTheme(current: ThemeMode): ThemeMode {
  const idx = MODES.indexOf(current)
  return MODES[(idx + 1) % MODES.length]
}

/** Initialize theme on app startup: read saved preference and apply. */
export async function initTheme(): Promise<ThemeMode> {
  const mode = await getSavedMode()
  await applyTheme(mode)
  return mode
}

/** React hook for theme management. */
export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>('system')
  const [resolved, setResolved] = useState<ResolvedTheme>(() => currentDocumentTheme())

  const applyAndStore = useCallback(async (nextMode: ThemeMode, persist: boolean) => {
    if (persist) {
      await saveMode(nextMode)
    }
    const nextResolved = await applyTheme(nextMode)
    setMode(nextMode)
    setResolved(nextResolved)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadTheme() {
      const saved = await getSavedMode()
      const nextResolved = await applyTheme(saved)
      if (!cancelled) {
        setMode(saved)
        setResolved(nextResolved)
      }
    }

    void loadTheme()

    return () => {
      cancelled = true
    }
  }, [])

  const toggle = useCallback(() => {
    void applyAndStore(cycleTheme(mode), true)
  }, [applyAndStore, mode])

  return { mode, resolved, toggle }
}
