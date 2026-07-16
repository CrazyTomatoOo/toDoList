import { nativeTheme } from 'electron'
import { getDb } from '../db/connection.js'
import type { ResolvedTheme, ThemeMode } from '../../shared/ipc.js'

const THEME_KEY = 'theme'
const MODES: ThemeMode[] = ['system', 'light', 'dark']

function isThemeMode(value: string | undefined): value is ThemeMode {
  return value !== undefined && MODES.includes(value as ThemeMode)
}

function ensureSettingsTable(): void {
  getDb().exec('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);')
}

export function getSystemTheme(): ResolvedTheme {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
}

export function getSavedMode(): ThemeMode {
  ensureSettingsTable()
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(THEME_KEY) as
    | { value: string }
    | undefined

  return isThemeMode(row?.value) ? row.value : 'system'
}

export function saveMode(mode: ThemeMode): void {
  if (!isThemeMode(mode)) {
    throw new Error(`Invalid theme mode: ${mode}`)
  }

  ensureSettingsTable()
  getDb()
    .prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(THEME_KEY, mode)
}
