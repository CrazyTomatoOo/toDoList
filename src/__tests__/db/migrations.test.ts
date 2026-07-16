import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { getDb, closeDb } from '../../main/db/connection.js'
import { runMigrations } from '../../main/db/migrations.js'

function createTempUserDataDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'todolist-db-test-'))
}

describe('database connection and migrations', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = createTempUserDataDir()
    process.env.TODO_USER_DATA_DIR = tempDir
  })

  afterEach(() => {
    closeDb()
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // ignore cleanup failures
    }
    delete process.env.TODO_USER_DATA_DIR
  })

  it('creates the database file in the userData directory with WAL and foreign keys enabled', () => {
    const db = getDb()
    const dbPath = path.join(tempDir, 'todo.db')

    expect(fs.existsSync(dbPath)).toBe(true)

    const journalMode = db.pragma('journal_mode', { simple: true }) as string
    const foreignKeys = db.pragma('foreign_keys', { simple: true }) as number

    expect(journalMode.toLowerCase()).toBe('wal')
    expect(foreignKeys).toBe(1)
  })

  it('runs migrations and records the latest version', () => {
    const db = getDb()
    const version = runMigrations()

    expect(version).toBe(4)

    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'migrations'")
      .get()

    expect(table).toBeDefined()

    const rows = db.prepare('SELECT version FROM migrations ORDER BY version').all() as {
      version: number
    }[]

    expect(rows.map((row) => row.version)).toEqual([1, 2, 3, 4])
  })

  it('is idempotent when run twice', () => {
    getDb()
    runMigrations()
    const version = runMigrations()

    expect(version).toBe(4)

    const db = getDb()
    const rows = db.prepare('SELECT version FROM migrations ORDER BY version').all() as {
      version: number
    }[]

    expect(rows).toHaveLength(4)
  })
})
