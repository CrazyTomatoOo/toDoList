import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { validateDataDir } from '../../main/db/dataDirValidation.js'

function createTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

describe('validateDataDir', () => {
  let resourcesDir: string
  let tempDir: string

  beforeEach(() => {
    resourcesDir = createTempDir('todolist-resources-')
    tempDir = createTempDir('todolist-validation-')
  })

  afterEach(() => {
    fs.rmSync(resourcesDir, { recursive: true, force: true })
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('passes for a writable absolute directory', () => {
    expect(validateDataDir(tempDir)).toBeNull()
  })

  it('creates the directory when missing but the parent is writable', () => {
    const missing = path.join(tempDir, 'not-yet-created', 'deep')
    expect(validateDataDir(missing)).toBeNull()
    expect(fs.existsSync(missing)).toBe(true)
  })

  it('returns not-absolute for a relative path', () => {
    expect(validateDataDir('relative/path')).toBe('not-absolute')
  })

  it('rejects POSIX double-slash paths as network', () => {
    expect(validateDataDir('//server/share')).toBe('unc-or-network')
  })

  it('rejects paths under /usr', () => {
    expect(validateDataDir('/usr/local/share')).toBe('system-dir')
  })

  it('rejects paths under /System', () => {
    expect(validateDataDir('/System/Library')).toBe('system-dir')
  })

  it('rejects directories inside the packaged resources directory', () => {
    const inside = path.join(resourcesDir, 'app', 'app.asar.unpacked')
    expect(validateDataDir(inside, { resourcesDir })).toBe('inside-resources')
  })

  it('rejects the resources directory itself', () => {
    expect(validateDataDir(resourcesDir, { resourcesDir })).toBe(
      'inside-resources',
    )
  })

  it('rejects an unwritable directory', () => {
    if (process.platform === 'win32') {
      return
    }
    const dir = path.join(tempDir, 'readonly')
    fs.mkdirSync(dir, { recursive: true })
    fs.chmodSync(dir, 0o500)
    try {
      expect(validateDataDir(dir)).toBe('unwritable')
    } finally {
      fs.chmodSync(dir, 0o700)
    }
  })

  it('rejects a symlink that points into a system directory', () => {
    if (process.platform === 'win32') {
      return
    }
    const link = path.join(tempDir, 'system-link')
    fs.symlinkSync('/usr', link)
    expect(validateDataDir(link)).toBe('system-dir')
  })
})
