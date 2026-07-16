import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { getDb, closeDb } from '../../main/db/connection.js'
import { runMigrations } from '../../main/db/migrations.js'

interface TableInfoRow {
  cid: number
  name: string
  type: string
  notnull: 0 | 1
  dflt_value: string | null
  pk: number
}

interface ForeignKeyRow {
  table: string
  from: string
  to: string
  on_delete: string
}

function createTempUserDataDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'todolist-schema-test-'))
}

describe('lists and tasks schema', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = createTempUserDataDir()
    process.env.TODO_USER_DATA_DIR = tempDir
  })

  afterEach(() => {
    closeDb()
    fs.rmSync(tempDir, { recursive: true, force: true })
    delete process.env.TODO_USER_DATA_DIR
  })

  function migratedDb() {
    const db = getDb()
    runMigrations(db)
    return db
  }

  it('creates lists and tasks tables after migrations run', () => {
    const db = migratedDb()

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('lists', 'tasks') ORDER BY name")
      .all() as { name: string }[]

    expect(tables.map((table) => table.name)).toEqual(['lists', 'tasks'])
  })

  it('creates the lists columns with required constraints', () => {
    const db = migratedDb()
    const columns = db.prepare('PRAGMA table_info(lists)').all() as TableInfoRow[]

    expect(columns).toMatchObject([
      { name: 'id', type: 'INTEGER', notnull: 0, dflt_value: null, pk: 1 },
      { name: 'name', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
      { name: 'created_at', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
      { name: 'updated_at', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
    ])
  })

  it('creates the tasks columns with required constraints and defaults', () => {
    const db = migratedDb()
    const columns = db.prepare('PRAGMA table_info(tasks)').all() as TableInfoRow[]

    expect(columns).toMatchObject([
      { name: 'id', type: 'INTEGER', notnull: 0, dflt_value: null, pk: 1 },
      { name: 'list_id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 0 },
      { name: 'title', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
      { name: 'description', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
      { name: 'priority', type: 'TEXT', notnull: 1, dflt_value: "'medium'", pk: 0 },
      { name: 'due_date', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
      { name: 'reminder_at', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
      { name: 'completed', type: 'INTEGER', notnull: 1, dflt_value: '0', pk: 0 },
      { name: 'sort_order', type: 'INTEGER', notnull: 1, dflt_value: '0', pk: 0 },
      { name: 'created_at', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
      { name: 'updated_at', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
      { name: 'recurrence', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
      { name: 'recurrence_end_date', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
      { name: 'start_date', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
      { name: 'end_date', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
      { name: 'is_urgent', type: 'INTEGER', notnull: 1, dflt_value: '0', pk: 0 },
      { name: 'is_important', type: 'INTEGER', notnull: 1, dflt_value: '0', pk: 0 },
    ])
  })

  it('enables the tasks foreign key to lists with cascade delete', () => {
    const db = migratedDb()

    expect(db.pragma('foreign_keys', { simple: true })).toBe(1)

    const foreignKeys = db.prepare('PRAGMA foreign_key_list(tasks)').all() as ForeignKeyRow[]

    expect(foreignKeys).toContainEqual(
      expect.objectContaining({
        table: 'lists',
        from: 'list_id',
        to: 'id',
        on_delete: 'CASCADE',
      }),
    )
  })

  it('creates task lookup indexes', () => {
    const db = migratedDb()
    const indexes = db.prepare('PRAGMA index_list(tasks)').all() as { name: string }[]

    expect(indexes.map((index) => index.name)).toEqual(
      expect.arrayContaining([
        'idx_tasks_list_id',
        'idx_tasks_completed',
        'idx_tasks_due_date',
        'idx_tasks_priority',
        'idx_tasks_recurrence',
        'idx_tasks_recurrence_end_date',
        'idx_tasks_start_date',
        'idx_tasks_end_date',
        'idx_tasks_is_urgent',
        'idx_tasks_is_important',
      ]),
    )
  })

  it('rejects tasks for missing lists', () => {
    const db = migratedDb()

    expect(() => {
      db.prepare(
        `INSERT INTO tasks (list_id, title, created_at, updated_at)
         VALUES (999, 'orphan task', '2026-07-15T00:00:00.000Z', '2026-07-15T00:00:00.000Z')`,
      ).run()
    }).toThrow(/FOREIGN KEY constraint failed/)
  })

  it('deletes a list\'s tasks when the list is deleted', () => {
    const db = migratedDb()

    const list = db
      .prepare("INSERT INTO lists (name, created_at, updated_at) VALUES ('Inbox', ?, ?)")
      .run('2026-07-15T00:00:00.000Z', '2026-07-15T00:00:00.000Z')

    db.prepare(
      `INSERT INTO tasks (list_id, title, created_at, updated_at)
       VALUES (?, 'Buy milk', '2026-07-15T00:00:00.000Z', '2026-07-15T00:00:00.000Z')`,
    ).run(list.lastInsertRowid)

    db.prepare('DELETE FROM lists WHERE id = ?').run(list.lastInsertRowid)

    const taskCount = db.prepare('SELECT COUNT(*) AS count FROM tasks').get() as { count: number }
    expect(taskCount.count).toBe(0)
  })
  it('keeps the tasks updated_at trigger after migration', () => {
    const db = migratedDb()
    const triggers = db.prepare("SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'tasks'").all() as { name: string }[]
    expect(triggers.map((trigger) => trigger.name)).toContain('trg_tasks_updated_at')
  })

  it('includes CHECK constraints for is_urgent and is_important', () => {
    const db = migratedDb()
    const row = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'tasks'").get() as { sql: string }

    expect(row.sql).toContain('CHECK (is_urgent IN (0, 1))')
    expect(row.sql).toContain('CHECK (is_important IN (0, 1))')
  })

  it('rejects invalid recurrence values', () => {
    const db = migratedDb()
    const list = db.prepare("INSERT INTO lists (name, created_at, updated_at) VALUES ('Inbox', ?, ?)")
      .run('2026-07-15T00:00:00.000Z', '2026-07-15T00:00:00.000Z')

    expect(() => {
      db.prepare(
        `INSERT INTO tasks (list_id, title, recurrence, created_at, updated_at)
         VALUES (?, 'bad recurrence', 'hourly', ?, ?)`,
      ).run(list.lastInsertRowid, '2026-07-15T00:00:00.000Z', '2026-07-15T00:00:00.000Z')
    }).toThrow(/CHECK constraint failed/)
  })

  it('rejects invalid is_urgent values', () => {
    const db = migratedDb()
    const list = db.prepare("INSERT INTO lists (name, created_at, updated_at) VALUES ('Inbox', ?, ?)")
      .run('2026-07-15T00:00:00.000Z', '2026-07-15T00:00:00.000Z')

    expect(() => {
      db.prepare(
        `INSERT INTO tasks (list_id, title, is_urgent, created_at, updated_at)
         VALUES (?, 'bad urgent', 2, ?, ?)`,
      ).run(list.lastInsertRowid, '2026-07-15T00:00:00.000Z', '2026-07-15T00:00:00.000Z')
    }).toThrow(/CHECK constraint failed/)
  })

  it('rejects invalid is_important values', () => {
    const db = migratedDb()
    const list = db.prepare("INSERT INTO lists (name, created_at, updated_at) VALUES ('Inbox', ?, ?)")
      .run('2026-07-15T00:00:00.000Z', '2026-07-15T00:00:00.000Z')

    expect(() => {
      db.prepare(
        `INSERT INTO tasks (list_id, title, is_important, created_at, updated_at)
         VALUES (?, 'bad important', 2, ?, ?)`,
      ).run(list.lastInsertRowid, '2026-07-15T00:00:00.000Z', '2026-07-15T00:00:00.000Z')
    }).toThrow(/CHECK constraint failed/)
  })

  it('rejects malformed date values for new date fields', () => {
    const db = migratedDb()
    const list = db.prepare("INSERT INTO lists (name, created_at, updated_at) VALUES ('Inbox', ?, ?)")
      .run('2026-07-15T00:00:00.000Z', '2026-07-15T00:00:00.000Z')

    for (const field of ['recurrence_end_date', 'start_date', 'end_date']) {
      expect(() => {
        db.prepare(
          `INSERT INTO tasks (list_id, title, ${field}, created_at, updated_at)
           VALUES (?, 'bad date', 'not-a-date', ?, ?)`,
        ).run(list.lastInsertRowid, '2026-07-15T00:00:00.000Z', '2026-07-15T00:00:00.000Z')
      }).toThrow(/CHECK constraint failed/)
    }
  })

  it('accepts valid recurrence, duration, and quadrant values', () => {
    const db = migratedDb()
    const list = db.prepare("INSERT INTO lists (name, created_at, updated_at) VALUES ('Inbox', ?, ?)")
      .run('2026-07-15T00:00:00.000Z', '2026-07-15T00:00:00.000Z')

    const result = db.prepare(
      `INSERT INTO tasks (list_id, title, recurrence, recurrence_end_date, start_date, end_date, is_urgent, is_important, created_at, updated_at)
       VALUES (?, 'valid recurring', 'daily', '2026-12-31', '2026-07-15', '2026-07-16', 1, 1, ?, ?)`,
    ).run(list.lastInsertRowid, '2026-07-15T00:00:00.000Z', '2026-07-15T00:00:00.000Z')

    expect(result.lastInsertRowid).toBeGreaterThan(0)
  })

  it('records migration version 4', () => {
    const db = migratedDb()
    const versions = db.prepare('SELECT version FROM migrations ORDER BY version').all() as { version: number }[]
    expect(versions.map((version) => version.version)).toContain(4)
  })
})
