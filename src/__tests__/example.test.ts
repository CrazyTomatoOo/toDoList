import { describe, expect, it } from 'vitest'
import { tmpdir } from 'node:os'
import {
  assertMigrationVersionTableExists,
  createTempUserDataDir,
} from './main/ipc.harness'

describe('main process test harness', () => {
  it('uses a temp userData directory for database work', () => {
    const userDataDir = createTempUserDataDir('todolist-test-')

    expect(userDataDir.startsWith(tmpdir())).toBe(true)
  })

  it('exposes a migration-version-table check', () => {
    const userDataDir = createTempUserDataDir('todolist-test-')

    expect(() => assertMigrationVersionTableExists(userDataDir)).not.toThrow()
  })
})
