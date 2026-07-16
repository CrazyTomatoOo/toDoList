import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { getDb } from './connection.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export interface Migration {
  version: number
  name: string
  sql: string
}

export function readMigrations(): Migration[] {
  const migrationsDir = path.join(__dirname, 'migrations')
  const files = fs
    .readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort()

  return files.map((name) => {
    const match = name.match(/^(\d+)/)
    if (!match) {
      throw new Error(`Invalid migration file name: ${name}`)
    }
    const version = parseInt(match[1], 10)
    const sql = fs.readFileSync(path.join(migrationsDir, name), 'utf-8')
    return { version, name, sql }
  })
}

export function runMigrations(database?: Database.Database): number {
  const db = database ?? getDb()

  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version INTEGER NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    );
  `)

  const appliedRows = db.prepare('SELECT version FROM migrations').all() as { version: number }[]
  const applied = new Set(appliedRows.map((row) => row.version))

  const pending = readMigrations()
    .filter((migration) => !applied.has(migration.version))
    .sort((a, b) => a.version - b.version)

  const runPending = db.transaction(() => {
    for (const migration of pending) {
      db.exec(migration.sql)
      db
        .prepare('INSERT INTO migrations (version, applied_at) VALUES (?, ?)')
        .run(migration.version, new Date().toISOString())
    }
  })

  runPending()

  const current = db.prepare('SELECT MAX(version) as version FROM migrations').get() as
    | { version: number | null }
    | undefined

  return current?.version ?? 0
}
