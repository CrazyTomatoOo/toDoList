import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import type DatabaseType from 'better-sqlite3'
import { closeDb, getDb } from '../db/connection.js'
import { CONFIG_VERSION, writeConfigAtomic } from '../db/dataDirConfig.js'
import { validateDataDir } from '../db/dataDirValidation.js'
import { validationFailureText } from '../db/dataDirConfig.js'

/** Ordered steps of a migration; `error.step` reports where one failed. */
export type MigrationStep =
  | 'validate'
  | 'checkpoint'
  | 'copy'
  | 'verify'
  | 'write-config'

export interface MigrationInput {
  sourceDir: string
  targetDir: string
  mode: 'migrate' | 'empty'
  configPath: string
}

export interface MigrationResult {
  ok: boolean
  error?: { step: MigrationStep; message: string }
  backupPath?: string
  warnings: string[]
}

export interface BackupInfo {
  name: string
  path: string
  sizeBytes: number
  createdAt: string
}

const BACKUP_PREFIX = 'todo-data-backup-'
const DB_FILE = 'todo.db'
const DB_SIDE_SUFFIXES = ['', '-wal', '-shm'] as const

function backupTimestamp(now = new Date()): string {
  return now.toISOString().replace(/[:.]/g, '-')
}

function messageOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

function getDbOrNull(): DatabaseType.Database | null {
  try {
    return getDb()
  } catch {
    return null
  }
}

/**
 * Checkpoints the live connection (if any) and closes it so `todo.db` is a
 * complete, standalone file and no `-wal`/`-shm` remain.
 */
function checkpointAndClose(): void {
  const db = getDbOrNull()
  if (!db) {
    return
  }
  if (db.open) {
    db.pragma('wal_checkpoint(TRUNCATE)')
  }
  closeDb()
}

/** Removes the target only when this operation created it. */
function removeDirIfCreated(dir: string, created: boolean): void {
  if (created) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

/**
 * Opens `dir/todo.db` and requires `PRAGMA quick_check` to report `ok`.
 * Returns an error message when the copy is unreadable or corrupt.
 */
function quickCheckAt(dir: string): string | null {
  const file = path.join(dir, DB_FILE)
  if (!fs.existsSync(file)) {
    return `目标缺少 ${DB_FILE}`
  }
  let db: DatabaseType.Database | undefined
  try {
    db = new Database(file)
    const check = db.pragma('quick_check', { simple: true })
    if (check !== 'ok') {
      return `quick_check 未通过：${String(check)}`
    }
    return null
  } catch (error) {
    return messageOf(error)
  } finally {
    if (db && db.open) {
      db.close()
    }
  }
}

function copyDbFiles(sourceDir: string, targetDir: string): void {
  for (const suffix of DB_SIDE_SUFFIXES) {
    const source = path.join(sourceDir, DB_FILE + suffix)
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, path.join(targetDir, DB_FILE + suffix))
    }
  }
}

function dirSizeBytes(dir: string): number {
  let total = 0
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      total += dirSizeBytes(full)
    } else if (entry.isFile()) {
      total += fs.statSync(full).size
    }
  }
  return total
}

function fail(step: MigrationStep, message: string): MigrationResult {
  return { ok: false, error: { step, message }, warnings: [] }
}

/**
 * Migrates the application's data directory.
 *
 * Strict order: validate target → checkpoint + close → copy db files →
 * verify at target → write config atomically → rename old dir to a backup.
 *
 * Any failure before the config write leaves the old location authoritative:
 * `config.json` stays byte-identical and the source directory keeps working.
 * A failure renaming the old directory after the config write is only a
 * warning — the verified target is already the truth.
 *
 * `mode: 'empty'` skips the copy and the rename entirely; the old directory
 * stays in place and can be pointed back at later. This service never
 * restarts the app and never reads the environment.
 */
export function migrateDataDir(input: MigrationInput): MigrationResult {
  const { sourceDir, targetDir, mode, configPath } = input
  const warnings: string[] = []

  // Step 1: validate target. Note validateDataDir creates the directory
  // (mkdir recursive + probe file), so we must know whether it pre-existed.
  let createdTarget: boolean
  try {
    createdTarget = !fs.existsSync(targetDir)
    // Same check the startup resolver and the picker use, resources dir
    // included: the renderer is not the only caller of this service.
    const failure = validateDataDir(targetDir, {
      resourcesDir: process.resourcesPath,
    })
    if (failure) {
      return fail('validate', `目标目录不可用（${validationFailureText(failure)}）`)
    }
  } catch (error) {
    return fail('validate', messageOf(error))
  }

  if (mode === 'empty') {
    // Fresh start: no copy, no rename, old dir untouched.
    try {
      writeConfigAtomic(configPath, {
        version: CONFIG_VERSION,
        dataDir: targetDir,
      })
    } catch (error) {
      removeDirIfCreated(targetDir, createdTarget)
      return fail('write-config', messageOf(error))
    }
    return { ok: true, warnings }
  }

  // Step 2: checkpoint + close so todo.db is complete on disk.
  try {
    checkpointAndClose()
  } catch (error) {
    return fail('checkpoint', messageOf(error))
  }

  // Step 3: copy db + side files (only those that exist).
  try {
    copyDbFiles(sourceDir, targetDir)
  } catch (error) {
    removeDirIfCreated(targetDir, createdTarget)
    return fail('copy', messageOf(error))
  }

  // Step 4: verify the copy at the target.
  const verifyError = quickCheckAt(targetDir)
  if (verifyError) {
    removeDirIfCreated(targetDir, createdTarget)
    return fail('verify', verifyError)
  }

  // Step 5: atomic config write — the point of no (full) return.
  try {
    writeConfigAtomic(configPath, {
      version: CONFIG_VERSION,
      dataDir: targetDir,
    })
  } catch (error) {
    removeDirIfCreated(targetDir, createdTarget)
    return fail('write-config', messageOf(error))
  }

  // Step 6: rename the old dir to a timestamped backup. Failure is a warning.
  const backupPath = path.join(
    path.dirname(path.resolve(sourceDir)),
    `${BACKUP_PREFIX}${backupTimestamp()}`,
  )
  try {
    fs.renameSync(sourceDir, backupPath)
  } catch (error) {
    warnings.push(`旧目录改名失败，已保留原目录：${messageOf(error)}`)
    return { ok: true, warnings }
  }

  return { ok: true, backupPath, warnings }
}

/**
 * Lists `todo-data-backup-*` directories in `parentDir` (the parent of the
 * current data directory) with recursive size and creation time. Backups are
 * never cleaned automatically.
 */
export function listBackups(
  parentDir: string,
  currentDir: string,
): BackupInfo[] {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(parentDir, { withFileTypes: true })
  } catch {
    return []
  }

  const backups: BackupInfo[] = []
  for (const entry of entries) {
    if (!entry.name.startsWith(BACKUP_PREFIX) || !entry.isDirectory()) {
      continue
    }
    const full = path.join(parentDir, entry.name)
    if (path.resolve(full) === path.resolve(currentDir)) {
      continue
    }
    let sizeBytes = 0
    let createdAt = ''
    try {
      sizeBytes = dirSizeBytes(full)
      createdAt = fs.statSync(full).birthtime.toISOString()
    } catch {
      // Unreadable entries keep default values; listing must not throw.
    }
    backups.push({ name: entry.name, path: full, sizeBytes, createdAt })
  }
  return backups.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Deletes one backup directory. Refuses anything that is not an absolute
 * path whose basename carries the backup prefix — the delete action only
 * ever applies to that prefix.
 */
export function deleteBackup(dir: string): void {
  const resolved = path.resolve(dir)
  if (!path.isAbsolute(dir)) {
    throw new Error(`备份路径必须是绝对路径：${dir}`)
  }
  if (!path.basename(resolved).startsWith(BACKUP_PREFIX)) {
    throw new Error(`拒绝删除非备份目录：${dir}`)
  }
  if (!fs.existsSync(resolved)) {
    throw new Error(`备份目录不存在：${dir}`)
  }
  fs.rmSync(resolved, { recursive: true, force: true })
}
