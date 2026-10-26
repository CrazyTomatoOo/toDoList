import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import type { CreateTaskInput } from '../../main/db/schema.js'
import { closeDb } from '../../main/db/connection.js'
import { runMigrations } from '../../main/db/migrations.js'
import { createList } from '../../main/db/repositories/listRepository.js'
import { createTask } from '../../main/db/repositories/taskRepository.js'
import {
  deleteBackup,
  listBackups,
  migrateDataDir,
} from '../../main/services/dataDirMigration.js'

function createTempUserDataDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'todolist-migration-test-'))
}

function dbFileOf(dir: string): string {
  return path.join(dir, 'todo.db')
}

/**
 * Opens `dir/todo.db` (creating side files as WAL mode requires) and returns
 * task titles. Used to prove a location is still authoritative after a
 * migration attempt.
 */
function readTaskTitles(dir: string): string[] {
  const db = new Database(dbFileOf(dir))
  try {
    return (
      db.prepare('SELECT title FROM tasks ORDER BY id').all() as Array<{
        title: string
      }>
    ).map((row) => row.title)
  } finally {
    db.close()
  }
}

function quickCheckAt(dir: string): string {
  const db = new Database(dbFileOf(dir))
  try {
    return db.pragma('quick_check', { simple: true }) as string
  } finally {
    db.close()
  }
}

function seedTasks(count: number): void {
  const list = createList('Inbox')
  for (let i = 0; i < count; i++) {
    const input: CreateTaskInput = { list_id: list.id, title: `Task ${i}` }
    createTask(input)
  }
}

/** Replaces an fs method for the duration of `body`, restoring it after. */
function withFsStub<T>(
  method: 'copyFileSync' | 'renameSync',
  stub: (original: (...args: never[]) => unknown, ...args: never[]) => unknown,
  body: () => T,
): T {
  const target = fs as unknown as Record<string, unknown>
  const original = target[method] as (...args: never[]) => unknown
  target[method] = (...args: never[]) => stub(original.bind(fs), ...args)
  try {
    return body()
  } finally {
    target[method] = original
  }
}

function expectConfigEquals(configPath: string, expected: Buffer): void {
  expect(fs.readFileSync(configPath).equals(expected)).toBe(true)
}

describe('dataDirMigration', () => {
  let sourceDir: string
  let configDir: string
  let configPath: string
  let targetDir: string

  beforeEach(() => {
    sourceDir = createTempUserDataDir()
    process.env.TODO_USER_DATA_DIR = sourceDir
    runMigrations()

    configDir = createTempUserDataDir()
    configPath = path.join(configDir, 'config.json')

    // The target sits beside the source so backups (parent of the data dir)
    // are observable, mirroring the real layout.
    targetDir = path.join(path.dirname(sourceDir), 'new-home')
  })

  afterEach(() => {
    closeDb()
    // Migration renames the source dir; cleanup must tolerate that, and
    // chmod must only run on dirs that still exist.
    for (const dir of [sourceDir, configDir]) {
      if (fs.existsSync(dir)) {
        fs.chmodSync(dir, 0o755)
      }
    }
    fs.rmSync(sourceDir, { recursive: true, force: true })
    fs.rmSync(configDir, { recursive: true, force: true })
    // The target and any backups live beside the source (same parent), but
    // that parent is os.tmpdir()-adjacent and shared — remove only what we
    // created under known names, never the parent itself.
    const parent = path.dirname(sourceDir)
    for (const name of fs.existsSync(parent) ? fs.readdirSync(parent) : []) {
      if (
        name === path.basename(targetDir) ||
        name.startsWith('todo-data-backup-')
      ) {
        fs.rmSync(path.join(parent, name), { recursive: true, force: true })
      }
    }
    delete process.env.TODO_USER_DATA_DIR
  })

  describe('migrate mode — success path', () => {
    it('copies the db, verifies at target, writes config, renames old dir', () => {
      seedTasks(3)

      const result = migrateDataDir({
        sourceDir,
        targetDir,
        mode: 'migrate',
        configPath,
      })

      expect(result.ok).toBe(true)
      expect(result.error).toBeUndefined()
      expect(result.warnings).toEqual([])
      // The old dir moved to a sibling backup name.
      expect(result.backupPath).toBeDefined()
      expect(path.basename(result.backupPath!)).toMatch(
        /^todo-data-backup-\d{4}-\d{2}-\d{2}T[\d-]+Z$/,
      )
      expect(fs.existsSync(sourceDir)).toBe(false)
      // Target verified clean and keeps the tasks.
      expect(quickCheckAt(targetDir)).toBe('ok')
      expect(readTaskTitles(targetDir)).toEqual(['Task 0', 'Task 1', 'Task 2'])
      // The backup holds the source db bytes (post-checkpoint, all data).
      const backupDb = fs.readFileSync(path.join(result.backupPath!, 'todo.db'))
      const targetDb = fs.readFileSync(dbFileOf(targetDir))
      expect(backupDb.equals(targetDb)).toBe(true)
      // Config written with exactly the target dir.
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      expect(cfg).toEqual({ version: 1, dataDir: targetDir })
    })

    it('migrates an empty source database (zero tasks)', () => {
      const result = migrateDataDir({
        sourceDir,
        targetDir,
        mode: 'migrate',
        configPath,
      })
      expect(result.ok).toBe(true)
      expect(quickCheckAt(targetDir)).toBe('ok')
      expect(readTaskTitles(targetDir)).toEqual([])
    })
  })

  describe('migrate mode — failures before config write', () => {
    it('unwritable target: config bytes unchanged, old db readable, target absent', () => {
      seedTasks(2)
      fs.writeFileSync(configPath, '{"version":1,"dataDir":"/old/place"}')
      const configBefore = fs.readFileSync(configPath)

      const roRoot = createTempUserDataDir()
      try {
        // Parent exists read-only: mkdir inside it → EACCES → validateDataDir
        // reports 'unwritable'.
        fs.chmodSync(roRoot, 0o555)
        const blockedDir = path.join(roRoot, 'sub')

        const result = migrateDataDir({
          sourceDir,
          targetDir: blockedDir,
          mode: 'migrate',
          configPath,
        })

        expect(result.ok).toBe(false)
        expect(result.error?.step).toBe('validate')
        expect(typeof result.error?.message).toBe('string')
        expectConfigEquals(configPath, configBefore)
        expect(readTaskTitles(sourceDir)).toEqual(['Task 0', 'Task 1'])
        expect(fs.existsSync(blockedDir)).toBe(false)
      } finally {
        fs.chmodSync(roRoot, 0o755)
        fs.rmSync(roRoot, { recursive: true, force: true })
      }
    })

    it('copy failure (target file exists read-only): config unchanged, old db readable', () => {
      seedTasks(2)
      fs.writeFileSync(configPath, '{"version":1,"dataDir":"/old/place"}')
      const configBefore = fs.readFileSync(configPath)

      fs.mkdirSync(targetDir, { recursive: true })
      const existing = path.join(targetDir, 'todo.db')
      fs.writeFileSync(existing, 'user file, do not touch')
      fs.chmodSync(existing, 0o444)

      try {
        const result = migrateDataDir({
          sourceDir,
          targetDir,
          mode: 'migrate',
          configPath,
        })

        expect(result.ok).toBe(false)
        expect(result.error?.step).toBe('copy')
        expectConfigEquals(configPath, configBefore)
        expect(fs.readFileSync(existing, 'utf-8')).toBe(
          'user file, do not touch',
        )
        expect(readTaskTitles(sourceDir)).toEqual(['Task 0', 'Task 1'])
      } finally {
        fs.chmodSync(existing, 0o644)
      }
    })

    it('verify failure: config unchanged, old db readable, created target removed', () => {
      seedTasks(2)
      fs.writeFileSync(configPath, '{"version":1,"dataDir":"/old/place"}')
      const configBefore = fs.readFileSync(configPath)

      // Corrupt the db copy in flight: the file lands at the target but its
      // content is garbage, so quick_check must fail there.
      const result = withFsStub(
        'copyFileSync',
        (original, src: fs.PathLike, dest: fs.PathLike) => {
          if (String(dest).endsWith('todo.db')) {
            fs.writeFileSync(dest, Buffer.alloc(4096, 0x41))
            return
          }
          original(src, dest)
        },
        () =>
          migrateDataDir({ sourceDir, targetDir, mode: 'migrate', configPath }),
      )

      expect(result.ok).toBe(false)
      expect(result.error?.step).toBe('verify')
      expectConfigEquals(configPath, configBefore)
      expect(readTaskTitles(sourceDir)).toEqual(['Task 0', 'Task 1'])
      // This operation created the target, so rollback removes it entirely.
      expect(fs.existsSync(targetDir)).toBe(false)
    })

    it('write-config failure: config bytes unchanged, old db readable, target removed', () => {
      seedTasks(2)
      fs.writeFileSync(configPath, '{"version":1,"dataDir":"/old/place"}')
      const configBefore = fs.readFileSync(configPath)

      // writeConfigAtomic does writeFileSync(`${file}.tmp`) then
      // renameSync(tmp, config). Break that rename — the `from` end carries
      // the .tmp suffix — so the atomic swap never happens.
      let tmpRenameBlocked = 0
      const result = withFsStub(
        'renameSync',
        (original, from: fs.PathLike, to: fs.PathLike) => {
          if (String(from).endsWith('.tmp')) {
            tmpRenameBlocked++
            throw Object.assign(
              new Error(
                `EACCES: permission denied, rename '${from}' -> '${to}'`,
              ),
              { code: 'EACCES' },
            )
          }
          original(from, to)
        },
        () =>
          migrateDataDir({ sourceDir, targetDir, mode: 'migrate', configPath }),
      )

      expect(tmpRenameBlocked).toBeGreaterThan(0)
      expect(result.ok).toBe(false)
      expect(result.error?.step).toBe('write-config')
      expectConfigEquals(configPath, configBefore)
      expect(readTaskTitles(sourceDir)).toEqual(['Task 0', 'Task 1'])
      // Target created by this op → removed on rollback.
      expect(fs.existsSync(targetDir)).toBe(false)
    })
  })

  describe('migrate mode — rename failure after config write', () => {
    it('records a warning and still succeeds', () => {
      seedTasks(2)

      const result = withFsStub(
        'renameSync',
        (original, from: fs.PathLike, to: fs.PathLike) => {
          if (String(from) === sourceDir) {
            throw Object.assign(
              new Error(`EBUSY: resource busy or locked, rename '${from}'`),
              { code: 'EBUSY' },
            )
          }
          original(from, to)
        },
        () =>
          migrateDataDir({ sourceDir, targetDir, mode: 'migrate', configPath }),
      )

      expect(result.ok).toBe(true)
      expect(result.error).toBeUndefined()
      expect(result.backupPath).toBeUndefined()
      expect(result.warnings.length).toBeGreaterThan(0)
      // The verified target is the truth.
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      expect(cfg).toEqual({ version: 1, dataDir: targetDir })
      expect(readTaskTitles(targetDir)).toEqual(['Task 0', 'Task 1'])
      // Old dir still on disk under the original name.
      expect(fs.existsSync(sourceDir)).toBe(true)
    })
  })

  describe('empty mode', () => {
    it('skips copy and rename, old dir untouched and pointable-back', () => {
      seedTasks(2)
      const sourceDbBefore = fs.readFileSync(dbFileOf(sourceDir))

      const result = migrateDataDir({
        sourceDir,
        targetDir,
        mode: 'empty',
        configPath,
      })

      expect(result.ok).toBe(true)
      expect(result.error).toBeUndefined()
      expect(result.backupPath).toBeUndefined()
      expect(result.warnings).toEqual([])
      // No db at the target.
      expect(fs.existsSync(dbFileOf(targetDir))).toBe(false)
      // Old dir untouched: same path, same bytes, still readable.
      expect(fs.existsSync(sourceDir)).toBe(true)
      expect(fs.readFileSync(dbFileOf(sourceDir)).equals(sourceDbBefore)).toBe(
        true,
      )
      expect(readTaskTitles(sourceDir)).toEqual(['Task 0', 'Task 1'])
      // Config points at the fresh dir.
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      expect(cfg).toEqual({ version: 1, dataDir: targetDir })
    })
  })

  describe('listBackups', () => {
    it('lists backup dirs with recursive size and creation time', () => {
      const parent = path.dirname(sourceDir)
      const b1 = path.join(parent, 'todo-data-backup-2026-01-02T03-04-05-000Z')
      const b2 = path.join(parent, 'todo-data-backup-2026-02-03T04-05-06-000Z')
      const notBackup = path.join(parent, 'some-other-dir')
      for (const dir of [b1, b2, notBackup]) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(path.join(b1, 'todo.db'), Buffer.alloc(1024))
      fs.mkdirSync(path.join(b1, 'nested'))
      fs.writeFileSync(path.join(b1, 'nested', 'f.bin'), Buffer.alloc(512))
      fs.writeFileSync(path.join(b2, 'todo.db'), Buffer.alloc(256))
      fs.writeFileSync(path.join(notBackup, 'x.txt'), 'x')

      const backups = listBackups(parent, sourceDir)

      expect(backups.map((b) => b.name).sort()).toEqual([
        'todo-data-backup-2026-01-02T03-04-05-000Z',
        'todo-data-backup-2026-02-03T04-05-06-000Z',
      ])
      const first = backups.find((b) => b.path === b1)
      expect(first).toBeDefined()
      expect(first!.sizeBytes).toBe(1024 + 512)
      expect(first!.createdAt).toBeDefined()
      expect(Number.isNaN(Date.parse(first!.createdAt))).toBe(false)
    })

    it('returns an empty array when there are none', () => {
      expect(listBackups(path.dirname(sourceDir), sourceDir)).toEqual([])
    })

    it('ignores plain files matching the prefix', () => {
      fs.writeFileSync(
        path.join(path.dirname(sourceDir), 'todo-data-backup-not-a-dir'),
        'nope',
      )
      expect(listBackups(path.dirname(sourceDir), sourceDir)).toEqual([])
    })
  })

  describe('deleteBackup', () => {
    it('deletes a backup directory, neighbours untouched', () => {
      const parent = path.dirname(sourceDir)
      const backup = path.join(
        parent,
        'todo-data-backup-2026-01-02T03-04-05-000Z',
      )
      const innocent = path.join(parent, 'important-stuff')
      fs.mkdirSync(backup, { recursive: true })
      fs.mkdirSync(innocent, { recursive: true })
      fs.writeFileSync(path.join(backup, 'todo.db'), 'x')

      deleteBackup(backup)

      expect(fs.existsSync(backup)).toBe(false)
      expect(fs.existsSync(innocent)).toBe(true)
    })

    it('refuses a path without the backup prefix', () => {
      const innocent = path.join(path.dirname(sourceDir), 'important-stuff')
      fs.mkdirSync(innocent, { recursive: true })

      expect(() => deleteBackup(innocent)).toThrow()
      expect(fs.existsSync(innocent)).toBe(true)
    })

    it('refuses relative or traversal paths', () => {
      expect(() => deleteBackup('todo-data-backup-x')).toThrow()
      expect(() =>
        deleteBackup(
          path.join(path.dirname(sourceDir), '..', 'todo-data-backup-x'),
        ),
      ).toThrow()
    })
  })

  it('never copies wal side files when SQLite already removed them', () => {
    // After a clean checkpoint+close, only todo.db remains in the source dir.
    seedTasks(1)
    closeDb()

    const result = migrateDataDir({
      sourceDir,
      targetDir,
      mode: 'migrate',
      configPath,
    })

    expect(result.ok).toBe(true)
    expect(quickCheckAt(targetDir)).toBe('ok')
    expect(readTaskTitles(targetDir)).toEqual(['Task 0'])
  })
})
