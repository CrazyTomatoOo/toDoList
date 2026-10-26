import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const PROBE_FILE_NAME = '.todolist-write-probe'

const NETWORK_FS_NAMES: Record<string, true> = {
  smbfs: true,
  cifs: true,
  smb: true,
  smb2: true,
  smb3: true,
  nfs: true,
  nfsd: true,
  afpfs: true,
  afp: true,
  webdav: true,
  ncpenfs: true,
}

const NETWORK_FS_MAGIC = new Set([
  0xff534d42, // CIFS
  0xfe534d42, // SMB2
  0x6969, // NFS
  0x696e, // NFSD
])

export type ValidationFailure =
  | 'not-absolute'
  | 'unc-or-network'
  | 'system-dir'
  | 'inside-resources'
  | 'unwritable'

function resolveNearestExisting(dir: string): string {
  let current = dir
  const tail: string[] = []

  for (;;) {
    try {
      const base = fs.realpathSync(current)
      return tail.length > 0 ? path.join(base, ...tail) : base
    } catch {
      const parent = path.dirname(current)
      if (parent === current || (current.startsWith('//') && parent === '/')) {
        return dir
      }
      tail.unshift(path.basename(current))
      current = parent
    }
  }
}

function isUncOrNetwork(dir: string): boolean {
  if (process.platform === 'win32') {
    return dir.startsWith('\\\\')
  }
  return dir.startsWith('//')
}

function countLeadingSlashes(dir: string): number {
  let count = 0
  for (let index = 0; index < dir.length && dir[index] === '/'; index++) {
    count++
  }
  return count
}

function isInside(
  child: string,
  parent: string,
  platform: NodeJS.Platform,
): boolean {
  const normalChild = platform === 'win32' ? child.toLowerCase() : child
  const normalParent = platform === 'win32' ? parent.toLowerCase() : parent
  return (
    normalChild === normalParent ||
    normalChild.startsWith(normalParent + path.sep)
  )
}

function getSystemDirs(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
): string[] {
  if (platform !== 'win32') {
    return ['/System', '/usr']
  }

  const candidates = [env.WINDIR, env.ProgramFiles, env['ProgramFiles(x86)']]
    .filter(
      (value): value is string => typeof value === 'string' && value.length > 0,
    )
    .map((value) => value.trim())

  return candidates.length > 0
    ? candidates
    : ['C:\\Windows', 'C:\\Program Files']
}

function isNetworkMount(dir: string): boolean {
  try {
    const stats = fs.statfsSync(dir)
    if (stats && typeof stats === 'object' && 'type' in stats) {
      const type = stats.type
      if (typeof type === 'string' && type in NETWORK_FS_NAMES) {
        return true
      }
      if (typeof type === 'number' && NETWORK_FS_MAGIC.has(type)) {
        return true
      }
    }
  } catch {
    // fall through to prefix-based checks elsewhere
  }
  return false
}

export function validateDataDir(
  dir: string,
  opts: { resourcesDir?: string; env?: NodeJS.ProcessEnv } = {},
): ValidationFailure | null {
  if (!path.isAbsolute(dir)) {
    return 'not-absolute'
  }

  const platform = process.platform
  const env = opts.env ?? process.env

  const normalized = path.resolve(dir)
  const original = dir
  if (
    isUncOrNetwork(original) ||
    countLeadingSlashes(original) >= 2 ||
    isUncOrNetwork(normalized) ||
    countLeadingSlashes(normalized) >= 2
  ) {
    return 'unc-or-network'
  }

  const resolved = resolveNearestExisting(normalized)
  if (isUncOrNetwork(resolved) || countLeadingSlashes(resolved) >= 2) {
    return 'unc-or-network'
  }

  if (isNetworkMount(path.dirname(resolved))) {
    return 'unc-or-network'
  }

  for (const systemDir of getSystemDirs(platform, env)) {
    if (isInside(resolved, systemDir, platform)) {
      return 'system-dir'
    }
  }

  if (opts.resourcesDir) {
    const resolvedResources = resolveNearestExisting(opts.resourcesDir)
    if (isInside(resolved, resolvedResources, platform)) {
      return 'inside-resources'
    }
  }

  try {
    fs.mkdirSync(resolved, { recursive: true })
    const probe = path.join(resolved, PROBE_FILE_NAME)
    fs.writeFileSync(probe, '')
    fs.rmSync(probe, { force: true })
  } catch {
    return 'unwritable'
  }

  return null
}
