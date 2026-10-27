import { describe, it, expect, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Mock Electron: the handler needs app.getVersion() for the state snapshot.
vi.mock('electron', () => ({
  app: {
    getVersion: vi.fn(() => '0.2.0-test'),
  },
}))

import {
  IPC_CHANNELS,
  type DataDirState,
  type DataDirResolution,
} from '../../shared/ipc.js'
import { dataDirHandlers } from '../../main/ipc/handlers/dataDir.js'
import { setDataDirState } from '../../main/services/dataDirState.js'
import { getDb, closeDb } from '../../main/db/connection.js'
import { runMigrations } from '../../main/db/migrations.js'
import { createIpcHarness } from './ipc.harness.js'

/** Structural slice of the IPC harness the assertions below invoke through. */
interface InvokeHarness {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
}

const NOTICE_KEY = 'config.noticeAcknowledged'
const DEFAULT_DIR = '/home/tester/.local/share/todolist-app'

function registerDataDirHandlers(): InvokeHarness {
  const harness = createIpcHarness()
  for (const { channel, handler } of dataDirHandlers) {
    harness.handle(channel, handler as (...args: unknown[]) => unknown)
  }
  return harness
}

function brokenResolution(
  fingerprint: string,
  kind: 'invalid-json' | 'bad-version' | 'bad-data-dir' = 'invalid-json',
): DataDirResolution {
  return {
    dir: DEFAULT_DIR,
    source: 'default',
    configPath: '/home/tester/.config/ToDoList/config.json',
    problem: {
      kind,
      detail: '配置文件不是合法的 JSON',
      fingerprint,
    },
  }
}

/**
 * Boot the app-like state on a real temp database the way main.ts does:
 * point TODO_USER_DATA_DIR at a fresh dir, open the DB, migrate, and capture
 * the resolution snapshot for the data-dir handlers.
 */
function bootOnTempDir(resolution: DataDirResolution): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'todolist-notice-'))
  process.env.TODO_USER_DATA_DIR = tempDir
  getDb()
  runMigrations()
  setDataDirState({
    resolution,
    defaultDir: DEFAULT_DIR,
    noStore: false,
  })
  return tempDir
}

function readNoticeKey(): string | undefined {
  const row = getDb()
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(NOTICE_KEY) as { value: string } | undefined
  return row?.value
}

function noticeKeyExists(): boolean {
  return (
    getDb()
      .prepare('SELECT 1 FROM settings WHERE key = ?')
      .get(NOTICE_KEY) !== undefined
  )
}

async function getState(harness: InvokeHarness): Promise<DataDirState> {
  return (await harness.invoke(IPC_CHANNELS.DATA_DIR_GET_STATE)) as DataDirState
}

describe('data-dir:ackNotice (issue #14)', () => {
  let tempDir: string | null = null

  afterEach(() => {
    closeDb()
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true })
      tempDir = null
    }
    delete process.env.TODO_USER_DATA_DIR
  })

  it('writes the current problem fingerprint into the settings table', async () => {
    tempDir = bootOnTempDir(brokenResolution('deadbeef'))

    const harness = registerDataDirHandlers()
    await harness.invoke(IPC_CHANNELS.DATA_DIR_ACK_NOTICE)

    expect(readNoticeKey()).toBe('deadbeef')
  })

  it('deletes the key when the config parses fine (problem is null)', async () => {
    tempDir = bootOnTempDir({
      dir: DEFAULT_DIR,
      source: 'default',
      configPath: '/home/tester/.config/ToDoList/config.json',
      problem: null,
    })
    getDb()
      .prepare(
        `INSERT INTO settings (key, value) VALUES ('${NOTICE_KEY}', 'stale')`,
      )
      .run()

    const harness = registerDataDirHandlers()
    await harness.invoke(IPC_CHANNELS.DATA_DIR_ACK_NOTICE)

    expect(noticeKeyExists()).toBe(false)
  })

  it('reports noticeAcknowledged true for the same fingerprint after a restart', async () => {
    // First run: fresh database, broken config not yet acknowledged.
    tempDir = bootOnTempDir(brokenResolution('cafebabe'))
    const harness = registerDataDirHandlers()
    expect((await getState(harness)).noticeAcknowledged).toBe(false)

    await harness.invoke(IPC_CHANNELS.DATA_DIR_ACK_NOTICE)

    // "Restart": close the DB, open it again on the same directory, and boot
    // with the same broken config (same bytes → same fingerprint).
    closeDb()
    getDb()
    expect((await getState(harness)).noticeAcknowledged).toBe(true)
  })

  it('reports noticeAcknowledged false for a different broken config', async () => {
    tempDir = bootOnTempDir(brokenResolution('cafebabe'))
    const harness = registerDataDirHandlers()
    await harness.invoke(IPC_CHANNELS.DATA_DIR_ACK_NOTICE)

    // "Restart" with a different broken config (different bytes/fingerprint).
    closeDb()
    getDb()
    setDataDirState({
      resolution: brokenResolution('0123abcd'),
      defaultDir: DEFAULT_DIR,
      noStore: false,
    })
    expect((await getState(harness)).noticeAcknowledged).toBe(false)
  })

  it('drops a stale key once the config parses again', async () => {
    tempDir = bootOnTempDir({
      dir: DEFAULT_DIR,
      source: 'default',
      configPath: '/home/tester/.config/ToDoList/config.json',
      problem: null,
    })
    getDb()
      .prepare(
        `INSERT INTO settings (key, value) VALUES ('${NOTICE_KEY}', 'stale')`,
      )
      .run()

    const harness = registerDataDirHandlers()
    expect((await getState(harness)).noticeAcknowledged).toBe(false)

    // The row is gone, so the identical broken bytes are announced again
    // instead of hiding behind an acknowledgement from an earlier breakage.
    const row = getDb()
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get(NOTICE_KEY)
    expect(row).toBeUndefined()
  })

  it('does not throw when the database is unwritable', async () => {
    // A garbage todo.db makes every statement fail: the acknowledgement
    // cannot be persisted, which must degrade to "notice every launch"
    // instead of an error.
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'todolist-notice-ro-'))
    fs.writeFileSync(
      path.join(tempDir, 'todo.db'),
      'not a sqlite database at all',
    )
    process.env.TODO_USER_DATA_DIR = tempDir
    setDataDirState({
      resolution: brokenResolution('deadbeef'),
      defaultDir: DEFAULT_DIR,
      noStore: false,
    })

    const harness = registerDataDirHandlers()
    await expect(
      harness.invoke(IPC_CHANNELS.DATA_DIR_ACK_NOTICE),
    ).resolves.toBeUndefined()

    // The snapshot still answers, reporting the notice as not acknowledged.
    expect((await getState(harness)).noticeAcknowledged).toBe(false)
  })
})
