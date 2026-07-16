import Database from 'better-sqlite3'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

let db: Database.Database | null = null

function getDbPath(): string {
  if (process.env.TODO_USER_DATA_DIR) {
    return path.join(process.env.TODO_USER_DATA_DIR, 'todo.db')
  }

  if (process.versions.electron) {
    const { app } = require('electron') as typeof import('electron')
    return path.join(app.getPath('userData'), 'todo.db')
  }

  // Fallback for non-Electron test runners (e.g. Vitest with mocked electron)
  return path.join(os.tmpdir(), 'todolist-db-fallback', 'todo.db')
}

export function getDb(): Database.Database {
  if (db) {
    return db
  }

  const dbPath = getDbPath()
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })

  const connection = new Database(dbPath)
  connection.pragma('journal_mode = WAL')
  connection.pragma('foreign_keys = ON')

  db = connection
  return db
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
