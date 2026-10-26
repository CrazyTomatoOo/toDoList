import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  configPathFor,
  parseCliDataDir,
  portableDir,
  resolveDataDir,
  writeConfigAtomic,
} from '../../main/db/dataDirConfig.js'

function createTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

function fingerprintOf(content: string): string {
  return createHash('sha256')
    .update(Buffer.from(content, 'utf-8'))
    .digest('hex')
}

describe('configPathFor', () => {
  it('returns appData/ToDoList/config.json by default', () => {
    expect(configPathFor('/appData')).toBe(
      path.join('/appData', 'ToDoList', 'config.json'),
    )
  })

  it('honors TODO_CONFIG_DIR', () => {
    expect(configPathFor('/appData', { TODO_CONFIG_DIR: '/cfg' })).toBe(
      path.join('/cfg', 'config.json'),
    )
  })
})

describe('parseCliDataDir', () => {
  it('accepts --data-dir=/path', () => {
    expect(parseCliDataDir(['--data-dir=/tmp/x'])).toBe('/tmp/x')
  })

  it('ignores empty equals form', () => {
    expect(parseCliDataDir(['--data-dir='])).toBeNull()
  })

  it('ignores space-separated form', () => {
    expect(parseCliDataDir(['--data-dir', '/tmp/x'])).toBeNull()
  })

  it('returns null when absent', () => {
    expect(parseCliDataDir([])).toBeNull()
  })
})

describe('portableDir', () => {
  it('returns exeDir/data when portable.txt exists', () => {
    const exeDir = createTempDir('todolist-portable-')
    fs.writeFileSync(path.join(exeDir, 'portable.txt'), '')
    expect(portableDir(exeDir)).toBe(path.join(exeDir, 'data'))
    fs.rmSync(exeDir, { recursive: true, force: true })
  })

  it('returns null when portable.txt is absent', () => {
    const exeDir = createTempDir('todolist-portable-')
    expect(portableDir(exeDir)).toBeNull()
    fs.rmSync(exeDir, { recursive: true, force: true })
  })
})

describe('resolveDataDir priority', () => {
  let appDataDir: string
  let exeDir: string
  let defaultUserDataDir: string
  let tempDirs: string[]

  beforeEach(() => {
    appDataDir = createTempDir('todolist-appdata-')
    exeDir = createTempDir('todolist-exe-')
    defaultUserDataDir = createTempDir('todolist-default-')
    tempDirs = [appDataDir, exeDir, defaultUserDataDir]
  })

  afterEach(() => {
    for (const dir of tempDirs) {
      try {
        fs.rmSync(dir, { recursive: true, force: true })
      } catch {
        // ignore
      }
    }
  })

  function baseInput(): {
    env: NodeJS.ProcessEnv
    argv: string[]
    appDataDir: string
    exeDir: string
    defaultUserDataDir: string
  } {
    return {
      env: {},
      argv: [],
      appDataDir,
      exeDir,
      defaultUserDataDir,
    }
  }

  it('picks env TODO_USER_DATA_DIR at the highest priority', () => {
    const dir = createTempDir('todolist-env-')
    tempDirs.push(dir)
    const result = resolveDataDir({
      ...baseInput(),
      env: { TODO_USER_DATA_DIR: dir },
      argv: ['--data-dir=/ignored'],
    })
    expect(result.dir).toBe(dir)
    expect(result.source).toBe('env')
    expect(result.problem).toBeNull()
  })

  it('picks --data-dir= when env is absent', () => {
    const cliDir = createTempDir('todolist-cli-')
    tempDirs.push(cliDir)
    const result = resolveDataDir({
      ...baseInput(),
      argv: [`--data-dir=${cliDir}`],
    })
    expect(result.dir).toBe(cliDir)
    expect(result.source).toBe('cli')
    expect(result.problem).toBeNull()
  })

  it('falls through to config when no env or cli override is present', () => {
    const configDir = path.join(appDataDir, 'ToDoList')
    fs.mkdirSync(configDir, { recursive: true })
    const configured = createTempDir('todolist-config-')
    tempDirs.push(configured)
    fs.writeFileSync(
      path.join(configDir, 'config.json'),
      JSON.stringify({ version: 1, dataDir: configured }),
    )

    const result = resolveDataDir(baseInput())
    expect(result.dir).toBe(configured)
    expect(result.source).toBe('config')
    expect(result.problem).toBeNull()
  })

  it('picks portable.txt when no higher source wins', () => {
    fs.writeFileSync(path.join(exeDir, 'portable.txt'), '')
    const result = resolveDataDir(baseInput())
    expect(result.dir).toBe(path.join(exeDir, 'data'))
    expect(result.source).toBe('portable')
    expect(result.problem).toBeNull()
  })

  it('uses default userData when nothing else wins', () => {
    const result = resolveDataDir(baseInput())
    expect(result.dir).toBe(defaultUserDataDir)
    expect(result.source).toBe('default')
    expect(result.problem).toBeNull()
  })

  it('warns and ignores space-separated --data-dir', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const configured = createTempDir('todolist-config-space-')
    tempDirs.push(configured)
    const configDir = path.join(appDataDir, 'ToDoList')
    fs.mkdirSync(configDir, { recursive: true })
    fs.writeFileSync(
      path.join(configDir, 'config.json'),
      JSON.stringify({ version: 1, dataDir: configured }),
    )

    const result = resolveDataDir({
      ...baseInput(),
      argv: ['--data-dir', '/ignored'],
    })

    expect(result.dir).toBe(configured)
    expect(result.source).toBe('config')
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('--data-dir 需使用等号形式'),
    )
    warn.mockRestore()
  })
})

describe('resolveDataDir problems and fingerprints', () => {
  let appDataDir: string
  let defaultUserDataDir: string
  let tempDirs: string[]

  beforeEach(() => {
    appDataDir = createTempDir('todolist-prob-appdata-')
    defaultUserDataDir = createTempDir('todolist-prob-default-')
    tempDirs = [appDataDir, defaultUserDataDir]
  })

  afterEach(() => {
    for (const dir of tempDirs) {
      try {
        fs.rmSync(dir, { recursive: true, force: true })
      } catch {
        // ignore
      }
    }
  })

  function baseInput(): {
    env: NodeJS.ProcessEnv
    argv: string[]
    appDataDir: string
    exeDir: string
    defaultUserDataDir: string
  } {
    return {
      env: {},
      argv: [],
      appDataDir,
      exeDir: '/irrelevant/exe',
      defaultUserDataDir,
    }
  }

  function writeConfig(content: string): string {
    const configDir = path.join(appDataDir, 'ToDoList')
    fs.mkdirSync(configDir, { recursive: true })
    const file = path.join(configDir, 'config.json')
    fs.writeFileSync(file, content)
    return file
  }

  it('returns unreadable when the config file cannot be read', () => {
    if (process.platform === 'win32') {
      return
    }
    const file = writeConfig('{"version": 1, "dataDir": "/tmp"}')
    fs.chmodSync(file, 0o000)
    try {
      const result = resolveDataDir(baseInput())
      expect(result.problem?.kind).toBe('unreadable')
      expect(result.dir).toBe(defaultUserDataDir)
      expect(result.source).toBe('default')
    } finally {
      fs.chmodSync(file, 0o600)
    }
  })

  it('returns invalid-json for a malformed file with a fingerprint', () => {
    const content = '{"version": 1, "dataDir": "/x"'
    writeConfig(content)
    const result = resolveDataDir(baseInput())
    expect(result.problem?.kind).toBe('invalid-json')
    expect(result.problem?.fingerprint).toBe(fingerprintOf(content))
  })

  it('returns bad-version for a version higher than 1', () => {
    const content = '{"version": 2, "dataDir": "/x"}'
    writeConfig(content)
    const result = resolveDataDir(baseInput())
    expect(result.problem?.kind).toBe('bad-version')
    expect(result.problem?.fingerprint).toBe(fingerprintOf(content))
  })

  it('returns bad-version for a missing version', () => {
    const content = '{"dataDir": "/x"}'
    writeConfig(content)
    const result = resolveDataDir(baseInput())
    expect(result.problem?.kind).toBe('bad-version')
    expect(result.problem?.fingerprint).toBe(fingerprintOf(content))
  })

  it('returns bad-data-dir for a relative dataDir', () => {
    const content = '{"version": 1, "dataDir": "relative/path"}'
    writeConfig(content)
    const result = resolveDataDir(baseInput())
    expect(result.problem?.kind).toBe('bad-data-dir')
    expect(result.problem?.fingerprint).toBe(fingerprintOf(content))
  })

  it('returns bad-data-dir for a dataDir containing ~', () => {
    const content = '{"version": 1, "dataDir": "~/data"}'
    writeConfig(content)
    const result = resolveDataDir(baseInput())
    expect(result.problem?.kind).toBe('bad-data-dir')
    expect(result.problem?.fingerprint).toBe(fingerprintOf(content))
  })

  it('returns bad-data-dir for a non-string dataDir', () => {
    const content = '{"version": 1, "dataDir": 123}'
    writeConfig(content)
    const result = resolveDataDir(baseInput())
    expect(result.problem?.kind).toBe('bad-data-dir')
    expect(result.problem?.fingerprint).toBe(fingerprintOf(content))
  })

  it('returns unusable-dir when the configured directory is rejected by validation', () => {
    const content = '{"version": 1, "dataDir": "/usr/local/share"}'
    writeConfig(content)
    const result = resolveDataDir({
      ...baseInput(),
      validate: () => 'system-dir',
    })
    expect(result.problem?.kind).toBe('unusable-dir')
    expect(result.problem?.fingerprint).toBe(fingerprintOf(content))
    expect(result.dir).toBe(defaultUserDataDir)
    expect(result.source).toBe('default')
  })

  it('does not mutate a broken config file', () => {
    const content = '{"version": 2, "dataDir": "/x"}'
    const file = writeConfig(content)
    const before = fs.readFileSync(file)
    const entriesBefore = fs.readdirSync(path.dirname(file))

    resolveDataDir(baseInput())

    const after = fs.readFileSync(file)
    const entriesAfter = fs.readdirSync(path.dirname(file))
    expect(after.equals(before)).toBe(true)
    expect(entriesAfter).toEqual(entriesBefore)
  })
})

describe('writeConfigAtomic', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = createTempDir('todolist-write-')
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('writes exactly version and dataDir keys', () => {
    const file = path.join(tempDir, 'config.json')
    writeConfigAtomic(file, { version: 1, dataDir: '/tmp/data' })
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'))
    expect(Object.keys(parsed)).toEqual(['version', 'dataDir'])
    expect(parsed.version).toBe(1)
    expect(parsed.dataDir).toBe('/tmp/data')
  })

  it('drops unknown keys on overwrite', () => {
    const file = path.join(tempDir, 'config.json')
    fs.writeFileSync(
      file,
      JSON.stringify({ version: 1, dataDir: '/old', extra: 'x' }),
    )
    writeConfigAtomic(file, { version: 1, dataDir: '/new' })
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'))
    expect(Object.keys(parsed)).toEqual(['version', 'dataDir'])
    expect(parsed.dataDir).toBe('/new')
  })

  it('leaves no temporary file behind', () => {
    const file = path.join(tempDir, 'config.json')
    writeConfigAtomic(file, { version: 1, dataDir: '/tmp/data' })
    const entries = fs.readdirSync(tempDir)
    expect(entries).toEqual(['config.json'])
  })
})
