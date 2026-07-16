import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getDb, closeDb } from '../../main/db/connection.js'
import { runMigrations } from '../../main/db/migrations.js'

export function createTempUserDataDir(prefix = 'todolist-user-data-') {
  return mkdtempSync(join(tmpdir(), prefix))
}

export function createIpcHarness() {
  const handlers = new Map<string, (...args: unknown[]) => unknown>()

  return {
    handle(channel: string, handler: (...args: unknown[]) => unknown) {
      handlers.set(channel, handler)
    },
    async invoke(channel: string, ...args: unknown[]) {
      const handler = handlers.get(channel)

      if (!handler) {
        throw new Error(`No handler registered for ${channel}`)
      }

      return handler(...args)
    },
    channels() {
      return [...handlers.keys()]
    },
  }
}

export function assertMigrationVersionTableExists(userDataDir: string) {
  process.env.TODO_USER_DATA_DIR = userDataDir

  try {
    const db = getDb()
    runMigrations()

    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'migrations'")
      .get()

    if (!table) {
      throw new Error('Migration version table does not exist')
    }
  } finally {
    closeDb()
    delete process.env.TODO_USER_DATA_DIR
  }
}
