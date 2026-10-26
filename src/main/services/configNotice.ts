import { getDb } from '../db/connection.js'

const NOTICE_KEY = 'config.noticeAcknowledged'

function ensureSettingsTable(): void {
  getDb().exec(
    'CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);',
  )
}

/**
 * Persist which broken bootstrap config the user has acknowledged (issue #14).
 *
 * The acknowledgement is the sha256 fingerprint of the exact bytes that failed
 * to parse (see db/dataDirConfig.ts), stored in the settings table of the data
 * directory currently in use — never in a sidecar next to config.json, whose
 * neighborhood ADR-0005 keeps byte-identical while a config is broken.
 *
 * A null problem means the config parses again: the key is removed so the next
 * breakage of any content is announced fresh.
 */
export function saveNoticeAcknowledgement(fingerprint: string | null): void {
  ensureSettingsTable()

  if (fingerprint === null) {
    getDb().prepare('DELETE FROM settings WHERE key = ?').run(NOTICE_KEY)
    return
  }

  getDb()
    .prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(NOTICE_KEY, fingerprint)
}

/** True when the given fingerprint is the acknowledged one. */
export function isNoticeAcknowledged(fingerprint: string): boolean {
  ensureSettingsTable()
  const row = getDb()
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(NOTICE_KEY) as { value: string } | undefined

  return row?.value === fingerprint
}
